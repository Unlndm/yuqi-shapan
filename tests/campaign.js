/**
 * tests/campaign.js — 闯关模式数据与纯引擎测试（不依赖 storage / UI）。
 * 运行：node tests/campaign.js
 */

var core = require('../src/campaign/core.js')
var L = require('../src/campaign/levels.js')
var h = require('./helper.js')

var LEVELS = L.LEVELS
var SOLO_GAMES = ['g2048', 'slide', 'minesweeper', 'sokoban', 'sudoku', 'maze', 'spotdiff']
var ALL_GAMES = [
  'gomoku', 'tictactoe', 'othello', 'connect4', 'chess', 'go',
  'aeroplane', 'monopoly', 'g2048', 'slide', 'minesweeper',
  'draughts', 'jungle', 'sokoban', 'sudoku',
  'werewolf', 'snake', 'maze', 'spotdiff'
]
var METRICS = ['win', 'moves', 'score', 'time', 'steps']

// 测试辅助：完美通关统计（三阈全达标）。
function perfect(lv) {
  var s = { win: true, moves: 1, score: 999999, time: 1, steps: 1, undos: 0 }
  if (lv.metric === 'win') s.moves = 1
  return s
}

// ── 关卡数据 ────────────────────────────────────────────────────────
h.suite('campaign/关卡数据')
h.eq('章节数 8', L.CHAPTERS.length, 8)
h.eq('关卡总数 80', LEVELS.length, 80)
h.eq('章节名齐全', L.CHAPTERS.map(function (c) { return c.name }), ['初见', '攻守', '残局', '远征', '深渊', '终章', '试炼', '封王'])

var ids = {}
var dup = []
var chapterCount = {}
var gameCount = {}
var fieldBad = []
var orderBad = []
for (var i = 0; i < LEVELS.length; i++) {
  var lv = LEVELS[i]
  if (ids[lv.id]) dup.push(lv.id)
  ids[lv.id] = true
  chapterCount[lv.chapter] = (chapterCount[lv.chapter] || 0) + 1
  gameCount[lv.game] = (gameCount[lv.game] || 0) + 1

  var expectChapter = Math.floor(i / 10) + 1
  var expectIndex = (i % 10) + 1
  if (lv.chapter !== expectChapter || lv.index !== expectIndex) orderBad.push(lv.id)

  var isSolo = SOLO_GAMES.indexOf(lv.game) >= 0
  if (!lv.id || !lv.title || !lv.desc) fieldBad.push(lv.id + ':empty')
  if (lv.mode !== (isSolo ? 'solo' : 'ai')) fieldBad.push(lv.id + ':mode')
  if (['easy', 'normal', 'hard'].indexOf(lv.difficulty) < 0) fieldBad.push(lv.id + ':difficulty')
  if (METRICS.indexOf(lv.metric) < 0) fieldBad.push(lv.id + ':metric')
  if (typeof lv.star2 !== 'number' || typeof lv.star3 !== 'number') fieldBad.push(lv.id + ':threshold')
  if (lv.metric === 'score' ? !(lv.star3 > lv.star2) : !(lv.star3 < lv.star2)) fieldBad.push(lv.id + ':thresholdOrder')
  if (typeof lv.reward !== 'number' || lv.reward <= 0) fieldBad.push(lv.id + ':reward')
  if (lv.desc.indexOf('待定') >= 0 || lv.desc.indexOf('敬请期待') >= 0) fieldBad.push(lv.id + ':placeholder')
  if (lv.desc.indexOf('星') < 0) fieldBad.push(lv.id + ':noStars')
}
h.eq('关卡 id 唯一', dup, [])
h.eq('每章恰好 10 关', [chapterCount[1], chapterCount[2], chapterCount[3], chapterCount[4], chapterCount[5], chapterCount[6], chapterCount[7], chapterCount[8]], [10, 10, 10, 10, 10, 10, 10, 10])
h.eq('章内序号与顺序一致', orderBad, [])
h.eq('字段完整且合法', fieldBad, [])
h.eq('覆盖 19 款玩法', Object.keys(gameCount).sort(), ALL_GAMES.slice().sort())
var under3 = []
var over5 = []
for (var g = 0; g < ALL_GAMES.length; g++) {
  var n = gameCount[ALL_GAMES[g]] || 0
  if (n < 3) under3.push(ALL_GAMES[g] + ':' + n)
  if (n > 5) over5.push(ALL_GAMES[g] + ':' + n)
}
h.eq('每款玩法至少 3 关', under3, [])
h.eq('每款玩法不超过 5 关', over5, [])

