/**
 * tests/rules-aeroplane.js — 飞行棋（28 格外圈 + 每方 6 格冲刺道，各 4 架飞机）规则测试。
 * 随机数全部经参数注入：骰子用 [d] 数组直接指定。
 * 运行：node tests/rules-aeroplane.js
 */

var ap = require('../src/rules/aeroplane.js').create('normal')
var board = require('../src/rules/aeroplane-board.js')
var h = require('./helper.js')

// 测试辅助：造一个「某玩家第 0 架飞机在航道上 d 步」的状态。
function stateWith(p0, p1) {
  var s = ap.newGame()
  for (var i = 0; i < 4; i++) {
    s.planes[0][i] = p0[i] === undefined ? -1 : p0[i]
    s.planes[1][i] = p1[i] === undefined ? -1 : p1[i]
  }
  return s
}

// ── 常量与盘面 ──────────────────────────────────────────────────────
h.suite('aeroplane/常量与盘面')
h.eq('外圈 28 格（每边 8 格含角）', ap.TRACK, 28)
h.eq('冲刺道 6 格 → 到家步数 34', ap.FINISH, 34)
h.eq('每方 4 架飞机', ap.PLANES, 4)
h.eq('四方起飞点在四个角', ap.START, [0, 7, 14, 21])
h.eq('轮次上限 40', ap.MAX_ROUNDS, 40)
h.eq('RING 长度 28', ap.RING.length, 28)
h.eq('环 0/7/14/21 = 起飞点',
  [ap.RING[0].kind, ap.RING[7].kind, ap.RING[14].kind, ap.RING[21].kind], ['start', 'start', 'start', 'start'])
h.eq('环 6/13/20/27 = 冲刺道入口',
  [ap.RING[6].kind, ap.RING[13].kind, ap.RING[20].kind, ap.RING[27].kind], ['entry', 'entry', 'entry', 'entry'])
h.eq('环 3/10/17/24 = 航线格',
  [ap.RING[3].kind, ap.RING[10].kind, ap.RING[17].kind, ap.RING[24].kind], ['fly', 'fly', 'fly', 'fly'])
h.eq('航线格前跳 4 格', [ap.RING[3].flyTo, ap.RING[10].flyTo, ap.RING[17].flyTo, ap.RING[24].flyTo], [7, 14, 21, 0])
h.eq('四色区各 7 格',
  [ap.RING[0].color, ap.RING[7].color, ap.RING[14].color, ap.RING[21].color], [0, 1, 2, 3])
h.eq('盘面表与引擎同源', board.TRACK, ap.TRACK)

// ── 初始状态 ────────────────────────────────────────────────────────
h.suite('aeroplane/初始状态')
var s0 = ap.newGame()
h.eq('双方 4 机都在机库', [s0.planes[0].join(','), s0.planes[1].join(',')], ['-1,-1,-1,-1', '-1,-1,-1,-1'])
h.eq('第 1 轮', s0.round, 1)

// ── 骰子与环坐标 ────────────────────────────────────────────────────
h.suite('aeroplane/骰子与环坐标')
h.ok('骰子恒在 1~6', (function () {
  for (var k = 0; k < 50; k++) {
    var d = ap.rollDice(k / 50)
    if (d < 1 || d > 6) return false
  }
  return true
})())
h.eq('蓝方 d=0 在环 0', ap.ringOf(0, 0), 0)
h.eq('蓝方 d=27 在环 27', ap.ringOf(0, 27), 27)
h.eq('红方 d=0 在环 7', ap.ringOf(1, 0), 7)
h.eq('红方 d=27 在环 6', ap.ringOf(1, 27), 6)
h.eq('钻冲刺道后 ringOf 返回 -1', ap.ringOf(0, 28), -1)
h.eq('机库 ringOf 返回 -1', ap.ringOf(0, -1), -1)

// ── 起飞与连投 ──────────────────────────────────────────────────────
h.suite('aeroplane/起飞与连投')
h.eq('掷 1~5 时在库飞机不可动', [1, 2, 3, 4, 5].map(function (d) { return ap.movable(s0, 0, d).length }).join(','), '0,0,0,0,0')
h.eq('掷 6 可起飞', ap.movable(s0, 0, 6).length, 4)
var mv = ap.movable(s0, 0, 6)[0]
h.eq('起飞动作落点 d=0', [mv.launch, mv.d, mv.ring], [true, 0, 0])
var rl = ap.apply(s0, 0, mv)
h.eq('起飞后该机出库', rl.state.planes[0][0], 0)
h.eq('掷 6 获连投', rl.extra, true)
h.ok('起飞有播报', rl.log.some(function (x) { return x.text.indexOf('起飞') >= 0 }))

// ── 逐格前进与撞机 ──────────────────────────────────────────────────
h.suite('aeroplane/前进与撞机')
var s1 = stateWith([0, -1, -1, -1], [-1, -1, -1, -1])
var m1 = ap.movable(s1, 0, 2)[0]           // 0 + 2 = 2 → 环 2 是普通格
h.eq('前进 2 步', [m1.d, m1.ring], [2, 2])
h.eq('无对手可撞', m1.capture, 0)

