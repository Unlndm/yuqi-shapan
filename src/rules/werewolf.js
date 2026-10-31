/**
 * rules/werewolf.js — 狼人杀纯规则 / AI 引擎。
 *
 * 模式：create(9 | '9', rand) → 9 人标准局（3 狼人 / 预言家 / 女巫 / 猎人 / 3 村民）
 *       create(6 | '6', rand) → 6 人精简局（2 狼人 / 预言家 / 女巫 / 2 村民）
 * rand：可注入 utils/rng.js 的随机器（含 next() 的对象）或 0~1 函数；缺省 Math.random。
 *       同一颗种子、同样的调用顺序 → 身份分配、AI 决策完全可复现。
 *
 * state 字段（UI 只读；所有推进都走 act，禁止直接改）：
 *   mode        9 / 6
 *   day         当前天数（第 1 天 = 第 1 夜）
 *   phase       'night' | 'day' | 'end'
 *   step        'wolf' | 'seer' | 'witch' | 'hunter' | 'discuss' | 'vote' | 'end'
 *   actor       当前需要决策的玩家 id；-1 = 无可行动者（已结束）
 *   players[]   {id, seat, role, faction, alive, isHuman, claim}
 *   wolfIds[]   全部狼人 id（含已死亡；人类视角由 visibleInfo 过滤）
 *   night       {killTarget, saved, poison, seerTarget, seerResult, resolved}
 *   witch       {heal, poison}（剩余药水）
 *   votes       {voterId: targetId|null}；voteOrder / voteIndex 为投票顺序
 *   exiled      本轮被放逐者 id
 *   hunterPending / pendingFrom  猎人开枪子流程
 *   claims      {playerId: 'seer'|'witch'|'hunter'|'villager'} 公开身份声明
 *   claimDay    {playerId: day} 声明发生在第几天（防止怀疑值每日重复累加）
 *   mind        {playerId: {sus[], claim, checks[]}} AI 怀疑值 / 查验记录
 *   threat      {playerId: n} 对狼人阵营的威胁计数（投票记录累积）
 *   speeches[]  发言记录
 *   log[]       {day, phase, type, text, scope, to?}；scope = public / wolf / private
 *   winner      null | {winner:'wolf'|'good', reason}
 *   _rand       内部随机器引用（不参与 JSON，不暴露给 UI）
 *
 * 导出：
 *   create(mode, rand)      创建初始局面
 *   act(state, action)      → {ok, state, events} 或 {ok:false, error, state}（入参 state 不变）
 *   aiChoose(state)         → 当前 AI 行动者的合法 action；人类回合返回 null
 *   checkWin(state)         → null | {winner, reason}
 *   visibleInfo(state, pid) 人类视角信息（只暴露合法信息）
 *   log(state, pid)         人类视角日志
 *   ROLES / ROLE_NAME       身份常量
 *
 * 动作类型（act 的 action.type）：
 *   wolfKill {target: id|null}        夜间狼人刀人（null = 空刀）
 *   seerCheck {target: id}            夜间预言家查验
 *   witch {heal: bool, poison: id|null} 夜间女巫用药（不可双药）
 *   speak {text, claim?}              白天人类发言（claim 可选公开声明）
 *   toVote {}                         白天结束讨论，进入投票
 *   vote {target: id|null}            投票（null = 弃票，不能投自己）
 *   hunterShoot {target: id|null}     猎人开枪（null = 不开枪）
 */

var ROLES = ['wolf', 'seer', 'witch', 'hunter', 'villager']
var ROLE_NAME = { wolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', villager: '村民' }
var CLAIMABLE = { seer: true, witch: true, hunter: true, villager: true }

// 输入：随机器（对象 / 函数 / 空）；输出：统一的 {next,int,pick,shuffle,chance}。
function makeRand(rand) {
  var src = rand
  function next() {
    if (typeof src === 'function') {
      var v = src()
      return typeof v === 'number' && isFinite(v) ? v : Math.random()
    }
    if (src && typeof src.next === 'function') {
      var w = src.next()
      return typeof w === 'number' && isFinite(w) ? w : Math.random()
    }
    return Math.random()
  }
  function int(n) {
    var lim = typeof n === 'number' && isFinite(n) ? Math.floor(n) : 0
    if (lim <= 0) return 0
    var v = Math.floor(next() * lim)
    return v >= lim ? lim - 1 : v
  }
  function pick(arr) {
    if (!arr || !arr.length) return null
    return arr[int(arr.length)]
  }
  function shuffle(arr) {
    var out = arr ? arr.slice() : []
    for (var i = out.length - 1; i > 0; i--) {
      var j = int(i + 1)
      var t = out[i]
      out[i] = out[j]
      out[j] = t
    }
    return out
  }
  function chance(p) {
    var v = typeof p === 'number' && isFinite(p) ? p : 0
    if (v <= 0) return false
    if (v >= 1) return true
    return next() < v
  }
  return { next: next, int: int, pick: pick, shuffle: shuffle, chance: chance }
}

// 内部：取局面的随机器（create 时已挂载；兜底再包一层）。
function rndOf(st) {
  if (!st._rand || typeof st._rand.next !== 'function') st._rand = makeRand(st._rand)
  return st._rand
}

// 内部：深拷贝（_rand 仅保留引用）。
function cloneValue(v) {
  if (v === null || typeof v !== 'object') return v
  if (Object.prototype.toString.call(v) === '[object Array]') {
    var arr = []
    for (var i = 0; i < v.length; i++) arr.push(cloneValue(v[i]))
    return arr
  }
  var o = {}
  for (var k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = cloneValue(v[k])
  }
  return o
}

function cloneState(st) {
  var out = {}
  for (var k in st) {
    if (!Object.prototype.hasOwnProperty.call(st, k)) continue
    out[k] = k === '_rand' ? st[k] : cloneValue(st[k])
  }
  return out
}

// 输入：玩家 id；输出：显示名（1 号、2 号……）。
function nameOf(id) {
  return (id + 1) + '号'
}

// 输入：玩家 id、阵营 / 身份；输出：中文短语。
function factionName(f) {
  return f === 'wolf' ? '狼人阵营' : '好人阵营'
}

// 内部：写日志（自动带天数与阶段）。
function addLog(st, entry) {
  entry.day = st.day
  entry.phase = st.phase
  st.log.push(entry)
  return entry
}

// 内部：存活玩家 id 列表（按座位顺序）。
function aliveIds(st) {
  var out = []
  for (var i = 0; i < st.players.length; i++) if (st.players[i].alive) out.push(i)
  return out
}

// 内部：存活狼人 / 存活好人计数。
function countAlive(st) {
  var wolf = 0
  var good = 0
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive) continue
    if (p.role === 'wolf') wolf++
    else good++
  }
  return { wolf: wolf, good: good }
}

