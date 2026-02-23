'use strict'

const { rollExpression, rollD100 } = require('../dice/roller')
const { skillCheck } = require('../dice/skillCheck')
const { sanCheck } = require('../dice/sanCheck')
const { opposedRoll } = require('../dice/opposed')
const { fightingCheck, firearmsCheck, dodgeCheck, damageRoll } = require('../dice/combat')
const { generateCharacters, formatStats, STAT_NAMES, STAT_ORDER } = require('../dice/charGen')
const { spendLuck } = require('../dice/luck')
const store = require('../storage/jsonStore')
const { quoteForLevel, quoteForRoll } = require('../shakespeare')
const npcs  = require('../npcs')
const aiKp  = require('../aiKp')

// CN stat name → EN key (for routing batch .st to player.stats)
const CN_TO_EN = { '力量':'STR', '体质':'CON', '体型':'SIZ', '敏捷':'DEX', '外貌':'APP', '智力':'INT', '意志':'POW', '教育':'EDU' }

const TEMPLATE_FULL =
`【CoC 7.0 人物卡录入模板】
复制下方指令，将数字 0 改为实际属性值，在群里 @我 发送：

.st 力量 0 体质 0 体型 0 敏捷 0 外貌 0 智力 0 意志 0 教育 0 幸运 0 SAN 0 侦查 0 图书馆使用 0 话术 0 聆听 0 急救 0 闪避 0 格斗 0 射击 0 心理学 0

━━ 投骰参考 ━━
力量/体质/敏捷/外貌/意志: 3d6×5
体型/智力/教育: (2d6+6)×5
幸运: 3d6×5 (单独投)
SAN初始值 = 意志(POW)值`

const TEMPLATE_SKILLS_ONLY =
`【CoC 7.0 技能录入模板】
检测到已用 .coc 保存了基础属性，只需补充技能即可：

.st 侦查 0 图书馆使用 0 话术 0 聆听 0 急救 0 闪避 0 格斗 0 射击 0 心理学 0

将 0 改为实际技能点，在群里 @我 发送即可`

function handleTemplate(contactId, roomId, playerName) {
  const player = store.getPlayer(players, contactId, roomId, playerName)
  const hasStats = STAT_ORDER.filter(k => k !== 'LUCK').some(k => player.stats[STAT_NAMES[k]] !== undefined)
  return hasStats ? TEMPLATE_SKILLS_ONLY : TEMPLATE_FULL
}

let players = store.load()
let rooms   = store.loadRooms()

// In-memory pending .coc results: key → array of stat sets
const pendingCoc = new Map()

function parseCommand(text) {
  text = text.trim()
  if (!text.startsWith('.')) return ['', '']
  const parts = text.split(/\s+/)
  const first = parts[0].toLowerCase()
  const rest = parts.slice(1).join(' ')

  // Handle .rd6, .r2d6, .r3d6+2 etc.
  const glued = first.match(/^\.r([d\d].*)$/)
  if (glued && !['rd', 'roll', 'rc'].some(s => first === '.' + s)) {
    return ['.r', glued[1] + (rest ? ' ' + rest : '')]
  }

  return [first, rest]
}

function handleCommand(text, contactId, roomId, playerName) {
  const [cmd, args] = parseCommand(text)
  if (!cmd) return null

  const player = store.getPlayer(players, contactId, roomId, playerName)
  const result = dispatch(cmd, args, player, contactId, roomId, playerName)
  if (result === null) return null

  store.save(players)
  store.saveRooms(rooms)

  // Result is either a plain string or { group?, dm?, aiKickoff? }
  if (typeof result === 'string') return `@${playerName}\n${result}`
  return {
    group:      result.group ? `@${playerName}\n${result.group}` : null,
    dm:         result.dm ?? null,
    aiKickoff:  result.aiKickoff ?? false,
  }
}

