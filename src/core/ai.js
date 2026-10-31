/**
 * core/ai.js — 通用异步博弈搜索（negamax + alpha-beta + 迭代加深）。
 * 职责：只依赖规则层统一接口（moves/apply/check/evaluate/candidates），
 *       不认任何棋种；由对局页在 setTimeout 回调中调用，让出主线程。
 * 难度策略（spec 9.3，2026-10-24 强化）：
 *   easy   深度 1，平分时随机挑前 3，弱化棋力
 *   normal 深度 3，预算 600ms
 *   hard   深度 5，预算 1000ms，超时返回当前最优解（迭代加深保证有解）
 *   规则模块可按分支数覆盖 DEPTH：象棋 1/4/5、五子棋 1/4/7、四子棋 1/5/8、
 *   黑白棋 1/4/7、跳棋 1/4/7、斗兽棋 1/3/6、围棋 1/3/6、井字棋 9 层全解。
 * 2026-10-24 强化点：
 *   ① 根级 α 剪枝（normal/hard 用上一候选最优分做窗口，只有严格更优才记录）；
 *   ② 历史启发（β 截断按 depth² 记分，同层/后续层优先重试）；
 *   ③ 各棋种按分支数抬高深度上限；
 *   ④ 根节点战术预检：一步胜直接落子；五子棋/四子棋「对方唯一成五点必堵」优先、
 *      「己方双威胁（落子后 ≥2 个成五点）」优先；象棋对「下一步被将死」的着法做
 *      根级过滤（预算内完成多少过滤多少，未扫到的着法保留）；
 *   ⑤ 静态战术延伸（quiescence）：规则暴露 tacticalMoves 时，叶子处继续搜吃子/
 *      升变，限制 QDEPTH 层，避免地平线送子（象棋吃子、被将军时搜应着）。
 * 评分约定：evaluate(board, turn) 返回「turn 视角」的分值；无则按 0（靠吃终局分）。
 */

var DEPTH = { easy: 1, normal: 3, hard: 5 }
var BUDGET_MS = { easy: 100, normal: 600, hard: 1000 }
var WIN_SCORE = 100000
var LEAF_WIN_BONUS = 50000 // 叶子静态延伸加分，须低于 WIN_SCORE 保持真胜优先
var QDEPTH = 4            // 静态战术延伸层数（3~4 ply，deadline 兜底）
var TACTIC_MS = 9         // 根节点战术预检的时间上限（保证主线程分片仍短）


// ── 人类大脑模型（2026-10-31）──────────────────────────────────────
// 不是“更会算”，而是把 AI 拆成六层，让它像人一样“会看错、会犹豫、会上头”：
//   ① 感知 attention：候选/杀点的注意力有限，难度越低越容易漏看；
//   ② 直觉 intuition：根节点一步胜 / 必堵 / 双威胁先走（rootPrecheck）；
//   ③ 推理 deliberation：negamax 深度搜索（本文件原有部分）；
//   ④ 情绪 mood：落后时更激进，领先时更保守；
//   ⑤ 记忆 memory：同局手数、上一次评估、最近一次玩家落点；
//   ⑥ 人格 persona：沉稳 / 好战 / 灵动，改变误差与选点窗口；
//   ⑦ 疲劳 fatigue：手数越多，注意力下降、失误率上升。
// 只在 chooseMoveAsync 的根节点选点时生效；chooseMove（同步测试用）保持原样。
var MIND = {
  easy:   { attention: 0.56, noise: 0.22, blunder: 0.16, patience: 0.55 },
  normal: { attention: 0.78, noise: 0.10, blunder: 0.07, patience: 0.72 },
  hard:   { attention: 0.94, noise: 0.035, blunder: 0.025, patience: 0.88 }
}
var PERSONAS = [
  { n: '沉稳', aggr: -0.08, attn: 0.05, pace: 180 },
  { n: '好战', aggr: 0.12, attn: -0.03, pace: -140 },
  { n: '灵动', aggr: 0.03, attn: 0.02, pace: 0 }
]

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v) }

