'use strict'

const { determineSuccess } = require('./skillCheck')

function spendLuck(currentLuck, spendAmount, skillName, originalRoll, skillValue) {
  if (spendAmount <= 0) return { success: false, details: '❌ 花费幸运值必须大于0' }
  if (spendAmount > currentLuck) return { success: false, details: `❌ 幸运值不足！当前幸运: ${currentLuck}，需要: ${spendAmount}` }

  const newRoll = Math.max(1, originalRoll - spendAmount)
  const newLuck = currentLuck - spendAmount
  const newLevel = determineSuccess(newRoll, skillValue)

  const details = `🍀 幸运消耗\n${skillName} 检定\n原始骰值: ${originalRoll} → 新骰值: ${newRoll}\n消耗幸运: ${spendAmount}\n剩余幸运: ${newLuck}\n新结果: 【${newLevel}】`
  return { success: true, newRoll, newLuck, newLevel, details }
}

module.exports = { spendLuck }
