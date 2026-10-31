/**
 * tests/rules-sizes.js — 可变棋盘尺寸测试（规则工厂）。
 * 配置一致性（sizes cell 范围/可创建实例）在 smoke.js 中覆盖（需 stub 系统模块）。
 * 运行：node tests/rules-sizes.js
 */

var gF = require('../src/rules/gomoku.js')
var oF = require('../src/rules/othello.js')
var c4F = require('../src/rules/connect4.js')
var tF = require('../src/rules/tictactoe.js')
var h = require('./helper.js')

h.suite('sizes/五子棋 9×9')
var g9 = gF.create(9, 9)
h.eq('初始走法 81', g9.moves(g9.init()).length, 81)
h.eq('星位 5 个（天元+四星）', g9.STARS.length, 5)
// 主对角五连
var w = g9.init()
for (var k = 0; k < 5; k++) w = g9.apply(w, { i: k, j: k }, 1)
h.eq('9 路对角五连判黑胜', g9.check(w, { i: 4, j: 4 }), { result: 'win', winner: 1 })
// 7×7 星位只有天元
h.eq('7×7 星位 1 个', gF.create(7, 7).STARS.length, 1)

h.suite('sizes/新增棋盘尺寸（2026-10-31）')
h.eq('五子棋 11×11 共 121 个落点', gF.create(11, 11).moves(gF.create(11, 11).init()).length, 121)
h.eq('五子棋 13×13 共 169 个落点', gF.create(13, 13).moves(gF.create(13, 13).init()).length, 169)
var o10 = oF.create(10, 10)
h.eq('黑白棋 10×10 黑初始 4 个合法点', o10.moves(o10.init(), 1).length, 4)
h.eq('四子棋 9×8 共 9 列', c4F.create(9, 8).moves(c4F.create(9, 8).init()).length, 9)

h.suite('sizes/黑白棋 8×8')
var o8 = oF.create(8, 8)
var b = o8.init()
h.eq('(3,3) 黑', b[3][3], 1)
h.eq('(4,4) 黑', b[4][4], 1)
h.eq('(3,4) 白', b[3][4], 2)
h.eq('(4,3) 白', b[4][3], 2)
h.eq('黑初始合法走法 4', o8.moves(b, 1).length, 4)
// 黑下 (5,3)：行 j=3 上 (3,3)黑-(4,3)白-(5,3)空，落子翻 (4,3)（即 b[3][4]）
var b2 = o8.apply(b, { i: 5, j: 3 }, 1)
h.eq('(4,3) 被翻黑', b2[3][4], 1)
h.eq('原棋盘不被修改', b[3][4], 2)

h.suite('sizes/四子棋 8×7 与 6×5')
var c87 = c4F.create(8, 7)
h.eq('8 列可选', c87.moves(c87.init()).length, 8)
h.eq('首列落点 (0,6)', c87.moves(c87.init())[0], { i: 0, j: 6 })
var c65 = c4F.create(6, 5)
h.eq('6 列可选', c65.moves(c65.init()).length, 6)
// 6×5 纵向四连
var v = c65.init()
for (var q = 0; q < 4; q++) v = c65.apply(v, { i: 1, j: 4 - q }, 1)
h.eq('纵向四连判黑胜', c65.check(v, { i: 1, j: 1 }), { result: 'win', winner: 1 })

h.suite('sizes/井字棋固定 3×3')
h.eq('传入大尺寸仍 3×3', tF.create(5, 5).moves(tF.create(5, 5).init()).length, 9)

process.exitCode = h.summary()
