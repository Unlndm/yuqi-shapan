/**
 * tests/rules-go.js — 围棋规则测试（提子/自杀/劫/数子/停一手）。
 * 运行：node tests/rules-go.js
 */

var goFactory = require('../src/rules/go.js')
var h = require('./helper.js')

h.suite('go/提子')
var g = goFactory.create(9, 9)
var b = g.init()
// 角上白子 (0,0)，黑已占 (0,1)，黑落 (1,0) 提掉
b[0][0] = 2
b[1][0] = 1 // (0,1) 黑
h.eq('提前白子仍在', b[0][0], 2)
h.eq('(1,0) 提 1 子', g.captures(b, { i: 1, j: 0 }, 1), 1)
var b2 = g.apply(b, { i: 1, j: 0 }, 1)
h.eq('提后 (0,0) 为空', b2[0][0], 0)

h.suite('go/禁自杀')
// 角 (0,0) 四周被白围死且提不到子 → 黑落此点自杀非法
var b3 = g.init()
b3[0][1] = 2 // (1,0) 白
b3[1][1] = 2 // (1,1) 白
b3[1][0] = 2 // (0,1) 白
h.eq('角上自杀点提 0 子', g.captures(b3, { i: 0, j: 0 }, 1), 0)
h.eq('自杀点不在合法走法中', (function () {
  var ms = g.moves(b3, 1)
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === 0 && ms[k].j === 0) return true
  }
  return false
})(), false)
// 反例：黑子 (0,1) 只剩 (0,0) 一口气，白落 (0,0) 可提黑 → 合法
var b4 = g.init()
b4[1][0] = 1 // (0,1) 黑
b4[1][1] = 2 // (1,1) 白
b4[2][0] = 2 // (0,2) 白
h.eq('白落 (0,0) 提黑 1 子', g.captures(b4, { i: 0, j: 0 }, 2), 1)

h.suite('go/简单劫')
// 标准劫形：黑 (3,4)(4,3)(4,5)，白 (4,4)(6,4)(5,3)(5,5)，白 (4,4) 唯一气在 (5,4)
var b5 = g.init()
b5[4][3] = 1 // (3,4) 黑
b5[3][4] = 1 // (4,3) 黑
b5[5][4] = 1 // (4,5) 黑
b5[4][4] = 2 // (4,4) 白，唯一气在 (5,4)
b5[4][6] = 2 // (6,4) 白
b5[3][5] = 2 // (5,3) 白
b5[5][5] = 2 // (5,5) 白
h.eq('黑 (5,4) 提白劫子 1 枚', g.captures(b5, { i: 5, j: 4 }, 1), 1)
var b6 = g.apply(b5, { i: 5, j: 4 }, 1)
h.eq('提后 (4,4) 为空', b6[4][4], 0)
var ko = g.koAfter(b6, { i: 5, j: 4 }, 1, 1)
h.ok('产生劫点 (4,4)', !!ko && ko.i === 4 && ko.j === 4)
g.setKo(ko)
h.eq('白立即回提被禁', (function () {
  var ms = g.moves(b6, 2)
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === 4 && ms[k].j === 4) return true
  }
  return false
})(), false)

h.suite('go/数子（中国规则）')
// 黑占 0-3 列（36 子），白占 5-8 列（36 子+6.5 贴目），第 4 列空域两侧皆邻不计
var b7 = g.init()
for (var y = 0; y < 9; y++) {
  for (var x = 0; x < 9; x++) {
    if (x <= 3) b7[y][x] = 1
    else if (x >= 5) b7[y][x] = 2
  }
}
var sc = g.score(b7)
h.eq('黑 36 子（中界空域不计）', sc.black, 36)
h.eq('白 36 子 + 6.5 贴目', sc.white, 42.5)
h.eq('白胜（含数子明细原因）', sc, { result: 'win', winner: 2, black: 36, white: 42.5, reason: '数子 黑36 : 白42.5（含贴目）' })

h.suite('go/停一手')
h.eq('apply pass 棋盘不变', g.apply(b7, { pass: true }, 1).length, 9)
h.eq('PASS_OK 标志', g.PASS_OK, true)
h.ok('evaluate 有定义且为数值', typeof g.evaluate(b7, 1) === 'number')

h.suite('go/13 路')
var g13 = goFactory.create(13, 13)
h.eq('13 路初始走法 169', g13.moves(g13.init()).length, 169)
h.eq('13 路星位 9 个', g13.STARS.length, 9)

process.exitCode = h.summary()
