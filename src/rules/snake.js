/**
 * rules/snake.js — 蛇棋（Snakes & Ladders）纯规则引擎。
 * 100 格、10×10 蛇形编号：1 在左下角，第一行向右 1→10，第二行向左 11→20，交替到 100（左上角）。
 *
 * 规则取舍（本实现口径）：
 *   · 必须**恰好**到达 100 才算胜利；点数超出 100 时原地不动（不反弹、不回退）。
 *   · 掷出 6 **不连掷**，每回合固定掷一次并交给对方（规则简单、回合边界清晰）。
 *   · 踩梯上升 / 踩蛇下降；若落点仍是梯/蛇则继续结算（最多 4 次，防数据成环）。
 *   · AI 不做任何决策，只负责掷骰与推进回合（roll 后交给 apply）。
 *   · 状态是纯数据，apply 不改动传入对象；随机数全部可注入，node 可直接测。
 *
 * 状态（纯数据）：
 *   { mode, pos: [p0, p1], turn, dice, round, over, winner }
 *   mode   —— 'ai'（1 人类 + 1 AI）或 'duo'（2 人同机），默认 'ai'
 *   pos    —— 双方棋子所在格（0 = 未起步，1~100 = 棋盘格）
 *   turn   —— 当前该谁掷骰（0 = 先手/人类，1 = 后手/AI）
 *   dice   —— 最近一次点数（0 = 尚未掷）
 *   round  —— 当前轮次（后手行动结束后 +1）
 *   over   —— 是否已终局
 *   winner —— 胜者下标（-1 = 未分胜负）
 */

var SIZE = 10
var LAST = 100
var PLAYERS = 2

// 固定梯子映射（格 → 格）。
var LADDERS = { 4: 14, 9: 31, 21: 42, 28: 84, 51: 67, 71: 91 }
// 固定蛇映射（格 → 格）。
var SNAKES = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 }

var NAMES = ['蓝棋', '红棋']

// 输入：任意值；输出：是否为有限数字。
function isNum(v) {
  return typeof v === 'number' && isFinite(v)
}

// 输入：随机值；输出：[0,1) 内的安全比例（脏值一律兜底 0）。
function ratio(v) {
  if (typeof v !== 'number' || isNaN(v) || v <= 0) return 0
  if (v >= 1) return 0.999999
  return v
}

// 输入：rand（函数 / 数字 / 数组 / 缺省）；输出：本次 0~1 比例。
// 数组只影响「每次调用取下一项」——实例内部由 create 维护游标，顶层函数固定取首项。
function firstRatio(rand) {
  if (typeof rand === 'function') return ratio(rand())
  if (typeof rand === 'number') return ratio(rand)
  if (rand && typeof rand === 'object' && isNum(rand.length) && rand.length > 0) return ratio(rand[0])
  return Math.random()
}

// 输入：可选 rand；输出：1~6 的整数点数。
function rollValue(rand) {
  return 1 + Math.floor(firstRatio(rand) * 6)
}

// 输入：格子编号；输出：{ to, kind } 或 null（kind = 'ladder' | 'snake'）。
function jumpOf(cell) {
  if (LADDERS[cell] !== undefined) return { to: LADDERS[cell], kind: 'ladder' }
  if (SNAKES[cell] !== undefined) return { to: SNAKES[cell], kind: 'snake' }
  return null
}

// 输入：mode；输出：合法模式（'duo' 或 'ai'）。
function normMode(mode) {
  return mode === 'duo' ? 'duo' : 'ai'
}

// 输入：mode；输出：全新对局状态（双方都在 0）。
function init(mode) {
  return {
    mode: normMode(mode),
    pos: [0, 0],
    turn: 0,
    dice: 0,
    round: 1,
    over: false,
    winner: -1
  }
}

// 输入：state（脏值兜底）、玩家下标；输出：棋子合法位置。
function posOf(state, player) {
  var src = state && state.pos
  var v = src && isNum(src[player]) ? Math.floor(src[player]) : 0
  if (v < 0) return 0
  if (v > LAST) return LAST
  return v
}

