/**
 * tests/rules-monopoly.js — 大富翁（24 格精简盘面 + 完整标准机制）规则测试。
 * 随机数全部注入：骰子用 [d1,d2] 数组直接指定，抽卡用 0~1 数字。
 * 运行：node tests/rules-monopoly.js
 */

var monopoly = require('../src/rules/monopoly.js')
var data = require('../src/rules/monopoly-board.js')
var h = require('./helper.js')

var mp = monopoly.create('normal')

// 测试辅助：把「买地/拍卖」这类必答决策一路清掉，使状态回到「该掷骰 / 该结束回合」。
function clearDecisions(st) {
  var guard = 0
  while (guard++ < 12) {
    var k = st.pending ? st.pending.kind : null
    if (k === 'buy') st = mp.applyAction(st, { type: 'declineBuy' }).state
    else if (k === 'auction') st = mp.applyAction(st, { type: 'passBid' }).state
    else break
  }
  return st
}

// ── 盘面数据（官方数字抽查） ────────────────────────────────────────
h.suite('monopoly/盘面数据')
h.eq('盘面 24 格', mp.BOARD.length, 24)
h.eq('开局资金 1500', mp.START_MONEY, 1500)

var count = { prop: 0, rail: 0, util: 0, chance: 0, chest: 0, start: 0, jail: 0, free: 0, gojail: 0, tax: 0 }
for (var i = 0; i < data.BOARD.length; i++) count[data.BOARD[i].type]++
h.eq('12 块地产（6 色组各 2 块）', count.prop, 12)
h.eq('4 条铁路', count.rail, 4)
h.eq('2 家公用事业', count.util, 2)
h.eq('1 张机会 / 1 张命运', [count.chance, count.chest], [1, 1])
h.eq('1 处税收', count.tax, 1)
h.eq('起点 / 监狱 / 入狱 各 1，无免费停车', [count.start, count.jail, count.gojail, count.free], [1, 1, 1, 0])
h.eq('6 个地产分组', Object.keys(data.GROUPS).length, 6)
h.eq('起点在 0 号格', data.BOARD[0].type, 'start')
h.eq('机会在 2 号格', data.BOARD[2].type, 'chance')
h.eq('监狱在 7 号格', data.BOARD[7].type, 'jail')
h.eq('命运在 11 号格', data.BOARD[11].type, 'chest')
h.eq('入狱在 15 号格', data.BOARD[15].type, 'gojail')
h.eq('拉萨 60 / 基础租金 2 / 抵押 30', [data.BOARD[1].price, data.BOARD[1].rent[0], data.BOARD[1].mortgage], [60, 2, 30])
h.eq('上海 400 / 旅馆租金 2000 / 抵押 200', [data.BOARD[22].price, data.BOARD[22].rent[5], data.BOARD[22].mortgage], [400, 2000, 200])
h.eq('陇海铁路 200 / 抵押 100', [data.BOARD[4].price, data.BOARD[4].mortgage], [200, 100])
h.eq('电力公司 150 / 抵押 75', [data.BOARD[9].price, data.BOARD[9].mortgage], [150, 75])
h.eq('棕色组 2 格 / 深蓝组 2 格 / 浅蓝组 2 格',
  [data.groupCells('brown').length, data.groupCells('darkblue').length, data.groupCells('lightblue').length], [2, 2, 2])

// ── 初始状态 ────────────────────────────────────────────────────────
h.suite('monopoly/初始状态')
var s0 = mp.newGame()
h.eq('双方 1500', s0.money, [1500, 1500])
h.eq('双方在起点', s0.pos, [0, 0])
h.eq('24 格全部无主', s0.owner.indexOf(0) + s0.owner.indexOf(1), -2)
h.eq('24 格全部无房', s0.houses.join(''), new Array(24).join('0') + '0')
h.eq('无人抵押', s0.mortgaged.indexOf(true), -1)
h.eq('待掷骰 / 先手蓝方 / 第 1 轮', [s0.pending.kind, s0.turn, s0.round], ['roll', 0, 1])
h.ok('合法动作含掷骰', mp.legalActions(s0).some(function (a) { return a.type === 'roll' }))

// ── 掷骰与移动 ──────────────────────────────────────────────────────
h.suite('monopoly/掷骰与移动')
var r1 = mp.applyAction(s0, { type: 'roll' }, 3)
h.eq('掷 3 停在格 3（成都）', r1.state.pos[0], 3)
h.eq('无人拥有 → 待购买决策', [r1.state.pending.kind, r1.state.pending.cell, r1.state.pending.price], ['buy', 3, 100])