// ── 状态归一与脏值兜底 ──────────────────────────────────────────────
h.suite('campaign/状态归一')
var s0 = core.emptyState()
h.eq('空状态解锁第 1 关', s0.unlocked, 1)
h.eq('空状态无星', core.totalStars(s0), 0)
h.eq('空状态进度文案', core.progressText(s0), '通关 0/80 · ★ 0/240')
h.eq('null 兜底为空状态', core.normState(null).unlocked, 1)

var dirty = core.normState({
  stars: { 'c1-01': 9, 'c1-02': -3, bad: 2, 'c1-03': 'x' },
  unlocked: 999,
  claimed: { 'c1-01': 1, 'c1-02': true, bad: true }
})
h.eq('星级超额截到 3', dirty.stars['c1-01'], 3)
h.eq('负星被丢弃', dirty.stars['c1-02'], undefined)
h.eq('未知关卡 id 被丢弃', dirty.stars['bad'], undefined)
h.eq('字符串星级被丢弃', dirty.stars['c1-03'], undefined)
h.eq('unlocked 超界夹到 80', dirty.unlocked, 80)
h.eq('claimed 只认 true', dirty.claimed['c1-01'], undefined)
h.eq('claimed true 保留', dirty.claimed['c1-02'], true)
h.eq('claimed 未知 id 丢弃', dirty.claimed['bad'], undefined)
h.eq('unlocked 脏值兜底 1', core.normState({ unlocked: 'x' }).unlocked, 1)
h.eq('unlocked 0 夹到 1', core.normState({ unlocked: 0 }).unlocked, 1)

// ── 关卡访问 ────────────────────────────────────────────────────────
h.suite('campaign/关卡访问')
h.eq('allLevels 返回 80', core.allLevels().length, 80)
h.eq('levelAt(1) 是首关', core.levelAt(1).id, 'c1-01')
h.eq('levelAt(80) 是末关', core.levelAt(80).id, 'c8-10')
h.eq('levelAt(0) = null', core.levelAt(0), null)
h.eq('levelAt(81) = null', core.levelAt(81), null)
h.eq('levelAt(1.5) = null', core.levelAt(1.5), null)
h.eq('findLevel 未知 id = null', core.findLevel('nope'), null)
h.eq('seqOf(c2-03) = 13', core.seqOf('c2-03'), 13)

// ── 章节视图 ────────────────────────────────────────────────────────
h.suite('campaign/章节视图')
var rows = core.chapterRows(core.emptyState())
h.eq('章节行数 8', rows.length, 8)
h.eq('每章 10 行', [rows[0].rows.length, rows[7].rows.length], [10, 10])
h.eq('首关未锁', rows[0].rows[0].locked, false)
h.eq('第 2 关默认锁定', rows[0].rows[1].locked, true)
h.eq('首行带全局序号 1', rows[0].rows[0].seq, 1)
h.eq('末行带全局序号 80', rows[7].rows[9].seq, 80)
h.eq('行内星级默认 0', rows[0].rows[0].stars, 0)
h.eq('章内星数默认 0', rows[0].stars, 0)
var partial = core.normState({ stars: { 'c1-01': 3, 'c1-02': 2 }, unlocked: 3 })
var pr = core.chapterRows(partial)
h.eq('已通关行 cleared', pr[0].rows[0].cleared, true)
h.eq('第 3 关已解锁', pr[0].rows[2].locked, false)
h.eq('第 4 关仍锁定', pr[0].rows[3].locked, true)
h.eq('第 1 章累计 5 星', pr[0].stars, 5)

// ── 单章视图（列表页一次只渲染 10 行）────────────────────────────────
h.suite('campaign/单章视图')
var c0 = core.chapterAt(core.emptyState(), 0)
h.eq('第 1 章 id/名称', [c0.id, c0.name], [L.CHAPTERS[0].id, L.CHAPTERS[0].name])
h.eq('第 1 章 10 行', c0.rows.length, 10)
h.eq('第 1 章 total=10', c0.total, 10)
h.eq('第 1 章首行全局序号 1', c0.rows[0].seq, 1)
h.eq('第 1 章首行章内序号 1', c0.rows[0].index, 1)
h.eq('空存档第 1 关未锁', c0.rows[0].locked, false)
h.eq('空存档第 2 关锁定', c0.rows[1].locked, true)
h.eq('空存档章内 0 星', c0.stars, 0)
h.eq('第 8 章末行全局序号 80', core.chapterAt(core.emptyState(), 7).rows[9].seq, 80)
h.eq('第 8 章末行 id c8-10', core.chapterAt(core.emptyState(), 7).rows[9].id, 'c8-10')
h.eq('越界章节 = null', core.chapterAt(core.emptyState(), 8), null)
h.eq('负数章节 = null', core.chapterAt(core.emptyState(), -1), null)