// 输入：难度、可选种子；输出：一局共用的大脑状态。
// 种子存在时用 LCG，测试可复现；不存在时用 Math.random。
function createMind(difficulty, seed) {
  var base = MIND[difficulty] || MIND.normal
  var state = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : 0
  var seeded = state !== 0
  function rnd() {
    if (!seeded) return Math.random()
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  var p = PERSONAS[Math.floor(rnd() * PERSONAS.length)]
  return {
    difficulty: difficulty,
    persona: p.n,
    aggression: clamp01(0.5 + p.aggr),
    attention: clamp01(base.attention + p.attn),
    noise: base.noise,
    blunder: base.blunder,
    patience: base.patience,
    pace: p.pace,
    moves: 0,
    mood: 0,             // -1 落后 / +1 领先
    confidence: 0.5,
    memory: {
      lastEval: 0,
      trend: 0,
      playerMoves: 0,
      lastPlayer: null
    },
    _rng: rnd
  }
}

function mindRand(mind) {
  return mind && mind._rng ? mind._rng() : Math.random()
}

// 输入：AI 的大脑、玩家刚落的一手；输出：无。
// 只记录轻量特征；不存整盘，避免手表运存膨胀。
function observePlayer(mind, move) {
  if (!mind || !move || move.pass) return
  mind.memory.playerMoves++
  mind.memory.lastPlayer = { i: move.i, j: move.j, fi: move.fi, fj: move.fj }
}

// 输入：mind、规则、当前局面、根节点完整候选分（[{m,v}]）；输出：人类化选点或 null。
// 越像人的地方不在“算”，而在“只在自己看得见的几个点里犹豫”。
function humanPick(mind, rules, board, turn, scored) {
  if (!mind || !scored || !scored.length) return null
  var arr = scored.slice()
  arr.sort(function (a, b) { return b.v - a.v })
  var top = arr[0].v
  var evalNow = rules.evaluate ? rules.evaluate(board, turn) : 0
  // 情绪：落后（负分）更激进，领先更保守；用当前评估归一化，避免不同棋种量纲差异。
  var mood = Math.max(-1, Math.min(1, evalNow / 2400))
  mind.mood = mind.mood * 0.6 + mood * 0.4
  mind.confidence = clamp01(mind.confidence * 0.9 + (mood * 0.5 + 0.5) * 0.1)
  var aggr = clamp01(mind.aggression + (mood < 0 ? -mood * 0.18 : -mood * 0.08))
  mind.aggression = aggr
  mind.moves++
  mind.memory.lastEval = evalNow
  mind.memory.trend = mind.memory.trend * 0.7 + mood * 0.3
  var fatigue = Math.min(0.06, mind.moves * 0.0012 + mind.memory.playerMoves * 0.0004)
  // 注意力窗口：分数越接近，越可能被选中；难度越低窗口越宽。
  var span = Math.max(1, Math.abs(top) * 0.03 + 6)
  var window = span * (0.55 + (1 - mind.attention) * 1.6 + aggr * 0.55)
  var pool = []
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].v >= top - window) pool.push(arr[i])
  }
  if (!pool.length) pool = [arr[0]]
  // 疲劳 + 注意力不足 → 偶尔看漏：从窗口外挑一手（“走神”）。
  var pBlunder = mind.blunder + fatigue + (1 - mind.attention) * 0.10
  if (mindRand(mind) < pBlunder) {
    var bad = []
    for (var b = 0; b < arr.length; b++) {
      if (arr[b].v < top - window) bad.push(arr[b])
    }
    if (bad.length) return bad[Math.floor(mindRand(mind) * bad.length)].m
  }
  // 注意力越集中，犹豫池越小；最像人的是“在 2~5 个看起来都不错的点里选”。
  var cap = Math.max(2, Math.round(2 + mind.attention * 5))
  if (pool.length > cap) pool = pool.slice(0, cap)
  // 情绪 + 人格决定温度：好战/落后时更敢选高分，沉稳/领先时更愿意选稳的。
  var temp = span * (0.34 + (1 - mind.attention) * 1.35) * (1.3 - aggr * 0.5)
  if (temp < 0.6) temp = 0.6
  var weights = []
  var sum = 0
  for (var k = 0; k < pool.length; k++) {
    var w = Math.exp((pool[k].v - top) / temp)
    // 记忆：最近趋势向上时略偏进攻，向下时略偏稳。
    w *= 1 + mind.memory.trend * 0.12
    weights.push(w)
    sum += w
  }
  var r = mindRand(mind) * sum
  for (var q = 0; q < pool.length; q++) {
    r -= weights[q]
    if (r <= 0) return pool[q].m
  }
  return pool[0].m
}