function dispatch(cmd, args, player, contactId, roomId, playerName) {
  if (['.r', '.rd', '.roll'].includes(cmd)) return handleRoll(args, player)
  if (cmd === '.rc') return handleSkillCheck(args, player)
  if (cmd === '.sc' || cmd === '.san') return handleSanCheck(args, player)
  if (cmd === '.rop') return handleOpposed(args)
  if (cmd === '.fight') return handleCombat('fight', args, player)
  if (cmd === '.fire') return handleCombat('fire', args, player)
  if (cmd === '.dodge') return handleCombat('dodge', args, player)
  if (cmd === '.dmg') return handleDamage(args)
  if (cmd === '.coc') return handleCoc(args, contactId, roomId)
  if (cmd === '.save') return handleSave(args, player, contactId, roomId)
  if (cmd === '.st') return handleSt(args, player)
  if (cmd === '.show') return handleShow(player)
  if (cmd === '.luck') return handleLuck(args, player)
  if (cmd === '.template') return handleTemplateCmd(contactId, roomId, playerName)
  if (cmd === '.kp') return handleKp(args, player, contactId, roomId, playerName)
  if (cmd === '.help') return helpText(args)
  return null
}

function handleRoll(args, player) {
  if (!args.trim()) {
    const r = rollD100()
    player.last_roll = r.total
    return `🎲 d100 = ${r.total}\n${quoteForRoll(r.total)}`
  }
  const result = rollExpression(args)
  player.last_roll = result.total
  return `🎲 ${result.details}\n${quoteForRoll(result.total)}`
}

function handleSkillCheck(args, player) {
  // Try: skill value [b/p]
  const mFull = args.trim().match(/^(\S+)\s+(\d+)\s*(?:(b|p)(\d*))?$/i)
  if (mFull) {
    const skillName = mFull[1], skillValue = parseInt(mFull[2])
    const bpType = mFull[3], bpCount = mFull[4] ? parseInt(mFull[4]) : 1
    const bonus   = bpType?.toLowerCase() === 'b' ? bpCount : 0
    const penalty = bpType?.toLowerCase() === 'p' ? bpCount : 0
    const result = skillCheck(skillName, skillValue, bonus, penalty)
    player.last_roll = result.roll
    player.last_skill_name = result.skillName
    player.last_skill_value = result.skillValue
    return `${result.details}\n${quoteForLevel(result.successLevel)}`
  }

  // Try: skill [b/p] — look up value from saved sheet
  const mName = args.trim().match(/^(\S+)\s*(?:(b|p)(\d*))?$/i)
  if (mName) {
    const skillName = mName[1]
    const saved = player.skills[skillName] ?? player.stats[skillName]
    if (saved === undefined) return `❌ 未找到技能「${skillName}」，请先用 .st ${skillName} 值 保存`
    const bpType = mName[2], bpCount = mName[3] ? parseInt(mName[3]) : 1
    const bonus   = bpType?.toLowerCase() === 'b' ? bpCount : 0
    const penalty = bpType?.toLowerCase() === 'p' ? bpCount : 0
    const result = skillCheck(skillName, saved, bonus, penalty)
    player.last_roll = result.roll
    player.last_skill_name = result.skillName
    player.last_skill_value = result.skillValue
    return `${result.details}\n${quoteForLevel(result.successLevel)}`
  }

  return '❌ 格式: .rc 技能名 目标值 [b/p[数量]]\n或已保存技能: .rc 技能名 [b/p]'
}

function handleSanCheck(args, player) {
  const m = args.trim().match(/^(\d+)\s+(\S+)\/(\S+)$/)
  if (!m) return '❌ 格式: .sc SAN值 成功损失/失败损失\n例: .sc 55 1d3/1d10'
  const result = sanCheck(parseInt(m[1]), m[2], m[3])
  player.san = result.newSan
  player.last_roll = result.roll
  return `${result.details}\n${quoteForLevel(result.passed ? '成功' : '失败')}`
}