// 内部：存活某身份玩家（该身份唯一）。
function livingByRole(st, role) {
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (p.alive && p.role === role) return p
  }
  return null
}

// 输入：局面；输出：胜负或 null（纯函数，不改 state）。
function checkWin(state) {
  if (!state || !state.players) return null
  if (state.winner) return state.winner
  var c = countAlive(state)
  if (c.wolf === 0) return { winner: 'good', reason: '狼人全灭' }
  if (c.wolf >= c.good) return { winner: 'wolf', reason: '狼人数量不少于好人' }
  return null
}

// 内部：判定胜负，若有结果则收尾；返回是否结束。
function finishIfWin(st) {
  var w = checkWin(st)
  if (!w) return false
  st.winner = w
  st.phase = 'end'
  st.step = 'end'
  st.actor = -1
  addLog(st, {
    scope: 'public',
    type: 'end',
    text: '游戏结束：' + factionName(w.winner) + '获胜（' + w.reason + '）。'
  })
  var parts = []
  for (var i = 0; i < st.players.length; i++) {
    parts.push(nameOf(i) + ' 是 ' + ROLE_NAME[st.players[i].role])
  }
  addLog(st, { scope: 'public', type: 'reveal', text: '身份揭晓：' + parts.join('，') + '。' })
  return true
}

// 内部：进入夜晚（不增加天数），重置夜间字段与行动者。
function enterNight(st) {
  st.phase = 'night'
  st.step = 'wolf'
  st.night = {
    killTarget: null,
    saved: false,
    poison: null,
    seerTarget: null,
    seerResult: null,
    resolved: false
  }
  st.votes = {}
  st.voteOrder = []
  st.voteIndex = 0
  st.exiled = null
  st.hunterPending = null
  st.pendingFrom = null

  var wolves = []
  for (var i = 0; i < st.players.length; i++) {
    if (st.players[i].alive && st.players[i].role === 'wolf') wolves.push(i)
  }
  if (wolves.length === 0) {
    finishIfWin(st)
    return
  }
  // 人类是存活狼人 → 由人类决定刀口；否则由第一只存活 AI 狼合议。
  if (st.players[0].isHuman && st.players[0].alive && st.players[0].role === 'wolf') {
    st.actor = 0
  } else {
    st.actor = wolves[0]
  }
  addLog(st, {
    scope: 'public',
    type: 'night',
    text: '第 ' + st.day + ' 夜开始。'
  })
}

// 内部：进入下一夜（天数 +1）。
function nextNight(st) {
  st.day = st.day + 1
  enterNight(st)
}

// 内部：狼人刀人完成后 → 预言家。
function toSeer(st) {
  var seer = livingByRole(st, 'seer')
  if (seer) {
    st.step = 'seer'
    st.actor = seer.id
    return
  }
  toWitch(st)
}

// 内部：预言家查验完成后 → 女巫（药水用尽 / 已死则直接结算）。
function toWitch(st) {
  var witch = livingByRole(st, 'witch')
  if (witch && (st.witch.heal > 0 || st.witch.poison > 0)) {
    st.step = 'witch'
    st.actor = witch.id
    return
  }
  resolveNight(st)
}