var pc1 = core.chapterAt(partial, 0)
h.eq('已通关行 cleared', pc1.rows[0].cleared, true)
h.eq('第 3 关已解锁', pc1.rows[2].locked, false)
h.eq('第 4 关仍锁定', pc1.rows[3].locked, true)
h.eq('第 1 章累计 5 星', pc1.stars, 5)
var pc2 = core.chapterAt(partial, 1)
h.eq('未推进到第 2 章时全锁', [pc2.rows[0].locked, pc2.rows[9].locked], [true, true])
h.eq('第 2 章 0 星', pc2.stars, 0)

// 单章视图必须与 chapterRows 的分章结果逐字段一致（防两套逻辑漂移）
var allRows = core.chapterRows(partial)
var drift = []
for (var ci = 0; ci < L.CHAPTERS.length; ci++) {
  var one = core.chapterAt(partial, ci)
  var many = allRows[ci]
  if (one.id !== many.id || one.name !== many.name || one.stars !== many.stars || one.total !== many.total) {
    drift.push('ch' + ci)
    continue
  }
  for (var rj = 0; rj < many.rows.length; rj++) {
    if (JSON.stringify(one.rows[rj]) !== JSON.stringify(many.rows[rj])) {
      drift.push('ch' + ci + '-row' + rj)
    }
  }
}
h.eq('单章视图与 chapterRows 一致', drift, [])

// 总览（3 列数字）与 chapterRows 汇总口径一致
var sum0 = core.summary(core.emptyState())
h.eq('空存档总览', [sum0.cleared, sum0.stars, sum0.total, sum0.maxStars], [0, 0, 80, 240])
var sumP = core.summary(partial)
h.eq('部分进度总览', [sumP.cleared, sumP.stars], [2, 5])

// ── 星级边界 ────────────────────────────────────────────────────────
h.suite('campaign/星级边界')
var winLv = core.findLevel('c1-02') // win / moves：star2=30、star3=22
h.eq('win 未取胜 = 0 星', core.starsOf(winLv, { win: false, moves: 1 }), 0)
h.eq('win 缺少 stats = 0 星', core.starsOf(winLv, null), 0)
h.eq('win 手数缺失 = 1 星', core.starsOf(winLv, { win: true }), 1)
h.eq('win 手数 31 = 1 星', core.starsOf(winLv, { win: true, moves: 31 }), 1)
h.eq('win 手数 30 = 2 星（边界）', core.starsOf(winLv, { win: true, moves: 30 }), 2)
h.eq('win 手数 22 = 3 星（边界）', core.starsOf(winLv, { win: true, moves: 22 }), 3)
h.eq('win 手数 10 = 3 星', core.starsOf(winLv, { win: true, moves: 10 }), 3)

var scoreLv = core.findLevel('c1-05') // score：star2=256、star3=512
h.eq('score 255 = 1 星', core.starsOf(scoreLv, { win: true, score: 255 }), 1)
h.eq('score 256 = 2 星（边界）', core.starsOf(scoreLv, { win: true, score: 256 }), 2)
h.eq('score 511 = 2 星', core.starsOf(scoreLv, { win: true, score: 511 }), 2)
h.eq('score 512 = 3 星（边界）', core.starsOf(scoreLv, { win: true, score: 512 }), 3)
h.eq('score 未通关 = 0 星', core.starsOf(scoreLv, { win: false, score: 99999 }), 0)

var timeLv = core.findLevel('c3-05') // time：star2=120、star3=80
h.eq('time 121 秒 = 1 星', core.starsOf(timeLv, { win: true, time: 121 }), 1)
h.eq('time 120 秒 = 2 星（边界）', core.starsOf(timeLv, { win: true, time: 120 }), 2)
h.eq('time 80 秒 = 3 星（边界）', core.starsOf(timeLv, { win: true, time: 80 }), 3)

