/**
 * rules/monopoly.js — 大富翁（24 格盘面）规则引擎。
 * 盘面数据在 monopoly-board.js（官方数字 + 中国地名），卡组在 monopoly-cards.js。
 * 规则（**单骰版**，2026-10 定案；文件头旧版写的「双骰再掷 / 三连双入狱」已作废）：
 *   单颗骰子轮流投掷、经过起点 +$200、成套未建房基础租金加倍、成套才可建房、
 *   房子须均匀建造、抵押须先卖掉同组建筑、赎回须多付 10% 利息、
 *   放弃购买即进入拍卖、资不抵债可抵押/卖房筹钱，仍不足则破产清算给债权人；
 *   监狱：掷出 6 才能出狱并按点数前进，连续三次未掷出 6 则缴罚金后行动。
 * 设计要点：
 *   · 纯函数 + 单一动作入口 applyAction(state, action, rand)：UI 与 AI 共用同一入口，
 *     双人热座与 AI 只差「谁来选动作」。
 *   · state.turn 表示当前行动者（0 蓝方 / 1 红方）；state.pending 表示「现在必须做什么」。
 *   · 随机数（骰子/抽卡）全部经 rand 参数注入，node 可直接测。
 *   · 所有返回的 state 都是新对象，不修改入参。
 */

var data = require('./monopoly-board.js')
var deckMod = require('./monopoly-cards.js')

var BOARD = data.BOARD
var N = data.BOARD_SIZE
var MAX_ROUNDS = 30          // 轮次上限（2 人对局通常更早结束于破产；到顶比总资产）

// 玩家名称（播报文案用；与棋子的蓝/红徽章一致）
var NAMES = ['蓝方', '红方']

