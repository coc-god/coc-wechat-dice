'use strict'

const { WechatyBuilder } = require('wechaty')
const { PuppetWechat4u } = require('wechaty-puppet-wechat4u')
const { handleCommand } = require('./handlers/messageHandler')
const aiKp = require('./aiKp')
const { skillCheck } = require('./dice/skillCheck')
const { quoteForLevel } = require('./shakespeare')

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

bot.on('message', async msg => {
  console.log(`[消息] self=${msg.self()} room=${!!msg.room()} text=${msg.text().slice(0, 50)}`)

  if (msg.self()) return

  const room = msg.room()
  if (!room) return

  const text = msg.text().trim()

  if (!text.startsWith('.')) {
    if (aiKp.isActive(roomId)) await handleAiMessage(text, room, talker, roomId, playerName)
    return
  }

  const talker = msg.talker()
  const contactId = talker.id
  const roomId = room.id
  const playerName = talker.name()

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
      await handleAiMessage('[系统] 请用中文描述玩家所处的开场场景，开始本次冒险。', room, talker, roomId, 'KP')
    }
  }
})

async function handleAiMessage(text, room, talker, roomId, playerName) {
  try {
    const raw     = await aiKp.chat(roomId, `${playerName}: ${text}`)
    const cleaned = aiKp.stripThinking(raw)
    const visible = aiKp.stripChecks(cleaned)
    const checks  = aiKp.parseChecks(cleaned)

    if (visible) await room.say(visible)

    for (const check of checks) {
      const result   = skillCheck(check.skill, check.value)
      const rollMsg  = `🎲 ${playerName} | ${result.details}\n${quoteForLevel(result.successLevel)}`
      await room.say(rollMsg)

      // Feed result back so AI can narrate the outcome
      const feedback  = `[系统] ${playerName} 的${check.skill}检定：骰出${result.roll}，目标值${check.value}，结果【${result.successLevel}】。请根据结果继续叙述。`
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
