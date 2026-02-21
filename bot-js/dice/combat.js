'use strict'

const { skillCheck } = require('./skillCheck')
const { rollDice } = require('./roller')

const fightingCheck = (skillValue, bonus = 0, penalty = 0) => skillCheck('格斗', skillValue, bonus, penalty)
const firearmsCheck = (skillValue, bonus = 0, penalty = 0) => skillCheck('射击', skillValue, bonus, penalty)
const dodgeCheck   = (skillValue, bonus = 0, penalty = 0) => skillCheck('闪避', skillValue, bonus, penalty)

function damageRoll(expression) {
  const result = rollDice(expression)
  return { damage: result.total, details: `💥 伤害骰: ${result.details}` }
}

module.exports = { fightingCheck, firearmsCheck, dodgeCheck, damageRoll }