function create(difficulty) {
  // ── 初始状态 ─────────────────────────────────────────────────────
  function newGame() {
    var owner = []
    var houses = []
    var mortgaged = []
    for (var i = 0; i < N; i++) { owner.push(-1); houses.push(0); mortgaged.push(false) }
    return {
      pos: [0, 0],
      money: [data.START_MONEY, data.START_MONEY],
      owner: owner,
      houses: houses,                 // 0..4 房屋；5 = 旅馆
      mortgaged: mortgaged,
      jail: [0, 0],                   // 剩余服刑尝试次数
      jailCards: [0, 0],              // 免狱卡张数
      doubles: [0, 0],                // 本回合连续双骰次数
      alive: [true, true],
      round: 1,
      turn: 0,                        // 当前行动者
      lastRoll: [0, 0],
      reRoll: false,                  // 双骰待再掷（与买地/拍卖决策叠加时不能丢）
      chance: idsOf(deckMod.CHANCE),
      chest: idsOf(deckMod.CHEST),
      auction: null,                  // { cell, high, highBidder, turn, passed }
      debt: null,                     // { player, amount, creditor }  creditor: 0|1|-1(银行)
      pending: { kind: 'roll' }       // roll|buy|auction|debt|endTurn|over
    }
  }

  function idsOf(deck) {
    var out = []
    for (var i = 0; i < deck.length; i++) out.push(deck[i].id)
    return out
  }

  function cardOf(deck, id) {
    for (var i = 0; i < deck.length; i++) if (deck[i].id === id) return deck[i]
    return deck[0]
  }

  function clone(s) {
    return {
      pos: [s.pos[0], s.pos[1]],
      money: [s.money[0], s.money[1]],
      owner: s.owner.slice(),
      houses: s.houses.slice(),
      mortgaged: s.mortgaged.slice(),
      jail: [s.jail[0], s.jail[1]],
      jailCards: [s.jailCards[0], s.jailCards[1]],
      doubles: [s.doubles[0], s.doubles[1]],
      alive: [s.alive[0], s.alive[1]],
      round: s.round,
      turn: s.turn,
      lastRoll: [s.lastRoll[0], s.lastRoll[1]],
      reRoll: !!s.reRoll,
      chance: s.chance.slice(),
      chest: s.chest.slice(),
      auction: s.auction ? {
        cell: s.auction.cell, high: s.auction.high, highBidder: s.auction.highBidder,
        turn: s.auction.turn, passed: s.auction.passed.slice()
      } : null,
      debt: s.debt ? { player: s.debt.player, amount: s.debt.amount, creditor: s.debt.creditor } : null,
      pending: s.pending ? { kind: s.pending.kind, cell: s.pending.cell, price: s.pending.price } : null
    }
  }

  // ── 基础查询 ─────────────────────────────────────────────────────
  // 内部：把注入的 rand 归一成 0~1 的数。rand 可以是数字（0~1），
  // 也可以是 [d1,d2] 数组（骰子注入）——数组时用第一个元素派生，保证可复现。
  function num(rand, salt) {
    var base
    if (rand === undefined) return Math.random()
    if (typeof rand === 'number') base = rand
    else base = rand[0]
    var s = salt || 1
    return (base * (9973 + s) + s * 0.37) % 1
  }

  // 输入：rand（0~1 数字，或 [点数] 数组直接指定）；输出：单颗骰子点数 1~6。
  // 说明（玩家决策）：大富翁与飞行棋一样**用一颗骰子轮流投**，因此不再有「双骰再掷」
  //   与「三连双入狱」；监狱改为「掷出 6 才能出狱」。
  function rollDice(rand) {
    if (rand === undefined) return 1 + Math.floor(Math.random() * 6)
    if (typeof rand !== 'number' && rand && rand.length >= 1) {
      return Math.max(1, Math.min(6, Math.floor(rand[0])))
    }
    // 数字 ≥ 1：直接当作骰子点数（测试注入用）；0~1：当作随机数派生
    if (typeof rand === 'number' && rand >= 1) return Math.max(1, Math.min(6, Math.floor(rand)))
    return 1 + Math.floor(num(rand, 1) * 6)
  }

  function groupCells(group) { return data.groupCells(group) }

  // 输入：state、player、group；输出：是否独占该组（且组内无抵押）。
  function ownsGroup(s, player, group) {
    var list = groupCells(group)
    for (var i = 0; i < list.length; i++) {
      if (s.owner[list[i]] !== player || s.mortgaged[list[i]]) return false
    }
    return true
  }

  // 输入：state、player；输出：持有的未抵押铁路条数。
  function railCount(s, player) {
    var n = 0
    for (var i = 0; i < N; i++) {
      if (BOARD[i].type === 'rail' && s.owner[i] === player && !s.mortgaged[i]) n++
    }
    return n
  }

  // 输入：state、player；输出：持有的未抵押公用事业家数。
  function utilCount(s, player) {
    var n = 0
    for (var i = 0; i < N; i++) {
      if (BOARD[i].type === 'util' && s.owner[i] === player && !s.mortgaged[i]) n++
    }
    return n
  }

  // 输入：state、格号、骰子和；输出：落脚应缴租金（0 = 不缴）。
  function rentOf(s, idx, diceSum) {
    var c = BOARD[idx]
    var owner = s.owner[idx]
    if (owner < 0 || s.mortgaged[idx]) return 0
    if (c.type === 'prop') {
      if (s.houses[idx] > 0) return c.rent[s.houses[idx]]
      return ownsGroup(s, owner, c.group) ? c.rent[0] * 2 : c.rent[0]
    }
    if (c.type === 'rail') return data.RAIL_RENT[railCount(s, owner)]
    if (c.type === 'util') return data.UTIL_MULT[utilCount(s, owner)] * diceSum
    return 0
  }

  // 输入：state、player；输出：总资产（现金 + 未抵押地价 + 房屋折半 + 抵押地价）。
  function netWorth(s, player) {
    var sum = s.money[player]
    for (var i = 0; i < N; i++) {
      if (s.owner[i] !== player) continue
      var c = BOARD[i]
      if (c.type === 'prop' || c.type === 'rail' || c.type === 'util') {
        sum += s.mortgaged[i] ? c.mortgage : c.price
      }
      if (s.houses[i] > 0) sum += Math.floor(houseCost(i) * s.houses[i] / 2)
    }
    return sum
  }

  function houseCost(idx) { return data.GROUPS[BOARD[idx].group].houseCost }

  // 输入：state、group；输出：该组的房屋总数 / 最大值 / 最小值（均匀建造以最小值为准）。
  function groupStats(s, group) {
    var list = groupCells(group)
    var total = 0
    var max = 0
    var min = 99
    for (var i = 0; i < list.length; i++) {
      var h = s.houses[list[i]]
      total += h
      if (h > max) max = h
      if (h < min) min = h
    }
    if (min === 99) min = 0
    return { total: total, max: max, min: min }
  }

  // ── 内部：资金收付（不足则转为债务） ──────────────────────────────
  // 输入：state、付款方、金额、收款方（-1 = 银行）、事件数组；
  // 输出：true = 已付清；false = 转为待偿债务（调用方须把 pending 设为 debt）。
  function charge(s, player, amount, creditor, ev) {
    if (amount <= 0) return true
    if (s.money[player] >= amount) {
      s.money[player] -= amount
      if (creditor >= 0) s.money[creditor] += amount
      return true
    }
    s.debt = { player: player, amount: amount, creditor: creditor }
    ev.push({ player: player, text: NAMES[player] + '资金不足，需筹措 $' + amount, delta: 0, kind: 'warn' })
    return false
  }

  function gain(s, player, amount) { s.money[player] += amount }

  // ── 内部：移动 ───────────────────────────────────────────────────
  // 前进 steps 格（环形），经过起点领薪。输出：落点格号。
  function step(s, player, steps, ev) {
    var from = s.pos[player]
    var to = from + steps
    if (to >= N) {
      gain(s, player, data.START_SALARY)
      ev.push({ player: player, text: NAMES[player] + '经过起点，领取 $' + data.START_SALARY, delta: data.START_SALARY, kind: 'salary' })
    }
    to = to % N
    s.pos[player] = to
    return to
  }

  // 前往指定格；若目标在身后则绕一圈（同样领薪）。
  function gotoCell(s, player, target, ev) {
    var from = s.pos[player]
    if (target === from) return target
    var steps = (target - from + N) % N
    return step(s, player, steps, ev)
  }

  // 内部：一次决策（买地/拍卖/偿债）处理完后，回到「该做什么」：
  // 双骰待再掷就继续掷，否则结束回合。
  function settleDecision(s) {
    s.pending = { kind: 'endTurn' }
  }

  function sendToJail(s, player, ev) {
    s.pos[player] = data.JAIL_POS
    s.jail[player] = data.JAIL_MAX_TURNS
    ev.push({ player: player, text: NAMES[player] + '被送入监狱', delta: 0, kind: 'jail' })
  }

  // ── 内部：落点结算 ───────────────────────────────────────────────
  // 返回值：无（按要求设置 s.pending；不需要决策时把 s.pending 置 null）。
  function landOn(s, player, ev, rand, depth) {
    var d = depth || 0
    var idx = s.pos[player]
    var c = BOARD[idx]
    s.pending = null
    if (c.type === 'prop' || c.type === 'rail' || c.type === 'util') {
      var owner = s.owner[idx]
      if (owner < 0) {
        s.pending = { kind: 'buy', cell: idx, price: c.price }
        return
      }
      if (owner === player) {
        ev.push({ player: player, text: NAMES[player] + '停在自己的 ' + c.name, delta: 0, kind: 'info' })
        return
      }
      var sum = s.lastRoll || 0
      var rent = rentOf(s, idx, sum)
      if (rent <= 0) {
        ev.push({ player: player, text: c.name + ' 已抵押，本回合不再收租', delta: 0, kind: 'info' })
        return
      }
      ev.push({ player: player, text: NAMES[player] + '在 ' + c.name + ' 停留，支付租金 $' + rent + ' 给 ' + NAMES[owner], delta: -rent, kind: 'rent' })
      if (!charge(s, player, rent, owner, ev)) s.pending = { kind: 'debt' }
      return
    }
    if (c.type === 'tax') {
      ev.push({ player: player, text: NAMES[player] + '缴纳' + c.name + ' $' + c.amount, delta: -c.amount, kind: 'tax' })
      if (!charge(s, player, c.amount, -1, ev)) s.pending = { kind: 'debt' }
      return
    }
    if (c.type === 'gojail') {
      sendToJail(s, player, ev)
      return
    }
    if (c.type === 'free') {
      ev.push({ player: player, text: NAMES[player] + '停在免费停车，本回合无事发生', delta: 0, kind: 'info' })
      return
    }
    if (c.type === 'jail') {
      ev.push({ player: player, text: NAMES[player] + '只是探监，下回合照常行动', delta: 0, kind: 'info' })
      return
    }
    if (c.type === 'start') {
      ev.push({ player: player, text: NAMES[player] + '停在起点', delta: 0, kind: 'info' })
      return
    }
    if (c.type === 'chance' || c.type === 'chest') {
      if (d > 3) return                                  // 防「连抽」死循环
      applyCard(s, player, c.type === 'chance' ? 'chance' : 'chest', ev, rand, d)
      return
    }
  }

  // 内部：抽卡并结算；advance / back3 会递归回落到落点结算。
  function applyCard(s, player, which, ev, rand, depth) {
    var deck = which === 'chance' ? deckMod.CHANCE : deckMod.CHEST
    var pool = which === 'chance' ? s.chance : s.chest
    var r = num(rand, 7)
    if (!pool.length) {
      var refill = idsOf(deck)
      if (which === 'chance') s.chance = refill; else s.chest = refill
      pool = refill
    }
    var pickIdx = Math.floor(r * pool.length) % pool.length
    var id = pool[pickIdx]
    var card = cardOf(deck, id)
    var rest = pool.slice()
    // 免狱卡由玩家保留，不循环回牌堆
    if (card.effect.kind !== 'freeJail') rest.splice(pickIdx, 1)
    if (which === 'chance') s.chance = rest; else s.chest = rest

    ev.push({ player: player, text: (which === 'chance' ? '机会' : '命运') + '：' + card.text, delta: 0, kind: 'card' })
    var e = card.effect
    if (e.kind === 'money') {
      gain(s, player, e.delta)
      return
    }
    if (e.kind === 'freeJail') {
      s.jailCards[player]++
      return
    }
    if (e.kind === 'goJail') {
      sendToJail(s, player, ev)
      return
    }
    if (e.kind === 'payEach' || e.kind === 'collectEach') {
      var sign = e.kind === 'payEach' ? -1 : 1
      var total = 0
      for (var p = 0; p < 2; p++) {
        if (p === player || !s.alive[p]) continue
        // 简化：按对手实际可付金额转移，避免出现负现金
        var can = Math.min(e.amount, Math.max(0, s.money[p]))
        s.money[p] -= can
        total += can
      }
      s.money[player] += sign * total
      ev.push({ player: player, text: (sign > 0 ? '收到' : '付出') + ' $' + total, delta: sign * total, kind: 'card' })
      return
    }
    if (e.kind === 'repairs') {
      var bill = 0
      for (var i = 0; i < N; i++) {
        if (s.owner[i] !== player) continue
        if (s.houses[i] === 5) bill += e.perHotel
        else bill += e.perHouse * s.houses[i]
      }
      ev.push({ player: player, text: '房屋维修合计 $' + bill, delta: -bill, kind: 'repairs' })
      if (bill > 0 && !charge(s, player, bill, -1, ev)) s.pending = { kind: 'debt' }
      return
    }
    if (e.kind === 'back3') {
      s.pos[player] = (s.pos[player] - 3 + N) % N
      ev.push({ player: player, text: NAMES[player] + '后退三格，回到 ' + BOARD[s.pos[player]].name, delta: 0, kind: 'info' })
      landOn(s, player, ev, rand, (depth || 0) + 1)
      return
    }
    if (e.kind === 'advance') {
      gotoCell(s, player, e.to, ev)
      ev.push({ player: player, text: NAMES[player] + '前往 ' + BOARD[e.to].name, delta: 0, kind: 'info' })
      landOn(s, player, ev, rand, (depth || 0) + 1)
      return
    }
    if (e.kind === 'nearestRail' || e.kind === 'nearestUtil') {
      var want = e.kind === 'nearestRail' ? 'rail' : 'util'
      var target = -1
      for (var k = 1; k <= N; k++) {
        var cand = (s.pos[player] + k) % N
        if (BOARD[cand].type === want) { target = cand; break }
      }
      if (target < 0) return
      gotoCell(s, player, target, ev)
      ev.push({ player: player, text: NAMES[player] + '前往最近的' + (want === 'rail' ? '铁路 ' : '公用事业 ') + BOARD[target].name, delta: 0, kind: 'info' })
      // 有主则付双倍租金（铁路）/十倍点数（公用事业）；无主走正常购买决策
      if (s.owner[target] >= 0 && s.owner[target] !== player) {
        var sum2 = s.lastRoll
        var owner2 = s.owner[target]
        var rent2 = want === 'rail'
          ? data.RAIL_RENT[railCount(s, owner2)] * 2
          : data.UTIL_MULT[utilCount(s, owner2)] * sum2
        if (s.mortgaged[target]) { rent2 = 0 }
        if (rent2 > 0) {
          ev.push({ player: player, text: NAMES[player] + '按卡面规则支付 $' + rent2 + ' 给 ' + NAMES[owner2], delta: -rent2, kind: 'rent' })
          if (!charge(s, player, rent2, owner2, ev)) s.pending = { kind: 'debt' }
        }
        return
      }
      landOn(s, player, ev, rand, (depth || 0) + 1)
      return
    }
  }

  // ── 动作合法性 ───────────────────────────────────────────────────
  // 输出：state.turn 当前可执行的全部动作（建房/卖房/抵押/赎回属自由动作，在自己回合开放）。
  function legalActions(s) {
    var p = s.turn
    var k = s.pending ? s.pending.kind : 'over'
    var out = []
    if (!s.alive[p] || k === 'over') return out
    if (k === 'roll') {
      if (s.jail[p] > 0) {
        if (s.jailCards[p] > 0) out.push({ type: 'useJailCard' })
        if (s.money[p] >= data.JAIL_FINE) out.push({ type: 'payJailFine' })
      }
      out.push({ type: 'roll' })
    } else if (k === 'buy') {
      out.push({ type: 'buy' })
      out.push({ type: 'declineBuy' })
    } else if (k === 'auction') {
      var a = s.auction
      out.push({ type: 'bid', min: a.high + 1, max: s.money[a.turn] })
      out.push({ type: 'passBid' })
    } else if (k === 'debt') {
      var d = s.debt
      if (s.money[d.player] >= d.amount) out.push({ type: 'payDebt' })
      out.push({ type: 'declareBankrupt' })
    } else if (k === 'endTurn') {
      out.push({ type: 'endTurn' })
    }
    // 自由动作：不在「买地决策」与「拍卖」中时开放；债务期只允许卖房/抵押（筹钱），不允许建房
    if (k !== 'buy' && k !== 'auction') {
      for (var i = 0; i < N; i++) {
        if (s.owner[i] !== p) continue
        if (k !== 'debt' && canBuild(s, p, i)) out.push({ type: 'build', cell: i })
        if (s.houses[i] > 0) out.push({ type: 'sell', cell: i })
        if (!s.mortgaged[i] && s.houses[i] === 0 && canMortgage(s, p, i)) out.push({ type: 'mortgage', cell: i })
        if (s.mortgaged[i] && s.money[p] >= unmortgageCost(s, i)) out.push({ type: 'unmortgage', cell: i })
      }
    }
    return out
  }

  function canBuild(s, p, idx) {
    var c = BOARD[idx]
    if (c.type !== 'prop' || s.houses[idx] >= 5) return false
    if (!ownsGroup(s, p, c.group)) return false
    var st = groupStats(s, c.group)
    if (s.houses[idx] !== st.min) return false          // 均匀建造：只能建在房屋最少的地块上
    return s.money[p] >= houseCost(idx)
  }

  function canMortgage(s, p, idx) {
    var c = BOARD[idx]
    if (c.type === 'prop') {
      var list = groupCells(c.group)
      for (var i = 0; i < list.length; i++) if (s.houses[list[i]] > 0) return false
      return true
    }
    return true
  }

  function unmortgageCost(s, idx) {
    return Math.ceil(BOARD[idx].mortgage * (1 + data.MORTGAGE_INTEREST))
  }

  // ── 动作执行 ─────────────────────────────────────────────────────
  // 输入：state、动作、rand；输出：{ state(新), events[] }。
  // state.pending 表示执行后「下一步要做什么」。
  function applyAction(state, action, rand) {
    var s = clone(state)
    var ev = []
    if (!action || !action.type) return { state: s, events: ev }
    var p = s.turn
    var t = action.type

    if (t === 'roll') {
      if (!(s.pending && s.pending.kind === 'roll')) return { state: s, events: ev }
      doRoll(s, p, ev, rand)
      return { state: s, events: ev }
    }

    if (t === 'useJailCard') {
      if (s.jailCards[p] <= 0 || s.jail[p] <= 0) return { state: s, events: ev }
      s.jailCards[p]--
      s.jail[p] = 0
      ev.push({ player: p, text: NAMES[p] + '使用免狱卡出狱', delta: 0, kind: 'jail' })
      doRoll(s, p, ev, rand)
      return { state: s, events: ev }
    }

    if (t === 'shopJailCard') {
      // 赛季商店买的免狱卡（库存由页面管，规则层只负责清监禁状态）：
      // 与运气卡不同，这里**不自动掷骰**，清完监狱后 pending 仍是 roll，玩家自己点骰子。
      if (s.jail[p] <= 0) return { state: s, events: ev }
      s.jail[p] = 0
      ev.push({ player: p, text: NAMES[p] + '使用免狱卡出狱', delta: 0, kind: 'jail' })
      return { state: s, events: ev }
    }

    if (t === 'payJailFine') {
      if (s.jail[p] <= 0 || s.money[p] < data.JAIL_FINE) return { state: s, events: ev }
      s.money[p] -= data.JAIL_FINE
      s.jail[p] = 0
      ev.push({ player: p, text: NAMES[p] + '缴纳罚金 $' + data.JAIL_FINE + ' 出狱', delta: -data.JAIL_FINE, kind: 'jail' })
      doRoll(s, p, ev, rand)
      return { state: s, events: ev }
    }

    if (t === 'buy') {
      var cell = s.pending && s.pending.kind === 'buy' ? s.pending.cell : -1
      if (cell < 0) return { state: s, events: ev }
      var price = BOARD[cell].price
      if (s.money[p] < price) { settleDecision(s); return { state: s, events: ev } }
      s.money[p] -= price
      s.owner[cell] = p
      ev.push({ player: p, text: NAMES[p] + '买下 ' + BOARD[cell].name + '，支付 $' + price, delta: -price, kind: 'buy' })
      settleDecision(s)
      return { state: s, events: ev }
    }

    if (t === 'declineBuy') {
      var c2 = s.pending && s.pending.kind === 'buy' ? s.pending.cell : -1
      if (c2 < 0) return { state: s, events: ev }
      ev.push({ player: p, text: NAMES[p] + '放弃购买 ' + BOARD[c2].name + '，进入拍卖', delta: 0, kind: 'auction' })
      s.auction = { cell: c2, high: 0, highBidder: -1, turn: s.turn, passed: [false, false] }
      s.pending = { kind: 'auction' }
      return { state: s, events: ev }
    }
    if (t === 'bid') {
      if (!s.auction) return { state: s, events: ev }
      var amt = action.amount
      var bidder = s.auction.turn
      if (amt <= s.auction.high || amt > s.money[bidder]) return { state: s, events: ev }
      s.auction.high = amt
      s.auction.highBidder = bidder
      ev.push({ player: bidder, text: NAMES[bidder] + '出价 $' + amt + ' 竞拍 ' + BOARD[s.auction.cell].name, delta: 0, kind: 'auction' })
      s.auction.turn = 1 - bidder
      if (activeBidders(s.auction) <= 1) resolveAuction(s, ev)
      if (s.auction) { s.pending = { kind: 'auction' } } else { settleDecision(s) }
      return { state: s, events: ev }
    }

    if (t === 'passBid') {
      if (!s.auction) return { state: s, events: ev }
      s.auction.passed[s.auction.turn] = true
      ev.push({ player: s.auction.turn, text: NAMES[s.auction.turn] + '放弃竞拍', delta: 0, kind: 'auction' })
      if (activeBidders(s.auction) <= 1) resolveAuction(s, ev)
      else s.auction.turn = 1 - s.auction.turn
      if (s.auction) { s.pending = { kind: 'auction' } } else { settleDecision(s) }
      return { state: s, events: ev }
    }

    if (t === 'payDebt') {
      if (!s.debt) return { state: s, events: ev }
      var dd = s.debt
      if (s.money[dd.player] < dd.amount) return { state: s, events: ev }
      s.money[dd.player] -= dd.amount
      if (dd.creditor >= 0) s.money[dd.creditor] += dd.amount
      ev.push({ player: dd.player, text: NAMES[dd.player] + '付清欠款 $' + dd.amount + (dd.creditor >= 0 ? ' 给 ' + NAMES[dd.creditor] : ' 给银行'), delta: -dd.amount, kind: 'pay' })
      s.debt = null
      settleDecision(s)
      return { state: s, events: ev }
    }

    if (t === 'declareBankrupt') {
      if (!s.debt) return { state: s, events: ev }
      bankrupt(s, ev)
      s.debt = null
      return { state: s, events: ev }
    }

    if (t === 'build') {
      if (!canBuild(s, p, action.cell)) return { state: s, events: ev }
      var hc = houseCost(action.cell)
      s.money[p] -= hc
      s.houses[action.cell]++
      ev.push({ player: p, text: NAMES[p] + '在 ' + BOARD[action.cell].name + (s.houses[action.cell] === 5 ? ' 建成旅馆' : ' 加盖第 ' + s.houses[action.cell] + ' 栋房屋') + '，支付 $' + hc, delta: -hc, kind: 'build' })
      return { state: s, events: ev }
    }

    if (t === 'sell') {
      var sc = BOARD[action.cell]
      if (s.owner[action.cell] !== p || s.houses[action.cell] <= 0) return { state: s, events: ev }
      var back = Math.floor(houseCost(action.cell) / 2)
      s.houses[action.cell]--
      s.money[p] += back
      ev.push({ player: p, text: NAMES[p] + '拆除 ' + sc.name + ' 的房屋，退回 $' + back, delta: back, kind: 'sell' })
      return { state: s, events: ev }
    }

    if (t === 'mortgage') {
      if (s.owner[action.cell] !== p || s.mortgaged[action.cell] || !canMortgage(s, p, action.cell)) return { state: s, events: ev }
      s.mortgaged[action.cell] = true
      s.money[p] += BOARD[action.cell].mortgage
      ev.push({ player: p, text: NAMES[p] + '抵押 ' + BOARD[action.cell].name + '，取得 $' + BOARD[action.cell].mortgage, delta: BOARD[action.cell].mortgage, kind: 'mortgage' })
      return { state: s, events: ev }
    }

    if (t === 'unmortgage') {
      var cost = unmortgageCost(s, action.cell)
      if (s.owner[action.cell] !== p || !s.mortgaged[action.cell] || s.money[p] < cost) return { state: s, events: ev }
      s.money[p] -= cost
      s.mortgaged[action.cell] = false
      ev.push({ player: p, text: NAMES[p] + '赎回 ' + BOARD[action.cell].name + '，支付 $' + cost + '（含 10% 利息）', delta: -cost, kind: 'unmortgage' })
      return { state: s, events: ev }
    }

    if (t === 'endTurn') {
      if (s.pending && (s.pending.kind === 'buy' || s.pending.kind === 'auction')) return { state: s, events: ev }
      if (s.pending && s.pending.kind === 'debt') return { state: s, events: ev }
      s.reRoll = false
      nextTurn(s, ev)
      return { state: s, events: ev }
    }

    return { state: s, events: ev }
  }

  // 内部：拍卖中「尚未放弃」的竞拍者数量。
  function activeBidders(a) {
    var n = 0
    for (var i = 0; i < a.passed.length; i++) if (!a.passed[i]) n++
    return n
  }

  // 内部：拍卖收尾（成交/流拍）。
  function resolveAuction(s, ev) {
    var a = s.auction
    if (!a) return
    if (a.highBidder >= 0 && a.high > 0) {
      s.money[a.highBidder] -= a.high
      s.owner[a.cell] = a.highBidder
      ev.push({ player: a.highBidder, text: NAMES[a.highBidder] + '以 $' + a.high + ' 拍得 ' + BOARD[a.cell].name, delta: -a.high, kind: 'auction' })
    } else {
      ev.push({ player: -1, text: BOARD[a.cell].name + ' 流拍，仍归银行', delta: 0, kind: 'auction' })
    }
    s.auction = null
  }

  // 内部：破产清算（资产移交债权人，房屋按半价折给债权人）。
  function bankrupt(s, ev) {
    var p = s.debt ? s.debt.player : s.turn
    var creditor = s.debt ? s.debt.creditor : -1
    var cash = s.money[p]
    s.money[p] = 0
    for (var i = 0; i < N; i++) {
      if (s.owner[i] !== p) continue
      if (s.houses[i] > 0) {
        var refund = Math.floor(houseCost(i) * s.houses[i] / 2)
        if (creditor >= 0) s.money[creditor] += refund
        s.houses[i] = 0
      }
      if (creditor >= 0) s.owner[i] = creditor
      else { s.owner[i] = -1; s.mortgaged[i] = false }
    }
    if (creditor >= 0) s.money[creditor] += cash
    s.alive[p] = false
    ev.push({ player: p, text: NAMES[p] + '破产清算，全部资产移交' + (creditor >= 0 ? NAMES[creditor] : '银行'), delta: 0, kind: 'bankrupt' })
    var other = 1 - p
    if (s.alive[other]) {
      s.pending = { kind: 'over' }
    }
  }

  // 内部：掷骰（单骰，含监狱流程）。
  // 监狱规则（配合单骰）：掷出 6 即可出狱并按点数前进；连续三次没掷出 6 则缴罚金后行动。
  function doRoll(s, p, ev, rand) {
    var dice = rollDice(rand)
    s.lastRoll = dice
    ev.push({ player: p, text: NAMES[p] + '掷出 ' + dice, delta: 0, kind: 'roll' })

    if (s.jail[p] > 0) {
      if (dice === 6) {
        s.jail[p] = 0
        ev.push({ player: p, text: NAMES[p] + '掷出 6，离开监狱并按点数前进', delta: 0, kind: 'jail' })
        step(s, p, dice, ev)
        landOn(s, p, ev, rand, 0)
      } else {
        s.jail[p]--
        if (s.jail[p] > 0) {
          ev.push({ player: p, text: NAMES[p] + '未掷出 6，继续留在监狱', delta: 0, kind: 'jail' })
          s.pending = { kind: 'endTurn' }
          return
        }
        s.money[p] -= data.JAIL_FINE
        s.jail[p] = 0
        ev.push({ player: p, text: NAMES[p] + '第三次未掷出 6，缴纳罚金 $' + data.JAIL_FINE + ' 后行动', delta: -data.JAIL_FINE, kind: 'jail' })
        step(s, p, dice, ev)
        landOn(s, p, ev, rand, 0)
      }
      // 出狱当回合不再加掷
      if (!s.pending) s.pending = { kind: 'endTurn' }
      return
    }

    step(s, p, dice, ev)
    landOn(s, p, ev, rand, 0)
    if (s.pending) return                      // 等决策（买地/债务）
    s.pending = { kind: 'endTurn' }
  }

  // 内部：交棒。轮次在回到 0 号玩家时 +1。
  function nextTurn(s, ev) {
    var nxt = 1 - s.turn
    if (!s.alive[nxt]) nxt = s.turn
    if (nxt === s.turn) { s.pending = { kind: 'over' }; return }
    if (nxt === 0) s.round++
    s.turn = nxt
    s.pending = { kind: 'roll' }
    ev.push({ player: s.turn, text: '轮到 ' + NAMES[s.turn] + ' 行动', delta: 0, kind: 'turn' })
  }

  // ── AI ───────────────────────────────────────────────────────────
  // 输入：state、rand；输出：一个动作（页面循环调用直到 pending 需要真人输入）。
  // 内部：该玩家是否已拥有同色组另一块地（成套前最后一块价值更高）。
  function ownsSibling(s, p, cell) {
    var c = BOARD[cell]
    if (!c || !c.group) return false
    for (var i = 0; i < BOARD.length; i++) {
      if (i !== cell && BOARD[i].group === c.group && s.owner[i] === p) return true
    }
    return false
  }

  // 内部：对手是否已握有同色组另一块（买下这块可阻止对手成套，战略价值更高）。
  function foeOwnsSibling(s, p, cell) {
    var c = BOARD[cell]
    if (!c || !c.group) return false
    for (var i = 0; i < BOARD.length; i++) {
      if (i !== cell && BOARD[i].group === c.group && s.owner[i] === 1 - p) return true
    }
    return false
  }

  // 内部：AI 现金安全垫——按对手当前最大单次租金估算「下一次踩到要付多少」，
  // 再留 60 缓冲。上限 400，避免旅馆期把 AI 吓得完全不敢投资。
  function cashReserve(s, p) {
    var threat = 0
    for (var i = 0; i < N; i++) {
      if (s.owner[i] !== 1 - p || s.mortgaged[i]) continue
      var r = rentOf(s, i, 7)
      if (r > threat) threat = r
    }
    return Math.min(400, Math.max(120, threat + 60))
  }

  // 内部：某格是否属于已独占的完整色组（成套值更高，卖/抵押时最后动）。
  function inCompleteGroup(s, p, idx) {
    var c = BOARD[idx]
    return c.type === 'prop' && ownsGroup(s, p, c.group)
  }

  // 内部：该地产的租金潜力（抵押排序用：低潜力先抵押，尽量保住成套/高租金）。
  function assetValue(idx) {
    var c = BOARD[idx]
    if (c.type === 'prop') return c.rent[0]
    if (c.type === 'rail') return 25
    if (c.type === 'util') return 4
    return 0
  }

  // 内部：建房收益分（租金增量 ÷ 建房费；成套再加成）。
  function buildScore(s, p, idx) {
    var c = BOARD[idx]
    if (c.type !== 'prop') return 0
    var h = s.houses[idx]
    var gain = c.rent[h + 1] - c.rent[h]
    var cost = houseCost(idx)
    var sc = cost > 0 ? gain / cost * 100 : 0
    if (ownsGroup(s, p, c.group)) sc += 30
    return sc
  }

  function aiAction(s, rand) {
    var acts = legalActions(s)
    if (!acts.length) return null
    var k = s.pending ? s.pending.kind : 'over'
    if (k === 'roll') {
      var r = rand !== undefined ? rand : Math.random()
      // 简单：有钱就保释（hard），否则掷骰
      if (s.jail[s.turn] > 0) {
        if (s.jailCards[s.turn] > 0) return pick(acts, 'useJailCard')
        if (difficulty === 'hard' && s.money[s.turn] >= data.JAIL_FINE + 200) return pick(acts, 'payJailFine')
      }
      return { type: 'roll' }
    }
    if (k === 'buy') {
      var cell = s.pending.cell
      var price = s.pending.price
      var surplus = s.money[s.turn] - price
      var synergy = ownsSibling(s, s.turn, cell)
      var foeSibling = foeOwnsSibling(s, s.turn, cell)
      var r2 = num(rand, 11)
      var want = false
      // 成套最后一块：hard 只要留 20 就买；若这块能卡住对手成套（对手有同组兄弟），
      // 也值得用较低安全垫抢下；普通留 100；easy 基本不抢。
      if (difficulty === 'hard') want = surplus >= (synergy ? 20 : (foeSibling ? 40 : 50))
      else if (difficulty === 'normal') want = surplus >= (synergy ? 100 : 150) && r2 < 0.85
      else want = surplus >= 300 && r2 < 0.6
      return { type: want ? 'buy' : 'declineBuy' }
    }
    if (k === 'auction') {
      var a = s.auction
      // 成套最后一块出价上限更高（hard 1.6×，普通/简单 1.0×）；否则维持原来的 1.2× / 0.8×
      var synergyA = ownsSibling(s, a.turn, a.cell)
      var mult = difficulty === 'hard' ? (synergyA ? 1.6 : 1.2) : (synergyA ? 1.0 : 0.8)
      var budget = Math.min(s.money[a.turn] - 50, Math.floor(BOARD[a.cell].price * mult))
      if (a.high + 1 <= budget) {
        var step10 = a.high + 10
        return { type: 'bid', amount: step10 <= budget ? step10 : a.high + 1 }
      }
      return { type: 'passBid' }
    }
    if (k === 'debt') {
      var d = s.debt
      if (s.money[d.player] >= d.amount) return { type: 'payDebt' }
      // 债务处理（2026-10-24 强化）：优先抵押「非成套、低租金」地产（只失去抵押权，
      // 不拆房）；其次卖非成套组的房；最后才动成套组 —— 尽量不拆掉核心资产。
      var pDebt = d.player
      var bestMort = null
      var bestMortV = 99999
      var bestSell = null
      var bestSellCost = 99999
      var bestSetMort = null
      var bestSetV = 99999
      var bestSetSell = null
      var bestSetSellCost = 99999
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i]
        var grp = inCompleteGroup(s, pDebt, a.cell)
        if (a.type === 'mortgage') {
          var av = assetValue(a.cell)
          if (!grp && av < bestMortV) { bestMortV = av; bestMort = a }
          if (grp && av < bestSetV) { bestSetV = av; bestSetMort = a }
        } else if (a.type === 'sell') {
          var hc = houseCost(a.cell)
          if (!grp && hc < bestSellCost) { bestSellCost = hc; bestSell = a }
          if (grp && hc < bestSetSellCost) { bestSetSellCost = hc; bestSetSell = a }
        }
      }
      if (bestMort) return bestMort
      if (bestSell) return bestSell
      if (bestSetMort) return bestSetMort
      if (bestSetSell) return bestSetSell
      return { type: 'declareBankrupt' }
    }
    if (k === 'endTurn') {
      var acts2 = legalActions(s)
      var pEnd = s.turn
      var keep = cashReserve(s, pEnd)
      // 建房：在满足安全垫的前提下选「租金增量/成本」最高的一手（hard 才按收益挑，
      // normal/easy 沿用原来的保守现金线，避免难度档行为趋同）。
      var bestBuild = null
      var bestScore = -1
      var cashKeep = difficulty === 'hard' ? keep : (difficulty === 'normal' ? 300 : 600)
      for (var b = 0; b < acts2.length; b++) {
        if (acts2[b].type !== 'build') continue
        if (s.money[pEnd] - houseCost(acts2[b].cell) < cashKeep) continue
        var bs = buildScore(s, pEnd, acts2[b].cell)
        if (bs > bestScore) { bestScore = bs; bestBuild = acts2[b] }
      }
      if (bestBuild) return bestBuild
      // 赎回：现金宽裕时优先赎回「成套且租金高」的地产
      var bestUn = null
      var bestUnScore = -1
      for (var u = 0; u < acts2.length; u++) {
        if (acts2[u].type !== 'unmortgage') continue
        if (s.money[pEnd] - unmortgageCost(s, acts2[u].cell) < keep + 150) continue
        var us = assetValue(acts2[u].cell) + (inCompleteGroup(s, pEnd, acts2[u].cell) ? 100 : 0)
        if (us > bestUnScore) { bestUnScore = us; bestUn = acts2[u] }
      }
      if (bestUn) return bestUn
      return { type: 'endTurn' }
    }
    return acts[0]
  }

  function pick(acts, type) {
    for (var i = 0; i < acts.length; i++) if (acts[i].type === type) return acts[i]
    return acts[0]
  }

  // ── 终局 ─────────────────────────────────────────────────────────
  function checkOver(s) {
    if (!s.alive[0]) return { result: 'lose', reason: '蓝方破产清算' }
    if (!s.alive[1]) return { result: 'win', reason: '红方破产清算' }
    if (s.round > MAX_ROUNDS) {
      var w0 = netWorth(s, 0)
      var w1 = netWorth(s, 1)
      if (w0 > w1) return { result: 'win', reason: MAX_ROUNDS + ' 轮总资产领先' }
      if (w0 < w1) return { result: 'lose', reason: MAX_ROUNDS + ' 轮总资产落后' }
      return { result: 'draw', reason: MAX_ROUNDS + ' 轮总资产持平' }
    }
    return null
  }

  return {
    BOARD: BOARD,
    GROUPS: data.GROUPS,
    BOARD_SIZE: N,
    MAX_ROUNDS: MAX_ROUNDS,
    START_MONEY: data.START_MONEY,
    JAIL_POS: data.JAIL_POS,
    GO_TO_JAIL_POS: data.GO_TO_JAIL_POS,
    JAIL_FINE: data.JAIL_FINE,
    NAMES: NAMES,
    newGame: newGame,
    rollDice: rollDice,
    ownsGroup: ownsGroup,
    railCount: railCount,
    utilCount: utilCount,
    rentOf: rentOf,
    netWorth: netWorth,
    houseCost: houseCost,
    groupStats: groupStats,
    unmortgageCost: unmortgageCost,
    legalActions: legalActions,
    applyAction: applyAction,
    aiAction: aiAction,
    checkOver: checkOver
  }
}

module.exports = { create: create }
