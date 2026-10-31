/**
 * tests/rules-snake.js — 蛇棋（Snakes & Ladders）规则测试。
 * 随机数全部注入：点数用数字 / 函数 / 数组直接指定。
 * 运行：node tests/rules-snake.js
 */

var snake = require('../src/rules/snake.js')
var h = require('./helper.js')

var g = snake.create()

// 测试辅助：造一个指定双方位置的状态。
function stateAt(p0, p1, extra) {
  var s = snake.init('ai')
  s.pos[0] = p0
  s.pos[1] = p1 === undefined ? 0 : p1
  if (extra) {
    for (var k in extra) s[k] = extra[k]
  }
  return s
}

// ── 常量与映射 ──────────────────────────────────────────────────────
h.suite('snake/常量与映射')
h.eq('10×10 棋盘 / 终点 100', [snake.SIZE, snake.LAST], [10, 100])
h.eq('梯子 4→14', [snake.LADDERS[4], snake.jumpOf(4).kind], [14, 'ladder'])
h.eq('梯子 28→84', snake.LADDERS[28], 84)
h.eq('蛇 17→7', [snake.SNAKES[17], snake.jumpOf(17).kind], [7, 'snake'])
h.eq('蛇 98→79', snake.SNAKES[98], 79)
h.eq('普通格 100 无跳转', snake.jumpOf(100), null)
h.eq('全部 14 个蛇/梯映射均存在', (function () {
  var n = 0
  for (var k in snake.LADDERS) n++
  for (var q in snake.SNAKES) n++
  return n
})(), 14)
h.ok('梯/蛇的落点不再触发另一次跳转（无链式陷阱）', (function () {
  var keys = []
  for (var a in snake.LADDERS) keys.push(snake.LADDERS[a])
  for (var b in snake.SNAKES) keys.push(snake.SNAKES[b])
  for (var i = 0; i < keys.length; i++) if (snake.jumpOf(keys[i])) return false
  return true
})())

// ── 初始状态 ────────────────────────────────────────────────────────
h.suite('snake/初始状态')
var s0 = snake.init()
h.eq('双方都在 0', s0.pos, [0, 0])
h.eq('先手行动 / 第 1 轮', [s0.turn, s0.round], [0, 1])
h.eq('默认 1 人类 + 1 AI', s0.mode, 'ai')
h.eq('未终局 / 无胜者', [s0.over, s0.winner], [false, -1])
h.eq('init(duo) → 2 人同机', snake.init('duo').mode, 'duo')
h.eq('非法 mode 兜底 ai', snake.init('x').mode, 'ai')

// ── 掷骰 ────────────────────────────────────────────────────────────
h.suite('snake/掷骰')
h.eq('rand=0 → 1 点', snake.roll(0), 1)
h.eq('rand=0.99 → 6 点', snake.roll(0.99), 6)
h.eq('rand=1 → 6 点（比例封顶）', snake.roll(1), 6)
h.eq('函数随机源 → 4 点', snake.roll(function () { return 0.5 }), 4)
h.eq('数组随机源取首项 → 3 点', snake.roll([0.4, 0.9]), 3)
h.ok('任意比例下点数恒在 1~6', (function () {
  for (var i = 0; i <= 100; i++) {
    var d = snake.roll(i / 100)
    if (d < 1 || d > 6) return false
  }
  return true
})())
h.ok('实例随机源可复现（数字注入）', (function () {
  var a = snake.create(0.5).roll()
  var b = snake.create(0.5).roll()
  return a === b && a === 4
})())
h.ok('实例数组随机源按调用顺序循环', (function () {
  var inst = snake.create([0, 0.5])
  return inst.roll() === 1 && inst.roll() === 4 && inst.roll() === 1
})())

// ── 前进 / 梯子 / 蛇 ────────────────────────────────────────────────
h.suite('snake/前进与跳转')
var m1 = snake.apply(stateAt(0, 0), 0, 3)
h.eq('0 掷 3 → 到 3', [m1.from, m1.to, m1.moved], [0, 3, true])
h.eq('未踩梯/蛇 → jumps 为空', m1.jumps, [])
h.eq('普通前进不获奖', m1.win, false)
h.eq('掷 6 不连掷', m1.extra, false)

var ladder = snake.apply(stateAt(0, 0), 0, 4)
h.eq('0 掷 4 → 梯子升到 14', [ladder.to, ladder.state.pos[0]], [14, 14])
h.eq('梯子跳转记录', ladder.jumps, [{ from: 4, to: 14, kind: 'ladder' }])
h.ok('梯子有播报', ladder.log.some(function (x) { return x.text.indexOf('梯子') >= 0 }))

var sn = snake.apply(stateAt(16, 0), 0, 1)
h.eq('16 掷 1 → 蛇滑到 7', [sn.to, sn.state.pos[0]], [7, 7])
h.eq('蛇跳转记录', sn.jumps, [{ from: 17, to: 7, kind: 'snake' }])
h.ok('蛇有播报', sn.log.some(function (x) { return x.text.indexOf('蛇') >= 0 }))

var sn2 = snake.apply(stateAt(50, 0), 0, 4)
h.eq('50 掷 4 → 54 踩蛇 → 34', sn2.state.pos[0], 34)

