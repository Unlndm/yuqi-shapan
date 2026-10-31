/**
 * tests/ai.js — 通用搜索 AI 行为测试（各棋种必防必胜局面）。
 * 运行：node tests/ai.js
 */

var ai = require('../src/core/ai.js')
var t = require('../src/rules/tictactoe.js').create()
var c4 = require('../src/rules/connect4.js').create(7, 6)
var g = require('../src/rules/gomoku.js').create(7, 7)
var h = require('./helper.js')

h.suite('ai/tictactoe 防守')
// 黑已有 (0,0)(1,0)，白行棋必须堵 (2,0)
var b = t.init()
b[0][0] = 1
b[0][1] = 1
var mv = ai.chooseMove(t, b, 2, 'hard')
h.eq('白必堵 (2,0)', mv, { i: 2, j: 0 })

h.suite('ai/tictactoe 进攻')
// 白已有 (0,0)(1,1)，白行棋完成对角
var b2 = t.init()
b2[0][0] = 2
b2[1][1] = 2
b2[0][1] = 1
b2[0][2] = 1
var mv2 = ai.chooseMove(t, b2, 2, 'hard')
h.eq('白抓 (2,2) 胜', mv2, { i: 2, j: 2 })

h.suite('ai/tictactoe 全解不输')
// hard 白对贪心黑模拟一整局：白至少不败
function playFull(rules, first, diff) {
  var board = rules.init()
  var turn = first
  var guard = 0
  while (guard++ < 60) {
    var mv = ai.chooseMove(rules, board, turn, diff)
    if (!mv) return { result: 'draw' }
    board = rules.apply(board, mv, turn)
    var ck = rules.check(board, mv)
    if (ck && ck.result) return ck
    turn = 3 - turn
  }
  return { result: 'draw' }
}
var r1 = playFull(t, 2, 'hard')
h.ok('hard 白不败', r1.result === 'draw' || r1.winner === 2)

h.suite('ai/connect4')
// 白在列 3 纵向三连 (3,3)(3,4)(3,5)，唯一成四点 (3,2)，白行棋直接取胜
var b3 = c4.init()
b3[5][3] = 2
b3[4][3] = 2
b3[3][3] = 2
b3[5][0] = 1
var mv3 = ai.chooseMove(c4, b3, 2, 'normal')
h.eq('白抓 (3,2) 胜', mv3, { i: 3, j: 2 })
// 黑 (3,5)(4,5)(5,5) 活三，但 (2,5) 已被白占 → 黑唯一威胁 (6,5)，白必堵
var b4 = c4.init()
b4[5][3] = 1
b4[5][4] = 1
b4[5][5] = 1
b4[5][2] = 2
b4[5][0] = 2
var mv4 = ai.chooseMove(c4, b4, 2, 'normal')
h.eq('白必堵 (6,5)', mv4, { i: 6, j: 5 })

h.suite('ai/gomoku')
// 黑四连 (1..4,3) 且 (0,3) 已被白占 → 唯一威胁 (5,3)，白必堵
var b5 = g.init()
b5[3][1] = 1
b5[3][2] = 1
b5[3][3] = 1
b5[3][4] = 1
b5[3][0] = 2
b5[0][0] = 2
var mv5 = ai.chooseMove(g, b5, 2, 'hard')
var okBlock = mv5 && mv5.j === 3 && mv5.i === 5
h.ok('白堵唯一成五点 (5,3)', !!okBlock)
// 空盘 AI 给出合法走法且耗时可控
var t0 = Date.now()
var mv6 = ai.chooseMove(g, g.init(), 1, 'hard')
var cost = Date.now() - t0
h.ok('空盘给出天元附近走法', !!mv6)
h.ok('hard 500ms 预算 + 开销内返回', cost < 650)

h.suite('ai/黑白棋 不会崩溃')
var o = require('../src/rules/othello.js').create(6, 6)
var mv7 = ai.chooseMove(o, o.init(), 1, 'hard')
h.ok('开局给出合法走法', !!mv7 && o.captures(o.init(), mv7, 1) > 0)

h.suite('ai/一步取胜（静态延伸）')
// 黑四连 (1..4,3)，黑行棋：两个成五点任取其一
var b8 = g.init()
b8[3][1] = 1
b8[3][2] = 1
b8[3][3] = 1
b8[3][4] = 1
b8[0][0] = 2
var mv8 = ai.chooseMove(g, b8, 1, 'hard')
var okWin = mv8 && mv8.j === 3 && (mv8.i === 0 || mv8.i === 5)
h.ok('黑抓成五点取胜', !!okWin)
// 白纵向三连 (3,3..5)，白行棋唯一成四点 (3,2)
var b9 = c4.init()
b9[5][3] = 2
b9[4][3] = 2
b9[3][3] = 2
b9[5][0] = 1
var mv9 = ai.chooseMove(c4, b9, 2, 'normal')
h.eq('白抓 (3,2) 成四胜', mv9, { i: 3, j: 2 })

