'use strict'

const http = require('http')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL       = 'qwen3:8b'
const MAX_HISTORY = 20  // messages to keep before trimming

const SYSTEM_PROMPT = `你是克苏鲁的呼唤7.0（CoC 7e）的守秘人（KP）。你正在主持一场沉浸式的恐怖跑团游戏。

【叙述风格】
- 用生动、充满氛围感的中文描述场景、NPC行为和环境细节
- 保持CoC特有的恐怖、悬疑、未知感
- 不要替玩家做决定，等待玩家行动后再推进剧情
- 每次回复控制在200字以内，节奏紧凑

【骰子检定】
当玩家行动需要技能检定时，在回复末尾单独一行写：
[检定: 技能名 目标值]
例：[检定: 侦查 60] 或 [检定: 图书馆使用 70]
可同时写多个。骰子结果由系统自动提供，你根据结果叙述后果。

【禁止事项】
- 不输出思考过程或推理过程
- 不超过200字
- 不自行推进玩家未确认的行动`

// Per-room state
const roomStates = new Map()

function getState(roomId) {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, { active: false, module: '', history: [] })
  }
  return roomStates.get(roomId)
}

function activate(roomId, moduleText = '') {
  const state = getState(roomId)
  state.active  = true
  state.module  = moduleText
  state.history = []
}

function deactivate(roomId) {
  getState(roomId).active = false
}

function isActive(roomId) {
  return getState(roomId).active
}

function clearHistory(roomId) {
  getState(roomId).history = []
}

function buildSystem(moduleText) {
  return moduleText
    ? SYSTEM_PROMPT + '\n\n【本次团本】\n' + moduleText
    : SYSTEM_PROMPT
}

function ollamaPost(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req  = http.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => {
        let raw = ''
        res.on('data', c => raw += c)
        res.on('end', () => {
          try { resolve(JSON.parse(raw)) }
          catch (e) { reject(new Error('Invalid JSON from Ollama')) }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function chat(roomId, userMessage) {
  const state = getState(roomId)

  // /no_think disables qwen3 chain-of-thought
  state.history.push({ role: 'user', content: '/no_think\n' + userMessage })

  const messages = [
    { role: 'system', content: buildSystem(state.module) },
    ...state.history,
  ]

  const data = await ollamaPost({
    model: MODEL,
    messages,
    stream: false,
    options: { temperature: 0.8, num_ctx: 4096 },
  })

  const reply = data.message?.content ?? ''
  state.history.push({ role: 'assistant', content: reply })

  // Rolling window to avoid context overflow
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(-MAX_HISTORY)
  }

  return reply
}

// Strip <think>...</think> blocks (qwen3 thinking output)
function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// Parse [检定: 技能名 目标值] directives from AI response
function parseChecks(text) {
  const re = /\[检定[：:]\s*(\S+)\s+(\d+)\]/g
  const checks = []
  let m
  while ((m = re.exec(text)) !== null) checks.push({ skill: m[1], value: parseInt(m[2]) })
  return checks
}

// Remove check directives so they don't show in chat
function stripChecks(text) {
  return text.replace(/\[检定[：:]\s*\S+\s+\d+\]/g, '').trim()
}

module.exports = { activate, deactivate, isActive, clearHistory, chat, stripThinking, parseChecks, stripChecks }
