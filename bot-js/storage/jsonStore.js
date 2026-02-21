'use strict'

const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/players.json')

function ensureDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {}
  return {}
}

function save(players) {
  ensureDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2), 'utf8')
}

function getPlayer(players, contactId, roomId, name = '') {
  const key = `${contactId}:${roomId}`
  if (!players[key]) {
    players[key] = { contact_id: contactId, room_id: roomId, name, luck: 0, san: 0, last_roll: null, last_skill_name: '', last_skill_value: 0, stats: {}, skills: {} }
  }
  // migrate old profiles without stats/skills
  if (!players[key].stats)  players[key].stats  = {}
  if (!players[key].skills) players[key].skills = {}
  if (name && players[key].name !== name) players[key].name = name
  return players[key]
}

module.exports = { load, save, getPlayer }
