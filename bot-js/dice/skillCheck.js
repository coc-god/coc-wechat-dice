'use strict'

const { rollD100 } = require('./roller')

const SuccessLevel = {
  FUMBLE: '大失败',
  FAILURE: '失败',
  REGULAR: '成功',
  HARD: '困难成功',
  EXTREME: '极难成功',
  CRITICAL: '大成功',
  ORDER: { '大失败': 0, '失败': 1, '成功': 2, '困难成功': 3, '极难成功': 4, '大成功': 5 },
  rank(level) { return this.ORDER[level] ?? -1 },
}

function determineSuccess(rollValue, skillValue) {
  if (rollValue === 1) return SuccessLevel.CRITICAL
  if (skillValue < 50 && rollValue >= 96) return SuccessLevel.FUMBLE
  if (rollValue === 100) return SuccessLevel.FUMBLE

  const extreme = Math.floor(skillValue / 5)
  const hard = Math.floor(skillValue / 2)

  if (rollValue <= extreme) return SuccessLevel.EXTREME
  if (rollValue <= hard) return SuccessLevel.HARD
  if (rollValue <= skillValue) return SuccessLevel.REGULAR
  return SuccessLevel.FAILURE
}

function skillCheck(skillName, skillValue, bonus = 0, penalty = 0) {
  const result = rollD100(bonus, penalty)
  const success = determineSuccess(result.total, skillValue)

  const hard = Math.floor(skillValue / 2)
  const extreme = Math.floor(skillValue / 5)

  let details = `🎲 ${skillName} 检定 (目标值: ${skillValue})\nd100 = ${result.total}`
  if (bonus > 0 || penalty > 0) details += `\n${result.details}`
  details += `\n困难: ${hard} / 极难: ${extreme}\n结果: 【${success}】`

  return { roll: result.total, skillName, skillValue, successLevel: success, details }
}

module.exports = { SuccessLevel, determineSuccess, skillCheck }