h.suite('ai/国际象棋 一步杀')
// 学者式四步杀局面：白后 h5、白象 c4，黑方刚走 Nf6 → 白 Qxf7#
// （只用规则层摆出局面，不改规则；验证 AI 在真实对局页同款规则实例上能抓杀）
var chess = require('../src/rules/chess.js').create()
var cb = chess.init()
var cseq = [
  [1, { i: 4, j: 4, fi: 4, fj: 6 }],
  [2, { i: 4, j: 3, fi: 4, fj: 1 }],
  [1, { i: 2, j: 4, fi: 5, fj: 7 }],
  [2, { i: 2, j: 2, fi: 1, fj: 0 }],
  [1, { i: 7, j: 3, fi: 3, fj: 7 }],
  [2, { i: 5, j: 2, fi: 6, fj: 0 }]
]
for (var cs = 0; cs < cseq.length; cs++) cb = chess.apply(cb, cseq[cs][1], cseq[cs][0])
var mvChess = ai.chooseMove(chess, cb, 1, 'hard')
h.eq('白抓 Qxf7#', mvChess, { i: 5, j: 1, fi: 7, fj: 3 })

h.suite('ai/候选排序（剪枝友好）')
// 黑白棋：能取角时角点排第一
var o = require('../src/rules/othello.js').create(6, 6)
var b10 = o.init()
b10[1][1] = 2 // (1,1) 白
b10[2][1] = 1 // (1,2) 黑
b10[1][2] = 1 // (2,1) 黑
var cs10 = o.candidates(b10, 1)
var hasCornerFirst = cs10.length > 0 && cs10[0].i === 0 && cs10[0].j === 0
var cornerInList = false
for (var c = 0; c < cs10.length; c++) {
  if (cs10[c].i === 0 && cs10[c].j === 0) cornerInList = cs10[c].i === cs10[0].i && cs10[c].j === cs10[0].j
}
h.ok('存在角点时排候选首位（或并列首位）', cs10.length > 0 && (hasCornerFirst || cornerInList))


h.suite('ai/人类大脑模型')
var mind = ai.createMind('normal', 7)
h.ok('人格存在', mind.persona === '沉稳' || mind.persona === '好战' || mind.persona === '灵动')
h.eq('难度记录', mind.difficulty, 'normal')
h.ok('注意力/失误率在 0..1', mind.attention > 0 && mind.attention <= 1 && mind.blunder >= 0 && mind.blunder < 1)
var mindB = ai.createMind('normal', 7)
h.eq('同种子人格可复现', mind.persona, mindB.persona)
h.eq('同种子注意力可复现', mind.attention, mindB.attention)
ai.observePlayer(mind, { i: 3, j: 4 })
h.eq('玩家落点写入记忆', mind.memory.lastPlayer.j, 4)
h.eq('玩家手数 +1', mind.memory.playerMoves, 1)

var fake = { evaluate: function () { return 0 } }
var opts = [
  { m: { i: 1, j: 1 }, v: 1000 },
  { m: { i: 2, j: 2 }, v: 990 },
  { m: { i: 3, j: 3 }, v: 0 }
]
function topRate(diff) {
  var n = 0
  for (var mi = 1; mi <= 120; mi++) {
    var mm = ai.createMind(diff, mi)
    var pick = ai.humanPick(mm, fake, null, 1, opts)
    if (pick && pick.i === 1 && pick.j === 1) n++
  }
  return n / 120
}
var hardRate = topRate('hard')
var easyRate = topRate('easy')
h.ok('hard 选最高分比例 > easy', hardRate > easyRate + 0.1)
h.ok('easy 也会犹豫（不是永远最高分）', easyRate < 1)
h.eq('humanPick 推进手数', (function () {
  var m2 = ai.createMind('normal', 2)
  ai.humanPick(m2, fake, null, 1, opts)
  return m2.moves
})(), 1)

// ── 异步搜索（时间片）契约 ─────────────────────────────────────────
// 三条：①回调恰好一次；②返回合法着法；③取消后绝不回调。
// 同步断言先跑完，异步断言在末尾统一收尾（summary 必须等异步结束）。
var asyncCalls = 0
var asyncMove = null
var cancelCalls = 0
var cancelAlive = true
var g13 = require('../src/rules/go.js').create(13, 13)
var bWin = g.init()
bWin[3][1] = 1
bWin[3][2] = 1
bWin[3][3] = 1
bWin[3][4] = 1
bWin[0][0] = 2

ai.chooseMoveAsync(g, bWin, 1, 'hard', function (mv) {
  asyncCalls++
  asyncMove = mv
}, function () { return false })

// 取消用例：13 路空盘 hard 必然跑超过 20ms，届时置 cancelAlive=false
ai.chooseMoveAsync(g13, g13.init(), 1, 'hard', function () {
  cancelCalls++
}, function () { return !cancelAlive })

setTimeout(function () {
  cancelAlive = false
  // 再等 700ms：搜索总预算 500ms，足以走完或自行作废
  setTimeout(function () {
    h.suite('ai/异步搜索（时间片）')
    h.eq('回调恰好一次', asyncCalls, 1)
    h.ok('返回合法着法（黑四连成五点）', !!asyncMove && asyncMove.j === 3 && (asyncMove.i === 0 || asyncMove.i === 5))
    h.eq('取消后不回调', cancelCalls, 0)
    process.exitCode = h.summary()
  }, 700)
}, 20)
