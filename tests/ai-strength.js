/**
 * tests/ai-strength.js — AI 棋力回归（刻意不登记到 tests/run.js，按需手动跑）。
 * 运行：node tests/ai-strength.js
 * 覆盖：象棋（免费吃后 / 一步杀 / 不送后）、五子棋（双威胁 / 必堵）、四子棋（必胜 / 必堵）、
 *       跳棋（强制吃子优先多子）、斗兽棋（兽穴防守）、同局面 hard 不送子。
 * 只断言「战术上明显正确」的着法，不做整局强弱对拼，避免测试时间失控。
 */

var ai = require('../src/core/ai.js')
var h = require('./helper.js')

// ── 国际象棋 ──────────────────────────────────────────────────────
var chess = require('../src/rules/chess.js').create()

function blankChess() {
  var b = []
  for (var j = 0; j < 9; j++) {
    var row = []
    for (var i = 0; i < 8; i++) row.push(0)
    b.push(row)
  }
  b[8] = [0, 0, 0, 0, 0, 0, 0, -1]
  return b
}

h.suite('ai-strength/chess 免费吃后')
// 白王 e1、黑王 e8、黑后 e4（无保护）；白车 a4 可将杀该后，同时解将
var b1 = blankChess()
b1[7][4] = 6   // 白王 e1
b1[0][4] = 12  // 黑王 e8
b1[4][4] = 11  // 黑后 e4
b1[4][0] = 4   // 白车 a4
var mv1 = ai.chooseMove(chess, b1, 1, 'hard')
h.eq('白车吃免费后 (a4xe4)', mv1, { i: 4, j: 4, fi: 0, fj: 4 })

h.suite('ai-strength/chess 一步杀')
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
var mvMate = ai.chooseMove(chess, cb, 1, 'hard')
h.eq('白抓 Qxf7#', mvMate, { i: 5, j: 1, fi: 7, fj: 3 })

h.suite('ai-strength/chess 不送后')
// 黑车 a6 与黑兵 d6：白后若贪吃 d6 兵，会被车 a6 横吃（白后价值 900，兵仅 100）
var b2 = blankChess()
b2[7][4] = 6   // 白王 e1
b2[0][4] = 12  // 黑王 e8
b2[4][4] = 5   // 白后 e4
b2[2][0] = 10  // 黑车 a6（j=2）
b2[2][3] = 7   // 黑兵 d6
var mv2 = ai.chooseMove(chess, b2, 1, 'hard')
var poison = mv2 && mv2.fi === 4 && mv2.fj === 4 && mv2.i === 3 && mv2.j === 2
h.ok('不吃被车保护的兵（避免送后）', !!mv2 && !poison)

// ── 五子棋 ────────────────────────────────────────────────────────
var gomoku = require('../src/rules/gomoku.js').create(15, 15)

function blankG(n) {
  var b = []
  for (var j = 0; j < n; j++) {
    var row = []
    for (var i = 0; i < n; i++) row.push(0)
    b.push(row)
  }
  return b
}

h.suite('ai-strength/gomoku 双威胁')
// 黑活三 (7..9,7)，黑行棋走任一端即成「开放四」（两个成五点），对手挡不住
var g1 = blankG(15)
g1[7][7] = 1
g1[7][8] = 1
g1[7][9] = 1
g1[8][7] = 2
g1[8][8] = 2
var mvG1 = ai.chooseMove(gomoku, g1, 1, 'hard')
h.ok('黑做双威胁（走活三任一端）', !!mvG1 && mvG1.j === 7 && (mvG1.i === 6 || mvG1.i === 10))

h.suite('ai-strength/gomoku 必堵')
// 黑四连 (7..10,7) 两端 (6,7)/(11,7) 都可成五：白必须至少挡一路
var g2 = blankG(15)
g2[7][7] = 1
g2[7][8] = 1
g2[7][9] = 1
g2[7][10] = 1
g2[8][8] = 2
var mvG2 = ai.chooseMove(gomoku, g2, 2, 'hard')
var blockG = mvG2 && mvG2.j === 7 && (mvG2.i === 6 || mvG2.i === 11)
h.ok('白挡黑四连成一端', !!blockG)