// ── 必须恰好到 100 ──────────────────────────────────────────────────
h.suite('snake/恰好到达')
var win = snake.apply(stateAt(96, 0), 0, 4)
h.eq('96 掷 4 → 恰好 100 获胜', [win.to, win.win, win.overshoot], [100, true, false])
h.eq('终局状态', [win.state.over, win.state.winner], [true, 0])
h.eq('终局后 turn 停在胜者', win.state.turn, 0)
h.ok('胜利有播报', win.log.some(function (x) { return x.text.indexOf('获胜') >= 0 }))
h.eq('check 返回先手胜', snake.check(win.state).result, 'win')
h.eq('check 报出胜者下标', snake.check(win.state).winner, 0)

var over = snake.apply(stateAt(98, 0), 0, 4)
h.eq('98 掷 4 超出 → 原地不动', [over.from, over.to, over.moved, over.overshoot], [98, 98, false, true])
h.eq('超出仍交回合给对手', over.state.turn, 1)
h.eq('超出不判负 / 不终局', [over.state.over, over.state.winner], [false, -1])
h.ok('超出有播报', over.log.some(function (x) { return x.text.indexOf('超出') >= 0 }))

var over2 = snake.apply(stateAt(97, 0), 0, 6)
h.eq('97 掷 6 = 103 超出 → 原地 97', over2.state.pos[0], 97)
h.eq('100 到 100 外的任何点数都不会胜利', over2.win, false)

var done = snake.apply(win.state, 1, 6)
h.eq('终局后继续掷骰 → invalid', done.invalid, true)
h.eq('终局后状态不变', done.state, win.state)

// ── 回合轮转 ────────────────────────────────────────────────────────
h.suite('snake/回合')
var t1 = snake.apply(stateAt(0, 0), 0, 2)
h.eq('先手行动后轮到后手', [t1.state.turn, t1.state.round], [1, 1])
var t2 = snake.apply(t1.state, 1, 5)
h.eq('后手行动后回到先手', [t2.state.turn, t2.state.round], [0, 2])
h.eq('后手前进', t2.state.pos[1], 5)
h.eq('双方位置互不影响', t2.state.pos, [2, 5])

var t3 = snake.apply(t2.state, 0, 6)
h.eq('回合仍按顺序交替（掷 6 不额外行动）', t3.state.turn, 1)

// ── AI ──────────────────────────────────────────────────────────────
h.suite('snake/AI')
h.eq('AI 只掷骰：rand=0 → 1 点', snake.aiChoose(stateAt(0, 0), 1, 0), 1)
h.eq('AI 只掷骰：rand=0.9 → 6 点', snake.aiChoose(stateAt(0, 0), 1, 0.9), 6)
h.eq('AI 终局不掷骰 → 0', snake.aiChoose(win.state, 1, 0.5), 0)
h.ok('AI 点数可直接交给 apply', (function () {
  var st = stateAt(0, 0)
  var d = snake.aiChoose(st, 1, 0)   // 1 点，落格 1 无蛇/梯
  var r = snake.apply(st, 1, d)
  return r.state.pos[1] === d && r.state.turn === 0
})())

// ── 脏入参兜底 ──────────────────────────────────────────────────────
h.suite('snake/脏入参')
h.eq('玩家下标越界 → invalid', snake.apply(stateAt(0, 0), 2, 3).invalid, true)
h.eq('点数 0 → invalid', snake.apply(stateAt(0, 0), 0, 0).invalid, true)
h.eq('点数 7 → invalid', snake.apply(stateAt(0, 0), 0, 7).invalid, true)
h.eq('点数非数字 → invalid', snake.apply(stateAt(0, 0), 0, 'x').invalid, true)
h.eq('state 为空 → invalid', snake.apply(null, 0, 3).invalid, true)
h.eq('非法初始位置被收敛到 0~100', (function () {
  var s = stateAt(-5, 130)
  return [snake.apply(s, 0, 1).from, snake.apply(s, 1, 1).from]
})(), [0, 100])
h.eq('check 进行中 → null', snake.check(s0), null)
h.eq('check 空状态 → null', snake.check(null), null)

// ── 纯函数：不改动传入 state ────────────────────────────────────────
h.suite('snake/纯函数')
var keep = stateAt(10, 20)
var before = keep.pos.slice()
var kr = snake.apply(keep, 0, 3)
h.eq('apply 不改动传入 pos', keep.pos, before)
h.eq('apply 返回新数组', kr.state.pos === keep.pos, false)
h.eq('apply 不改动传入 turn/round', [keep.turn, keep.round], [0, 1])

// ── 实例 API ────────────────────────────────────────────────────────
h.suite('snake/API')
h.ok('实例含 init/roll/apply/check/aiChoose/jumpOf',
  ['init', 'roll', 'apply', 'check', 'aiChoose', 'jumpOf'].every(function (k) { return typeof g[k] === 'function' }))
h.ok('模块导出 create/init/roll/apply/check/aiChoose',
  ['create', 'init', 'roll', 'apply', 'check', 'aiChoose'].every(function (k) { return typeof snake[k] === 'function' }))

process.exit(h.summary())
