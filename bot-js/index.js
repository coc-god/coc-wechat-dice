'use strict'

const { WechatyBuilder } = require('wechaty')
const { PuppetWechat4u } = require('wechaty-puppet-wechat4u')
const { handleCommand } = require('./handlers/messageHandler')
const aiKp  = require('./aiKp')
const store = require('./storage/jsonStore')
const { skillCheck } = require('./dice/skillCheck')
const { quoteForLevel } = require('./shakespeare')

let players = store.load()

const bot = WechatyBuilder.build({
  name: 'coc-dice-bot',
  puppet: new PuppetWechat4u(),
})

bot.on('scan', (qrcode, status) => {
  const url = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`
  console.log(`\n[扫码登录] 状态: ${status}`)
  console.log(`扫描二维码: ${url}\n`)
})

bot.on('login', user => {
  console.log(`[登录成功] ${user}`)
})

bot.on('logout', user => {
  console.log(`[已登出] ${user}`)
})

// Deduplicate messages — protects against multiple bot instances or Wechaty double-delivery
const seenMsgIds = new Set()

bot.on('message', async msg => {
  const msgId = msg.id
  if (seenMsgIds.has(msgId)) {
    console.log(`[重复消息已忽略] id=${msgId}`)
    return
  }
  seenMsgIds.add(msgId)
  setTimeout(() => seenMsgIds.delete(msgId), 120_000)

  console.log(`[消息] self=${msg.self()} room=${!!msg.room()} text=${msg.text().slice(0, 50)}`)

  if (msg.self()) return

  const room = msg.room()
  if (!room) return

  const text = msg.text().trim()
  const talker = msg.talker()
  const contactId = talker.id
  const roomId = room.id
  const playerName = talker.name()

  if (!text.startsWith('.')) {
    if (aiKp.isActive(roomId)) await handleAiMessage(text, room, talker, roomId, playerName)
    return
  }

  const response = handleCommand(text, contactId, roomId, playerName)
  if (!response) return

  if (typeof response === 'string') {
    await room.say(response)
  } else {
    // { group?, dm?, aiKickoff? }
    if (response.dm) {
      try {
        await talker.say(response.dm)
      } catch (e) {
        if (response.group) response.group += '\n(私信发送失败，请先添加骰娘为好友)'
        else await room.say(`@${playerName}\n❌ 私信发送失败，请先添加骰娘为好友`)
      }
    }
    if (response.group) await room.say(response.group)
    if (response.aiKickoff) {
      await handleAiMessage('[系统·开场指令] 请用300字左右描述调查员抵达的开场场景。要求：①以丰富的感官细节（视觉、听觉、嗅觉、触觉）营造真实、温馨、舒适的氛围，让玩家先放松下来；②主要NPC要完整地完成初次见面的社交礼节——热情迎接、自我介绍、寒暄、引导入住，对话要自然流畅；③本场景全程不出现任何诡异、警告或不适元素，完全正常；④结尾以NPC的一个具体问题或邀请结束，等待玩家回应。', room, talker, roomId, 'KP')
    }
  }
})

async function handleAiMessage(text, room, talker, roomId, playerName) {
  try {
    const raw     = await aiKp.chat(roomId, `${playerName}: ${text}`)
    const cleaned = aiKp.stripThinking(raw)
    const visible = aiKp.stripChecks(cleaned)
    const checks  = aiKp.parseChecks(cleaned)

    if (visible) {
      console.log(`[AI回复] ${visible.slice(0, 100)}`)
      await room.say(visible)
    }

    for (const check of checks) {
      // Use player's saved skill value if available, fall back to AI-specified value
      const player     = store.getPlayer(players, talker.id, roomId, playerName)
      const savedValue = player.skills[check.skill] ?? player.stats[check.skill]
      const skillValue = savedValue ?? check.value
      const valueNote  = savedValue !== undefined ? '' : `（人物卡未找到，使用KP默认值${check.value}）`

      const result   = skillCheck(check.skill, skillValue)
      const rollMsg  = `🎲 ${playerName} | ${result.details}${valueNote}\n${quoteForLevel(result.successLevel)}`
      await room.say(rollMsg)

      // Feed result back so AI can narrate the outcome
      const feedback  = `[系统] ${playerName} 的${check.skill}检定：骰出${result.roll}，目标值${skillValue}，结果【${result.successLevel}】。请根据结果继续叙述。`
      const followRaw = await aiKp.chat(roomId, feedback)
      const followMsg = aiKp.stripChecks(aiKp.stripThinking(followRaw))
      if (followMsg) await room.say(followMsg)
    }
  } catch (e) {
    console.error('[AI KP]', e.message)
    await room.say('⚠️ AI守秘人无响应，请确认 Ollama 正在运行（ollama serve）')
  }
}

bot.on('error', err => console.error('[错误]', err))

console.log('CoC 7.0 骰娘启动中...')
bot.start()
