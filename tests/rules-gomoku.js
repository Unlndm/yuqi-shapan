/**
 * tests/rules-gomoku.js — 五子棋规则测试（胜负/和棋/边界/评估）。
 * 运行：node tests/rules-gomoku.js
 */

var g = require('../src/rules/gomoku.js').create(7, 7)
var h = require('./helper.js')

h.suite('gomoku/init+moves')
h.eq('初始 7 行', g.init().length, 7)
h.eq('初始每行 7 列', g.init()[0].length, 7)
h.eq('初始合法走法 49', g.moves(g.init()).length, 49)
h.eq('空盘候选只给天元', g.candidates(g.init()), [{ i: 3, j: 3 }])

h.suite('gomoku/apply')
var b = g.init()
b = g.apply(b, { i: 3, j: 3 }, 1)
h.eq('落子后该点为黑', b[3][3], 1)
h.eq('原棋盘不被修改', g.init()[3][3], 0)

h.suite('gomoku/check 五连胜')
// 横向五连
var w1 = g.init()
for (var i = 2; i < 7; i++) w1 = g.apply(w1, { i: i, j: 0 }, 1)
h.eq('横向 5 连判黑胜', g.check(w1, { i: 6, j: 0 }), { result: 'win', winner: 1 })
// 纵向
var w2 = g.init()
for (var j = 1; j < 6; j++) w2 = g.apply(w2, { i: 0, j: j }, 2)
h.eq('纵向 5 连判白胜', g.check(w2, { i: 0, j: 5 }), { result: 'win', winner: 2 })
// 反斜对角
var w3 = g.init()
for (var k = 0; k < 5; k++) w3 = g.apply(w3, { i: k, j: 4 - k }, 1)
h.eq('对角 5 连判黑胜', g.check(w3, { i: 4, j: 0 }), { result: 'win', winner: 1 })
// 四连不算胜
var w4 = g.init()
for (var m = 0; m < 4; m++) w4 = g.apply(w4, { i: m, j: 6 }, 1)
h.eq('横向 4 连不判胜', g.check(w4, { i: 3, j: 6 }), null)
// 隔子不算连
var w5 = g.init()
w5 = g.apply(w5, { i: 0, j: 0 }, 1)
w5 = g.apply(w5, { i: 1, j: 0 }, 2)
w5 = g.apply(w5, { i: 2, j: 0 }, 1)
w5 = g.apply(w5, { i: 3, j: 0 }, 2)
w5 = g.apply(w5, { i: 4, j: 0 }, 1)
h.eq('夹白子的黑子不算连', g.check(w5, { i: 4, j: 0 }), null)

h.suite('gomoku/check 和棋（盘满）')
// 填盘模式 (x+2y)%4<2：横/纵/两对角方向同色游程均 ≤2，保证无五连。
// 注意：不能棋盘式 (x+y)%2 交替——主对角线会整条同色。
var full = []
for (var y = 0; y < 7; y++) {
  var row = []
  for (var x = 0; x < 7; x++) row.push((x + 2 * y) % 4 < 2 ? 1 : 2)
  full.push(row)
}
var ck = g.check(full, { i: 6, j: 6 })
h.eq('盘满且无五连判和', ck && ck.result, 'draw')

h.suite('gomoku/evaluate')
var e1 = g.init()
e1[3][2] = 1
e1[3][3] = 1
e1[3][4] = 1
var s1 = g.evaluate(e1, 1)
var s2 = g.evaluate(e1, 2)
h.ok('黑三连对黑为正分', s1 > 0)
h.eq('对黑正分 = 对白负分', s1, -s2)
h.eq('空盘评估为 0', g.evaluate(g.init(), 1), 0)

process.exitCode = h.summary()
