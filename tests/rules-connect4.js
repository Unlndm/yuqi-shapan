/**
 * tests/rules-connect4.js — 四子棋规则测试（重力/四连/满盘）。
 * 运行：node tests/rules-connect4.js
 */

var c4 = require('../src/rules/connect4.js').create(7, 6)
var h = require('./helper.js')

h.suite('connect4/moves 重力')
var b = c4.init()
h.eq('初始 7 列可选', b && c4.moves(b).length, 7)
h.eq('初始落点全在底行', c4.moves(b)[0], { i: 0, j: 5 })

b = c4.apply(b, { i: 3, j: 5 }, 1)
var ms = c4.moves(b)
var col3 = null
for (var k = 0; k < ms.length; k++) if (ms[k].i === 3) col3 = ms[k]
h.eq('列 3 下一子落在 (3,4)', col3, { i: 3, j: 4 })

h.suite('connect4/column-full')
var full3 = c4.init()
for (var n = 0; n < 6; n++) full3 = c4.apply(full3, { i: 3, j: 5 - n }, n % 2 === 0 ? 1 : 2)
var ms3 = c4.moves(full3)
var has3 = false
for (var m = 0; m < ms3.length; m++) if (ms3[m].i === 3) has3 = true
h.ok('满列不再给出走法', !has3)
h.eq('剩 6 列可选', ms3.length, 6)

h.suite('connect4/check 四连')
// 纵向四连：黑在列 2 叠四子，白落在不冲突的列 0/1/4
var v = c4.init()
var others = [0, 1, 4]
for (var q = 0; q < 4; q++) {
  v = c4.apply(v, { i: 2, j: 5 - q }, 1)
  if (q < 3) {
    v = c4.apply(v, { i: others[q], j: 5 }, 2)
  }
}
h.eq('纵向四连判黑胜', c4.check(v, { i: 2, j: 2 }), { result: 'win', winner: 1 })
// 横向四连
var hh = c4.init()
for (var w = 0; w < 4; w++) hh = c4.apply(hh, { i: w, j: 5 }, 2)
h.eq('横向四连判白胜', c4.check(hh, { i: 3, j: 5 }), { result: 'win', winner: 2 })
// 三连不胜
var t3 = c4.init()
for (var u = 0; u < 3; u++) t3 = c4.apply(t3, { i: u, j: 5 }, 1)
h.eq('三连不判胜', c4.check(t3, { i: 2, j: 5 }), null)

h.suite('connect4/check 满盘和棋')
// (x+2y)%4<2 填盘：四方向同色游程均 ≤2，无任何四连。
var draw = []
for (var y = 0; y < 6; y++) {
  var row = []
  for (var x = 0; x < 7; x++) row.push((x + 2 * y) % 4 < 2 ? 1 : 2)
  draw.push(row)
}
h.eq('满盘无四连判和', c4.check(draw, { i: 6, j: 5 }), { result: 'draw' })

h.suite('connect4/candidates 中列优先')
var cs = c4.candidates(c4.init())
h.eq('首选中列', cs[0].i, 3)

process.exitCode = h.summary()
