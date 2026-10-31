/**
 * tests/daily.js — 每日挑战纯逻辑测试（不依赖 storage）。
 * 运行：node tests/daily.js
 * 覆盖：同日同玩法同种子、跨日切换、连续天数、断签重置、奖励只发一次、
 *       玩法不匹配不发奖、入参不被修改。
 */

var e = require('../src/utils/economy-core.js')
var rng = require('../src/utils/rng.js')
var h = require('./helper.js')

// 输入：相对 2026-10-24 的天数偏移；输出：UTC 日期串 YYYYMMDD（避免时区/夏令时干扰）。
function dstr(offset) {
  var d = new Date(Date.UTC(2026, 9, 24) + offset * 86400000)
  var y = d.getUTCFullYear()
  var m = d.getUTCMonth() + 1
  var day = d.getUTCDate()
  return '' + y + (m < 10 ? '0' : '') + m + (day < 10 ? '0' : '') + day
}

h.suite('daily/日期 → 玩法与种子')
var ids = e.DAILY_GAMES.slice()
var sel1 = e.selectDaily(dstr(0), ids)
var sel2 = e.selectDaily(dstr(0), ids)
h.eq('同日选择完全一致', sel1, sel2)
h.eq('选择日期已清洗', e.selectDaily('2026-10-24', ids).date, '20261024')
h.eq('种子与 rng.dateSeed 一致', sel1.seed, rng.dateSeed(sel1.date, sel1.gameId))
h.ok('跨日种子不同', e.selectDaily(dstr(1), ids).seed !== sel1.seed)
h.ok('跨日玩法不同', e.selectDaily(dstr(1), ids).gameId !== sel1.gameId)
h.eq('空玩法列表兜底', e.selectDaily(dstr(0), []).gameId, '')
h.eq('空玩法列表种子 0', e.selectDaily(dstr(0), []).seed, 0)

// 连续 N 天恰好覆盖全部 N 款玩法（严格轮换，不靠哈希撞运气）
var seen = {}
for (var ci = 0; ci < ids.length; ci++) seen[e.selectDaily(dstr(ci), ids).gameId] = true
h.eq('连续天数覆盖全部玩法', Object.keys(seen).length, ids.length)
h.eq('兜底玩法清单 19 款', ids.length, 19)
// 同一颗每日种子：两次构造的随机序列一致（骰子/卡牌/AI 并列决策可复现）
var seqA = []
var seqB = []
var ra = rng.create(sel1.seed)
var rb = rng.create(sel1.seed)
for (var si = 0; si < 10; si++) {
  seqA.push(ra.int(6))
  seqB.push(rb.int(6))
}
h.eq('每日种子可复现', seqA, seqB)

h.suite('daily/状态归一')
h.eq('空状态默认值', e.normDaily(null), { date: '', gameId: '', seed: 0, completed: false, rewardClaimed: false, streak: 0, lastDate: '' })
var dirty = e.normDaily({ date: 123, gameId: 5, seed: -1, completed: 'yes', rewardClaimed: 1, streak: 'x', lastDate: 9 })
h.eq('脏日期兜底', dirty.date, '')
h.eq('脏玩法兜底', dirty.gameId, '')
h.eq('脏种子兜底', dirty.seed, 0)
h.eq('脏完成标记兜底', dirty.completed, false)
h.eq('脏连续天数兜底', dirty.streak, 0)

h.suite('daily/连续七日挑战')
var state = e.normDaily(null)
var totalReward = 0
for (var di = 0; di < 7; di++) {
  var date = dstr(di)
  var sel = e.selectDaily(date, ids)
  // 模拟 loadDaily 换日后的状态：日期/玩法换成今天，连续天数与上次日期保留
  var dayState = {
    date: sel.date,
    gameId: sel.gameId,
    seed: sel.seed,
    completed: false,
    rewardClaimed: false,
    streak: state.streak,
    lastDate: state.lastDate
  }
  var r = e.completeDaily(dayState, date, sel.gameId)
  totalReward += r.reward
  state = r.state
  h.eq('第 ' + (di + 1) + ' 天连续天数', state.streak, di + 1)
  h.eq('第 ' + (di + 1) + ' 天完成标记', state.completed, true)
  h.eq('第 ' + (di + 1) + ' 天完成日期', state.lastDate, date)
  var again = e.completeDaily(state, date, sel.gameId)
  h.eq('第 ' + (di + 1) + ' 天重复不发币', again.reward, 0)
  h.eq('第 ' + (di + 1) + ' 天重复标记', again.already, true)
}
h.eq('七日奖励合计', totalReward, e.DAILY_REWARD * 7)

h.suite('daily/断签与跨日')
var gapState = {
  date: dstr(9),
  gameId: 'gomoku',
  seed: 1,
  completed: false,
  rewardClaimed: false,
  streak: 7,
  lastDate: dstr(6)
}
var gap = e.completeDaily(gapState, dstr(9), 'gomoku')
h.eq('断签三天重置为 1', gap.state.streak, 1)
h.eq('断签后仍发奖', gap.reward, e.DAILY_REWARD)

// 页面未先 loadDaily：旧日期状态直接完成 → 按「今天首次完成」处理
var oldRaw = { date: dstr(0), gameId: 'gomoku', seed: 123, completed: true, rewardClaimed: true, streak: 3, lastDate: dstr(0) }
var cross = e.completeDaily(oldRaw, dstr(1), 'gomoku')
h.eq('跨日连续 +1', cross.state.streak, 4)
h.eq('跨日状态日期更新', cross.state.date, dstr(1))
h.eq('跨日发奖一次', cross.reward, e.DAILY_REWARD)
h.eq('跨日原状态未改', oldRaw.date, dstr(0))
var farRaw = { date: dstr(0), gameId: 'gomoku', seed: 123, completed: true, rewardClaimed: true, streak: 5, lastDate: dstr(0) }
h.eq('跨多日重置为 1', e.completeDaily(farRaw, dstr(3), 'gomoku').state.streak, 1)

h.suite('daily/玩法匹配与首次')
var today = dstr(0)
var nowSel = e.selectDaily(today, ids)
var todayState = { date: today, gameId: nowSel.gameId, seed: nowSel.seed, completed: false, rewardClaimed: false, streak: 0, lastDate: '' }
var wrong = e.completeDaily(todayState, today, 'tictactoe')
h.eq('玩法不匹配不发币', wrong.reward, 0)
h.eq('玩法不匹配标记 already', wrong.already, true)
h.eq('玩法不匹配不标记完成', wrong.state.completed, false)
h.eq('玩法不匹配不改入参', todayState.completed, false)
var first = e.completeDaily(e.normDaily(null), today, nowSel.gameId)
h.eq('全新状态首次完成发奖', first.reward, e.DAILY_REWARD)
h.eq('全新状态连续 1', first.state.streak, 1)
h.eq('空日期不发奖', e.completeDaily(todayState, '', nowSel.gameId).reward, 0)

process.exitCode = h.summary()