// 内部：夜晚结算（刀口 / 毒药 → 死讯 → 猎人 → 白天）。
function resolveNight(st) {
  st.night.resolved = true
  var deaths = []
  var kt = st.night.killTarget
  if (kt !== null && kt !== undefined && !st.night.saved && st.players[kt].alive) deaths.push(kt)
  var pt = st.night.poison
  if (pt !== null && pt !== undefined && deaths.indexOf(pt) < 0 && st.players[pt].alive) deaths.push(pt)
  for (var i = 0; i < deaths.length; i++) st.players[deaths[i]].alive = false

  var names = []
  for (i = 0; i < deaths.length; i++) names.push(nameOf(deaths[i]))
  addLog(st, {
    scope: 'public',
    type: 'deaths',
    deaths: deaths.slice(),
    text: deaths.length
      ? '第 ' + st.day + ' 天：昨晚 ' + names.join('、') + ' 倒下了。'
      : '第 ' + st.day + ' 天：昨晚是平安夜。'
  })

  // 猎人被动：夜间死亡仍可开枪，开完枪再判胜负。
  var hunter = null
  for (i = 0; i < deaths.length; i++) {
    if (st.players[deaths[i]].role === 'hunter') {
      hunter = deaths[i]
      break
    }
  }
  if (hunter !== null) {
    st.step = 'hunter'
    st.hunterPending = hunter
    st.pendingFrom = 'night'
    st.actor = hunter
    return
  }
  if (finishIfWin(st)) return
  enterDay(st)
}

// 内部：进入白天（发言 + 可选的人类发言，然后投票）。
function enterDay(st) {
  st.phase = 'day'
  st.step = 'discuss'
  st.votes = {}
  st.voteOrder = []
  st.voteIndex = 0
  st.exiled = null
  generateSpeeches(st)
  if (st.players[0].isHuman && st.players[0].alive) {
    st.actor = 0
  } else {
    // 人类已出局：自动进入投票，由 AI 继续推进（观战模式）。
    st.actor = -1
    startVote(st)
  }
}

// 内部：AI 发言模板（跳预言家 / 悍跳 / 归票 / 怀疑 / 观望）。
function generateSpeeches(st) {
  var rnd = rndOf(st)
  var alive = aliveIds(st)
  for (var k = 0; k < alive.length; k++) {
    var id = alive[k]
    var p = st.players[id]
    if (p.isHuman) continue
    var mind = st.mind[id]
    var text = ''
    var claim = null

    if (p.role === 'seer') {
      var last = mind.checks.length ? mind.checks[mind.checks.length - 1] : null
      if (last && (last.result === 'wolf' || st.day >= 2 || rnd.chance(0.4))) {
        claim = 'seer'
        text = '我是预言家，昨晚查验 ' + nameOf(last.target) + '，他是' +
          (last.result === 'wolf' ? '狼人' : '好人') + '。'
        if (last.result === 'wolf') text += '今天归票 ' + nameOf(last.target) + '。'
      }
    }

    // 狼人悍跳：公开对跳预言家，优先抹黑真预言家的声明。
    if (!text && p.role === 'wolf' && rnd.chance(0.35)) {
      var fake = null
      var claimedSeer = null
      for (var c = 0; c < alive.length; c++) {
        var cid = alive[c]
        if (cid === id || st.players[cid].role === 'wolf') continue
        if (st.claims[cid] === 'seer') claimedSeer = cid
      }
      if (claimedSeer !== null) fake = claimedSeer
      else {
        var goodPool = []
        for (c = 0; c < alive.length; c++) {
          if (st.players[alive[c]].role !== 'wolf' && alive[c] !== id) goodPool.push(alive[c])
        }
        fake = goodPool.length ? rnd.pick(goodPool) : null
      }
      if (fake !== null) {
        claim = 'seer'
        text = '我是预言家，昨晚查验 ' + nameOf(fake) + ' 是狼人。今天归票 ' + nameOf(fake) + '。'
      }
    }

    if (!text) {
      var target = worstSuspect(st, id, true)
      if (target !== null) {
        var score = st.mind[id].sus[target]
        if (score >= 40) text = '我怀疑 ' + nameOf(target) + '，今天归票 ' + nameOf(target) + '。'
        else if (score > 0) text = '我有点怀疑 ' + nameOf(target) + '，他的发言我不太信。'
        else text = '我先听大家发言，暂时没有明确目标。'
      } else {
        text = '人不多，我先听大家发言。'
      }
    }

    var entry = {
      scope: 'public',
      type: 'speech',
      by: id,
      text: nameOf(id) + '：' + text
    }
    if (claim) entry.claim = claim
    addLog(st, entry)
    st.speeches.push({ day: st.day, by: id, text: text, claim: claim })

    if (claim) {
      st.claims[id] = claim
      st.claimDay[id] = st.day
      p.claim = claim
      st.mind[id].claim = claim
    }
  }
  resolveClaimSuspicion(st)
}