// 内部：取本棋种在给定难度下的搜索深度。规则模块可用 DEPTH 覆盖
// （如井字棋分支极少，直接 9 层全解；其余棋种用全局默认）。
function depthFor(rules, difficulty) {
  if (rules.DEPTH && rules.DEPTH[difficulty]) return rules.DEPTH[difficulty]
  return DEPTH[difficulty] || 2
}

// 内部：候选集（规则提供 candidates 时用收缩后的候选，否则全量走法）。
function movesOf(rules, board, turn) {
  return rules.candidates ? rules.candidates(board, turn) : rules.moves(board, turn)
}

// 内部：两个走法是否同一着（含国际象棋的起子坐标 fi/fj）。
function sameMove(a, b) {
  if (!a || !b) return false
  if (a.pass || b.pass) return !!a.pass && !!b.pass
  return a.i === b.i && a.j === b.j && a.fi === b.fi && a.fj === b.fj
}

// 内部：按目标格找走法（根级「必堵点」用；坐标来自规则 winPoints）。
function findByTarget(ms, p) {
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === p.i && ms[k].j === p.j) return ms[k]
  }
  return null
}

// 内部：一步胜着法。
// 规则若提供 winPoints（五子棋/四子棋：静态就能算出成五点），直接取该点对应的走法，
// 避免每个候选都 apply+check；其余棋种用 apply+check，且对能给出 inCheck 的棋种
// （国际象棋）先用「这手是否将军」做便宜的预筛 —— 不将军的着法不可能将死。
function immediateWinMoves(rules, board, turn, ms) {
  if (rules.winPoints) {
    var pts = rules.winPoints(board, turn)
    if (!pts || !pts.length) return []
    var out = []
    for (var p = 0; p < pts.length; p++) {
      var hit = findByTarget(ms, pts[p])
      if (hit) out.push(hit)
    }
    if (!out.length) {
      var all = rules.moves(board, turn)
      for (var q = 0; q < pts.length; q++) {
        var h2 = findByTarget(all, pts[q])
        if (h2) out.push(h2)
      }
    }
    return out
  }
  var res = []
  for (var k = 0; k < ms.length; k++) {
    var nb = rules.apply(board, ms[k], turn)
    if (rules.inCheck && !rules.inCheck(nb, 3 - turn)) continue
    var ck = rules.check(nb, ms[k])
    if (ck && ck.result === 'win' && ck.winner === turn) res.push(ms[k])
  }
  return res
}

// 内部：行棋方是否存在立即取胜点（静态延伸用；优先走规则的 winPoints 快路径）。
function hasImmediateWin(rules, board, turn) {
  if (rules.winPoints) return rules.winPoints(board, turn).length > 0
  var ms = movesOf(rules, board, turn)
  for (var k = 0; k < ms.length; k++) {
    var nb = rules.apply(board, ms[k], turn)
    if (rules.inCheck && !rules.inCheck(nb, 3 - turn)) continue
    var ck = rules.check(nb, ms[k])
    if (ck && ck.result === 'win' && ck.winner === turn) return true
  }
  return false
}

// 内部：叶子评估（静态分 + 「一步胜」接近胜利加分）。
function leafEval(rules, board, turn) {
  var base = rules.evaluate ? rules.evaluate(board, turn) : 0
  if (!rules.NO_STATIC_WIN && hasImmediateWin(rules, board, turn)) base += LEAF_WIN_BONUS
  return base
}

// 内部：turn 方是否已经存在一步将死（只对能给出 inCheck 的规则有意义）。
// 先按「是否将军」预筛，只有将军着法才调用 check（check 要生成对方全部合法着法，
// 是最贵的一步），把根级防守预检的代价压到可接受范围。
function hasMateIn1(rules, board, turn, deadline) {
  if (!rules.inCheck) return false
  var ms = movesOf(rules, board, turn)
  var cap = Math.min(ms.length, 20)
  for (var k = 0; k < cap; k++) {
    if ((k & 3) === 0 && Date.now() > deadline) return false
    var nb = rules.apply(board, ms[k], turn)
    if (!rules.inCheck(nb, 3 - turn)) continue
    var ck = rules.check(nb, ms[k])
    if (ck && ck.result === 'win' && ck.winner === turn) return true
  }
  return false
}

