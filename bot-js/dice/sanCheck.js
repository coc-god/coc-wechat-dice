'use strict'

const { rollD100, rollDice } = require('./roller')

function sanCheck(sanValue, successLoss, failLoss) {
  const result = rollD100()
  const passed = result.total <= sanValue

  const lossExpr = passed ? successLoss : failLoss
  const lossResult = rollDice(lossExpr)
  const sanLoss = Math.max(0, lossResult.total)
  const newSan = Math.max(0, sanValue - sanLoss)

  const checkResult = passed ? '成功' : '失败'
  let details = `🧠 SAN 检定 (当前SAN: ${sanValue})\nd100 = ${result.total} / 目标值: ${sanValue}\n结果: 【${checkResult}】\n理智损失: ${lossExpr} = ${sanLoss}\n剩余SAN: ${newSan}`

  const warnings = []
  if (sanLoss >= 5) warnings.push('⚠️ 单次理智损失≥5点，可能陷入临时性疯狂！')
  if (newSan === 0) warnings.push('☠️ 理智值降至0，调查员永久疯狂！')
  if (warnings.length) details += '\n' + warnings.join('\n')

  return { roll: result.total, passed, sanLoss, newSan, details }
}

module.exports = { sanCheck }
