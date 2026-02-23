'use strict'

const http = require('http')
const fs   = require('fs')
const path = require('path')

const MODULES_DIR = path.join(__dirname, 'modules')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL       = 'qwen3:8b'
const MAX_HISTORY = 20  // messages to keep before trimming

const SYSTEM_PROMPT = `你是克苏鲁的呼唤7.0（CoC 7e）的守秘人（KP）。你正在主持一场沉浸式的恐怖跑团游戏。

【守秘人职责】
- 你是公平的裁判与叙述者，只描述调查员能直接感知的内容
- 剧情由玩家行动驱动——等待玩家宣告行动，不要主动推进剧情
- 玩家问到什么，才回应什么；玩家没有探索的地方，不主动介绍
- 只有当玩家明显陷入停滞（连续几轮无实质行动）时，才通过NPC对话或环境细节给出隐晦提示

【NPC行为规范】
- NPC是有血有肉的普通人，先做好本分的社交礼节：自我介绍、问候、闲聊、提供帮助
- 即使NPC有秘密，大多数时候他们表现得完全正常——热情、友善、健谈
- NPC的异常只偶尔、短暂、隐晦地流露：一个停顿、一个回避、一个持续半秒太久的微笑
- 不要让NPC一开口就透露任何神秘信息、警告或暗示——先建立信任，再让裂缝慢慢出现

【保密原则】
- 你知道完整的真相、NPC秘密和模组结局，但绝对不能透露
- 只描述调查员当前能看到、听到、感受到的表面现象
- NPC按其人设表现，不暴露隐藏动机和秘密身份
- 线索要让玩家自己发现，不要直接点明

【回复规范——严格执行】
- 只说新的东西。已经描述过的场景、气氛、NPC外貌、环境细节，一律不再重复
- 直接响应玩家刚才的行动或对话，说明结果或NPC的反应，然后停下来等玩家
- 控制在60-100字。如果写完发现有句子和之前说过的意思重复，删掉它
- 禁止用开场白重新建立场景（不要再写壁炉、热可可、雪景，除非玩家主动问起）
- 每条回复检查：这条信息是新的吗？玩家已经知道了吗？如果已知，不要说

【叙述风格与氛围节奏】
- 如果团本中有【氛围指导】，严格遵守其阶段性氛围比例
- 故事初期以温馨、日常为主，让玩家放松，为后续反差蓄力
- 恐惧感要像湖水一样慢慢涨上来：用一个细节不对劲、一句有歧义的话、一个持续太久的微笑来传达不安，绝不使用jump scare式的揭示
- NPC的异常通过细节流露（动作停顿、回避某个话题、过分热情），而非直接表现为明显的威胁

【骰子检定——严格流程】
检定分两个阶段，绝对不能混在一起：

第一阶段——宣告检定（玩家声明行动时）：
- 只描述玩家"正在尝试"这个动作的过程，不透露任何结果
- 在回复末尾单独一行写 [检定: 技能名 目标值]
- 此时停止，等待系统提供骰子结果
- 例：玩家说"我仔细打量林赛" → 描述"你走近林赛，仔细观察她的脸" → [检定: 侦查 60]

第二阶段——叙述结果（系统反馈骰子后）：
- 系统会发来格式为 [系统] xxx检定：骰出N，目标值M，结果【成功/失败/大成功/大失败】
- 成功：描述玩家发现了什么有意义的细节
- 失败：描述玩家没有注意到任何异常，或产生了误判
- 大成功：给出超出预期的额外细节
- 大失败：产生错误信息或负面后果

禁止在第一阶段就透露任何检定会发现的内容——哪怕是暗示。
禁止在未收到系统骰子结果时描述检定的发现。

触发检定的条件：
- 玩家明确声明具体行动，且该行动在CoC规则下需要骰骰子
- 纯对话、移动、观察环境等不需要检定
- 玩家只是描述感受或想法时不触发

【禁止事项】
- 不输出思考过程或推理过程
- 不超过150字
- 不替玩家做决定，不自行推进玩家未宣告的行动
- 不主动揭示任何秘密、真相或结局信息`

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
    options: { temperature: 0.8, num_ctx: 8192 },
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

// Load a module by name from the modules/ directory
function loadModule(name) {
  const file = path.join(MODULES_DIR, `${name}.txt`)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8')
}

function listModules() {
  if (!fs.existsSync(MODULES_DIR)) return []
  return fs.readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => f.replace('.txt', ''))
}

module.exports = { activate, deactivate, isActive, clearHistory, chat, stripThinking, parseChecks, stripChecks, loadModule, listModules }