// ── 四子棋 ────────────────────────────────────────────────────────
var c4 = require('../src/rules/connect4.js').create(7, 6)

h.suite('ai-strength/connect4 必胜')
// 白在列 3 纵向三连 (3,3..5)，白行棋落 (3,2) 成四
var q1 = c4.init()
q1[5][3] = 2
q1[4][3] = 2
q1[3][3] = 2
q1[5][0] = 1
var mvQ1 = ai.chooseMove(c4, q1, 2, 'normal')
h.eq('白落 (3,2) 成四胜', mvQ1, { i: 3, j: 2 })

h.suite('ai-strength/connect4 必堵')
// 黑底行 (3,4,5) 三连，列 2/列 0 已被白占 → 唯一成四点 (6,5)，白必堵
var q2 = c4.init()
q2[5][3] = 1
q2[5][4] = 1
q2[5][5] = 1
q2[5][2] = 2
q2[5][0] = 2
var mvQ2 = ai.chooseMove(c4, q2, 2, 'normal')
h.eq('白必堵 (6,5)', mvQ2, { i: 6, j: 5 })

// ── 国际跳棋 ──────────────────────────────────────────────────────
var draughts = require('../src/rules/draughts.js').create()

h.suite('ai-strength/draughts 强制吃子')
// 白兵 (2,5) 可连吃 (3,4)(5,2) 两子；另一白兵 (2,3) 只能吃 (3,2) 一子。
// 强制吃子规则下 AI 必须吃，且应优先吃两子。
var d1 = []
for (var dj = 0; dj < 9; dj++) {
  var dr = []
  for (var di = 0; di < 8; di++) dr.push(0)
  d1.push(dr)
}
d1[8] = [0]
d1[5][2] = 1   // 白兵 (2,5)
d1[3][2] = 1   // 白兵 (2,3)
d1[4][3] = 3   // 黑兵 (3,4)
d1[2][5] = 3   // 黑兵 (5,2)
d1[2][3] = 3   // 黑兵 (3,2)
var mvD1 = ai.chooseMove(draughts, d1, 1, 'normal')
h.ok('AI 选择吃子（不是静着）', !!mvD1 && !!mvD1.captures && mvD1.captures.length > 0)
h.ok('优先连吃两子', !!mvD1 && !!mvD1.captures && mvD1.captures.length >= 2)

// ── 斗兽棋 ────────────────────────────────────────────────────────
var jungle = require('../src/rules/jungle.js').create()

h.suite('ai-strength/jungle 兽穴防守')
// 黑狼 (3,7) 贴着白方兽穴 (3,8)，下一步即可进穴取胜；白狮 (4,7) 必须吃掉它
var j1 = []
for (var jj = 0; jj < 10; jj++) {
  var jr = []
  for (var ji = 0; ji < 7; ji++) jr.push(0)
  j1.push(jr)
}
j1[9] = [0]
j1[7][4] = 7   // 白狮 (4,7)
j1[7][3] = 12  // 黑狼 (3,7)
var mvJ1 = ai.chooseMove(jungle, j1, 1, 'normal')
h.ok('白狮吃贴穴黑狼', !!mvJ1 && mvJ1.i === 3 && mvJ1.j === 7)

// ── 同局面 hard 不送子（象棋免费后场景 + 一步杀场景） ─────────────
h.suite('ai-strength/hard 不出现明显送子')
var hard1 = ai.chooseMove(chess, b1, 1, 'hard')
h.ok('hard 仍抓免费后', !!hard1 && hard1.i === 4 && hard1.j === 4 && hard1.fi === 0 && hard1.fj === 4)
var hard2 = ai.chooseMove(chess, cb, 1, 'hard')
h.ok('hard 仍抓一步杀', !!hard2 && hard2.i === 5 && hard2.j === 1 && hard2.fi === 7 && hard2.fj === 3)

process.exitCode = h.summary()