// 内部：象棋「下一步被将死」的根级过滤。
// 对前 SCAN_MATE 个候选逐手 apply，再看对方是否有一步杀；扫到的送杀着法剔除，
// 未扫到的候选保持（乐观保留，避免未完成扫描时误删好着）。只有一个安全着法时直接返回。
function mateSafeCandidates(rules, board, turn, cand, deadline) {
  if (!rules.inCheck || rules.NO_STATIC_WIN) return null
  var scan = Math.min(cand.length, 18)
  var safe = []
  for (var k = 0; k < cand.length; k++) {
    if (k < scan) {
      if (Date.now() > deadline) return null
      var nb = rules.apply(board, cand[k], turn)
      var ck = rules.check(nb, cand[k])
      if (ck && ck.result === 'win' && ck.winner === turn) return [cand[k]]
      if (ck && ck.result === 'draw') { safe.push(cand[k]); continue }
      if (hasMateIn1(rules, nb, 3 - turn, deadline)) continue
      safe.push(cand[k])
    } else {
      safe.push(cand[k])
    }
  }
  if (!safe.length || safe.length === cand.length) return null
  return safe
}

// 内部：根节点战术预检。
// 返回 { move: 直接落子或 null, cand: 可能被防守过滤后的候选 }。
// 顺序：一步胜 → 对方唯一成五点必堵 → 己方双威胁 → 象棋防一步杀。
function rootPrecheck(rules, board, turn, cand, difficulty, deadline) {
  var tdead = Math.min(deadline, Date.now() + TACTIC_MS)
  var res = { move: null, cand: cand }

  var wins = immediateWinMoves(rules, board, turn, cand)
  if (wins.length) {
    // easy 在前几个胜着中随机，保留弱化；其余直接取排序最前的一手
    res.move = difficulty === 'easy' && wins.length > 1
      ? wins[Math.floor(Math.random() * wins.length)]
      : wins[0]
    return res
  }
  if (difficulty === 'easy') return res

  // 五子棋 / 四子棋：静态成五点可以直接算，做「必堵」与「双威胁」预检
  if (rules.winPoints) {
    var oppPts = rules.winPoints(board, 3 - turn)
    if (oppPts.length >= 1) {
      // 对方已有成五点：唯一成五点必堵；出现两个（双四/双威胁）时同样先挡一路 ——
      // 不挡就下一手直接输，挡一路至少把局面拖住（对手仍可能用另一个点赢）。
      var block = findByTarget(cand, oppPts[0]) || findByTarget(rules.moves(board, turn), oppPts[0])
      if (block) { res.move = block; return res }
    }
    if (oppPts.length === 0) {
      // 己方双威胁：落子后若能同时形成 ≥2 个成五点，对手挡不住，直接下
      var cap = Math.min(cand.length, 20)
      var bestM = null
      var bestN = 1
      for (var k = 0; k < cap; k++) {
        if (Date.now() > tdead) break
        var nb = rules.apply(board, cand[k], turn)
        var n = rules.winPoints(nb, turn).length
        if (n > bestN) { bestN = n; bestM = cand[k] }
        if (bestN >= 3) break
      }
      if (bestM) { res.move = bestM; return res }
    }
  }

  // 象棋：剔除「下完这手就被对方一步将死」的着法（预算内扫多少算多少）
  var safe = mateSafeCandidates(rules, board, turn, cand, tdead)
  if (safe) {
    if (safe.length === 1) res.move = safe[0]
    else res.cand = safe
  }
  return res
}

// 内部：线索——「杀手着法」排序（借鉴参考项目 方寸棋阁 的 killerMoves 手法）。
// 同一层里曾引发 β 截断的着法，在兄弟节点重试时先搜，能明显提高 α-β 剪枝率。
// 本工程不照搬其代码，只采用这一通用思路；按层保存 2 枚，命中就前置，其余顺序不动。
function orderWithKillers(ms, killers, ply) {
  var km = killers && killers[ply]
  if (!km || !km.length || !ms || ms.length < 2) return ms
  var head = []
  var rest = []
  for (var i = 0; i < ms.length; i++) {
    var m = ms[i]
    if (sameMove(m, km[0]) || (km.length > 1 && sameMove(m, km[1]))) head.push(m)
    else rest.push(m)
  }
  if (!head.length) return ms
  return head.concat(rest)
}

