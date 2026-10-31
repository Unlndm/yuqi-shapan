/**
 * tests/rules-draughts.js — 英式跳棋规则测试（布局/强制吃子/连吃/升王/终局/和棋）。
 * 坐标：i 列 0..7，j 行 0..7（j=0 顶部黑方底线，j=7 底部白方底线），仅深色格 (i+j)%2=1。
 * 元数据行 board[8][0] = 无吃子半回合计数（>=100 判和）。
 * 运行：node tests/rules-draughts.js
 */

var d = require('../src/rules/draughts.js').create()
var h = require('./helper.js')

// 输出：9 行空棋盘（含元数据行）。
function blank() {
  var b = []
  for (var j = 0; j < 9; j++) {
    var row = []
    for (var i = 0; i < 8; i++) row.push(0)
    b.push(row)
  }
  return b
}

// 输入：board、棋子码；输出：棋子数。
function count(b, v) {
  var n = 0
  for (var j = 0; j < 8; j++) {
    for (var i = 0; i < 8; i++) if (b[j][i] === v) n++
  }
  return n
}

// 输入：走法数组、目标格；输出：走法或 null。
function find(ms, i, j) {
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === i && ms[k].j === j) return ms[k]
  }
  return null
}

h.suite('draughts/初始局面')
var b = d.init()
h.eq('棋盘 8 行 + 元数据行', b.length, 9)
h.eq('白兵 12', count(b, 1), 12)
h.eq('黑兵 12', count(b, 3), 12)
h.eq('白方初始合法走法 7', d.moves(b, 1).length, 7)
h.eq('黑方初始合法走法 7', d.moves(b, 2).length, 7)
h.eq('浅色格无子', (function () {
  var n = 0
  for (var j = 0; j < 8; j++) {
    for (var i = 0; i < 8; i++) if (b[j][i] !== 0 && (i + j) % 2 === 0) n++
  }
  return n
})(), 0)
h.eq('初始无吃子计数', b[8][0], 0)
h.eq('初始评估为 0', d.evaluate(b, 1), 0)
h.eq('初始双方评估互为相反数', d.evaluate(b, 1), -d.evaluate(b, 2))

h.suite('draughts/强制吃子')
var b1 = blank()
b1[5][2] = 1 // 白兵 (2,5)
b1[4][3] = 3 // 黑兵 (3,4)
b1[5][6] = 1 // 白兵 (6,5)：本可静走
var ms1 = d.moves(b1, 1)
h.eq('有吃子时只剩吃子着法', ms1.length, 1)
h.eq('吃子落点 (4,3)', { i: ms1[0].i, j: ms1[0].j, fi: ms1[0].fi, fj: ms1[0].fj },
  { i: 4, j: 3, fi: 2, fj: 5 })
h.eq('吃子链长度 1', ms1[0].captures.length, 1)
var b1a = d.apply(b1, ms1[0], 1)
h.eq('黑兵被提', b1a[4][3], 0)
h.eq('白兵落到 (4,3)', b1a[3][4], 1)
h.eq('吃子后计数清零', b1a[8][0], 0)

h.suite('draughts/连吃必须走完整链')
var b2 = blank()
b2[7][2] = 1 // 白兵 (2,7)
b2[6][3] = 3 // 黑兵 (3,6)
b2[4][5] = 3 // 黑兵 (5,4)
var ms2 = d.moves(b2, 1)
h.eq('唯一合法着法', ms2.length, 1)
h.eq('连吃两子', ms2[0].captures.length, 2)
h.eq('终点 (6,3)', { i: ms2[0].i, j: ms2[0].j }, { i: 6, j: 3 })
h.ok('不返回半截链落点 (4,5)', find(ms2, 4, 5) === null)
var b2a = d.apply(b2, ms2[0], 1)
h.eq('两枚黑兵都被提', count(b2a, 3), 0)
h.eq('白兵到 (6,3)', b2a[3][6], 1)

