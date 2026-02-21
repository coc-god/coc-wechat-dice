'use strict'

// CoC 7e preset monster stat blocks
const MONSTERS = {
  '食尸鬼': {
    en: 'Ghoul',
    stats: { STR: 80, CON: 70, SIZ: 65, INT: 55, POW: 45, DEX: 70 },
    hp: 14, db: '+1d4', armor: 0, mov: 7,
    skills: { '爪击': 40, '啃咬': 30, '闪避': 35 },
    san: '0/1d6',
  },
  '深潜者': {
    en: 'Deep One',
    stats: { STR: 80, CON: 80, SIZ: 70, INT: 70, POW: 65, DEX: 60 },
    hp: 15, db: '+1d4', armor: 1, mov: '8/8游',
    skills: { '斗殴': 50, '追踪': 50, '闪避': 30 },
    san: '0/1d6',
  },
  '僵尸': {
    en: 'Zombie',
    stats: { STR: 80, CON: 80, SIZ: 65, INT: 0, POW: 30, DEX: 25 },
    hp: 15, db: '+1d4', armor: 2, mov: 5,
    skills: { '击打': 30, '闪避': 0 },
    san: '0/1d8',
    notes: '穿刺伤害减半',
  },
  '猎犬': {
    en: 'Hunting Horror',
    stats: { STR: 150, CON: 110, SIZ: 130, INT: 80, POW: 80, DEX: 90 },
    hp: 24, db: '+3d6', armor: 5, mov: '10/飞',
    skills: { '缠绕': 65, '啃咬': 55, '闪避': 45 },
    san: '1d3/1d10',
  },
  '夜魇': {
    en: 'Nightgaunt',
    stats: { STR: 80, CON: 80, SIZ: 65, INT: 50, POW: 50, DEX: 90 },
    hp: 15, db: '+1d4', armor: 0, mov: '6/12飞',
    skills: { '爪击': 50, '挠痒': 90, '闪避': 45 },
    san: '1/1d6',
    notes: '挠痒成功令目标无法行动，直至对抗STR脱出',
  },
  '蛇人': {
    en: 'Serpent Person',
    stats: { STR: 65, CON: 80, SIZ: 60, INT: 75, POW: 60, DEX: 70 },
    hp: 14, db: '0', armor: 0, mov: 8,
    skills: { '斗殴': 40, '毒牙': 30, '闪避': 35, '巫术': 65 },
    san: '0/1d6',
    notes: '毒牙命中后每轮失去1d6 CON，直至救治',
  },
  '米戈': {
    en: 'Mi-Go',
    stats: { STR: 65, CON: 65, SIZ: 55, INT: 90, POW: 60, DEX: 80 },
    hp: 12, db: '0', armor: 0, mov: '7/10飞',
    skills: { '钳击': 45, '闪避': 40 },
    san: '0/1d6',
  },
  '暗夜游荡者': {
    en: 'Dark Young of Shub-Niggurath',
    stats: { STR: 200, CON: 175, SIZ: 200, INT: 70, POW: 75, DEX: 50 },
    hp: 37, db: '+4d6', armor: 3, mov: 10,
    skills: { '踩踏': 90, '触须缠绕': 80, '闪避': 25 },
    san: '1d3/1d10',
  },
}

// Short aliases → canonical name
const ALIASES = {
  '尸鬼':   '食尸鬼',
  '深人':   '深潜者',
  '夜行者': '夜魇',
  '暗夜':   '暗夜游荡者',
}

function find(name) {
  return MONSTERS[name] ?? MONSTERS[ALIASES[name]] ?? null
}

function list() {
  return Object.entries(MONSTERS)
    .map(([cn, m]) => `${cn}(${m.en})`)
    .join('\n  ')
}

function sheet(name, monster) {
  const s = monster.stats
  const skills = Object.entries(monster.skills).map(([k, v]) => `${k} ${v}%`).join('  ')
  const lines = [
    `📋 【${name}】${monster.en}`,
    `HP ${monster.hp}  DB ${monster.db}  盔甲 ${monster.armor}点  移动 ${monster.mov}`,
    `STR ${s.STR}  CON ${s.CON}  SIZ ${s.SIZ}  INT ${s.INT}  POW ${s.POW}  DEX ${s.DEX}`,
    `【技能】${skills}`,
    `【理智损失】${monster.san}`,
  ]
  if (monster.notes) lines.push(`📌 ${monster.notes}`)
  return lines.join('\n')
}

module.exports = { find, list, sheet }