// 内部：处理公开身份声明带来的怀疑值变化（真预言家视角 / 村民视角）。
function resolveClaimSuspicion(st) {
  var claimants = []
  for (var id in st.claims) {
    if (!Object.prototype.hasOwnProperty.call(st.claims, id)) continue
    if (st.claims[id] === 'seer' && st.players[Number(id)].alive) claimants.push(Number(id))
  }
  if (!claimants.length) return
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive || p.isHuman) continue
    if (p.role === 'wolf') continue // 狼人知道队友，不受公开声明影响
    var mind = st.mind[i]
    if (p.role === 'seer') {
      // 真预言家：其余跳预言家的人必是狼（只在对方当天新跳时加一次，避免每天重复累加）。
      for (var j = 0; j < claimants.length; j++) {
        if (claimants[j] !== i && st.claimDay[claimants[j]] === st.day) {
          mind.sus[claimants[j]] += 100
        }
      }
    } else {
      // 普通好人：先跳者略可信，后跳者对跳可疑（同样只在当天新声明时结算）。
      for (var m = 1; m < claimants.length; m++) {
        if (claimants[m] !== i && st.claimDay[claimants[m]] === st.day) {
          mind.sus[claimants[m]] += 25
        }
      }
      if (claimants.length === 1 && claimants[0] !== i && st.claimDay[claimants[0]] === st.day) {
        mind.sus[claimants[0]] -= 10
      }
    }
  }
}

// 内部：某 AI 视角下最可疑的存活玩家（ties 用注入随机决定）。
// onlyPositive：仅在怀疑值 > 0 时返回，否则 null。
function worstSuspect(st, viewerId, onlyPositive) {
  var rnd = rndOf(st)
  var best = []
  var bestScore = -1e9
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive || i === viewerId) continue
    var s = st.mind[viewerId].sus[i]
    if (onlyPositive && s <= 0) continue
    if (s > bestScore) {
      bestScore = s
      best = [i]
    } else if (s === bestScore) {
      best.push(i)
    }
  }
  if (!best.length) return null
  return best.length === 1 ? best[0] : best[rnd.int(best.length)]
}

// 内部：开始投票（存活玩家按座位顺序依次投票）。
function startVote(st) {
  st.step = 'vote'
  st.votes = {}
  st.voteIndex = 0
  st.voteOrder = aliveIds(st)
  addLog(st, { scope: 'public', type: 'voteStart', text: '开始投票。' })
  if (!st.voteOrder.length) {
    st.actor = -1
    return
  }
  st.actor = st.voteOrder[0]
}

// 内部：投票统计 → 放逐 / 平票 → 下一夜。
function tally(st) {
  var counts = {}
  var alive = aliveIds(st)
  for (var i = 0; i < alive.length; i++) counts[alive[i]] = 0
  for (var k = 0; k < st.voteOrder.length; k++) {
    var target = st.votes[st.voteOrder[k]]
    if (target !== null && target !== undefined && counts[target] !== undefined) counts[target]++
  }
  var max = 0
  var top = []
  for (i = 0; i < alive.length; i++) {
    var n = counts[alive[i]]
    if (n > max) {
      max = n
      top = [alive[i]]
    } else if (n === max && n > 0) {
      top.push(alive[i])
    }
  }
  if (max > 0 && top.length === 1) {
    var outId = top[0]
    st.players[outId].alive = false
    st.exiled = outId
    addLog(st, {
      scope: 'public',
      type: 'exile',
      target: outId,
      text: nameOf(outId) + ' 被放逐出局。'
    })
    if (st.players[outId].role === 'hunter') {
      st.step = 'hunter'
      st.hunterPending = outId
      st.pendingFrom = 'day'
      st.actor = outId
      return
    }
    if (finishIfWin(st)) return
    nextNight(st)
    return
  }
  addLog(st, {
    scope: 'public',
    type: 'noExile',
    text: max === 0 ? '无人得票，本轮无人出局。' : '平票，本轮无人出局。'
  })
  if (finishIfWin(st)) return
  nextNight(st)
}

// 内部：投票后更新怀疑值（被投者怀疑投票者；狼人记录被投狼人的威胁）。
function applyVoteSuspicion(st, voter, target) {
  if (target === null || target === undefined) return
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive || p.isHuman) continue
    if (i === voter) continue
    if (target === i) st.mind[i].sus[voter] += 15
    if (p.role === 'wolf' && st.players[target].role === 'wolf' && voter !== i) {
      st.threat[voter] = (st.threat[voter] || 0) + 1
    }
  }
}

// 内部：AI 狼的刀人评分：神职声明 > 对狼有威胁 > 随机扰动；队友永远排除。
function chooseKill(st, wolfId) {
  var rnd = rndOf(st)
  var best = []
  var bestScore = -1e9
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive || i === wolfId || p.role === 'wolf') continue
    var score = 0
    if (p.claim === 'seer') score += 60
    else if (p.claim === 'witch') score += 45
    else if (p.claim === 'hunter') score += 40
    score += (st.threat[i] || 0) * 15
    score += rnd.int(8)
    if (score > bestScore) {
      bestScore = score
      best = [i]
    } else if (score === bestScore) {
      best.push(i)
    }
  }
  if (!best.length) return null
  return best.length === 1 ? best[0] : best[rnd.int(best.length)]
}