var r2 = mp.applyAction(r1.state, { type: 'buy' })
h.eq('买下成都', r2.state.owner[3], 0)
h.eq('付出 100', r2.state.money[0], 1400)
h.eq('转入回合结束', r2.state.pending.kind, 'endTurn')

var r3 = mp.applyAction(r2.state, { type: 'endTurn' })
h.eq('交棒给红方', [r3.state.turn, r3.state.round], [1, 1])
// 红方先停在 17 号格（所得税前一格）：掷 2 步落到所得税 → 缴税后回合结束
r3.state.pos[1] = 17
var r4 = mp.applyAction(r3.state, { type: 'roll' }, 2)
h.eq('落到所得税并缴税', [r4.state.pos[1], r4.state.money[1]], [19, 1300])
h.eq('单骰：没有连掷，决策完即结束回合', r4.state.pending.kind, 'endTurn')

// ── 单骰规则（本轮由双骰改为「一颗骰子轮流投」） ────────────────────
h.suite('monopoly/单骰规则')
h.ok('骰子恒在 1~6', (function () {
  for (var k = 0; k <= 10; k++) {
    var d = mp.rollDice(k / 10)
    if (d < 1 || d > 6) return false
  }
  return true
})())
h.eq('注入数组时取第一个值', mp.rollDice([4, 5]), 4)
var sone = mp.newGame()
var o1 = mp.applyAction(sone, { type: 'roll' }, 6)
h.eq('掷 6 落无主地先给购买决策', [o1.state.pos[0], o1.state.pending.kind], [6, 'buy'])
var o2 = clearDecisions(mp.applyAction(o1.state, { type: 'declineBuy' }).state)
h.eq('单骰没有双骰连掷，决策完即结束回合', o2.pending.kind, 'endTurn')

// 经过起点领薪：把蓝方放到 21，掷 4 → 25 → 1，领 200
var sSalary = mp.newGame()
sSalary.pos[0] = 21
var rS = mp.applyAction(sSalary, { type: 'roll' }, 4)
h.eq('环形移动到格 1', rS.state.pos[0], 1)
h.eq('经过起点 +200', rS.state.money[0], 1700)

// ── 监狱流程 ────────────────────────────────────────────────────────
h.suite('monopoly/监狱流程')
var sj = mp.newGame()
sj.pos[0] = 7
sj.jail[0] = 3
var j1 = mp.applyAction(sj, { type: 'roll' }, 3)
h.eq('未掷出 6：留在监狱且剩 2 次', [j1.state.jail[0], j1.state.pos[0]], [2, 7])
h.eq('留在监狱本回合结束', j1.state.pending.kind, 'endTurn')

var sj2 = mp.newGame()
sj2.pos[0] = 7
sj2.jail[0] = 1
var j2 = clearDecisions(mp.applyAction(sj2, { type: 'roll' }, 3).state)
h.eq('第三次未掷出 6：缴罚金 50', j2.money[0], 1450)
h.eq('缴罚金后按点数前进（7+3=10）', j2.pos[0], 10)

var sj3 = mp.newGame()
sj3.pos[0] = 7
sj3.jail[0] = 2
var j3 = mp.applyAction(sj3, { type: 'roll' }, 6)        // 掷出 6 → 出狱并走 6 → 13 京哈铁路（无主）
h.eq('掷出 6 出狱', j3.state.jail[0], 0)
h.eq('按点数前进 6 格', j3.state.pos[0], 13)
h.eq('落地无主地先给购买决策', j3.state.pending.kind, 'buy')
var j3b = clearDecisions(mp.applyAction(j3.state, { type: 'declineBuy' }).state)
h.eq('出狱当回合结束', j3b.pending.kind, 'endTurn')

var sj4 = mp.newGame()
sj4.pos[0] = 7
sj4.jail[0] = 3
h.ok('监狱中可交罚金', mp.legalActions(sj4).some(function (a) { return a.type === 'payJailFine' }))
var j4 = mp.applyAction(sj4, { type: 'payJailFine' }, 2)
h.eq('交罚金后出狱并移动', [j4.state.jail[0], j4.state.money[0]], [0, 1450])

