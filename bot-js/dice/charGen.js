'use strict'

const { rollDice } = require('./roller')

const STATS_3D6 = ['STR', 'CON', 'DEX', 'APP', 'POW']
const STATS_2D6_6 = ['SIZ', 'INT', 'EDU']
const STAT_NAMES = { STR:'力量', CON:'体质', SIZ:'体型', DEX:'敏捷', APP:'外貌', INT:'智力', POW:'意志', EDU:'教育', LUCK:'幸运' }
const STAT_ORDER = ['STR','CON','SIZ','DEX','APP','INT','POW','EDU','LUCK']

function generateOne() {
  const stats = {}
  for (const s of STATS_3D6) stats[s] = rollDice('3d6').total * 5
  for (const s of STATS_2D6_6) stats[s] = rollDice('2d6+6').total * 5
  stats.LUCK = rollDice('3d6').total * 5
  return stats
}

function formatStats(stats, index = null) {
  const header = index === null ? '📋 调查员属性' : `📋 第${index}组属性`
  const lines = [header]
  for (const key of STAT_ORDER) lines.push(`  ${STAT_NAMES[key]}(${key}): ${stats[key]}`)
  const total = STAT_ORDER.filter(k => k !== 'LUCK').reduce((s, k) => s + stats[k], 0)
  lines.push(`  总计(不含幸运): ${total}`)
  return lines.join('\n')
}

function generateCharacters(count = 1) {
  count = Math.max(1, Math.min(count, 10))
  const sets = Array.from({ length: count }, () => generateOne())
  const text = sets.map((s, i) => formatStats(s, count > 1 ? i + 1 : null)).join('\n\n')
  return { text, sets }
}

module.exports = { generateCharacters, formatStats, STAT_NAMES, STAT_ORDER }