h.suite('draughts/升王')
var b3 = blank()
b3[1][2] = 1 // 白兵 (2,1)
var b3a = d.apply(b3, { i: 1, j: 0, fi: 2, fj: 1 }, 1)
h.eq('白兵进底线升王', b3a[0][1], 2)
var b4 = blank()
b4[2][1] = 1 // 白兵 (1,2)
b4[1][2] = 3 // 黑兵 (2,1)
var ms4 = d.moves(b4, 1)
h.eq('吃子升王唯一着法', ms4.length, 1)
h.eq('吃子落点 (3,0)', { i: ms4[0].i, j: ms4[0].j }, { i: 3, j: 0 })
h.eq('吃子链长度 1', ms4[0].captures.length, 1)
var b4a = d.apply(b4, ms4[0], 1)
h.eq('吃子后升王', b4a[0][3], 2)
h.eq('黑兵被提', count(b4a, 3), 0)
// 黑兵升王（底线 j=7）
var b4b = blank()
b4b[6][5] = 3 // 黑兵 (5,6)
var b4c = d.apply(b4b, { i: 4, j: 7, fi: 5, fj: 6 }, 2)
h.eq('黑兵进底线升黑王', b4c[7][4], 4)

h.suite('draughts/王双向移动与吃子')
var b5 = blank()
b5[3][3] = 2 // 白王 (3,3)
var ms5 = d.moves(b5, 1)
h.eq('王四方向各一步', ms5.length, 4)
h.ok('王不飞格（不含 (0,0)）', find(ms5, 0, 0) === null)
var b6 = blank()
b6[4][3] = 2 // 白王 (3,4)
b6[5][2] = 3 // 黑兵 (2,5)
var ms6 = d.moves(b6, 1)
h.eq('王可向后吃子', ms6.length, 1)
h.eq('落点 (1,6)', { i: ms6[0].i, j: ms6[0].j }, { i: 1, j: 6 })
var b6a = d.apply(b6, ms6[0], 1)
h.eq('王落到 (1,6)', b6a[6][1], 2)
var b7 = blank()
b7[4][4] = 2 // 白王 (4,4)
b7[3][3] = 3 // 黑兵 (3,3)
b7[1][1] = 3 // 黑兵 (1,1)
var ms7 = d.moves(b7, 1)
h.eq('王连吃两子', ms7[0].captures.length, 2)
h.eq('连吃终点 (0,0)', { i: ms7[0].i, j: ms7[0].j }, { i: 0, j: 0 })
var b7a = d.apply(b7, ms7[0], 1)
h.eq('两枚黑兵都被提', count(b7a, 3), 0)
h.eq('王到 (0,0)', b7a[0][0], 2)

h.suite('draughts/终局与和棋')
var onlyWhite = blank()
onlyWhite[4][3] = 1
h.eq('吃光对方判胜', d.check(onlyWhite, { i: 3, j: 4, fi: 2, fj: 5 }),
  { result: 'win', winner: 1, reason: '吃光对方棋子' })
var stuck = blank()
stuck[7][0] = 4 // 黑王 (0,7)
stuck[6][1] = 1 // 白兵 (1,6) 堵住唯一邻格
stuck[5][2] = 1 // 白兵 (2,5) 占住吃子落点
stuck[7][4] = 1 // 白兵 (4,7)：作为 lastMove 目标格
h.eq('对方无合法走法判胜', d.check(stuck, { i: 4, j: 7, fi: 3, fj: 6 }),
  { result: 'win', winner: 1, reason: '对方无合法走法' })
var drawB = blank()
drawB[4][3] = 1
drawB[4][5] = 3
drawB[8][0] = 100
h.eq('100 半回合无吃子判和', d.check(drawB, { i: 3, j: 4, fi: 2, fj: 5 }),
  { result: 'draw', reason: '50 回合无吃子' })
drawB[8][0] = 99
h.eq('99 半回合未到和棋线', d.check(drawB, { i: 3, j: 4, fi: 2, fj: 5 }), null)

h.suite('draughts/计数与排序/接口')
var cnt = blank()
cnt[4][3] = 1
var cnt1 = d.apply(cnt, { i: 2, j: 3, fi: 3, fj: 4 }, 1)
h.eq('静着累加计数', cnt1[8][0], 1)
b1[8][0] = 37
var cnt2 = d.apply(b1, ms1[0], 1)
h.eq('吃子清零计数', cnt2[8][0], 0)
h.eq('初始候选数 7', d.candidates(b, 1).length, 7)
h.eq('候选首着为吃子', { i: d.candidates(b1, 1)[0].i, j: d.candidates(b1, 1)[0].j }, { i: 4, j: 3 })
h.eq('DEPTH 1/4/7', d.DEPTH, { easy: 1, normal: 4, hard: 7 })
h.eq('MATCH_BY_COLUMN=false', d.MATCH_BY_COLUMN, false)
h.eq('MOVE_HAS_FROM=true', d.MOVE_HAS_FROM, true)
h.eq('captures=null', d.captures, null)

process.exitCode = h.summary()