// 内部：AI 预言家优先查验未查过且最可疑的人。
function chooseCheck(st, seerId) {
  var rnd = rndOf(st)
  var mind = st.mind[seerId]
  var checked = {}
  for (var c = 0; c < mind.checks.length; c++) checked[mind.checks[c].target] = true
  var fresh = []
  var all = []
  for (var i = 0; i < st.players.length; i++) {
    var p = st.players[i]
    if (!p.alive || i === seerId) continue
    all.push(i)
    if (!checked[i]) fresh.push(i)
  }
  var pool = fresh.length ? fresh : all
  if (!pool.length) return null
  var best = []
  var bestScore = -1e9
  for (var k = 0; k < pool.length; k++) {
    var s = mind.sus[pool[k]] + rnd.int(3)
    if (s > bestScore) {
      bestScore = s
      best = [pool[k]]
    } else if (s === bestScore) {
      best.push(pool[k])
    }
  }
  return best.length === 1 ? best[0] : best[rnd.int(best.length)]
}

// 内部：AI 女巫决策（救 / 毒 / 不用）。
function chooseWitch(st, witchId) {
  var rnd = rndOf(st)
  var heal = false
  var poison = null
  var kt = st.night.killTarget
  if (st.witch.heal > 0 && kt !== null && kt !== undefined && st.players[kt].alive) {
    var target = st.players[kt]
    var chance = 0.2
    if (target.claim === 'seer') chance = 0.9
    else if (target.claim === 'witch') chance = 0.75
    else if (kt === witchId) chance = 0.8
    else if (st.mind[witchId].sus[kt] < 0) chance = 0.45
    if (rnd.chance(chance)) heal = true
  }
  if (!heal && st.witch.poison > 0) {
    var t = worstSuspect(st, witchId, false)
    var sus = t === null ? 0 : st.mind[witchId].sus[t]
    // 只有在怀疑值足够高时才动毒药，避免 AI 无依据乱毒好人。
    if (t !== null && sus >= 40 && rnd.chance(0.7)) poison = t
    else if (t !== null && sus >= 20 && rnd.chance(0.3)) poison = t
  }
  return { type: 'witch', heal: heal, poison: poison }
}

// 内部：AI 投票目标（不投自己；狼人不投队友；狼人优先投跳预言家的好人）。
function chooseVote(st, voterId) {
  var rnd = rndOf(st)
  var p = st.players[voterId]
  var best = []
  var bestScore = -1e9
  for (var i = 0; i < st.players.length; i++) {
    var q = st.players[i]
    if (!q.alive || i === voterId) continue
    if (p.role === 'wolf' && q.role === 'wolf') continue
    var score = st.mind[voterId].sus[i]
    if (p.role === 'wolf') {
      if (q.claim === 'seer') score += 60
      else if (q.claim === 'witch') score += 30
      score += (st.threat[i] || 0) * 10
    } else if (q.claim === 'seer') {
      score -= 20
    }
    if (score > bestScore) {
      bestScore = score
      best = [i]
    } else if (score === bestScore) {
      best.push(i)
    }
  }
  if (!best.length) return null
  return best.length === 1 ? best[0] : best[rnd.int(best.length)]
}

// 内部：AI 猎人开枪目标（最可疑者；没有目标则不开枪）。
function chooseHunter(st, hunterId) {
  return worstSuspect(st, hunterId, false)
}

// 输入：局面；输出：当前 AI 行动者的 action；人类回合 / 已结束返回 null。
function aiChoose(state) {
  if (!state || state.phase === 'end') return null
  var id = state.actor
  if (id === null || id === undefined || id < 0) return null
  var p = state.players[id]
  if (!p || p.isHuman) return null

  if (state.step === 'hunter') {
    return { type: 'hunterShoot', target: chooseHunter(state, id) }
  }
  if (state.phase === 'night') {
    if (state.step === 'wolf' && p.role === 'wolf' && p.alive) {
      return { type: 'wolfKill', target: chooseKill(state, id) }
    }
    if (state.step === 'seer' && p.role === 'seer' && p.alive) {
      return { type: 'seerCheck', target: chooseCheck(state, id) }
    }
    if (state.step === 'witch' && p.role === 'witch' && p.alive) {
      return chooseWitch(state, id)
    }
  }
  if (state.phase === 'day') {
    if (state.step === 'discuss') return { type: 'toVote' }
    if (state.step === 'vote' && p.alive) {
      return { type: 'vote', target: chooseVote(state, id) }
    }
  }
  return null
}

// 内部：非法动作统一返回（原 state 保持不变）。
function fail(state, error) {
  return { ok: false, error: error, state: state }
}