var stepLv = core.findLevel('c1-04') // steps：star2=80、star3=50
h.eq('steps 81 = 1 星', core.starsOf(stepLv, { win: true, steps: 81 }), 1)
h.eq('steps 80 = 2 星（边界）', core.starsOf(stepLv, { win: true, steps: 80 }), 2)
h.eq('steps 50 = 3 星（边界）', core.starsOf(stepLv, { win: true, steps: 50 }), 3)
h.eq('moves 型 metric 也可结算', core.starsOf({ metric: 'moves', star2: 10, star3: 5 }, { win: true, moves: 5 }), 3)

// ── 首次奖励 / 解锁 / 最高星保留 ────────────────────────────────────
h.suite('campaign/结算与奖励')
var a = core.finish(core.emptyState(), 'c1-01', { win: true, moves: 3 })
h.eq('首次 3 星', a.stars, 3)
h.eq('首次发奖励 20', a.reward, 20)
h.eq('首次解锁下一关', a.unlocked, true)
h.eq('状态解锁到 2', a.state.unlocked, 2)
h.eq('claimed 记录', a.state.claimed['c1-01'], true)

var b = core.finish(a.state, 'c1-01', { win: true, moves: 3 })
h.eq('重复通关不再发奖', b.reward, 0)
h.eq('重复通关解锁标记 false', b.unlocked, false)
h.eq('重复通关状态不变', b.state.unlocked, 2)

var lose = core.finish(core.emptyState(), 'c1-01', { win: false, moves: 3 })
h.eq('失败 0 星', lose.stars, 0)
h.eq('失败不发奖', lose.reward, 0)
h.eq('失败不记录星级', lose.state.stars['c1-01'], undefined)
h.eq('失败不解锁', lose.state.unlocked, 1)
h.eq('失败不登记 claimed', lose.state.claimed['c1-01'], undefined)

var rewardless = core.finish(core.emptyState(), 'c1-01', { win: true, moves: 40 })
h.eq('1 星也发奖励', rewardless.reward, 20)
h.eq('1 星也解锁', rewardless.state.unlocked, 2)

var locked = core.finish(core.emptyState(), 'c1-05', perfect(core.findLevel('c1-05')))
h.eq('未解锁关卡 locked=true', locked.locked, true)
h.eq('未解锁关卡 0 星', locked.stars, 0)
h.eq('未解锁关卡不发奖', locked.reward, 0)
h.eq('未解锁关卡状态不变', locked.state.unlocked, 1)

// 申报最高星：先 3 星后 1 星不回退
var hi = core.finish(core.emptyState(), 'c1-01', { win: true, moves: 3 })
var lo = core.finish(hi.state, 'c1-01', { win: true, moves: 10 })
h.eq('本次只有 1 星', lo.stars, 1)
h.eq('历史最高仍为 3 星', lo.best, 3)
h.eq('状态保留最高星', lo.state.stars['c1-01'], 3)
h.eq('最高星不重复发奖', lo.reward, 0)

// 输入状态不被修改
var origin = core.emptyState()
core.finish(origin, 'c1-01', { win: true, moves: 3 })
h.eq('finish 不修改入参 stars', origin.stars, {})
h.eq('finish 不修改入参 unlocked', origin.unlocked, 1)

// 非法关卡 id
var bad = core.finish(core.emptyState(), 'nope', { win: true })
h.eq('非法关卡 level=null', bad.level, null)
h.eq('非法关卡 0 星', bad.stars, 0)
h.eq('非法关卡状态归一', bad.state.unlocked, 1)

// ── 全 80 关顺序通关 ────────────────────────────────────────────────
h.suite('campaign/全关流程')
var st = core.emptyState()
var rewardSum = 0
var rewardExpect = 0
var allStars3 = true
for (var q = 1; q <= core.TOTAL; q++) {
  var qlv = core.levelAt(q)
  rewardExpect += qlv.reward
  var rq = core.finish(st, qlv.id, perfect(qlv))
  if (!rq.locked) st = rq.state
  rewardSum += rq.reward
  if (rq.stars !== 3) allStars3 = false
}
h.eq('80 关全部 3 星', allStars3, true)
h.eq('全部通关后解锁 80', st.unlocked, 80)
h.eq('累计星数 240', core.totalStars(st), 240)
h.eq('奖励总额与关卡一致', rewardSum, rewardExpect)
h.eq('全通关文案', core.progressText(st), '通关 80/80 · ★ 240/240')
h.eq('全部关卡记为已通关', core.chapterRows(st)[5].rows[9].cleared, true)

process.exitCode = h.summary()