function handleOpposed(args) {
  const m = args.trim().match(/^(\S+)\s+(\d+)\s+vs\s+(\S+)\s+(\d+)$/i)
  if (!m) return '❌ 格式: .rop 技能1 值1 vs 技能2 值2'
  return opposedRoll(m[1], parseInt(m[2]), m[3], parseInt(m[4])).details
}

function handleCombat(kind, args, player) {
  const m = args.trim().match(/^(\d+)\s*(?:(b|p)(\d*))?$/i)
  if (!m) return `❌ 格式: .${kind} 技能值 [b/p[数量]]`
  const skillValue = parseInt(m[1])
  const bpType = m[2], bpCount = m[3] ? parseInt(m[3]) : 1
  const bonus   = bpType?.toLowerCase() === 'b' ? bpCount : 0
  const penalty = bpType?.toLowerCase() === 'p' ? bpCount : 0
  const fn = { fight: fightingCheck, fire: firearmsCheck, dodge: dodgeCheck }[kind]
  const result = fn(skillValue, bonus, penalty)
  player.last_roll = result.roll
  player.last_skill_name = result.skillName
  player.last_skill_value = skillValue
  return `${result.details}\n${quoteForLevel(result.successLevel)}`
}

function handleDamage(args) {
  if (!args.trim()) return '❌ 格式: .dmg 表达式 (如 1d3+1d4)'
  return damageRoll(args.trim()).details
}

function handleCoc(args, contactId, roomId) {
  const count = /^\d+$/.test(args.trim()) ? parseInt(args.trim()) : 1
  const { text, sets } = generateCharacters(count)
  const key = `${contactId}:${roomId}`
  pendingCoc.set(key, sets)

  const hint = sets.length === 1
    ? '输入 .save 确认保存到人物卡'
    : `输入 .save 1 ~ .save ${sets.length} 选择保存到人物卡`
  return `${text}\n\n📌 ${hint}`
}

function handleSave(args, player, contactId, roomId) {
  const key = `${contactId}:${roomId}`
  const sets = pendingCoc.get(key)
  if (!sets) return '❌ 没有待保存的属性，请先使用 .coc 生成'

  const idx = /^\d+$/.test(args.trim()) ? parseInt(args.trim()) - 1 : 0
  if (idx < 0 || idx >= sets.length) return `❌ 请输入 1 到 ${sets.length} 之间的数字`

  const chosen = sets[idx]
  // Save main stats; set luck from stats
  player.stats = {}
  for (const key of STAT_ORDER) {
    if (key === 'LUCK') {
      player.luck = chosen[key]
    } else {
      player.stats[STAT_NAMES[key]] = chosen[key]
      player.stats[key] = chosen[key]  // store both CN and EN keys
    }
  }
  player.san = chosen.POW  // SAN starts at POW

  pendingCoc.delete(key)
  return `✅ 人物卡已保存！\n${formatStats(chosen)}\n\n初始SAN已设为POW值: ${chosen.POW}\n幸运已设为: ${chosen.LUCK}`
}

const STATS_3D6  = new Set(['STR', 'CON', 'DEX', 'APP', 'POW'])  // roll 3d6×5: 15–90
const STATS_2D6P6 = new Set(['SIZ', 'INT', 'EDU'])               // roll (2d6+6)×5: 40–90

// Hard check — returns error string or null
function hardValidate(name, val) {
  if (val < 0 || val > 99) return `「${name}」值 ${val} 超出有效范围 (0–99)`
  return null
}