// 输入：局面、动作；输出：{ok, state, events} / {ok:false, error, state}。
function act(state, action) {
  if (!state || typeof state !== 'object' || !state.players) return fail(state, '缺少有效局面')
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return fail(state, '动作格式错误')
  }
  if (state.phase === 'end') return fail(state, '游戏已结束')
  if (state.actor === null || state.actor === undefined || state.actor < 0) {
    return fail(state, '当前没有可行动角色')
  }
  if (action.player !== undefined && action.player !== state.actor) {
    return fail(state, '不是该玩家的回合')
  }

  var st = cloneState(state)
  var before = st.log.length
  var actor = st.actor
  var p = st.players[actor]
  var i

  if (!p) return fail(state, '行动者不存在')

  if (action.type === 'wolfKill') {
    if (st.phase !== 'night' || st.step !== 'wolf') return fail(state, '当前不是狼人刀人阶段')
    if (!p.alive || p.role !== 'wolf') return fail(state, '只有存活狼人才能刀人')
    var kt = action.target === undefined ? null : action.target
    if (kt !== null) {
      if (typeof kt !== 'number' || !st.players[kt] || !st.players[kt].alive) {
        return fail(state, '刀人目标无效')
      }
      if (st.players[kt].role === 'wolf') return fail(state, '不能刀队友')
    }
    st.night.killTarget = kt
    addLog(st, {
      scope: 'wolf',
      type: 'wolfKill',
      target: kt,
      text: kt === null ? '狼人合议：今晚空刀。' : '狼人合议：今晚击杀 ' + nameOf(kt) + '。'
    })
    toSeer(st)
  } else if (action.type === 'seerCheck') {
    if (st.phase !== 'night' || st.step !== 'seer') return fail(state, '当前不是预言家查验阶段')
    if (!p.alive || p.role !== 'seer') return fail(state, '只有存活预言家才能查验')
    var ct = action.target
    if (typeof ct !== 'number' || !st.players[ct] || !st.players[ct].alive || ct === actor) {
      return fail(state, '查验目标无效')
    }
    var result = st.players[ct].role === 'wolf' ? 'wolf' : 'good'
    st.night.seerTarget = ct
    st.night.seerResult = result
    st.mind[actor].checks.push({ target: ct, result: result, day: st.day })
    st.mind[actor].sus[ct] += result === 'wolf' ? 100 : -50
    addLog(st, {
      scope: 'private',
      to: actor,
      type: 'seerCheck',
      target: ct,
      result: result,
      text: '你查验 ' + nameOf(ct) + '，他是' + (result === 'wolf' ? '狼人' : '好人') + '。'
    })
    toWitch(st)
  } else if (action.type === 'witch') {
    if (st.phase !== 'night' || st.step !== 'witch') return fail(state, '当前不是女巫用药阶段')
    if (!p.alive || p.role !== 'witch') return fail(state, '只有存活女巫才能用药')
    var heal = !!action.heal
    var poison = action.poison === undefined ? null : action.poison
    if (heal && poison !== null) return fail(state, '同夜不能同时使用解药和毒药')
    if (heal) {
      if (st.witch.heal <= 0) return fail(state, '解药已用完')
      if (st.night.killTarget === null || st.night.killTarget === undefined) return fail(state, '今晚没有刀口可救')
      if (!st.players[st.night.killTarget].alive) return fail(state, '刀口目标已出局')
      st.night.saved = true
      st.witch.heal--
      addLog(st, {
        scope: 'private',
        to: actor,
        type: 'witchHeal',
        text: '你使用解药救下了 ' + nameOf(st.night.killTarget) + '。'
      })
    }
    if (poison !== null) {
      if (typeof poison !== 'number' || !st.players[poison] || !st.players[poison].alive ||
          poison === actor) {
        return fail(state, '毒药目标无效')
      }
      if (st.witch.poison <= 0) return fail(state, '毒药已用完')
      st.night.poison = poison
      st.witch.poison--
      addLog(st, {
        scope: 'private',
        to: actor,
        type: 'witchPoison',
        text: '你使用毒药毒杀了 ' + nameOf(poison) + '。'
      })
    }
    if (!heal && poison === null) {
      addLog(st, { scope: 'private', to: actor, type: 'witchPass', text: '你今晚没有用药。' })
    }
    resolveNight(st)
  } else if (action.type === 'speak') {
    if (st.phase !== 'day' || st.step !== 'discuss') return fail(state, '当前不是讨论阶段')
    if (!p.alive) return fail(state, '出局玩家不能发言')
    var text = action.text
    if (typeof text !== 'string' || !text.replace(/^\s+|\s+$/g, '').length) {
      return fail(state, '发言内容不能为空')
    }
    if (text.length > 200) return fail(state, '发言过长')
    var claim = action.claim === undefined ? null : action.claim
    if (claim !== null && !CLAIMABLE[claim]) return fail(state, '身份声明无效')
    var entry = {
      scope: 'public',
      type: 'speech',
      by: actor,
      text: nameOf(actor) + '：' + text
    }
    if (claim) entry.claim = claim
    addLog(st, entry)
    st.speeches.push({ day: st.day, by: actor, text: text, claim: claim })
    if (claim) {
      st.claims[actor] = claim
      st.claimDay[actor] = st.day
      p.claim = claim
    }
  } else if (action.type === 'toVote') {
    if (st.phase !== 'day' || st.step !== 'discuss') return fail(state, '当前不是讨论阶段')
    startVote(st)
  } else if (action.type === 'vote') {
    if (st.phase !== 'day' || st.step !== 'vote') return fail(state, '当前不是投票阶段')
    if (!p.alive) return fail(state, '出局玩家不能投票')
    var vt = action.target === undefined ? null : action.target
    if (vt !== null) {
      if (typeof vt !== 'number' || !st.players[vt] || !st.players[vt].alive) {
        return fail(state, '投票目标无效')
      }
      if (vt === actor) return fail(state, '不能投自己')
    }
    st.votes[actor] = vt
    addLog(st, {
      scope: 'public',
      type: 'vote',
      by: actor,
      target: vt,
      text: vt === null ? nameOf(actor) + ' 弃票。' : nameOf(actor) + ' 投给了 ' + nameOf(vt) + '。'
    })
    applyVoteSuspicion(st, actor, vt)
    st.voteIndex++
    if (st.voteIndex < st.voteOrder.length) {
      st.actor = st.voteOrder[st.voteIndex]
    } else {
      tally(st)
    }
  } else if (action.type === 'hunterShoot') {
    if (st.step !== 'hunter') return fail(state, '当前不是猎人开枪阶段')
    if (st.hunterPending === null || actor !== st.hunterPending) {
      return fail(state, '当前不是该猎人的开枪时机')
    }
    var ht = action.target === undefined ? null : action.target
    if (ht !== null) {
      if (typeof ht !== 'number' || !st.players[ht] || !st.players[ht].alive) {
        return fail(state, '开枪目标无效')
      }
      if (ht === actor) return fail(state, '猎人不能带走自己')
    }
    var pendingFrom = st.pendingFrom
    st.hunterPending = null
    st.pendingFrom = null
    if (ht === null) {
      addLog(st, {
        scope: 'public',
        type: 'hunterShoot',
        by: actor,
        target: null,
        text: '猎人 ' + nameOf(actor) + ' 没有开枪。'
      })
    } else {
      st.players[ht].alive = false
      addLog(st, {
        scope: 'public',
        type: 'hunterShoot',
        by: actor,
        target: ht,
        text: '猎人 ' + nameOf(actor) + ' 开枪带走了 ' + nameOf(ht) + '。'
      })
    }
    if (finishIfWin(st)) return okResult(state, st, before)
    if (pendingFrom === 'night') enterDay(st)
    else nextNight(st)
  } else {
    return fail(state, '未知动作类型')
  }

  return okResult(state, st, before)
}

