/**
 * tests/rules-jungle.js — 斗兽棋规则测试（等级/鼠象/陷阱/河流/跳河/兽穴/终局）。
 * 坐标：i 列 0..6，j 行 0..8（j=0 黑方底线，j=8 白方底线）；元数据行 board[9][0]。
 * 棋子码：白 1..8、黑 9..16（减 8 得等级：1鼠 2猫 3狗 4狼 5豹 6虎 7狮 8象）。
 * 运行：node tests/rules-jungle.js
 */

var jg = require('../src/rules/jungle.js').create()
var h = require('./helper.js')

// 输出：10 行空棋盘（9 行棋盘 + 元数据行）。
function blank() {
  var b = []
  for (var j = 0; j < 10; j++) {
    var row = []
    for (var i = 0; i < 7; i++) row.push(0)
    b.push(row)
  }
  return b
}

// 输入：board、阵营；输出：棋子数。
function countColor(b, turn) {
  var n = 0
  for (var j = 0; j < 9; j++) {
    for (var i = 0; i < 7; i++) {
      if (b[j][i] === 0) continue
      if ((b[j][i] <= 8 ? 1 : 2) === turn) n++
    }
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

h.suite('jungle/初始布局')
var b = jg.init()
h.eq('棋盘 9 行 + 元数据行', b.length, 10)
h.eq('白方 8 子', countColor(b, 1), 8)
h.eq('黑方 8 子', countColor(b, 2), 8)
h.eq('白鼠 (3,7)', b[7][3], 1)
h.eq('黑鼠 (3,1)', b[1][3], 9)
h.eq('白象 (6,6)', b[6][6], 8)
h.eq('黑象 (0,2)', b[2][0], 16)
h.eq('白狮 (6,8)', b[8][6], 7)
h.eq('黑狮 (0,0)', b[0][0], 15)
h.eq('白方初始合法着法 18', jg.moves(b, 1).length, 18)
h.eq('黑方初始合法着法 18', jg.moves(b, 2).length, 18)
h.eq('水域初始无子', (function () {
  var cells = [[1, 3], [2, 3], [4, 3], [5, 3], [1, 4], [2, 4], [4, 4], [5, 4], [1, 5], [2, 5], [4, 5], [5, 5]]
  var n = 0
  for (var k = 0; k < cells.length; k++) if (b[cells[k][1]][cells[k][0]] !== 0) n++
  return n
})(), 0)
h.eq('兽穴初始为空', [b[0][3], b[8][3]], [0, 0])
h.eq('初始评估为 0', jg.evaluate(b, 1), 0)
h.eq('初始双方评估互为相反数', jg.evaluate(b, 1), -jg.evaluate(b, 2))

h.suite('jungle/等级吃子与鼠象特例')
var b1 = blank()
b1[4][3] = 7   // 白狮 (3,4)
b1[3][3] = 12  // 黑狼 (3,3)
var m1 = jg.moves(b1, 1)
h.ok('狮吃狼', find(m1, 3, 3) !== null)
h.ok('吃子不强制（仍有静着）', m1.length > 1)
h.eq('候选首着为吃子', { i: jg.candidates(b1, 1)[0].i, j: jg.candidates(b1, 1)[0].j }, { i: 3, j: 3 })
var b2 = blank()
b2[4][3] = 2   // 白猫 (3,4)
b2[3][3] = 15  // 黑狮 (3,3)
h.ok('低等级不能吃高等级', find(jg.moves(b2, 1), 3, 3) === null)
var b3 = blank()
b3[4][3] = 3   // 白狗 (3,4)
b3[3][3] = 11  // 黑狗 (3,3)
h.ok('同级可互吃', find(jg.moves(b3, 1), 3, 3) !== null)
var b4 = blank()
b4[4][3] = 8   // 白象 (3,4)
b4[3][3] = 9   // 黑鼠 (3,3)
h.ok('象不能吃鼠', find(jg.moves(b4, 1), 3, 3) === null)
var b5 = blank()
b5[4][3] = 1   // 白鼠 (3,4)
b5[3][3] = 16  // 黑象 (3,3)
h.ok('鼠能吃象', find(jg.moves(b5, 1), 3, 3) !== null)

h.suite('jungle/陷阱')
var t1 = blank()
t1[8][2] = 16  // 黑象站在白方陷阱 (2,8)
t1[8][1] = 2   // 白猫 (1,8)
h.ok('踩对方陷阱可被任意兽吃', find(jg.moves(t1, 1), 2, 8) !== null)
var t2 = blank()
t2[0][2] = 15  // 黑狮站在黑方陷阱 (2,0)
t2[0][1] = 2   // 白猫 (1,0)
h.ok('站在己方陷阱不降级', find(jg.moves(t2, 1), 2, 0) === null)
var t3 = blank()
t3[0][2] = 8   // 白象站在黑方陷阱 (2,0)
t3[0][1] = 10  // 黑猫 (1,0)
h.ok('我方兽踩对方陷阱会被低级兽吃', find(jg.moves(t3, 2), 2, 0) !== null)

h.suite('jungle/河流与水陆隔离')
var w1 = blank()
w1[2][1] = 1   // 白鼠 (1,2)
h.ok('鼠可入水', find(jg.moves(w1, 1), 1, 3) !== null)
var w2 = blank()
w2[2][1] = 3   // 白狗 (1,2)
h.ok('非鼠不可入水', find(jg.moves(w2, 1), 1, 3) === null)
var w3 = blank()
w3[3][1] = 1   // 白鼠在水中 (1,3)
w3[2][1] = 13  // 黑豹岸上 (1,2)
h.ok('水中鼠不吃岸上兽', find(jg.moves(w3, 1), 1, 2) === null)
h.ok('岸上兽不吃水中鼠', find(jg.moves(w3, 2), 1, 3) === null)
var w4 = blank()
w4[3][1] = 1   // 白鼠水中 (1,3)
w4[3][2] = 9   // 黑鼠水中 (2,3)
h.ok('水中鼠可吃水中鼠', find(jg.moves(w4, 1), 2, 3) !== null)
var w5 = blank()
w5[3][2] = 1   // 白鼠水中 (2,3)
w5[2][2] = 16  // 黑象岸上 (2,2)
h.ok('水中鼠不能吃岸上象', find(jg.moves(w5, 1), 2, 2) === null)

h.suite('jungle/虎狮跳河')
var j1 = blank()
j1[2][1] = 7   // 白狮 (1,2)
var jm1 = jg.moves(j1, 1)
h.ok('狮纵向跳河到 (1,6)', find(jm1, 1, 6) !== null)
h.eq('跳河走法标记 jump', find(jm1, 1, 6).jump, true)
var j2 = blank()
j2[2][1] = 7   // 白狮 (1,2)
j2[4][1] = 9   // 黑鼠在 (1,4) 水中
h.ok('路径水中有鼠则不可跳', find(jg.moves(j2, 1), 1, 6) === null)
var j3 = blank()
j3[3][0] = 6   // 白虎 (0,3)
h.ok('虎横向跳河到 (3,3)', find(jg.moves(j3, 1), 3, 3) !== null)
var j4 = blank()
j4[2][1] = 7   // 白狮 (1,2)
j4[6][1] = 12  // 黑狼 (1,6)
h.ok('跳河可吃落点敌兽', find(jg.moves(j4, 1), 1, 6) !== null)
var j5 = blank()
j5[2][1] = 7   // 白狮 (1,2)
j5[4][1] = 1   // 白鼠在 (1,4) 水中
h.ok('己方水中鼠同样阻挡', find(jg.moves(j5, 1), 1, 6) === null)

h.suite('jungle/兽穴')
var d1 = blank()
d1[7][3] = 7   // 白狮 (3,7)
h.ok('禁入己方兽穴 (3,8)', find(jg.moves(d1, 1), 3, 8) === null)
var d2 = blank()
d2[0][2] = 7   // 白狮 (2,0)
var dm2 = jg.moves(d2, 1)
h.ok('可进对方兽穴 (3,0)', find(dm2, 3, 0) !== null)
h.eq('白方进黑方兽穴判胜',
  jg.check(jg.apply(d2, find(dm2, 3, 0), 1), { i: 3, j: 0, fi: 2, fj: 0 }),
  { result: 'win', winner: 1, reason: '进入对方兽穴' })
var d3 = blank()
d3[8][2] = 15  // 黑狮 (2,8)
var dm3 = jg.moves(d3, 2)
h.eq('黑方进白方兽穴判胜',
  jg.check(jg.apply(d3, find(dm3, 3, 8), 2), { i: 3, j: 8, fi: 2, fj: 8 }),
  { result: 'win', winner: 2, reason: '进入对方兽穴' })

h.suite('jungle/终局与和棋')
var onlyWhite = blank()
onlyWhite[8][6] = 7
h.eq('吃光对方判胜', jg.check(onlyWhite, { i: 6, j: 8, fi: 5, fj: 8 }),
  { result: 'win', winner: 1, reason: '吃光对方棋子' })
var stuck = blank()
stuck[0][0] = 9  // 黑鼠 (0,0)
stuck[0][1] = 3  // 白狗 (1,0) 堵右
stuck[1][0] = 2  // 白猫 (0,1) 堵下
stuck[8][6] = 7  // 白狮 (6,8)：lastMove 目标格
h.eq('对方无合法走法判胜', jg.check(stuck, { i: 6, j: 8, fi: 5, fj: 8 }),
  { result: 'win', winner: 1, reason: '对方无合法走法' })
var drawB = blank()
drawB[8][6] = 7  // 白狮
drawB[6][3] = 9  // 黑鼠 (3,6)：仍有合法着法
drawB[9][0] = 100
h.eq('100 半回合无吃子判和', jg.check(drawB, { i: 6, j: 8, fi: 5, fj: 8 }),
  { result: 'draw', reason: '50 回合无吃子' })
drawB[9][0] = 99
h.eq('99 半回合未到和棋线', jg.check(drawB, { i: 6, j: 8, fi: 5, fj: 8 }), null)

h.suite('jungle/计数与评估/接口')
var cnt = blank()
cnt[4][3] = 7  // 白狮 (3,4)
var cnt1 = jg.apply(cnt, { i: 3, j: 3, fi: 3, fj: 4 }, 1)
h.eq('静着累加计数', cnt1[9][0], 1)
var capB = blank()
capB[4][3] = 7   // 白狮 (3,4)
capB[4][4] = 12  // 黑狼 (4,4)
var cap1 = jg.apply(capB, { i: 4, j: 4, fi: 3, fj: 4 }, 1)
h.eq('吃子清零计数', cap1[9][0], 0)
h.eq('落点换成白狮', cap1[4][4], 7)
h.eq('原格清空', cap1[4][3], 0)
var strong = blank()
strong[4][3] = 7  // 白狮
strong[4][5] = 8  // 白象
h.ok('多子方评估为正', jg.evaluate(strong, 1) > 0)
var trapB = blank()
trapB[0][2] = 8  // 白象站黑方陷阱 (2,0)
var safeB = blank()
safeB[0][1] = 8  // 白象在 (1,0) 安全格
h.ok('踩对方陷阱评估更低', jg.evaluate(trapB, 1) < jg.evaluate(safeB, 1))
h.eq('DEPTH 1/3/6', jg.DEPTH, { easy: 1, normal: 3, hard: 6 })
h.eq('MATCH_BY_COLUMN=false', jg.MATCH_BY_COLUMN, false)
h.eq('MOVE_HAS_FROM=true', jg.MOVE_HAS_FROM, true)
h.eq('captures=null', jg.captures, null)

process.exitCode = h.summary()