// Soft check — returns warning string or null (saves regardless)
function softValidate(name, val, player) {
  const enKey = CN_TO_EN[name] ?? (name === 'LUCK' || name === '幸运' ? 'LUCK' : null)

  if (enKey && STATS_3D6.has(enKey)) {
    if (val > 90) return `${name} ${val} 超过3d6×5上限(90)`
    if (val < 15) return `${name} ${val} 低于3d6×5下限(15)`
  }
  if (enKey && STATS_2D6P6.has(enKey)) {
    if (val > 90) return `${name} ${val} 超过(2d6+6)×5上限(90)`
    if (val < 40) return `${name} ${val} 低于(2d6+6)×5下限(40)`
  }
  if (enKey === 'LUCK' || name === '幸运') {
    if (val > 90) return `幸运 ${val} 超过3d6×5上限(90)`
    if (val < 15) return `幸运 ${val} 低于3d6×5下限(15)`
  }

  // SAN should not exceed POW
  if (name === 'SAN' || name === '理智') {
    const pow = player.stats['意志'] ?? player.stats['POW']
    if (pow !== undefined && val > pow) return `SAN ${val} 超过当前意志值(${pow})，初始SAN上限=意志`
  }

  return null
}

function setStat(player, name, val) {
  if (name === '幸运' || name === 'LUCK') {
    player.luck = val
  } else if (name === 'SAN' || name === '理智') {
    player.san = val
  } else if (CN_TO_EN[name]) {
    const enKey = CN_TO_EN[name]
    player.stats[STAT_NAMES[enKey]] = val  // CN key
    player.stats[enKey] = val              // EN key
  } else {
    player.skills[name] = val
  }
}

function handleSt(args, player) {
  const tokens = args.trim().split(/\s+/)
  if (tokens.length < 2 || tokens.length % 2 !== 0) {
    return '❌ 格式: .st 技能名 值\n或批量: .st 名1 值1 名2 值2 ...'
  }

  // Parse all pairs and hard-validate first — reject on any error before saving anything
  const pairs = []
  for (let i = 0; i < tokens.length; i += 2) {
    const name = tokens[i], valStr = tokens[i + 1]
    if (!/^\d+$/.test(valStr)) return `❌ 「${name}」的值无效: "${valStr}"`
    const val = parseInt(valStr)
    const err = hardValidate(name, val)
    if (err) return `❌ ${err}`
    pairs.push({ name, val })
  }

  // All valid — save and collect soft warnings
  const saved = [], warnings = []
  for (const { name, val } of pairs) {
    setStat(player, name, val)
    saved.push(`${name}=${val}`)
    const w = softValidate(name, val, player)
    if (w) warnings.push(w)
  }

  let result = saved.length === 1
    ? `✅ 已保存: ${saved[0]}`
    : `✅ 已批量保存 ${saved.length} 项:\n` + saved.join('  ')

  if (warnings.length) result += '\n\n⚠️ 数值异常提示:\n' + warnings.map(w => `  · ${w}`).join('\n')
  return result
}

function handleShow(player) {
  const lines = ['📋 我的人物卡']

  const statKeys = STAT_ORDER.filter(k => k !== 'LUCK')
  const hasStats = statKeys.some(k => player.stats[STAT_NAMES[k]] !== undefined)
  if (hasStats) {
    lines.push('【基础属性】')
    for (const k of statKeys) {
      const v = player.stats[STAT_NAMES[k]] ?? player.stats[k]
      if (v !== undefined) lines.push(`  ${STAT_NAMES[k]}(${k}): ${v}`)
    }
  }

  const skillEntries = Object.entries(player.skills)
  if (skillEntries.length) {
    lines.push('【技能】')
    for (const [name, val] of skillEntries) lines.push(`  ${name}: ${val}`)
  }

  lines.push(`【其他】\n  SAN: ${player.san}  幸运: ${player.luck}`)

  if (!hasStats && !skillEntries.length) return '📋 人物卡为空\n用 .coc 生成属性，或 .st 技能名 值 手动录入'
  return lines.join('\n')
}