// 输入：state、player、dice；输出：{ state, moved, ... }（纯函数，不改传入 state）。
// 非法入参 → invalid=true 且返回干净副本；终局后调用同样 invalid。
function apply(state, player, dice) {
  var p = isNum(player) ? Math.floor(player) : -1
  var d = isNum(dice) ? Math.floor(dice) : -1
  var base = state && typeof state === 'object' ? state : null
  if (!base || p < 0 || p >= PLAYERS || d < 1 || d > 6 || base.over) {
    return {
      state: base, invalid: true, player: p, dice: d,
      from: 0, to: 0, moved: false, overshoot: false,
      jumps: [], win: false, extra: false, log: []
    }
  }
  var from = posOf(base, p)
  var next = posOf(base, 1)
  var log = []
  var jumps = []
  var overshoot = false
  var landing = from

  if (from + d > LAST) {
    // 必须恰好到达：超出则原地不动，但仍消耗本回合。
    overshoot = true
    log.push({ text: NAMES[p] + ' 掷 ' + d + ' 点，超出 ' + LAST + '，原地不动' })
  } else {
    landing = from + d
    log.push({ text: NAMES[p] + ' 掷 ' + d + ' 点，前进到 ' + landing })
    // 连续结算梯/蛇（固定映射本身无链，循环上限仅作数据防护）。
    for (var guard = 0; guard < 4; guard++) {
      var jp = jumpOf(landing)
      if (!jp) break
      jumps.push({ from: landing, to: jp.to, kind: jp.kind })
      landing = jp.to
      log.push({ text: jp.kind === 'ladder' ? '踩到梯子，升到 ' + landing : '踩到蛇，滑到 ' + landing })
    }
  }

  var pos = [posOf(base, 0), posOf(base, 1)]
  pos[p] = landing
  var winner = -1
  if (!overshoot && landing === LAST) {
    winner = p
    log.push({ text: NAMES[p] + ' 恰好到达 ' + LAST + '，获胜' })
  }
  var over = winner >= 0 || !!base.over
  var state2 = {
    mode: normMode(base.mode),
    pos: pos,
    turn: over ? p : 1 - p,
    dice: d,
    round: (isNum(base.round) ? Math.floor(base.round) : 1) + (p === 1 ? 1 : 0),
    over: over,
    winner: winner
  }
  return {
    state: state2, invalid: false, player: p, dice: d,
    from: from, to: landing, moved: landing !== from,
    overshoot: overshoot, jumps: jumps, win: winner === p,
    extra: false, log: log
  }
}

// 输入：state；输出：null（进行中）或 { result, winner, reason }。
// result 以先手（玩家 0）视角：'win' / 'lose'。
function check(state) {
  if (!state || !state.over) return null
  var w = isNum(state.winner) ? Math.floor(state.winner) : -1
  if (w < 0) return null
  return {
    result: w === 0 ? 'win' : 'lose',
    winner: w,
    reason: NAMES[w] + ' 到达 ' + LAST
  }
}

// 输入：state、player、rand；输出：AI 的点数（1~6，终局返回 0）。
// AI 无决策：点数完全由注入随机源决定，调用方再用 apply 推进回合。
function aiChoose(state, player, rand) {
  if (!state || state.over) return 0
  return rollValue(rand)
}

// 输入：可选 rand；输出：实例（默认随机源可注入）。
// 数组作为随机源时，实例内按调用次数循环取用，便于复现整段对局。
function create(rand) {
  var cursor = 0

  function next() {
    if (typeof rand === 'function') return ratio(rand())
    if (typeof rand === 'number') return ratio(rand)
    if (rand && typeof rand === 'object' && isNum(rand.length) && rand.length > 0) {
      var v = rand[cursor % rand.length]
      cursor++
      return ratio(v)
    }
    return Math.random()
  }

  function instRoll(r) {
    if (r !== undefined) return rollValue(r)
    return 1 + Math.floor(next() * 6)
  }

  function instAi(state, player, r) {
    if (!state || state.over) return 0
    if (r !== undefined) return rollValue(r)
    return instRoll()
  }

  return {
    SIZE: SIZE,
    LAST: LAST,
    PLAYERS: PLAYERS,
    LADDERS: LADDERS,
    SNAKES: SNAKES,
    NAMES: NAMES,
    init: init,
    roll: instRoll,
    apply: apply,
    check: check,
    aiChoose: instAi,
    jumpOf: jumpOf
  }
}

module.exports = {
  create: create,
  init: init,
  roll: rollValue,
  apply: apply,
  check: check,
  aiChoose: aiChoose,
  jumpOf: jumpOf,
  SIZE: SIZE,
  LAST: LAST,
  PLAYERS: PLAYERS,
  LADDERS: LADDERS,
  SNAKES: SNAKES,
  NAMES: NAMES
}
