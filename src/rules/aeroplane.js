/**
 * rules/aeroplane.js — 飞行棋规则引擎（28 格外圈 + 每方 6 格冲刺道，各 4 架飞机）。
 * 盘面数据在 aeroplane-board.js；create(difficulty) 返回实例，
 * 随机数（骰子 / 决策）全部经参数注入，node 可直接测。
 * state：{ planes: [[d,d,d,d],[d,d,d,d]], round: 1 }（玩家 0 = 蓝方 / 1 = 红方）
 *   d = -1 机库；0..27 外圈（该玩家自己的步数）；28..33 冲刺道；34 到家。
 * 规则：掷 6 起飞（机库 → d = 0）并获连投；逐格前进；
 *   落点撞到对方飞机则对方那架回机库、撞机方获连投；
 *   落地航线格前跳 4 格；到家需精确点数（超过 34 按 2*FINISH-nd 回退，恰好 34 到家）；
 *   4 架全部到家者胜；超过 MAX_ROUNDS 比总进度（各机 d 之和，机库算 0），大者胜、相等和局。
 */

var board = require('./aeroplane-board.js')

var TRACK = board.TRACK
var FINISH = board.FINISH
var PLANES = board.PLANES
var START = board.START
var RING = board.RING
var MAX_ROUNDS = board.MAX_ROUNDS

var NAMES = ['蓝方', '红方']   // 玩家 0 / 1 的播报名称

