'use strict'

const { WechatyBuilder } = require('wechaty')
const { PuppetWechat4u } = require('wechaty-puppet-wechat4u')
const { handleCommand, handleTemplate } = require('./handlers/messageHandler')

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

  const mentionSelf = await msg.mentionSelf()
  console.log(`[消息] mentionSelf=${mentionSelf}`)
  if (!mentionSelf) return

  const text = (await msg.mentionText()).trim()
  console.log(`[消息] mentionText="${text}"`)
  if (!text) return

  const talker = msg.talker()
  const contactId = talker.id
  const roomId = room.id
  const playerName = talker.name()

  if (text.trim().toLowerCase() === '.template') {
    try {
      await talker.say(handleTemplate(contactId, roomId, playerName))
      await room.say(`@${playerName} 已私信发送人物卡模板，填好后在群里 @我 发送 .st 指令批量录入`)
    } catch (e) {
      await room.say(`@${playerName} 私信发送失败，请先添加骰娘为好友后重试`)
    }
    return
  }

  const response = handleCommand(text, contactId, roomId, playerName)
  if (response) await room.say(response)
})

bot.on('error', err => console.error('[错误]', err))

console.log('CoC 7.0 骰娘启动中...')
bot.start()