function handleLuck(args, player) {
  const parts = args.trim().split(/\s+/)
  if (!parts[0]) return `🍀 当前幸运: ${player.luck}\n用法: .luck set 值 / .luck spend 数量 技能名 技能值`
  const sub = parts[0].toLowerCase()
  if (sub === 'set' && parts[1] && /^\d+$/.test(parts[1])) {
    player.luck = parseInt(parts[1])
    return `🍀 幸运值已设置为: ${player.luck}`
  }
  if (sub === 'spend' && parts.length >= 4) {
    const amount = parseInt(parts[1]), skillName = parts[2], skillValue = parseInt(parts[3])
    if (isNaN(amount) || isNaN(skillValue)) return '❌ 格式: .luck spend 数量 技能名 技能值'
    if (player.last_roll === null) return '❌ 没有找到上次检定记录'
    const result = spendLuck(player.luck, amount, skillName, player.last_roll, skillValue)
    if (result.success) { player.luck = result.newLuck; player.last_roll = result.newRoll }
    return result.details
  }
  return '❌ 用法: .luck set 值 / .luck spend 数量 技能名 技能值'
}

function handleTemplateCmd(contactId, roomId, playerName) {
  const player = store.getPlayer(players, contactId, roomId, playerName)
  const hasStats = STAT_ORDER.filter(k => k !== 'LUCK').some(k => player.stats[STAT_NAMES[k]] !== undefined)
  return {
    group: '已私信发送人物卡模板，填好后在群里 @我 发送 .st 指令批量录入',
    dm:    hasStats ? TEMPLATE_SKILLS_ONLY : TEMPLATE_FULL,
  }
}

// ── KP ────────────────────────────────────────────────────────────────────

function isKp(contactId, roomId) {
  return store.getKp(rooms, roomId)?.contactId === contactId
}

function handleKp(args, player, contactId, roomId, playerName) {
  const parts = args.trim().split(/\s+/)
  const sub  = parts[0]?.toLowerCase() ?? ''
  const rest = parts.slice(1).join(' ')

  if (!sub) return kpStatus(roomId)
  if (sub === 'claim')  return kpClaim(contactId, roomId, playerName)
  if (sub === 'resign') return kpResign(contactId, roomId)
  if (sub === 'ai')     return handleKpAi(rest, contactId, roomId)

  // Commands below require KP
  if (!isKp(contactId, roomId)) {
    const kp = store.getKp(rooms, roomId)
    return kp
      ? `❌ 需要KP权限 (当前KP: ${kp.playerName})`
      : '❌ 需要KP权限，先用 .kp claim 认领KP'
  }

  if (sub === 'rc')  return kpSecretRoll(rest, player)
  if (sub === 'npc') return kpNpcRoll(rest)
  if (sub === 'sc')  return kpNpcSan(rest)
  return kpStatus(roomId)
}

function handleKpAi(args, contactId, roomId) {
  if (!isKp(contactId, roomId)) {
    const kp = store.getKp(rooms, roomId)
    return kp ? `❌ 需要KP权限 (当前KP: ${kp.playerName})` : '❌ 需要KP权限，先用 .kp claim 认领KP'
  }

  const parts = args.trim().split(/\s+/)
  const sub   = parts[0]?.toLowerCase() ?? ''
  const content = parts.slice(1).join(' ')

  if (!sub || sub === 'status') {
    const active = aiKp.isActive(roomId)
    return active
      ? '🤖 AI守秘人运行中\n.kp ai stop — 停止 | .kp ai clear — 清除历史'
      : '🤖 AI守秘人未启动\n.kp ai start [团本简介] — 启动'
  }
  if (sub === 'start' || sub === 'load') {
    aiKp.activate(roomId, content)
    const note = content ? '已加载团本，' : ''
    return { group: `🤖 ${note}AI守秘人已启动！\n玩家直接发消息即可与KP互动\n.kp ai stop — 停止 | .kp ai clear — 清除历史`, aiKickoff: true }
  }
  if (sub === 'stop') {
    aiKp.deactivate(roomId)
    return '🤖 AI守秘人已停止'
  }
  if (sub === 'clear') {
    aiKp.clearHistory(roomId)
    return '🤖 对话历史已清除，从下一条消息重新开始'
  }
  return '❌ 用法: .kp ai start [团本] / .kp ai stop / .kp ai clear / .kp ai status'
}