function create(difficulty) {
  // 输出：初始对局状态（双方 4 机在库）。
  function newGame() {
    return { planes: [[-1, -1, -1, -1], [-1, -1, -1, -1]], round: 1 }
  }

  // 输入：rand；输出：1~6。
  function rollDice(rand) {
    var r = rand !== undefined ? rand : Math.random()
    return 1 + Math.floor(r * 6)
  }

  // 输入：玩家、步数 d；输出：外圈环坐标（非外圈返回 -1）。
  function ringOf(player, d) {
    return d < 0 || d > TRACK - 1 ? -1 : (START[player] + d) % TRACK
  }

  // 内部：从原始落点 raw 结算「超终点回退 + 航线前跳」，输出 { d, finished, flew }。
  function landing(player, raw) {
    var nd = raw
    var flew = false
    for (var guard = 0; guard < 16; guard++) {
      if (nd === FINISH) return { d: FINISH, finished: true, flew: flew }
      if (nd > FINISH) { nd = 2 * FINISH - nd; continue }  // 超终点按 2*FINISH-nd 回退
      if (nd < 0) { nd = 0; continue }
      if (nd <= TRACK - 1) {
        var ring = (START[player] + nd) % TRACK
        var cell = RING[ring]
        if (!flew && cell && cell.kind === 'fly') {
          nd += (cell.flyTo - ring + TRACK) % TRACK   // 前跳 4 格
          flew = true
          continue
        }
      }
      return { d: nd, finished: false, flew: flew }
    }
    return { d: nd, finished: nd === FINISH, flew: flew }
  }

  // 内部：环坐标上对方飞机数（仅外圈；冲刺道 / 到家不计）。
  function capturesAt(state, player, ring) {
    if (ring < 0) return 0
    var opp = 1 - player
    var n = 0
    for (var p = 0; p < PLANES; p++) {
      var d = state.planes[opp][p]
      if (d >= 0 && d <= TRACK - 1 && ringOf(opp, d) === ring) n++
    }
    return n
  }

  // 内部：组装一个动作 {plane, launch, d, finished, flew, ring, capture, dice}。
  function makeMove(state, player, plane, launch, dice, l) {
    var ring = l.finished ? -1 : ringOf(player, l.d)
    return {
      plane: plane, launch: launch, dice: dice, d: l.d,
      finished: l.finished, flew: l.flew, ring: ring,
      capture: capturesAt(state, player, ring)
    }
  }

  // 输入：state、player、dice；输出：全部可行动作（无动作返回 []）。
  function movable(state, player, dice) {
    var out = []
    for (var p = 0; p < PLANES; p++) {
      var d = state.planes[player][p]
      if (d === -1) {
        if (dice === 6) out.push(makeMove(state, player, p, true, dice, landing(player, 0)))
        continue
      }
      if (d >= FINISH) continue
      out.push(makeMove(state, player, p, false, dice, landing(player, d + dice)))
    }
    return out
  }

  // 输入：state、player、move；输出：{ state(新), log:[{text}], extra(是否连投) }。
  // extra = 掷 6 或撞机（击落对方飞机）。
  function apply(state, player, move) {
    var s = {
      planes: [state.planes[0].slice(), state.planes[1].slice()],
      round: state.round
    }
    var log = []
    var name = NAMES[player]
    var no = name + ' ' + (move.plane + 1) + ' 号飞机'
    if (move.launch) {
      s.planes[player][move.plane] = 0
      log.push({ text: no + '起飞' })
    } else {
      s.planes[player][move.plane] = move.d
      if (move.finished) {
        log.push({ text: no + '到达终点' })
      } else if (move.d >= TRACK) {
        log.push({ text: no + '进入冲刺道' })
      } else if (move.flew) {
        log.push({ text: name + '飞机登上航线，前跳 4 格' })
      }
    }
    if (move.capture > 0 && move.ring >= 0) {
      var opp = 1 - player
      for (var p = 0; p < PLANES; p++) {
        var d = s.planes[opp][p]
        if (d >= 0 && d <= TRACK - 1 && ringOf(opp, d) === move.ring) s.planes[opp][p] = -1
      }
      log.push({ text: '击落对手 ' + move.capture + ' 架飞机' })
    }
    return { state: s, log: log, extra: move.dice === 6 || move.capture > 0 }
  }

  // 内部：某架飞机在 d 位置上，对手外圈飞机距离它最近的危险步数（1~6，0 = 安全）。
  // 只有外圈会被撞：对手在你身后 1~6 格，下一步掷出对应点数就能击落你。
  function dangerGap(state, player, d) {
    if (d < 0 || d > TRACK - 1) return 0
    var r = ringOf(player, d)
    var planes = state.planes[1 - player]
    var best = 0
    for (var i = 0; i < PLANES; i++) {
      var od = planes[i]
      if (od < 0 || od > TRACK - 1) continue
      var gap = (r - ringOf(1 - player, od) + TRACK) % TRACK
      if (gap >= 1 && gap <= 6 && (best === 0 || gap < best)) best = gap
    }
    return best
  }

  // 内部：动作评分（越大越好）。
  // 2026-10-24 强化：到家 ≫ 撞机 > 前跳/起飞 > 推进；落点在对手 1~6 格射程内重罚，
  // 从危险位置飞向安全位置给小奖励；冲刺道不可被撞，额外加分。
  function score(state, player, m) {
    var s = m.launch ? 0 : m.d
    if (m.finished) s += 1000
    s += m.capture * 80
    if (m.flew) s += 30
    if (m.launch) s += 20
    if (!m.finished && m.d >= TRACK) s += 15 // 冲刺道：对手撞不到
    var g = m.finished ? 0 : dangerGap(state, player, m.d)
    if (g > 0) s -= g <= 2 ? 32 : 24
    // 逃离危险：原来那格就在对手射程内，这步落到安全格
    var oldD = state.planes[player][m.plane]
    var og = m.launch ? 0 : dangerGap(state, player, oldD)
    if (g === 0 && og > 0 && !m.finished) s += 10
    return s
  }

  // 输入：state、player、moves、rand；输出：AI 选中的动作或 null。
  // hard 永远最优；normal 前二随机；easy 完全随机。
  function aiChoose(state, player, moves, rand) {
    if (!moves || !moves.length) return null
    var r = rand !== undefined ? rand : Math.random()
    if (difficulty === 'easy') return moves[Math.floor(r * moves.length)]
    var sorted = moves.slice().sort(function (a, b) {
      return score(state, player, b) - score(state, player, a)
    })
    if (difficulty === 'hard') return sorted[0]
    return sorted[Math.floor(r * Math.min(2, sorted.length))]
  }

  // 输入：state、player；输出：总进度（各机 d 之和，机库 -1 算 0）。
  function progress(state, player) {
    var n = 0
    for (var p = 0; p < PLANES; p++) {
      var d = state.planes[player][p]
      n += d < 0 ? 0 : d
    }
    return n
  }

  // 输入：state；输出：终局判定或 null（本机玩家视角：0 = 蓝方）。
  function checkOver(state) {
    var f0 = 0
    var f1 = 0
    for (var p = 0; p < PLANES; p++) {
      if (state.planes[0][p] >= FINISH) f0++
      if (state.planes[1][p] >= FINISH) f1++
    }
    if (f0 === PLANES) return { result: 'win', reason: '四机全部到达' }
    if (f1 === PLANES) return { result: 'lose', reason: '对手四机到达' }
    if (state.round > MAX_ROUNDS) {
      var m0 = progress(state, 0)
      var m1 = progress(state, 1)
      if (m0 > m1) return { result: 'win', reason: MAX_ROUNDS + ' 轮进度领先' }
      if (m0 < m1) return { result: 'lose', reason: MAX_ROUNDS + ' 轮进度落后' }
      return { result: 'draw', reason: MAX_ROUNDS + ' 轮进度持平' }
    }
    return null
  }

  return {
    RING: RING,
    TRACK: TRACK,
    FINISH: FINISH,
    PLANES: PLANES,
    START: START,
    MAX_ROUNDS: MAX_ROUNDS,
    NAMES: NAMES,
    newGame: newGame,
    rollDice: rollDice,
    ringOf: ringOf,
    movable: movable,
    apply: apply,
    aiChoose: aiChoose,
    progress: progress,
    checkOver: checkOver
  }
}

module.exports = { create: create }
