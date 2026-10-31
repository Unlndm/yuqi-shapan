/**
 * tests/rules-othello.js — 黑白棋规则测试（合法走法/翻转/终局）。
 * 运行：node tests/rules-othello.js
 */

var o = require('../src/rules/othello.js').create(6, 6)
var h = require('./helper.js')

h.suite('othello/init')
var b = o.init()
h.eq('(2,2) 黑', b[2][2], 1)
h.eq('(3,3) 黑', b[3][3], 1)
h.eq('(2,3) 白', b[2][3], 2)
h.eq('(3,2) 白', b[3][2], 2)
h.eq('共 4 子', o.moves(b, 1).length + 4, 8)

h.suite('othello/moves 初始 4 步')
var ms = o.moves(b, 1)
h.eq('黑初始合法走法 4', ms.length, 4)
// (2,2)黑 (3,2)白 (4,2)? → 黑落 (4,2) 翻转 (3,2)
h.ok('含 (4,2)', JSON.stringify(ms).indexOf('"i":4,"j":2') >= 0)
var ms2 = o.moves(b, 2)
h.eq('白初始合法走法 4', ms2.length, 4)

h.suite('othello/apply+captures')
var c1 = o.captures(b, { i: 4, j: 2 }, 1)
h.eq('(4,2) 翻 1 子', c1, 1)
var b2 = o.apply(b, { i: 4, j: 2 }, 1)
h.eq('落点变黑', b2[2][4], 1)
h.eq('(3,2) 被翻黑', b2[2][3], 1)
h.eq('原棋盘不被修改', b[2][4], 0)
h.eq('非法落点翻 0 子', o.captures(b, { i: 0, j: 0 }, 1), 0)
// 连续翻转：落 (2,1) 翻转 (2,2)? 检验多方向
var b3 = o.apply(b2, { i: 2, j: 1 }, 2)
h.eq('白落 (2,1) 翻黑 (2,2)', b3[1][2], 2)

h.suite('othello/check')
h.eq('开局未终局', o.check(b, null), null)
// 全满棋盘：3黑4白 → 白胜
var full = []
for (var j = 0; j < 6; j++) {
  var row = []
  for (var i = 0; i < 6; i++) row.push((i + j) % 2 === 0 ? 1 : 2)
  full.push(row)
}
var c = o.check(full, null)
h.eq('全满 18:18 判和', c, { result: 'draw', black: 18, white: 18, reason: '盘满 · 黑18 : 白18' })
full[5][5] = 2
h.eq('全满 17:19 判白胜', o.check(full, null),
  { result: 'win', winner: 2, black: 17, white: 19, reason: '盘满 · 黑17 : 白19' })
// 一方棋子为 0 提前终局
var zero = o.init()
for (var y = 0; y < 6; y++) for (var x = 0; x < 6; x++) zero[y][x] = 0
zero[0][0] = 2
zero[0][1] = 2
h.eq('黑子为 0 判白胜', o.check(zero, null),
  { result: 'win', winner: 2, black: 0, white: 2, reason: '一方无子 · 黑0 : 白2' })

process.exitCode = h.summary()
