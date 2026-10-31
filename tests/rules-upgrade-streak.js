/**
 * tests/rules-upgrade-streak.js — 大富翁「房屋等级 → 租金」与 AI 盖房决策测试。
 * 运行：node tests/rules-upgrade-streak.js
 */

var monopoly = require('../src/rules/monopoly.js')
var h = require('./helper.js')
// 连胜统计（config.streakOf）依赖系统模块 stub，断言在 smoke.js 中

h.suite('upgrade/房屋等级对应租金')
var mp = monopoly.create('normal')
var s = mp.newGame()
s.owner[1] = 1
s.owner[3] = 1                       // 红方独占棕色组
h.eq('未建房且成套 → 基础租金加倍（2→4）', mp.rentOf(s, 1, 7), 4)
s.houses[1] = 1
h.eq('1 栋房屋租金 10', mp.rentOf(s, 1, 7), 10)
s.houses[1] = 3
h.eq('3 栋房屋租金 90', mp.rentOf(s, 1, 7), 90)
s.houses[1] = 5
h.eq('旅馆租金 250', mp.rentOf(s, 1, 7), 250)
s.houses[1] = 0
s.mortgaged[1] = true
h.eq('抵押后不收租', mp.rentOf(s, 1, 7), 0)

h.suite('upgrade/AI 盖房决策')
var s2 = mp.newGame()
s2.turn = 1
s2.owner[1] = 1
s2.owner[3] = 1
s2.money[1] = 2000
s2.pending = { kind: 'endTurn' }
var a2 = mp.aiAction(s2, 0.5)
h.eq('现金充裕 → AI 盖房', a2.type, 'build')
var s3 = mp.newGame()
s3.turn = 1
s3.owner[1] = 1
s3.owner[3] = 1
s3.money[1] = 60                     // 建房费 50，余额不足留现金 → 不盖
s3.pending = { kind: 'endTurn' }
var a3 = mp.aiAction(s3, 0.5)
h.eq('现金不足 → AI 结束回合', a3.type, 'endTurn')

// 未成套：合法动作里不应出现盖房
var s4 = mp.newGame()
s4.turn = 1
s4.owner[1] = 1
s4.money[1] = 2000
s4.pending = { kind: 'endTurn' }
h.ok('未成套不可盖房', !mp.legalActions(s4).some(function (a) { return a.type === 'build' }))

h.suite('reason/规则层终局原因')
var ch = require('../src/rules/chess.js').create()
var b = ch.init()
for (var j = 0; j < 8; j++) for (var i = 0; i < 8; i++) b[j][i] = 0
b[7][4] = 6
b[0][4] = 12
b[7][0] = 10
b[0][7] = 10
var ck = ch.check(b, { i: 0, j: 0, fi: 0, fj: 7 })
h.ok('chess check 返回对象或 null', ck === null || (ck.result === 'win' && ck.reason === '将死') || (ck.result === 'draw' && ck.reason === '困毙'))
var go = require('../src/rules/go.js').create(9, 9)
var gb = go.init()
for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) gb[y][x] = x <= 3 ? 1 : (x >= 5 ? 2 : 0)
var sc = go.score(gb)
h.ok('go score reason 含数子明细', typeof sc.reason === 'string' && sc.reason.indexOf('黑') >= 0)

process.exitCode = h.summary()