function okResult(state, st, before) {
  return { ok: true, state: st, events: st.log.slice(before) }
}

// 内部：复制日志条目（避免 UI 修改内部数据）。
function copyEntry(e) {
  var out = {}
  for (var k in e) {
    if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = cloneValue(e[k])
  }
  return out
}

// 内部：人类视角日志（存活者只看到公开 / 狼队 / 自己的私密信息；出局或终局可见全部）。
function visibleLog(st, pid) {
  var p = st.players[pid]
  var reveal = st.phase === 'end' || (p && !p.alive)
  var isWolf = p && p.role === 'wolf'
  var out = []
  for (var i = 0; i < st.log.length; i++) {
    var e = st.log[i]
    if (reveal || e.scope === 'public' || (e.scope === 'wolf' && isWolf) ||
        (e.scope === 'private' && e.to === pid)) {
      out.push(copyEntry(e))
    }
  }
  return out
}

// 输入：局面、玩家 id；输出：该玩家可见的日志（缺省 0 号 / 人类）。
function log(state, player) {
  if (!state || !state.players) return []
  var pid = typeof player === 'number' && state.players[player] ? player : 0
  return visibleLog(state, pid)
}

// 内部：当前行动者可选动作（供 UI 渲染按钮）。
function legalOptions(st, pid) {
  var p = st.players[pid]
  if (!p) return null
  var targets = []
  var i
  if (st.phase === 'night' && st.step === 'wolf' && p.alive && p.role === 'wolf') {
    for (i = 0; i < st.players.length; i++) {
      if (st.players[i].alive && st.players[i].role !== 'wolf') targets.push(i)
    }
    return { type: 'wolfKill', canPass: true, targets: targets }
  }
  if (st.phase === 'night' && st.step === 'seer' && p.alive) {
    for (i = 0; i < st.players.length; i++) {
      if (st.players[i].alive && i !== pid) targets.push(i)
    }
    return { type: 'seerCheck', targets: targets }
  }
  if (st.phase === 'night' && st.step === 'witch' && p.alive) {
    for (i = 0; i < st.players.length; i++) {
      if (st.players[i].alive && i !== pid) targets.push(i)
    }
    return {
      type: 'witch',
      killTarget: st.night.killTarget,
      canHeal: st.witch.heal > 0 && st.night.killTarget !== null,
      canPoison: st.witch.poison > 0,
      targets: targets
    }
  }
  if (st.step === 'hunter') {
    for (i = 0; i < st.players.length; i++) {
      if (st.players[i].alive && i !== pid) targets.push(i)
    }
    return { type: 'hunterShoot', canPass: true, targets: targets }
  }
  if (st.phase === 'day' && st.step === 'discuss') {
    return { types: ['speak', 'toVote'] }
  }
  if (st.phase === 'day' && st.step === 'vote') {
    for (i = 0; i < st.players.length; i++) {
      if (st.players[i].alive && i !== pid) targets.push(i)
    }
    return { type: 'vote', canAbstain: true, targets: targets }
  }
  return null
}