// ── 租金：成套加倍 / 房屋 / 抵押 ────────────────────────────────────
h.suite('monopoly/租金计算')
var sr = mp.newGame()
sr.owner[1] = 1                                  // 红方只有拉萨
h.eq('未成套基础租金 2', mp.rentOf(sr, 1, 7), 2)
sr.owner[3] = 1                                  // 红方凑齐棕色组
h.ok('成套成立', mp.ownsGroup(sr, 1, 'brown'))
h.eq('成套未建房租金加倍 4', mp.rentOf(sr, 1, 7), 4)
sr.houses[1] = 1
h.eq('1 栋房租金 10', mp.rentOf(sr, 1, 7), 10)
sr.houses[1] = 5
h.eq('旅馆租金 250', mp.rentOf(sr, 1, 7), 250)
sr.mortgaged[1] = true
h.eq('抵押后不收租', mp.rentOf(sr, 1, 7), 0)

var srail = mp.newGame()
srail.owner[4] = 1
h.eq('1 条铁路租金 25', mp.rentOf(srail, 4, 7), 25)
srail.owner[13] = 1
h.eq('2 条铁路租金 50', mp.rentOf(srail, 4, 7), 50)
srail.owner[21] = 1
h.eq('3 条铁路租金 100', mp.rentOf(srail, 4, 7), 100)
srail.owner[23] = 1
h.eq('4 条铁路租金 200', mp.rentOf(srail, 4, 7), 200)

var sutil = mp.newGame()
sutil.owner[9] = 1
h.eq('1 家公用事业 4 倍点数', mp.rentOf(sutil, 9, 7), 28)
sutil.owner[17] = 1
h.eq('2 家公用事业 10 倍点数', mp.rentOf(sutil, 9, 7), 70)

// ── 建房规则 ────────────────────────────────────────────────────────
h.suite('monopoly/建房规则')
var sb = mp.newGame()
sb.owner[1] = 0
sb.money[0] = 2000
h.ok('未成套不可建房', !mp.legalActions(sb).some(function (a) { return a.type === 'build' }))
sb.owner[3] = 0
h.ok('成套后可建房', mp.legalActions(sb).some(function (a) { return a.type === 'build' && a.cell === 1 }))
var b1 = mp.applyAction(sb, { type: 'build', cell: 1 })
h.eq('建第 1 栋花 50', b1.state.money[0], 1950)
h.eq('房屋数 1', b1.state.houses[1], 1)
h.ok('均匀建造：同一块不可连建第 2 栋', !mp.legalActions(b1.state).some(function (a) { return a.type === 'build' && a.cell === 1 }))
h.ok('均匀建造：另一块可建', mp.legalActions(b1.state).some(function (a) { return a.type === 'build' && a.cell === 3 }))

// ── 抵押与赎回 ──────────────────────────────────────────────────────
h.suite('monopoly/抵押与赎回')
var sm = mp.newGame()
sm.owner[1] = 0
var m1 = mp.applyAction(sm, { type: 'mortgage', cell: 1 })
h.eq('抵押取得 30', m1.state.money[0], 1530)
h.eq('抵押标记置位', m1.state.mortgaged[1], true)
h.eq('赎回需付 33（含 10% 利息）', mp.unmortgageCost({ mortgaged: m1.state.mortgaged }, 1), 33)
var m2 = mp.applyAction(m1.state, { type: 'unmortgage', cell: 1 })
h.eq('赎回后现金 1497', m2.state.money[0], 1497)
h.eq('赎回后抵押标记清除', m2.state.mortgaged[1], false)

// 同组有房时不可抵押（官方：须先卖掉同组建筑）
var sm2 = mp.newGame()
sm2.owner[1] = 0
sm2.owner[3] = 0
sm2.houses[3] = 1
h.ok('同组有房不可抵押', !mp.legalActions(sm2).some(function (a) { return a.type === 'mortgage' && a.cell === 1 }))
h.ok('可先卖房', mp.legalActions(sm2).some(function (a) { return a.type === 'sell' && a.cell === 3 }))
var sv = mp.applyAction(sm2, { type: 'sell', cell: 3 })
h.eq('卖房退回半价 25', sv.state.money[0], 1525)
h.ok('卖完房后可抵押', mp.legalActions(sv.state).some(function (a) { return a.type === 'mortgage' && a.cell === 1 }))

// ── 拍卖 ────────────────────────────────────────────────────────────
h.suite('monopoly/拍卖')
var sa = mp.newGame()
var a1 = mp.applyAction(sa, { type: 'roll' }, 3)
var a2 = mp.applyAction(a1.state, { type: 'declineBuy' })
h.eq('放弃购买 → 进入拍卖', a2.state.pending.kind, 'auction')
h.eq('起拍价为 0', a2.state.auction.high, 0)
var a3 = mp.applyAction(a2.state, { type: 'bid', amount: 30 })
h.eq('蓝方出价 30', a3.state.auction.high, 30)
var a4 = mp.applyAction(a3.state, { type: 'passBid' })
h.eq('红方放弃 → 蓝方拍得', a4.state.owner[3], 0)
h.eq('拍得者付 30', a4.state.money[0], 1470)
h.eq('拍卖结束回到回合结束', a4.state.pending.kind, 'endTurn')

