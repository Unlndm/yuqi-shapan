/**
 * tests/rules-tictactoe.js — 井字棋规则测试。
 * 运行：node tests/rules-tictactoe.js
 */

var t = require('../src/rules/tictactoe.js').create()
var h = require('./helper.js')

h.suite('tictactoe/init')
h.eq('初始走法 9', t.moves(t.init()).length, 9)

h.suite('tictactoe/check')
function mk(cells, who) {
  var b = t.init()
  for (var k = 0; k < cells.length; k++) {
    b[cells[k][1]][cells[k][0]] = who
  }
  return b
}
h.eq('横排胜', t.check(mk([[0, 0], [1, 0], [2, 0]], 1), { i: 2, j: 0 }), { result: 'win', winner: 1 })
h.eq('竖排胜', t.check(mk([[1, 0], [1, 1], [1, 2]], 2), { i: 1, j: 2 }), { result: 'win', winner: 2 })
h.eq('主对角胜', t.check(mk([[0, 0], [1, 1], [2, 2]], 1), { i: 2, j: 2 }), { result: 'win', winner: 1 })
h.eq('反对角胜', t.check(mk([[2, 0], [1, 1], [0, 2]], 1), { i: 0, j: 2 }), { result: 'win', winner: 1 })
h.eq('两子不胜', t.check(mk([[0, 0], [1, 0]], 1), { i: 1, j: 0 }), null)
// 和棋盘
var draw = [
  [1, 2, 1],
  [1, 2, 2],
  [2, 1, 2]
]
h.eq('盘满无三连判和', t.check(draw, { i: 2, j: 2 }), { result: 'draw' })

h.suite('tictactoe/apply 纯函数')
var b0 = t.init()
var b1 = t.apply(b0, { i: 1, j: 1 }, 1)
h.eq('新棋盘落子', b1[1][1], 1)
h.eq('旧棋盘不变', b0[1][1], 0)

process.exitCode = h.summary()