function kpStatus(roomId) {
  const kp = store.getKp(rooms, roomId)
  const line = kp ? `当前KP: ${kp.playerName}` : '当前无KP'
  return `👁 ${line}\n━━━━━━━━━━━━━━━━\n` +
    '.kp claim — 认领KP\n' +
    '.kp resign — 放弃KP\n' +
    '【KP专属】\n' +
    '.kp rc 技能 值 [b/p] — 秘密检定 (私信结果)\n' +
    '.kp npc list — 预设怪物列表\n' +
    '.kp npc 怪物名 — 查看怪物数据\n' +
    '.kp npc 怪物名 技能 [值] [b/p] — NPC检定\n' +
    '.kp sc SAN值 成功损失/失败损失 — NPC理智检定'
}

function kpClaim(contactId, roomId, playerName) {
  const existing = store.getKp(rooms, roomId)
  if (existing && existing.contactId !== contactId) return `❌ ${existing.playerName} 已是本场KP`
  store.setKp(rooms, roomId, contactId, playerName)
  return `👁 ${playerName} 成为本场KP`
}

function kpResign(contactId, roomId) {
  const kp = store.getKp(rooms, roomId)
  if (!kp) return '❌ 当前没有KP'
  if (kp.contactId !== contactId) return `❌ 你不是当前KP (当前KP: ${kp.playerName})`
  store.clearKp(rooms, roomId)
  return '👁 KP已卸任'
}

function kpSecretRoll(args, player) {
  // .kp rc 技能名 值 [b/p]
  const m = args.trim().match(/^(\S+)\s+(\d+)\s*(?:(b|p)(\d*))?$/i)
  if (!m) return '❌ 格式: .kp rc 技能名 目标值 [b/p[数量]]'
  const skillName = m[1], skillValue = parseInt(m[2])
  const bpType = m[3], bpCount = m[4] ? parseInt(m[4]) : 1
  const bonus   = bpType?.toLowerCase() === 'b' ? bpCount : 0
  const penalty = bpType?.toLowerCase() === 'p' ? bpCount : 0
  const result = skillCheck(skillName, skillValue, bonus, penalty)
  player.last_roll = result.roll
  return {
    group: `🔒 KP 进行了秘密检定`,
    dm:    `🔒 [秘密检定结果]\n${result.details}\n${quoteForLevel(result.successLevel)}`,
  }
}

function kpNpcRoll(args) {
  const parts = args.trim().split(/\s+/)

  // .kp npc list
  if (parts[0]?.toLowerCase() === 'list') {
    return `📋 预设怪物:\n  ${npcs.list()}\n用法: .kp npc 怪物名 技能名 [值] [b/p]`
  }

  const npcName = parts[0]
  if (!npcName) return '❌ 格式: .kp npc 怪物名 技能名 [值]\n或: .kp npc list'

  const monster = npcs.find(npcName)

  // .kp npc 怪物名  → show stat sheet
  if (parts.length === 1) {
    if (!monster) return `❌ 未找到预设怪物「${npcName}」，输入 .kp npc list 查看列表`
    return npcs.sheet(npcName, monster)
  }

  // Determine skill name, value, and b/p
  const skillName = parts[1]
  let skillValue, bpToken

  if (parts[2] && /^\d+$/.test(parts[2])) {
    // explicit value: NPC名 技能名 值 [b/p]
    skillValue = parseInt(parts[2])
    bpToken = parts[3]
  } else {
    // auto-lookup: NPC名 技能名 [b/p]
    bpToken = parts[2]
    if (monster?.skills[skillName] !== undefined) {
      skillValue = monster.skills[skillName]
    } else {
      return monster
        ? `❌ 「${npcName}」没有预设技能「${skillName}」\n可用: ${Object.keys(monster.skills).join('、')}`
        : `❌ 未知怪物「${npcName}」需手动填值: .kp npc ${npcName} ${skillName} 目标值`
    }
  }

  const bpMatch = bpToken?.match(/^(b|p)(\d*)$/i)
  const bonus   = bpMatch?.[1]?.toLowerCase() === 'b' ? (parseInt(bpMatch[2]) || 1) : 0
  const penalty = bpMatch?.[1]?.toLowerCase() === 'p' ? (parseInt(bpMatch[2]) || 1) : 0

  const result = skillCheck(skillName, skillValue, bonus, penalty)
  const label  = monster ? `[${npcName}]` : `[${npcName}]`
  return `📋 ${label} ${result.details}\n${quoteForLevel(result.successLevel)}`
}