// 事件契约：拍卖相关事件都带 kind 'auction' —— 页面据此把它们从「消息气泡」里滤掉
// （玩家反馈：竞拍走气泡一闪一闪浪费时间；拍卖状态改由环内状态行承担）。改事件文案/kind 时请同步页面。
function hasKind(ev, k) {
  for (var ei = 0; ei < ev.length; ei++) if (ev[ei].kind === k) return true
  return false
}
h.ok('放弃购买事件带 kind auction', hasKind(a2.events, 'auction'))
h.ok('出价事件带 kind auction', hasKind(a3.events, 'auction'))
h.ok('成交事件带 kind auction', hasKind(a4.events, 'auction'))

var sAuc2 = mp.newGame()
var f1 = mp.applyAction(sAuc2, { type: 'roll' }, 3)
var f2 = mp.applyAction(f1.state, { type: 'declineBuy' })
var f3 = mp.applyAction(f2.state, { type: 'passBid' })   // 蓝方一放弃，场上只剩红方 → 当场流拍收尾
var f4 = mp.applyAction(f3.state, { type: 'passBid' })   // 拍卖已结束 → 空操作（保留以确认不崩）
h.eq('双方都不出价 → 流拍仍归银行', f4.state.owner[3], -1)
h.eq('流拍后回回合结束', f4.state.pending.kind, 'endTurn')
h.ok('流拍事件也带 kind auction（避免残留气泡）', hasKind(f3.events, 'auction'))

// ── 债务与破产清算 ──────────────────────────────────────────────────
h.suite('monopoly/债务与破产')
var sd = mp.newGame()
sd.owner[3] = 1                                  // 红方拥有成都（棕组未成套）
sd.money[0] = 1                                  // 蓝方现金不足
var d1 = mp.applyAction(sd, { type: 'roll' }, 3)   // 掷 3 → 落在成都，基础租金 6
h.eq('付不起 → 转为待偿债务', d1.state.pending.kind, 'debt')
h.eq('债务金额 6 / 债权人红方', [d1.state.debt.amount, d1.state.debt.creditor], [6, 1])
h.eq('现金未扣（等着筹措）', d1.state.money[0], 1)
h.ok('债务期可抵押地皮筹钱', mp.legalActions(d1.state).some(function (a) { return a.type === 'mortgage' || a.type === 'declareBankrupt' }))

var sd2 = mp.newGame()
sd2.money[0] = 0
sd2.pending = { kind: 'debt' }
sd2.debt = { player: 0, amount: 100, creditor: 1 }
sd2.owner[1] = 0
var d2 = mp.applyAction(sd2, { type: 'declareBankrupt' })
h.eq('破产后蓝方出局', d2.state.alive[0], false)
h.eq('破产资产移交债权人', d2.state.owner[1], 1)
h.eq('终局判定为负', mp.checkOver(d2.state).result, 'lose')

// ── 终局 ────────────────────────────────────────────────────────────
h.suite('monopoly/终局')
var so = mp.newGame()
so.alive[1] = false
h.eq('红方出局 → 蓝方胜', mp.checkOver(so).result, 'win')
var so2 = mp.newGame()
so2.round = mp.MAX_ROUNDS + 1
so2.money = [3000, 1000]
h.eq('超轮次比总资产 → 蓝方领先', mp.checkOver(so2).result, 'win')
so2.money = [1000, 3000]
h.eq('超轮次比总资产 → 蓝方落后', mp.checkOver(so2).result, 'lose')

// ── 抽卡（把牌堆压成单张，使抽卡结果可复现） ───────────────────────
h.suite('monopoly/机会与命运')
var sc = mp.newGame()
sc.chance = ['c01']                              // 只留「前往上海」
var c1 = mp.applyAction(sc, { type: 'roll' }, 2)   // 掷 2 → 格 2 机会
h.ok('机会卡有播报', c1.events.some(function (e) { return e.text.indexOf('机会：前往上海') >= 0 }))
h.eq('前往上海（22 号格）', c1.state.pos[0], 22)
h.eq('上海无人拥有 → 待购买决策', c1.state.pending.kind, 'buy')