// 内部：走法身份（历史启发表用；国际象棋要区分起子格）。
function moveKey(m) {
  if (!m) return ''
  if (m.pass) return 'P'
  if (m.fi !== undefined) return m.fi + ',' + m.fj + '>' + m.i + ',' + m.j
  return m.i + ',' + m.j
}

// 内部：历史启发——同一着法在不同层引发 β 截断时累加 depth² 分。
// 排序策略：杀手着法 → 有历史分的着法（按分数降序）→ 其余保持候选集原序。
// 只在确有历史分时才多排一层，避免每个节点都做一次全排序。
function orderWithHistory(ms, killers, ply, history) {
  var out = orderWithKillers(ms, killers, ply)
  if (!history || !out || out.length < 2) return out
  var hot = []
  var cold = []
  for (var i = 0; i < out.length; i++) {
    if (history[moveKey(out[i])] > 0) hot.push(out[i])
    else cold.push(out[i])
  }
  if (!hot.length) return out
  hot.sort(function (a, b) { return history[moveKey(b)] - history[moveKey(a)] })
  return hot.concat(cold)
}

// 输入：走法；输出：本局统一的历史分键（供排序与记账共用）。
function recordHistory(history, move, depth) {
  var key = moveKey(move)
  history[key] = (history[key] || 0) + depth * depth
}

function rememberKiller(killers, ply, move) {
  var km = killers[ply]
  if (!km) { killers[ply] = [move]; return }
  if (sameMove(km[0], move)) return
  if (km.length > 1) km.length = 1
  km.push(move)
}

