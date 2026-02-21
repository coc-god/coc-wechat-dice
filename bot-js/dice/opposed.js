'use strict'

const { rollD100 } = require('./roller')
const { SuccessLevel, determineSuccess } = require('./skillCheck')

function opposedRoll(name1, skill1, name2, skill2) {
  const r1 = rollD100()
  const r2 = rollD100()
  const level1 = determineSuccess(r1.total, skill1)
  const level2 = determineSuccess(r2.total, skill2)
  const rank1 = SuccessLevel.rank(level1)
  const rank2 = SuccessLevel.rank(level2)

  let winner, outcome
  if (level1 === SuccessLevel.FUMBLE && level2 === SuccessLevel.FUMBLE) {
    winner = '双方'; outcome = '双方大失败，均未成功！'
  } else if (rank1 <= 1 && rank2 <= 1) {
    winner = '无'; outcome = '双方均未成功'
  } else {
    winner = rank1 > rank2 ? name1 : rank2 > rank1 ? name2 : skill1 >= skill2 ? name1 : name2
    outcome = `🏆 ${winner} 胜出！`
  }

  const details = `⚔️ 对抗检定\n${name1} (${skill1}): d100 = ${r1.total} 【${level1}】\n${name2} (${skill2}): d100 = ${r2.total} 【${level2}】\n${outcome}`
  return { roll1: r1.total, roll2: r2.total, level1, level2, winner, details }
}

module.exports = { opposedRoll }