// 输入：局面、人类玩家 id；输出：只含合法信息的视图。
function visibleInfo(state, player) {
  if (!state || !state.players) return null
  var pid = typeof player === 'number' && state.players[player] ? player : 0
  var p = state.players[pid]
  var reveal = state.phase === 'end' || (p && !p.alive)
  var isWolf = p && p.role === 'wolf'
  var players = []
  for (var i = 0; i < state.players.length; i++) {
    var q = state.players[i]
    var known = reveal || i === pid || (isWolf && q.role === 'wolf')
    players.push({
      id: q.id,
      seat: q.seat,
      name: nameOf(q.id),
      alive: q.alive,
      isHuman: q.isHuman,
      claim: q.claim,
      role: known ? q.role : null,
      roleName: known ? ROLE_NAME[q.role] : null,
      faction: known ? q.faction : null
    })
  }

  var checks = []
  if (p && (p.role === 'seer' || reveal)) {
    var raw = state.mind[pid] ? state.mind[pid].checks : []
    for (i = 0; i < raw.length; i++) {
      checks.push({ target: raw[i].target, result: raw[i].result, day: raw[i].day })
    }
  }

  var potions = null
  if ((p && p.role === 'witch') || reveal) {
    potions = { heal: state.witch.heal, poison: state.witch.poison }
  }

  var nightInfo = null
  if (reveal) {
    nightInfo = {
      killTarget: state.night.killTarget,
      saved: state.night.saved,
      poison: state.night.poison,
      seerTarget: state.night.seerTarget,
      seerResult: state.night.seerResult
    }
  } else if (isWolf && p && p.alive) {
    // 狼人只知道自己选的刀口，看不到预言家查验与女巫用药。
    nightInfo = { killTarget: state.night.killTarget }
  } else if (p && p.role === 'witch' && p.alive && state.step === 'witch') {
    // 女巫只看到今晚刀口。
    nightInfo = { killTarget: state.night.killTarget }
  }

  var votes = {}
  for (var v in state.votes) {
    if (Object.prototype.hasOwnProperty.call(state.votes, v)) votes[v] = state.votes[v]
  }

  return {
    mode: state.mode,
    day: state.day,
    phase: state.phase,
    step: state.step,
    actor: state.actor,
    yourId: pid,
    alive: p ? p.alive : false,
    winner: state.winner ? { winner: state.winner.winner, reason: state.winner.reason } : null,
    you: p ? {
      id: pid,
      name: nameOf(pid),
      role: p.role,
      roleName: ROLE_NAME[p.role],
      faction: p.faction,
      alive: p.alive,
      claim: p.claim
    } : null,
    players: players,
    wolves: (isWolf || reveal) ? state.wolfIds.slice() : [],
    checks: checks,
    potions: potions,
    night: nightInfo,
    votes: votes,
    options: state.phase !== 'end' && state.actor === pid ? legalOptions(state, pid) : null,
    canAct: state.phase !== 'end' && state.actor === pid,
    log: visibleLog(state, pid)
  }
}

// 输入：模式、随机器；输出：初始局面。
function create(mode, rand) {
  var m = mode === 6 || mode === '6' ? 6 : 9
  var rnd = makeRand(rand)
  var deck = m === 6
    ? ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager']
    : ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager']
  deck = rnd.shuffle(deck)

  var players = []
  var wolfIds = []
  for (var i = 0; i < deck.length; i++) {
    var role = deck[i]
    players.push({
      id: i,
      seat: i,
      role: role,
      faction: role === 'wolf' ? 'wolf' : 'good',
      alive: true,
      isHuman: i === 0,
      claim: null
    })
    if (role === 'wolf') wolfIds.push(i)
  }

  var mind = {}
  var threat = {}
  for (i = 0; i < players.length; i++) {
    var sus = []
    for (var j = 0; j < players.length; j++) {
      // 狼人天生知道队友，怀疑值压到底；其余给一点初始「直觉」，避免全员零怀疑导致天天平票。
      sus.push(players[i].role === 'wolf' && players[j].role === 'wolf' ? -100 : rnd.int(4))
    }
    mind[i] = { sus: sus, claim: null, checks: [] }
    threat[i] = 0
  }

  var st = {
    mode: m,
    day: 1,
    phase: 'night',
    step: 'wolf',
    actor: -1,
    players: players,
    wolfIds: wolfIds,
    night: {
      killTarget: null,
      saved: false,
      poison: null,
      seerTarget: null,
      seerResult: null,
      resolved: false
    },
    witch: { heal: 1, poison: 1 },
    votes: {},
    voteOrder: [],
    voteIndex: 0,
    exiled: null,
    hunterPending: null,
    pendingFrom: null,
    claims: {},
    claimDay: {},
    mind: mind,
    speeches: [],
    log: [],
    winner: null,
    threat: threat,
    _rand: rnd
  }

  addLog(st, {
    scope: 'public',
    type: 'start',
    text: m === 6
      ? '6 人精简局：2 狼人、预言家、女巫、2 村民。'
      : '9 人标准局：3 狼人、预言家、女巫、猎人、3 村民。'
  })
  enterNight(st)
  return st
}

module.exports = {
  create: create,
  act: act,
  aiChoose: aiChoose,
  checkWin: checkWin,
  visibleInfo: visibleInfo,
  log: log,
  ROLES: ROLES,
  ROLE_NAME: ROLE_NAME
}
