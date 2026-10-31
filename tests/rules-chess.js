/**
 * tests/rules-chess.js — 国际象棋规则测试（走法/升变/将军/将死/困毙）。
 * 坐标：j=0 黑方底线（8 段线），j=7 白方底线（1 段线）；白兵在 j=6 向 j- 方前进。
 * 运行：node tests/rules-chess.js
 */

var chessFactory = require('../src/rules/chess.js')
var c = chessFactory.create()
var h = require('./helper.js')

h.suite('chess/初始局面')
var b = c.init()
h.eq('黑车 a8', b[0][0], 10)
h.eq('白王 e1', b[7][4], 6)
h.eq('白兵 8 枚', (function () {
  var n = 0
  for (var j = 0; j < 8; j++) for (var i = 0; i < 8; i++) if (b[j][i] === 1) n++
  return n
})(), 8)
h.eq('白开局合法走法 20', c.moves(b, 1).length, 20)

h.suite('chess/走法')
// 白马 b1(1,7)→c3(2,5)
h.ok('白马可跳 c3', (function () {
  var ms = c.moves(b, 1)
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === 2 && ms[k].j === 5 && ms[k].fi === 1 && ms[k].fj === 7) return true
  }
  return false
})())
var b2 = c.apply(b, { i: 2, j: 5, fi: 1, fj: 7 }, 1)
h.eq('马到 c3', b2[5][2], 2)
h.eq('b1 变空', b2[7][1], 0)

h.suite('chess/兵升变')
var b3 = c.init()
for (var j = 0; j < 8; j++) for (var i = 0; i < 8; i++) b3[j][i] = 0
b3[1][6] = 1 // 白兵 g7（j=1）
b3[7][4] = 6 // 白王 e1
b3[0][4] = 12 // 黑王 e8
var promo = c.apply(b3, { i: 6, j: 0, fi: 6, fj: 1 }, 1)
h.eq('缺省升变为白后', promo[0][6], 5)
h.eq('指定升马', c.apply(b3, { i: 6, j: 0, fi: 6, fj: 1, promo: 1 }, 1)[0][6], 2)
h.eq('指定升车', c.apply(b3, { i: 6, j: 0, fi: 6, fj: 1, promo: 3 }, 1)[0][6], 4)
// 黑兵升变：黑兵 a2（j=6）进 a1（j=7），promo 同样按 1马 2象 3车 4后
var b3b = c.init()
for (var jj = 0; jj < 8; jj++) for (var ii = 0; ii < 8; ii++) b3b[jj][ii] = 0
b3b[6][0] = 7   // 黑兵 a2
b3b[0][4] = 12  // 黑王 e8
b3b[7][4] = 6   // 白王 e1
h.eq('黑兵缺省升后', c.apply(b3b, { i: 0, j: 7, fi: 0, fj: 6 }, 2)[7][0], 11)
h.eq('黑兵指定升象', c.apply(b3b, { i: 0, j: 7, fi: 0, fj: 6, promo: 2 }, 2)[7][0], 9)

h.suite('chess/将军与将死（学者式四步杀）')
// 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
var seq = [
  [1, { i: 4, j: 4, fi: 4, fj: 6 }],   // e2-e4
  [2, { i: 4, j: 3, fi: 4, fj: 1 }],   // e7-e5
  [1, { i: 2, j: 4, fi: 5, fj: 7 }],   // Bf1-c4
  [2, { i: 2, j: 2, fi: 1, fj: 0 }],   // Nb8-c6
  [1, { i: 7, j: 3, fi: 3, fj: 7 }],   // Qd1-h5
  [2, { i: 5, j: 2, fi: 6, fj: 0 }],   // Ng8-f6
  [1, { i: 5, j: 1, fi: 7, fj: 3 }]    // Qh5xf7#
]
var cur = c.init()
for (var s = 0; s < seq.length; s++) {
  cur = c.apply(cur, seq[s][1], seq[s][0])
}
h.eq('白后 f7 将死黑方', c.check(cur, seq[seq.length - 1][1]), { result: 'win', winner: 1, reason: '将死' })
h.eq('黑王被将军', c.inCheck(cur, 2), true)

h.suite('chess/将军检测')
// 黑车 a1 与白王 e1 同在底线横排，中间无遮挡 → 将军
var b6 = c.init()
for (var j2 = 0; j2 < 8; j2++) for (var i2 = 0; i2 < 8; i2++) b6[j2][i2] = 0
b6[7][4] = 6  // 白王 e1
b6[7][0] = 10 // 黑车 a1
b6[0][7] = 12 // 黑王 h8
h.eq('白王被黑车将军', c.inCheck(b6, 1), true)
// 白王逃到 e2 脱将
var b7 = c.apply(b6, { i: 4, j: 6, fi: 4, fj: 7 }, 1)
h.eq('白王到 e2 后脱将', c.inCheck(b7, 1), false)

h.suite('chess/困毙判和')
// 黑王 a8，白后 b6 + 白车 c7 控制全部逃格，但 a8 未被将军 → 困毙判和
var b8 = c.init()
for (var j3 = 0; j3 < 8; j3++) for (var i3 = 0; i3 < 8; i3++) b8[j3][i3] = 0
b8[0][0] = 12 // 黑王 a8
b8[2][1] = 5  // 白后 b6
b8[1][2] = 4  // 白车 c7
b8[7][7] = 6  // 白王 h1（远离）
var ck8 = c.check(b8, { i: 1, j: 2, fi: 1, fj: 3 })
h.eq('困毙判和', ck8 && ck8.result, 'draw')

h.suite('chess/三次重复局面（positionKey）')
// 规则层只出签名，计数在对局页走子栈上做（见 game.ux 的 repeatCount）。
h.ok('同一局面同一行棋方 → 签名相同', c.positionKey(b, 1) === c.positionKey(c.init(), 1))
h.ok('换行棋方 → 签名不同', c.positionKey(b, 1) !== c.positionKey(b, 2))
h.ok('棋盘变了 → 签名不同', c.positionKey(b2, 1) !== c.positionKey(b, 1))
// 签名忽略半回合计数（m8[0]），但看易位权旗标
var bM = c.init()
bM[8][0] = 42
h.ok('半回合计数不进签名', c.positionKey(bM, 1) === c.positionKey(c.init(), 1))
bM[8][1] = 1
h.ok('易位权旗标进签名', c.positionKey(bM, 1) !== c.positionKey(c.init(), 1))

h.suite('chess/评估与深度')
h.eq('初始局面双方评估互为相反数', c.evaluate(c.init(), 1), -c.evaluate(c.init(), 2))
h.ok('多子方评估更高', c.evaluate(c.init(), 1) === 0)

process.exitCode = h.summary()
