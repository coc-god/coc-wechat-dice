'use strict'

function roll(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function rollDice(notation) {
  notation = notation.trim().toLowerCase()
  if (!notation) return { total: 0, details: '无效的骰子表达式' }

  const termPattern = /([+-]?)\s*(?:(\d*)d(\d+)|(\d+))/g
  const terms = []
  let match
  while ((match = termPattern.exec(notation)) !== null) {
    terms.push(match)
  }

  if (!terms.length) return { total: 0, details: `无法解析: ${notation}` }

  let total = 0
  const parts = []

  for (const [, signStr, countStr, sidesStr, plainNum] of terms) {
    const sign = signStr === '-' ? -1 : 1
    if (sidesStr) {
      const count = parseInt(countStr) || 1
      const sides = parseInt(sidesStr)
      if (count > 100 || sides > 10000) return { total: 0, details: '骰子数量或面数过大' }
      const rolls = Array.from({ length: count }, () => roll(sides))
      const subtotal = rolls.reduce((a, b) => a + b, 0) * sign
      total += subtotal
      parts.push(sign === -1 ? `-${count}d${sides}: [${rolls}]` : `${count}d${sides}: [${rolls}]`)
    } else {
      const num = parseInt(plainNum) * sign
      total += num
      parts.push(String(num))
    }
  }

  return { total, details: parts.join(' + ') + ` = ${total}` }
}

function rollD100(bonus = 0, penalty = 0) {
  const net = bonus - penalty
  const extraTens = Math.abs(net)
  const isBonus = net > 0

  const units = roll(10) - 1
  const tensRolls = Array.from({ length: 1 + extraTens }, () => roll(10) - 1)
  const chosenTens = isBonus ? Math.min(...tensRolls) : Math.max(...tensRolls)

  let result = chosenTens * 10 + units
  if (result === 0) result = 100

  const tensDisplay = tensRolls.map(t => t * 10)
  const detailParts = [`十位: [${tensDisplay}]`]
  if (extraTens > 0) detailParts.push(`(${isBonus ? '奖励骰' : '惩罚骰'}x${extraTens})`)
  detailParts.push(`选择: ${chosenTens * 10}`, `个位: ${units}`, `= ${result}`)

  return { total: result, tensRolls, units, details: detailParts.join(' ') }
}

function rollExpression(expr) {
  expr = expr.trim()
  if (!expr) {
    const r = rollD100()
    return { total: r.total, details: `1d100 = ${r.total}` }
  }
  return rollDice(expr)
}

module.exports = { roll, rollDice, rollD100, rollExpression }