function kpNpcSan(args) {
  // .kp sc SAN值 成功损失/失败损失
  const m = args.trim().match(/^(\d+)\s+(\S+)\/(\S+)$/)
  if (!m) return '❌ 格式: .kp sc SAN值 成功损失/失败损失\n例: .kp sc 55 1d3/1d10'
  const result = sanCheck(parseInt(m[1]), m[2], m[3])
  return `📋 [NPC] ${result.details}\n${quoteForLevel(result.passed ? '成功' : '失败')}`
}

function helpText(topic = '') {
  topic = topic.trim().toLowerCase()
  const topics = {
    r:    '🎲 掷骰指令 .r\n.r 1d100 / .r 3d6 / .rd6 / .r 1d8+2',
    rc:   '🎲 技能检定 .rc\n.rc 技能名 目标值 [b/p[数量]]\n.rc 侦查 60 b2\n已存技能: .rc 侦查 (自动读取人物卡)',
    sc:   '🧠 理智检定 .sc\n.sc 当前SAN 成功损失/失败损失\n.sc 55 1d3/1d10',
    san:  '🧠 理智检定 .sc\n.sc 当前SAN 成功损失/失败损失\n.sc 55 1d3/1d10',
    coc:  '📋 生成角色 .coc\n.coc / .coc 5 — 生成属性\n.save / .save 2 — 确认保存到人物卡',
    st:       '📝 设置技能 .st\n.st 侦查 60 — 单条保存\n.st 侦查 60 聆听 40 — 批量保存',
    template: '📨 人物卡模板 .template\n私信发送空白模板，填好后在群里 @我 用 .st 批量录入',
    show: '📋 查看人物卡 .show',
    rop:  '⚔️ 对抗检定 .rop\n.rop 力量 60 vs 力量 45',
    luck: '🍀 幸运消耗 .luck\n.luck set 值 — 设置幸运值\n.luck spend 数量 技能名 技能值',
    kp:   '👁 KP功能 .kp\n.kp claim/resign — 认领/放弃\n.kp rc 技能 值 — 秘密检定\n.kp npc NPC名 技能 值 — NPC检定\n.kp sc SAN值 成功/失败 — NPC理智检定',
  }
  return topics[topic] ||
    '🎲 CoC 7.0 骰娘 指令列表\n━━━━━━━━━━━━━━━━\n' +
    '.r [表达式] / .rdN — 掷骰\n' +
    '.rc 技能 [目标值] [b/p] — 技能检定\n' +
    '.sc SAN值 成功/失败 — 理智检定\n' +
    '.rop 名1 值1 vs 名2 值2 — 对抗检定\n' +
    '.fight/.fire/.dodge 值 — 战斗检定\n' +
    '.dmg 表达式 — 伤害骰\n' +
    '.coc [数量] → .save [n] — 生成并保存人物卡\n' +
    '.st 技能 值 [技能 值 ...] — 录入技能(支持批量)\n' +
    '.template — 私信发送空白人物卡模板\n' +
    '.kp — KP功能（认领/秘密检定/NPC）\n' +
    '.show — 查看人物卡\n' +
    '.luck set/spend — 幸运管理\n' +
    '.help [指令] — 查看帮助\n' +
    '━━━━━━━━━━━━━━━━'
}

module.exports = { handleCommand }