var sc2 = mp.newGame()
sc2.pos[0] = 9                                   // 掷 2 → 格 11 命运
sc2.chest = ['d02']                              // 只留「银行差错补 $200」
var c2 = mp.applyAction(sc2, { type: 'roll' }, 2)
h.ok('命运卡有播报', c2.events.some(function (e) { return e.text.indexOf('命运：银行差错补足你 $200') >= 0 }))
h.eq('银行差错补 $200', c2.state.money[0], 1700)

var sc3 = mp.newGame()
var c3 = mp.applyAction(sc3, { type: 'payJailFine' })
h.eq('不在监狱时交罚金无效', c3.state.money[0], 1500)
var sc4 = mp.newGame()
sc4.pos[0] = 7
sc4.jail[0] = 3
sc4.jailCards[0] = 1
var c4 = mp.applyAction(sc4, { type: 'useJailCard' }, 3)
h.eq('免狱卡用掉', c4.state.jailCards[0], 0)
h.eq('免狱卡出狱并移动', [c4.state.jail[0], c4.state.pos[0]], [0, 10])

// 商店免狱卡（赛季道具）：只清监禁，不自动掷骰，库存由页面扣
var sc5 = mp.newGame()
sc5.pos[0] = 7
sc5.jail[0] = 3
var c5 = mp.applyAction(sc5, { type: 'shopJailCard' })
h.eq('商店免狱卡清监禁', c5.state.jail[0], 0)
h.eq('商店免狱卡不自动掷骰（仍待掷）', c5.state.pending.kind, 'roll')
h.eq('商店免狱卡不占场上免狱卡', c5.state.jailCards[0], 0)
var sc6 = mp.newGame()
var c6 = mp.applyAction(sc6, { type: 'shopJailCard' })
h.eq('不在监狱时商店免狱卡无效', [c6.state.jail[0], c6.state.pos[0]], [0, 0])

// ── 回合数与交棒 ────────────────────────────────────────────────────
h.suite('monopoly/回合推进')
var st = mp.newGame()
var cur = st
for (var q = 0; q < 6; q++) {
  cur = mp.applyAction(cur, { type: 'roll' }, 3).state
  if (cur.pending && cur.pending.kind === 'buy') cur = mp.applyAction(cur, { type: 'declineBuy' }).state
  if (cur.pending && cur.pending.kind === 'auction') cur = mp.applyAction(cur, { type: 'passBid' }).state
  if (cur.pending && cur.pending.kind === 'auction') cur = mp.applyAction(cur, { type: 'passBid' }).state
  if (cur.pending && cur.pending.kind === 'endTurn') cur = mp.applyAction(cur, { type: 'endTurn' }).state
}
h.eq('六次行动后回到蓝方且轮次推进', [cur.turn, cur.round >= 2], [0, true])

// ── AI 决策可用 ─────────────────────────────────────────────────────
h.suite('monopoly/AI 决策')
var sai = mp.newGame()
var aiRoll = mp.aiAction(sai, 0.5)
h.eq('AI 会掷骰', aiRoll.type, 'roll')
var ai1 = mp.applyAction(sai, { type: 'roll' }, 3)
var aiBuy = mp.aiAction(ai1.state, 0.5)
h.ok('AI 对买地给出合法动作', ['buy', 'declineBuy'].indexOf(aiBuy.type) >= 0)

// 2026-10-24 强化：hard 会为「成套最后一块」提高买地与竞拍上限
var mpHard = monopoly.create('hard')
function buyProbe(money, ownSibling) {
  var s = mpHard.newGame()
  s.turn = 1
  s.money = [1500, money]
  if (ownSibling) s.owner[1] = 1   // 拉萨（成都的同组兄弟）
  s.pending = { kind: 'buy', cell: 3, price: 100 } // 成都 100
  return s
}
h.eq('hard 成套：留 20 也买', mpHard.aiAction(buyProbe(130, true), 0.5).type, 'buy')
h.eq('hard 非成套：留 30 不买', mpHard.aiAction(buyProbe(130, false), 0.5).type, 'declineBuy')
function aucProbe(ownSibling, high) {
  var s = mpHard.newGame()
  s.turn = 1
  s.money = [1500, 300]
  if (ownSibling) s.owner[1] = 1
  s.auction = { cell: 3, high: high, highBidder: 0, turn: 1, passed: [false, false] }
  s.pending = { kind: 'auction' }
  return s
}
h.eq('hard 成套竞拍上限 1.6×', mpHard.aiAction(aucProbe(true, 150), 0.5), { type: 'bid', amount: 160 })
h.eq('hard 非成套竞拍上限 1.2× → 放弃', mpHard.aiAction(aucProbe(false, 150), 0.5), { type: 'passBid' })

process.exit(h.summary())