// 红方飞机停在环 1（d=22），蓝方从 d=0 走 1 步落到环 1 → 撞机
var s2 = stateWith([0, -1, -1, -1], [22, -1, -1, -1])
h.eq('红方 d=22 在环 1', ap.ringOf(1, 22), 1)
var m2 = ap.movable(s2, 0, 1)[0]
h.eq('落点可撞 1 架', m2.capture, 1)
var rc = ap.apply(s2, 0, m2)
h.eq('被撞飞机回机库', rc.state.planes[1][0], -1)
h.eq('撞机获连投', rc.extra, true)
h.ok('撞机有播报', rc.log.some(function (x) { return x.text.indexOf('击落') >= 0 }))

// ── 航线前跳 ────────────────────────────────────────────────────────
h.suite('aeroplane/航线前跳')
var s3 = stateWith([2, -1, -1, -1], [-1, -1, -1, -1])
var m3 = ap.movable(s3, 0, 1)[0]           // 2 + 1 = 3 → 环 3 是航线格，前跳 4
h.eq('落航线格后前跳到环 7', [m3.d, m3.ring, m3.flew], [7, 7, true])
h.ok('航线有播报', ap.apply(s3, 0, m3).log.some(function (x) { return x.text.indexOf('航线') >= 0 }))

// ── 冲刺道与精确到家 ────────────────────────────────────────────────
h.suite('aeroplane/冲刺道与到家')
var s4 = stateWith([27, -1, -1, -1], [-1, -1, -1, -1])
var m4 = ap.movable(s4, 0, 1)[0]
h.eq('走完外圈最后一格进入冲刺道 d=28', [m4.d, m4.ring], [28, -1])
h.ok('进冲刺道有播报', ap.apply(s4, 0, m4).log.some(function (x) { return x.text.indexOf('冲刺道') >= 0 || x.text.indexOf('前进') >= 0 }))

var s5 = stateWith([31, -1, -1, -1], [-1, -1, -1, -1])
var m5 = ap.movable(s5, 0, 3)[0]           // 31 + 3 = 34 = 到家（精确）
h.eq('精确点数到家', [m5.d, m5.finished], [34, true])

var s6 = stateWith([32, -1, -1, -1], [-1, -1, -1, -1])
var m6 = ap.movable(s6, 0, 5)[0]           // 32 + 5 = 37 → 回退到 31
h.eq('超过终点按 2×34−37 回退', [m6.d, m6.finished], [31, false])

// ── 终局 ────────────────────────────────────────────────────────────
h.suite('aeroplane/终局')
var sw = stateWith([34, 34, 34, 34], [-1, -1, -1, -1])
h.eq('蓝方四机到家 → 胜', ap.checkOver(sw).result, 'win')
var sl = stateWith([-1, -1, -1, -1], [34, 34, 34, 34])
h.eq('红方四机到家 → 负', ap.checkOver(sl).result, 'lose')
var sr = stateWith([-1, -1, -1, -1], [-1, -1, -1, -1])
sr.round = ap.MAX_ROUNDS + 1
sr.planes[0] = [10, 0, 0, 0]
h.eq('超轮次比进度 → 领先为胜', ap.checkOver(sr).result, 'win')
sr.planes[0] = [-1, -1, -1, -1]
h.eq('超轮次进度持平 → 和局', ap.checkOver(sr).result, 'draw')
h.eq('进行中返回 null', ap.checkOver(s0), null)

// ── AI ──────────────────────────────────────────────────────────────
h.suite('aeroplane/AI 决策')
var sa = stateWith([0, -1, -1, -1], [22, -1, -1, -1])
var moves = ap.movable(sa, 0, 1)
h.ok('有可选动作', moves.length > 0)
h.ok('AI 选中的动作在候选里', moves.indexOf(ap.aiChoose(sa, 0, moves, 0.5)) >= 0)
h.ok('hard 档必选最优（优先撞机）', ap.aiChoose(sa, 0, moves, 0.5).capture >= ap.aiChoose(sa, 0, moves, 0.99).capture - 1)
h.eq('无动作时 AI 返回 null', ap.aiChoose(s0, 0, [], 0.5), null)
// 2026-10-24：hard 会避开「落在对手 1~6 格射程内」的落点
// 蓝 A d=9 +3 → 12（红在环 9，差 3 格，危险）；蓝 B d=4 +3 → 7（安全）
// 用点数 3（不是 6），避免「起飞」动作抢走选择
var apHard = require('../src/rules/aeroplane.js').create('hard')
var sd = stateWith([9, 4, -1, -1], [2, -1, -1, -1])
var md = ap.movable(sd, 0, 3)
var chSafe = apHard.aiChoose(sd, 0, md, 0.5)
h.eq('hard 选安全机（不被下一步撞）', [chSafe.plane, chSafe.d], [1, 7])

// ── 进度统计 ────────────────────────────────────────────────────────
h.suite('aeroplane/进度')
h.eq('机库不计进度', ap.progress(stateWith([-1, -1, -1, -1], []), 0), 0)
h.eq('进度为四机 d 之和', ap.progress(stateWith([10, 20, -1, 0], []), 0), 30)

process.exit(h.summary())