// 内部：静态战术延伸（quiescence）。
// 规则可选暴露 tacticalMoves(board,turn)：象棋返回吃子/升变（被将军时返回全部应着）。
// 评分取 stand-pat 与继续搜战术着法的较大值；深度用 QDEPTH 封顶，deadline 兜底。
// 被将军时 stand-pat 不成立（不能「停一手」当没事），best 从 -Infinity 起只算应着。
function quiesce(rules, board, turn, depth, alpha, beta, deadline, ctx, ply) {
  if (Date.now() > deadline) { ctx.timeout = true; return 0 }
  var inChk = !!(rules.inCheck && rules.inCheck(board, turn))
  var best
  if (inChk) {
    best = -Infinity
  } else {
    // 战术节点不重复做叶子「一步胜」检测（象棋那一步要生成全部合法着法），
    // 直接吃子/升变搜索已能覆盖地平线送子；真将死由 check 在着法循环里判出。
    best = rules.evaluate ? rules.evaluate(board, turn) : 0
    if (depth <= 0 || best >= beta) return best
    if (best > alpha) alpha = best
  }
  if (depth <= 0) return best === -Infinity ? 0 : best
  var ms = rules.tacticalMoves ? rules.tacticalMoves(board, turn) : null
  if (!ms || !ms.length) {
    if (inChk) return -(WIN_SCORE + depth)
    return best
  }
  for (var k = 0; k < ms.length; k++) {
    if ((k & 3) === 0 && Date.now() > deadline) { ctx.timeout = true; return best === -Infinity ? 0 : best }
    var nb = rules.apply(board, ms[k], turn)
    var ck = rules.check(nb, ms[k])
    var v
    if (ck && ck.result === 'win') {
      v = ck.winner === turn ? WIN_SCORE + depth : -(WIN_SCORE + depth)
    } else if (ck && ck.result === 'draw') {
      v = 0
    } else {
      v = -quiesce(rules, nb, 3 - turn, depth - 1, -beta, -alpha, deadline, ctx, ply + 1)
    }
    if (ctx.timeout) return best === -Infinity ? 0 : best
    if (v > best) best = v
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best === -Infinity ? 0 : best
}

// 内部：negamax 单层搜索。返回 turn 视角分值；ctx.timeout 置位后快速返回 0。
function negamax(rules, board, turn, depth, alpha, beta, deadline, ctx, ply) {
  if (Date.now() > deadline) ctx.timeout = true
  if (ctx.timeout) return 0
  if (depth <= 0) {
    // 异步搜索用「纯静态叶子」：negamax 无法续算，若叶子还做静态战术延伸，
    // 12ms 的候选子预算常常连第 1 层都跑不完（旧实现会退化成永远走候选第 1 手）。
    // 根节点战术预检 + 迭代加深已覆盖一步胜 / 必堵 / 防一步杀，深度 2~4 的静态
    // minimax 又能看到「吃子后被反吃」，整体棋力比「跑不完就放弃」更稳。
    if (ctx.flat) return rules.evaluate ? rules.evaluate(board, turn) : 0
    // 规则提供战术着法时做静态战术延伸（限 QDEPTH 层），否则走普通叶子评估。
    if (rules.tacticalMoves) {
      return quiesce(rules, board, turn, rules.QDEPTH || QDEPTH, alpha, beta, deadline, ctx, ply)
    }
    return leafEval(rules, board, turn)
  }
  var ms = rules.candidates ? rules.candidates(board, turn) : rules.moves(board, turn)
  if (!ms || !ms.length) {
    // 无合法走法（黑白棋单方轮空）：换对手继续搜索；双方都无子可走时
    // rules.check 会在上层 apply 后判出终局，不会递归到这里形成死循环。
    return -negamax(rules, board, 3 - turn, depth - 1, -beta, -alpha, deadline, ctx, ply + 1)
  }
  ms = orderWithHistory(ms, ctx.killers, ply || 0, ctx.history)
  var best = -Infinity
  for (var k = 0; k < ms.length; k++) {
    // 每 4 个着法查一次软 deadline：单层候选很多时也能及时收手，减少切片超时
    if ((k & 3) === 0 && Date.now() > deadline) {
      ctx.timeout = true
      return best === -Infinity ? 0 : best
    }
    var nb = rules.apply(board, ms[k], turn)
    var ck = rules.check(nb, ms[k])
    var v
    if (ck && ck.result === 'win') {
      v = ck.winner === turn ? WIN_SCORE + depth : -(WIN_SCORE + depth)
    } else if (ck && ck.result === 'draw') {
      v = 0
    } else {
      v = -negamax(rules, nb, 3 - turn, depth - 1, -beta, -alpha, deadline, ctx, ply + 1)
    }
    if (ctx.timeout) return best === -Infinity ? 0 : best
    if (v > best) best = v
    if (best > alpha) alpha = best
    if (alpha >= beta) {
      // β 截断：记杀手（同层先试）+ 历史分（全局累计，depth² 加权）
      rememberKiller(ctx.killers, ply || 0, ms[k])
      recordHistory(ctx.history, ms[k], depth)
      break
    }
  }
  return best
}

// 输入：rules（规则模块）、board、turn、difficulty('easy'|'normal'|'hard')；
// 输出：最佳走法 {i,j} 或 null（无合法走法）。纯函数，可在任何线程/回调中运行。
function chooseMove(rules, board, turn, difficulty) {
  var maxDepth = depthFor(rules, difficulty)
  var deadline = Date.now() + (BUDGET_MS[difficulty] || 600)
  var all = rules.moves(board, turn)
  if (!all || !all.length) return null
  if (all.length === 1) return all[0]
  var cand = rules.candidates ? rules.candidates(board, turn) : all
  if (!cand || !cand.length) return null
  // 围棋等支持停一手的棋种：把「停一手」作为末位候选参与搜索
  // （评分持平地区填子为 0 收益，搜索自然会在终局阶段选择停一手）。
  if (rules.PASS_OK) cand = cand.concat([{ pass: true }])
  // 只有一个候选（五子棋/围棋空盘的天元）：直接落子，结果与深搜一致但省掉整段预算
  if (cand.length === 1) return cand[0]

  // 根节点战术预检：一步胜 / 必堵 / 双威胁 / 防一步杀
  var pre = rootPrecheck(rules, board, turn, cand, difficulty, deadline)
  if (pre.move) return pre.move
  cand = pre.cand
  if (cand.length === 1) return cand[0]

  var ctx = { timeout: false, killers: [], history: {} }
  var bestMove = cand[0]
  var prevBest = null
  // 根节点：normal/hard 用「上一层最优分」做 α 窗口，只有严格更优的着法才被记录；
  // easy 仍用全窗口收集并列最优，保留弱化随机性。根级 α 剪枝能把大量劣着挡在子树外，
  // 同一预算下通常能多搜一层。
  var rootPrune = difficulty !== 'easy'
  for (var d = 1; d <= maxDepth; d++) {
    // 迭代加深：上一深度找到的最优着法先搜（先验排序，能大幅提前拿到下界，
    // 让同一预算内多跑一层；这也是参考项目 方寸棋阁 的做法，思路通用、代码自写）。
    if (prevBest) {
      var front = [prevBest]
      for (var pi = 0; pi < cand.length; pi++) {
        if (!sameMove(cand[pi], prevBest)) front.push(cand[pi])
      }
      cand = front
    }
    var best = -Infinity
    var bestList = []
    for (var k = 0; k < cand.length; k++) {
      var m = cand[k]
      var nb = rules.apply(board, m, turn)
      var ck = rules.check(nb, m)
      var v
      if (ck && ck.result === 'win') {
        v = ck.winner === turn ? WIN_SCORE + d : -(WIN_SCORE + d)
      } else if (ck && ck.result === 'draw') {
        v = 0
      } else {
        var beta = rootPrune ? -best : Infinity
        v = -negamax(rules, nb, 3 - turn, d - 1, -Infinity, beta, deadline, ctx, 1)
      }
      if (ctx.timeout) break
      if (v > best) { best = v; bestList = [m] }
      else if (!rootPrune && v === best) { bestList.push(m) }
    }
    if (!ctx.timeout && bestList.length) {
      // easy 在前三优中随机，降低棋力同时避免机械感；其余取最优
      var pool = difficulty === 'easy' && bestList.length > 3 ? bestList.slice(0, 3) : bestList
      bestMove = pool[Math.floor(Math.random() * pool.length)]
      prevBest = bestMove
      if (best > WIN_SCORE) break // 已见必胜，无需更深
    }
    if (ctx.timeout) break
  }
  return bestMove
}

// ── 时间片异步搜索 ───────────────────────────────────────────────────
// 背景（2026-10-23）：chooseMove 同步跑满预算，hard 期间主线程完全冻结，
// 触摸、呼吸点、滚动全部停摆。参考项目 方寸棋阁 也只是把 think() 包进
// setTimeout(...,0)，一样冻结整段 —— 不解决根本问题。
// 本实现改为「按根候选分片」：每片最多算 SLICE_MS，然后用 setTimeout(step,0)
// 让出主线程，下一片接着算同一深度。negamax 无法中途续算，故切片粒度取
// 根候选这一级；子搜索仍受总 deadline 约束，因此总耗时与同步版一致，
// 只是把 1000ms 的一段长冻结拆成若干短任务，界面全程可响应。
// 取消：isCancelled() 为真时静默退出、不调 done（页面自行收尾）。
var SLICE_MS = 12
// 单个根候选子树的软上限：negamax 不能中途续算，若某个候选的子树远超 SLICE_MS，
// 就先放弃这一层（保留上一层完整结果）返回，避免主线程被一棵深子树整段冻住。
var CAND_MS = 12
// 输入：同 chooseMove，另加 done(move|null) 与 isCancelled()；
// 输出：无（结果经 done 回调，且恰好一次）。
function chooseMoveAsync(rules, board, turn, difficulty, done, isCancelled, mindArg) {
  var finished = false
  var layerDone = false
  var bestMove = null
  function cancelled() { return !!(isCancelled && isCancelled()) }
  function finish(mv) {
    if (finished) return
    finished = true
    done(mv)
  }

  var maxDepth = depthFor(rules, difficulty)
  var deadline = Date.now() + (BUDGET_MS[difficulty] || 600)
  var all = rules.moves(board, turn)
  if (!all || !all.length) { finish(null); return }
  if (all.length === 1) { finish(all[0]); return }
  var cand = rules.candidates ? rules.candidates(board, turn) : all
  if (!cand || !cand.length) { finish(null); return }
  if (rules.PASS_OK) cand = cand.concat([{ pass: true }])
  if (cand.length === 1) { finish(cand[0]); return }

  // 大脑：优先用调用方传入的 mind（一局共享）；否则挂在本局规则实例上懒创建。
  // 规则实例每局重建，所以人格/疲劳/记忆自然随新局重置，不会跨局污染。
  var mind = mindArg || rules.__mind
  if (!mind || mind.difficulty !== difficulty) {
    mind = createMind(difficulty)
    rules.__mind = mind
  }

  // 根节点战术预检同样异步入口先跑（预算 TACTIC_MS，不会再把主线程冻住）
  var pre = rootPrecheck(rules, board, turn, cand, difficulty, deadline)
  if (pre.move) { finish(pre.move); return }
  cand = pre.cand
  if (cand.length === 1) { finish(cand[0]); return }

  var ctx = { timeout: false, killers: [], history: {}, flat: true }
  bestMove = cand[0]
  var prevBest = null
  var depth = 1
  var k = 0
  var best = -Infinity
  var bestList = []
  var rootPrune = difficulty !== 'easy'

  // 输入：无；输出：无。收尾时若连第 1 层都没跑完（全被单棵子树超时打断），
  // 用「静态评估一遍根候选」兜底，避免退化成永远走候选第 1 手。
  function quickFallback() {
    var bm = cand[0]
    var bv = -Infinity
    var t0 = Date.now()
    for (var q = 0; q < cand.length; q++) {
      if ((q & 3) === 0 && Date.now() - t0 > 20) break
      var nb = rules.apply(board, cand[q], turn)
      var v = rules.evaluate ? -rules.evaluate(nb, 3 - turn) : 0
      if (v > bv) { bv = v; bm = cand[q] }
    }
    return bm
  }

  // 输入：无；输出：无。有完整层结果就用 bestMove，否则走静态兜底。
  function finishBest() {
    finish(layerDone ? bestMove : quickFallback())
  }

  // 每层开始：prevBest 前置（先验排序），并重置本层累计
  function startDepth() {
    if (prevBest) {
      var front = [prevBest]
      for (var p = 0; p < cand.length; p++) {
        if (!sameMove(cand[p], prevBest)) front.push(cand[p])
      }
      cand = front
    }
    best = -Infinity
    bestList = []
    scored = []
    k = 0
  }

  function step() {
    if (finished || cancelled()) return
    var sliceStart = Date.now()
    while (true) {
      if (ctx.timeout) { finishBest(); return }
      // 开新候选前先看本片是否已用满：保证每次让出前不会再多跑一棵子树
      if (k < cand.length && Date.now() - sliceStart >= SLICE_MS) { setTimeout(step, 0); return }
      if (k >= cand.length) {
        // 本层收尾：有完整结果才更新最优；否则保留上一层结果
        if (bestList.length || scored.length) {
          layerDone = true
          if (best > WIN_SCORE) {
            // 已证必胜：不让“走神”把胜局送掉，这是人类也不会犯的错。
            bestMove = bestList[0] || bestMove
            finishBest()
            return
          }
          var human = null
          try {
            human = humanPick(mind, rules, board, turn, scored)
          } catch (err) {
            // 人类模型只负责“选点”，任何异常都不能让 AI 卡在思考态。
            human = null
          }
          if (human) {
            bestMove = human
          } else {
            var pool = difficulty === 'easy' && bestList.length > 3 ? bestList.slice(0, 3) : bestList
            bestMove = pool[Math.floor(Math.random() * pool.length)]
          }
          prevBest = bestMove
        }
        depth++
        if (depth > maxDepth) { finishBest(); return }
        startDepth()
        continue
      }
      var m = cand[k]
      var nb = rules.apply(board, m, turn)
      var ck = rules.check(nb, m)
      var v
      if (ck && ck.result === 'win') {
        v = ck.winner === turn ? WIN_SCORE + depth : -(WIN_SCORE + depth)
      } else if (ck && ck.result === 'draw') {
        v = 0
      } else {
        var beta = rootPrune ? -best : Infinity
        var subDeadline = Math.min(deadline, Date.now() + CAND_MS)
        v = -negamax(rules, nb, 3 - turn, depth - 1, -Infinity, beta, subDeadline, ctx, 1)
      }
      k++
      if (ctx.timeout) {
        if (Date.now() <= deadline) {
          // 只是单个候选子树超出软上限：丢弃这一手的半截分，继续同层下一手；
          // 整层结束时若没有任何完整结果，bestMove 仍保留上一层的最优着法。
          ctx.timeout = false
          if (Date.now() - sliceStart >= SLICE_MS) { setTimeout(step, 0); return }
          continue
        }
        finishBest()
        return
      }
      scored.push({ m: m, v: v })
      if (v > best) { best = v; bestList = [m] }
      else if (!rootPrune && v === best) { bestList.push(m) }
      if (Date.now() - sliceStart >= SLICE_MS) { setTimeout(step, 0); return }
    }
  }

  startDepth()
  setTimeout(step, 0)
}

module.exports = {
  chooseMove: chooseMove,
  chooseMoveAsync: chooseMoveAsync,
  negamax: negamax,
  createMind: createMind,
  observePlayer: observePlayer,
  humanPick: humanPick
}
