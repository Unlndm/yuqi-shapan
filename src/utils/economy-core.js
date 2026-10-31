/**
 * utils/economy-core.js — 棋币 / 赛季 / 商店的纯逻辑（无 storage，node 可直接测）。
 * 约定（2026-10-24 玩家决策）：
 *   · 赛季「随更新来」：每次发版手动把 SEASON_ID +1、改 SEASON_NAME；
 *     ID 变化时赛季进度与领取记录重置，棋币 / 道具 / 已解锁配色永久保留。
 *   · 棋币来源：对局结算（人机 / 双人按结果发币）+ 赛季任务奖励。
 *   · 棋币出口：解锁新配色（设置页）+ 赛季商店买局内道具（免狱卡 / 重掷券）。
 *   · 局内道具只在本机玩家回合手动使用，AI 不使用。
 * 所有函数都返回新对象，不修改入参（页面 data 依赖引用变化触发刷新）。
 */

var rng = require('./rng.js')

var SEASON_ID = 1
var SEASON_NAME = '初执棋子'

// 对局结算发币（玩家视角）。胜多负少，双人略低于人机，避免刷双人局。
var COIN = {
  ai: { win: 20, draw: 10, lose: 5 },
  pvp: { win: 15, draw: 8, lose: 4 }
}

// 赛季任务（一次性；完成需手动领取；赛季重置后进度与领取记录一起清空）
var TASKS = [
  { id: 'games', name: '完成6局对局', need: 6, reward: 60 },
  { id: 'wins', name: '赢得4局', need: 4, reward: 100 },
  { id: 'streak', name: '达成3连胜', need: 3, reward: 80 },
  { id: 'variety', name: '体验4种玩法', need: 4, reward: 60 },
  { id: 'aiGames', name: '人机对战5局', need: 5, reward: 60 }
]

// 赛季商店（库存跨赛季保留，使用后扣 1）
var ITEMS = [
  { id: 'jailCard', name: '免狱卡', desc: '大富翁：免罚出狱', price: 80 },
  { id: 'reroll', name: '重掷券', desc: '飞行棋：重掷一次', price: 60 }
]

// 可解锁配色：前三套默认免费，后两套用棋币解锁（解锁永久保留）
var PALETTE_PRICES = { amber: 200, rose: 300 }
var DEFAULT_PALETTES = ['purple', 'green', 'blue']

// 内部：非负整数兜底。
function intOf(v, defVal) {
  var n = typeof v === 'number' && isFinite(v) ? Math.floor(v) : defVal
  return n > 0 ? n : (n === 0 ? 0 : defVal)
}

// 内部：对象浅拷贝（Vela 无 Object.assign 保证，手写更稳）。
function copyObj(src) {
  var o = {}
  if (src) for (var k in src) o[k] = src[k]
  return o
}

// 内部：新赛季的空进度。
function emptySeason() {
  return {
    id: SEASON_ID,
    games: 0,
    wins: 0,
    aiGames: 0,
    streak: 0,
    bestStreak: 0,
    seen: {},
    claimed: {}
  }
}

// 输入：storage 里的原始赛季对象；输出：本季可用的规范化状态（旧季/脏值 → 新季空状态）。
// 2026-10-24 修正：SEASON_ID 曾被误改为 2（玩家未要求换季）。现回退为 1；
// 对已经按「第 2 赛季」写入的存档（id=2）不重置，原样保留任务进度与领取记录，
// 避免这次代码回退被误判为换季、把玩家数据清空。
function normSeason(raw) {
  if (!raw) return emptySeason()
  var legacyRollback = SEASON_ID === 1 && Number(raw.id) === 2
  if (raw.id !== SEASON_ID && !legacyRollback) return emptySeason()
  return {
    id: SEASON_ID,
    games: intOf(raw.games, 0),
    wins: intOf(raw.wins, 0),
    aiGames: intOf(raw.aiGames, 0),
    streak: intOf(raw.streak, 0),
    bestStreak: intOf(raw.bestStreak, 0),
    seen: raw.seen && typeof raw.seen === 'object' ? copyObj(raw.seen) : {},
    claimed: raw.claimed && typeof raw.claimed === 'object' ? copyObj(raw.claimed) : {}
  }
}

// 内部：深拷贝赛季状态（seen / claimed 单独拷一层）。
function cloneSeason(s) {
  var o = normSeason(s)
  o.seen = copyObj(o.seen)
  o.claimed = copyObj(o.claimed)
  return o
}

// 输入：赛季状态、任务 id；输出：当前进度（0 起）。
function progressOf(s, id) {
  if (id === 'games') return s.games
  if (id === 'wins') return s.wins
  if (id === 'streak') return s.bestStreak
  if (id === 'aiGames') return s.aiGames
  if (id === 'variety') {
    var n = 0
    for (var k in s.seen) if (s.seen[k]) n++
    return n
  }
  return 0
}

// 输入：任务 id；输出：任务定义或 null。
function findTask(id) {
  for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i]
  return null
}

// 输入：赛季状态；输出：页面用的任务行数组（进度 / 可领 / 已领）。
function taskRows(season) {
  var s = normSeason(season)
  var rows = []
  for (var i = 0; i < TASKS.length; i++) {
    var t = TASKS[i]
    var cur = progressOf(s, t.id)
    var done = cur >= t.need
    rows.push({
      id: t.id,
      name: t.name,
      cur: cur > t.need ? t.need : cur,
      need: t.need,
      reward: t.reward,
      done: done,
      claimed: !!s.claimed[t.id],
      canClaim: done && !s.claimed[t.id],
      text: (cur > t.need ? t.need : cur) + '/' + t.need
    })
  }
  return rows
}

// 输入：结果 win|lose|draw、模式 ai|pvp；输出：本局应发棋币（结算弹窗展示与发放共用）。
function coinFor(result, mode) {
  var table = mode === 'pvp' ? COIN.pvp : COIN.ai
  return result === 'win' ? table.win : (result === 'draw' ? table.draw : table.lose)
}

// 输入：赛季状态、玩法 id、结果 win|lose|draw、模式 ai|pvp；
// 输出：{ season 新状态, coins 本次发币, tasks 新完成的任务 id 数组 }。
function applyMatch(season, gameId, result, mode) {
  var prev = normSeason(season)
  var s = cloneSeason(prev)
  s.games++
  // 单人玩法（推箱子 / 数独）通关：只计入总局数与玩法种类，
  // 不计胜场、连胜、人机局数（避免单人通关拉高对战数据与连胜）。
  if (mode !== 'solo') {
    if (result === 'win') {
      s.wins++
      s.streak++
      if (s.streak > s.bestStreak) s.bestStreak = s.streak
    } else {
      s.streak = 0
    }
    if (mode !== 'pvp') s.aiGames++
  }
  if (gameId) s.seen[gameId] = true

  var gain = coinFor(result, mode)

  // 新完成（此前未完成、且未领取）的任务 id：供页面提示「赛季任务可领取」
  var finished = []
  for (var i = 0; i < TASKS.length; i++) {
    var t = TASKS[i]
    if (s.claimed[t.id]) continue
    if (progressOf(prev, t.id) < t.need && progressOf(s, t.id) >= t.need) finished.push(t.id)
  }
  return { season: s, coins: gain, tasks: finished }
}

// 输入：赛季状态、当前棋币、任务 id；输出：{ok, reason, season, coins, reward}。
// reason: bad | claimed | locked
function claim(season, coins, id) {
  var t = findTask(id)
  var s = cloneSeason(season)
  if (!t) return { ok: false, reason: 'bad', season: s, coins: coins, reward: 0 }
  if (s.claimed[id]) return { ok: false, reason: 'claimed', season: s, coins: coins, reward: 0 }
  if (progressOf(s, id) < t.need) return { ok: false, reason: 'locked', season: s, coins: coins, reward: 0 }
  s.claimed[id] = true
  return { ok: true, reason: '', season: s, coins: coins + t.reward, reward: t.reward }
}

// 输入：物品 id；输出：物品定义或 null。
function findItem(id) {
  for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i]
  return null
}

// 输入：items 原始对象；输出：规范化库存 {jailCard:0, reroll:0}。
function normItems(raw) {
  var o = {}
  for (var i = 0; i < ITEMS.length; i++) o[ITEMS[i].id] = intOf(raw && raw[ITEMS[i].id], 0)
  return o
}

// 输入：当前棋币、库存、物品 id；输出：{ok, reason, coins, items}。reason: bad | poor
function buyItem(coins, items, id) {
  var item = findItem(id)
  var inv = normItems(items)
  var c = intOf(coins, 0)
  if (!item) return { ok: false, reason: 'bad', coins: c, items: inv }
  if (c < item.price) return { ok: false, reason: 'poor', coins: c, items: inv }
  inv[id] = inv[id] + 1
  return { ok: true, reason: '', coins: c - item.price, items: inv }
}

// 输入：库存、物品 id；输出：{ok, items}。库存不足时不变。
function useItem(items, id) {
  var inv = normItems(items)
  if (!inv[id] || inv[id] <= 0) return { ok: false, items: inv }
  inv[id] = inv[id] - 1
  return { ok: true, items: inv }
}

// 输入：当前棋币、已解锁配色数组、配色 id；输出：{ok, reason, coins, palettes}。
// reason: bad | owned | poor
function unlockPalette(coins, palettes, id) {
  var price = PALETTE_PRICES[id]
  var c = intOf(coins, 0)
  var list = palettes && palettes.length ? palettes.slice() : DEFAULT_PALETTES.slice()
  if (price === undefined) return { ok: false, reason: 'bad', coins: c, palettes: list }
  if (list.indexOf(id) >= 0) return { ok: false, reason: 'owned', coins: c, palettes: list }
  if (c < price) return { ok: false, reason: 'poor', coins: c, palettes: list }
  list.push(id)
  return { ok: true, reason: '', coins: c - price, palettes: list }
}

// 输入：已解锁数组；输出：规范化数组（至少含三套默认，去重）。
function normPalettes(raw) {
  var list = []
  for (var i = 0; i < DEFAULT_PALETTES.length; i++) list.push(DEFAULT_PALETTES[i])
  if (raw && raw.length) {
    for (var k = 0; k < raw.length; k++) {
      if (list.indexOf(raw[k]) < 0 && PALETTE_PRICES[raw[k]] !== undefined) list.push(raw[k])
    }
  }
  return list
}

// 输入：无；输出：赛季展示标题（也用于主页金币条）。
function seasonLabel() {
  return '第 ' + SEASON_ID + ' 赛季 · ' + SEASON_NAME
}

// ── 每日挑战 ───────────────────────────────────────────────────────
// 状态：{date, gameId, seed, completed, rewardClaimed, streak, lastDate}
//   date：当天日期串 YYYYMMDD；gameId / seed：当天轮换结果；
//   completed / rewardClaimed：当天是否已完成、是否已发币（发币只一次）；
//   streak / lastDate：连续挑战天数与最近一次完成日期（跨日保留，断签才归 1）。
// 轮换规则：日期天序号 % 玩法数（严格轮换，连续 N 天恰好覆盖 N 款玩法）。
// 玩法清单由调用方传入（主页把 config.GAME_TYPES 的 id 传进来）；未传则用 DAILY_GAMES 兜底。
// 新玩法上线后由调用方传入完整清单即可自动纳入，本文件不依赖 config，避免循环依赖。
var DAILY_REWARD = 40
var DAILY_GAMES = [
  'gomoku', 'tictactoe', 'othello', 'connect4', 'chess', 'go',
  'aeroplane', 'monopoly', 'g2048', 'slide', 'minesweeper',
  'draughts', 'jungle', 'sokoban', 'sudoku',
  'werewolf', 'snake', 'maze', 'spotdiff'
]

// 输入：无；输出：空的每日挑战状态。
function emptyDaily() {
  return { date: '', gameId: '', seed: 0, completed: false, rewardClaimed: false, streak: 0, lastDate: '' }
}

// 输入：storage 原始每日状态；输出：规范化新对象（脏值 → 默认）。
function normDaily(raw) {
  var r = raw && typeof raw === 'object' ? raw : {}
  return {
    date: typeof r.date === 'string' ? r.date : '',
    gameId: typeof r.gameId === 'string' ? r.gameId : '',
    seed: intOf(r.seed, 0),
    completed: r.completed === true,
    rewardClaimed: r.rewardClaimed === true,
    streak: intOf(r.streak, 0),
    lastDate: typeof r.lastDate === 'string' ? r.lastDate : ''
  }
}

// 输入：日期串 YYYYMMDD、玩法 id 数组；输出：{date, gameId, seed}（纯函数，同日同结果）。
function selectDaily(dateStr, gameIds) {
  var date = rng.cleanDate(dateStr)
  var list = gameIds ? gameIds : DAILY_GAMES
  if (!list.length) return { date: date, gameId: '', seed: 0 }
  var idx = rng.dayNumber(date) % list.length
  if (idx < 0) idx += list.length
  var gameId = list[idx]
  return { date: date, gameId: gameId, seed: rng.dateSeed(date, gameId) }
}

// 输入：每日状态、日期串、完成玩法 id；
// 输出：{state 新状态, reward 本次发币, already 是否已领过}。
// 规则：同一天只发一次；换日按「昨天完成过」累加连续天数，断签归 1；
//       当天玩法不匹配（防止随意刷别的玩法）不发币，状态不变。
function completeDaily(state, dateStrValue, gameId) {
  var prev = normDaily(state)
  var date = rng.cleanDate(dateStrValue)
  var s = normDaily(prev)
  var gid = typeof gameId === 'string' ? gameId : ''
  if (!date) return { state: s, reward: 0, already: true }

  // 跨日（页面未先 loadDaily 的情况）：直接按「今天首次完成」处理
  if (prev.date !== date) {
    s.date = date
    s.gameId = gid || s.gameId
    s.seed = s.gameId ? rng.dateSeed(date, s.gameId) : 0
    s.completed = true
    s.rewardClaimed = true
    s.streak = (prev.lastDate && rng.dayNumber(date) - rng.dayNumber(prev.lastDate) === 1)
      ? prev.streak + 1 : 1
    s.lastDate = date
    return { state: s, reward: DAILY_REWARD, already: false }
  }

  // 同日：只认当天轮换出的玩法（gameId 为空视为未指定，允许绑定）
  if (gid && s.gameId && gid !== s.gameId) return { state: s, reward: 0, already: true }
  if (!s.gameId && gid) s.gameId = gid
  if (!s.seed && s.gameId) s.seed = rng.dateSeed(date, s.gameId)
  if (s.rewardClaimed) {
    s.completed = true
    return { state: s, reward: 0, already: true }
  }

  s.completed = true
  s.rewardClaimed = true
  if (!s.lastDate) {
    s.streak = 1
  } else if (s.lastDate === date) {
    if (s.streak < 1) s.streak = 1
  } else {
    s.streak = rng.dayNumber(date) - rng.dayNumber(s.lastDate) === 1 ? s.streak + 1 : 1
  }
  s.lastDate = date
  return { state: s, reward: DAILY_REWARD, already: false }
}

// ── 终身成就（42 项；不随赛季重置） ────────────────────────────────
// 分类：对局 8 / 棋种 8 / 赛季 8 / 收集 8 / 每日 5 / 残局 5。
// 每项：{id, name, category, key, threshold, reward}；key 指向终身计数器的键。
// 解锁只在「首次达标」发生一次，奖励同步发放一次；state.unlocked 记录已解锁。
var ACH_CATS = [
  { id: 'match', name: '对局' },
  { id: 'game', name: '棋种' },
  { id: 'season', name: '赛季' },
  { id: 'collect', name: '收集' },
  { id: 'daily', name: '每日' },
  { id: 'puzzle', name: '残局' },
  { id: 'campaign', name: '闯关' }
]

var ACHIEVEMENTS = [
  // 对局（8）
  { id: 'm_first', name: '初执棋子', category: 'match', key: 'games', threshold: 1, reward: 10 },
  { id: 'm_games_10', name: '十局磨砺', category: 'match', key: 'games', threshold: 10, reward: 20 },
  { id: 'm_games_50', name: '五十战', category: 'match', key: 'games', threshold: 50, reward: 50 },
  { id: 'm_games_200', name: '两百局老手', category: 'match', key: 'games', threshold: 200, reward: 120 },
  { id: 'm_win_1', name: '首胜', category: 'match', key: 'wins', threshold: 1, reward: 10 },
  { id: 'm_win_10', name: '十胜', category: 'match', key: 'wins', threshold: 10, reward: 30 },
  { id: 'm_win_50', name: '五十胜', category: 'match', key: 'wins', threshold: 50, reward: 100 },
  { id: 'm_streak_5', name: '五连胜', category: 'match', key: 'streakBest', threshold: 5, reward: 60 },
  // 棋种（8）
  { id: 'g_var_4', name: '初识棋种', category: 'game', key: 'variety', threshold: 4, reward: 30 },
  { id: 'g_var_8', name: '八面玲珑', category: 'game', key: 'variety', threshold: 8, reward: 60 },
  { id: 'g_var_12', name: '十二般武艺', category: 'game', key: 'variety', threshold: 12, reward: 100 },
  { id: 'g_var_15', name: '全玩法通', category: 'game', key: 'variety', threshold: 15, reward: 150 },
  { id: 'g_var_19', name: '十九般武艺', category: 'game', key: 'variety', threshold: 19, reward: 220 },
  { id: 'g_gomoku_win', name: '五子首捷', category: 'game', key: 'win_gomoku', threshold: 1, reward: 20 },
  { id: 'g_chess_win', name: '棋王初胜', category: 'game', key: 'win_chess', threshold: 1, reward: 20 },
  { id: 'g_go_win', name: '围地初胜', category: 'game', key: 'win_go', threshold: 1, reward: 20 },
  { id: 'g_solo_win', name: '单骑闯关', category: 'game', key: 'soloWins', threshold: 1, reward: 20 },
  // 赛季（8）
  { id: 's_task_1', name: '首项赛季任务', category: 'season', key: 'seasonTasks', threshold: 1, reward: 20 },
  { id: 's_task_5', name: '五项赛季任务', category: 'season', key: 'seasonTasks', threshold: 5, reward: 40 },
  { id: 's_task_15', name: '十五项赛季任务', category: 'season', key: 'seasonTasks', threshold: 15, reward: 80 },
  { id: 's_task_30', name: '三十项赛季任务', category: 'season', key: 'seasonTasks', threshold: 30, reward: 120 },
  { id: 's_task_60', name: '六十项赛季任务', category: 'season', key: 'seasonTasks', threshold: 60, reward: 200 },
  { id: 's_perfect_1', name: '单季全勤', category: 'season', key: 'seasonPerfect', threshold: 1, reward: 60 },
  { id: 's_perfect_3', name: '三季全勤', category: 'season', key: 'seasonPerfect', threshold: 3, reward: 120 },
  { id: 's_perfect_5', name: '五季全勤', category: 'season', key: 'seasonPerfect', threshold: 5, reward: 200 },
  // 收集（8）
  { id: 'c_skin_1', name: '首套皮肤', category: 'collect', key: 'skinsBought', threshold: 1, reward: 20 },
  { id: 'c_skin_3', name: '三套皮肤', category: 'collect', key: 'skinsBought', threshold: 3, reward: 40 },
  { id: 'c_skin_5', name: '五套皮肤', category: 'collect', key: 'skinsBought', threshold: 5, reward: 80 },
  { id: 'c_skin_6', name: '皮肤全收', category: 'collect', key: 'skinsBought', threshold: 6, reward: 120 },
  { id: 'c_pal_1', name: '解锁配色', category: 'collect', key: 'palettesBought', threshold: 1, reward: 40 },
  { id: 'c_pal_2', name: '配色全开', category: 'collect', key: 'palettesBought', threshold: 2, reward: 80 },
  { id: 'c_buy_5', name: '五次进货', category: 'collect', key: 'purchases', threshold: 5, reward: 30 },
  { id: 'c_buy_20', name: '常客', category: 'collect', key: 'purchases', threshold: 20, reward: 100 },
  // 每日（5）
  { id: 'd_first', name: '今日一试', category: 'daily', key: 'dailyDone', threshold: 1, reward: 20 },
  { id: 'd_7', name: '七日挑战', category: 'daily', key: 'dailyDone', threshold: 7, reward: 60 },
  { id: 'd_30', name: '月度挑战', category: 'daily', key: 'dailyDone', threshold: 30, reward: 150 },
  { id: 'd_streak_3', name: '三日不断', category: 'daily', key: 'dailyStreak', threshold: 3, reward: 40 },
  { id: 'd_streak_7', name: '七日连挑', category: 'daily', key: 'dailyStreak', threshold: 7, reward: 100 },
  // 残局（5）
  { id: 'p_1', name: '首解残局', category: 'puzzle', key: 'puzzles', threshold: 1, reward: 20 },
  { id: 'p_5', name: '五题在手', category: 'puzzle', key: 'puzzles', threshold: 5, reward: 50 },
  { id: 'p_10', name: '十题贯通', category: 'puzzle', key: 'puzzles', threshold: 10, reward: 80 },
  { id: 'p_20', name: '二十题', category: 'puzzle', key: 'puzzles', threshold: 20, reward: 120 },
  { id: 'p_30', name: '残局三十', category: 'puzzle', key: 'puzzles', threshold: 30, reward: 200 },
  // 闯关（5）：进度用「历史最大值」写入，重复通关不会虚增
  { id: 'cg_first', name: '初入闯关', category: 'campaign', key: 'campaignLevels', threshold: 1, reward: 20 },
  { id: 'cg_10', name: '十关通过', category: 'campaign', key: 'campaignLevels', threshold: 10, reward: 60 },
  { id: 'cg_30', name: '半程王者', category: 'campaign', key: 'campaignLevels', threshold: 30, reward: 120 },
  { id: 'cg_60', name: '闯关封王', category: 'campaign', key: 'campaignLevels', threshold: 60, reward: 300 },
  { id: 'cg_star_90', name: '九十星辉', category: 'campaign', key: 'campaignStars', threshold: 90, reward: 150 }
]

// 规范化时预置的计数器键（其余自定义键，如 played_<gameId>，按需保留）。
var ACH_COUNTER_KEYS = [
  'games', 'wins', 'aiGames', 'pvpGames', 'streakBest', 'variety', 'soloWins',
  'win_gomoku', 'win_chess', 'win_go',
  'seasonTasks', 'seasonPerfect',
  'skinsBought', 'palettesBought', 'purchases',
  'dailyDone', 'dailyStreak',
  'puzzles',
  'campaignLevels', 'campaignStars'
]

// 内部：成就 id 是否合法。
function isAchId(id) {
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) return true
  return false
}

// 输入：storage 原始成就状态 {counters, unlocked}；输出：规范化新对象。
function normAch(raw) {
  var r = raw && typeof raw === 'object' ? raw : {}
  var src = r.counters && typeof r.counters === 'object' ? r.counters : {}
  var counters = {}
  for (var i = 0; i < ACH_COUNTER_KEYS.length; i++) {
    counters[ACH_COUNTER_KEYS[i]] = intOf(src[ACH_COUNTER_KEYS[i]], 0)
  }
  // 保留额外计数字段（如 played_gomoku / win_chess），仅收非负整数
  for (var k in src) {
    if (counters[k] === undefined) counters[k] = intOf(src[k], 0)
  }
  var unlocked = {}
  var u = r.unlocked && typeof r.unlocked === 'object' ? r.unlocked : {}
  for (var id in u) if (u[id] === true && isAchId(id)) unlocked[id] = true
  return { counters: counters, unlocked: unlocked }
}

// 输入：无；输出：空的终身成就状态。
function emptyAch() {
  return normAch(null)
}

// 输入：成就状态、计数器键、增量（可为负，最低 0）；输出：新状态（不改入参）。
function bumpAch(prev, key, amount) {
  var s = normAch(prev)
  if (!key || typeof key !== 'string') return s
  var d = typeof amount === 'number' && isFinite(amount) ? Math.floor(amount) : 0
  var next = intOf(s.counters[key], 0) + d
  s.counters[key] = next > 0 ? next : 0
  return s
}

// 输入：成就状态、事件表；输出：新状态。
// 事件值：数字 = 累加；{max: n} = 取历史最大值（用于「最长连续」类计数）。
function applyAchEvents(prev, events) {
  var s = normAch(prev)
  if (!events || typeof events !== 'object') return s
  for (var k in events) {
    var v = events[k]
    if (typeof v === 'number' && isFinite(v)) {
      var add = intOf(s.counters[k], 0) + Math.floor(v)
      s.counters[k] = add > 0 ? add : 0
    } else if (v && typeof v === 'object' && typeof v.max === 'number' && isFinite(v.max)) {
      var m = Math.floor(v.max)
      if (m > intOf(s.counters[k], 0)) s.counters[k] = m > 0 ? m : 0
    }
  }
  return s
}

// 输入：计数器对象；输出：派生计数（variety = 有对局记录的玩法种数）。
function deriveCounters(counters) {
  var c = counters && typeof counters === 'object' ? counters : {}
  var variety = 0
  for (var k in c) {
    if (k.indexOf('played_') === 0 && intOf(c[k], 0) > 0) variety++
  }
  return { variety: variety }
}

// 输入：旧成就状态、最新计数（可为空沿用旧值）、额外派生计数（绝对值覆盖）；
// 输出：{state 新状态, unlocked 本次解锁的成就定义数组, reward 本次奖励合计}。
// 只对「此前未解锁且本次达标」的项发奖，天然保证只发一次。
function unlockReady(prev, counters, extra) {
  var s = normAch(prev)
  if (counters && typeof counters === 'object') {
    s.counters = normAch({ counters: counters, unlocked: s.unlocked }).counters
  }
  if (extra && typeof extra === 'object') {
    for (var k in extra) {
      if (typeof extra[k] === 'number' && isFinite(extra[k]) && extra[k] > 0) {
        s.counters[k] = Math.floor(extra[k])
      }
    }
  }
  var list = []
  var reward = 0
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i]
    if (s.unlocked[a.id]) continue
    if (intOf(s.counters[a.key], 0) < a.threshold) continue
    s.unlocked[a.id] = true
    list.push(copyObj(a))
    reward += a.reward
  }
  return { state: s, unlocked: list, reward: reward }
}

// 单人玩法（通关计 soloWins；后续推箱子/数独接入时在此追加 id）。
var SOLO_GAMES = ['g2048', 'slide', 'minesweeper', 'sokoban', 'sudoku', 'maze', 'spotdiff']

// 输入：玩法 id、结果 win|lose|draw、模式 ai|pvp；输出：本局应计入的成就事件表。
// 由对局结算调用方喂给 applyAchEvents / recordAchEvents，避免页面各写一份计数口径。
function matchEvents(gameId, result, mode) {
  var ev = { games: 1 }
  if (gameId) ev['played_' + gameId] = 1
  if (result === 'win') {
    ev.wins = 1
    if (gameId) ev['win_' + gameId] = 1
    if (gameId && SOLO_GAMES.indexOf(gameId) >= 0) ev.soloWins = 1
  }
  if (mode === 'pvp') ev.pvpGames = 1
  else ev.aiGames = 1
  return ev
}

// ── 皮肤与收集 ────────────────────────────────────────────────────
// 目录：棋盘底材 3 / 骰子 3 / 棋子样式 2 / 整页底色 2（默认款价格 0，默认即拥有）。
// 2026-10-30：整页背景位图改为纯色（玩家要求省内存），bg 分类保留为两档底色，
// 已购玩家与「皮肤全收」成就（6 套）不受影响。
// 状态：{owned: [id...], equipped: {mat, dice, piece, bg}}。
var SKINS = [
  { id: 'mat_classic', category: 'mat', name: '经典木纹', price: 0 },
  { id: 'mat_walnut', category: 'mat', name: '胡桃木', price: 120 },
  { id: 'mat_ink', category: 'mat', name: '水墨青石', price: 180 },
  { id: 'dice_classic', category: 'dice', name: '经典骰面', price: 0 },
  { id: 'dice_ivory', category: 'dice', name: '象牙骰面', price: 100 },
  { id: 'dice_amber', category: 'dice', name: '琥珀骰面', price: 160 },
  { id: 'piece_classic', category: 'piece', name: '经典棋子', price: 0 },
  { id: 'piece_ring', category: 'piece', name: '描边棋子', price: 150 },
  { id: 'bg_plain', category: 'bg', name: '素色底', price: 0 },
  { id: 'bg_cloud', category: 'bg', name: '层次底', price: 200 }
]
var SKIN_CATS = ['mat', 'dice', 'piece', 'bg']
var DEFAULT_SKIN = { mat: 'mat_classic', dice: 'dice_classic', piece: 'piece_classic', bg: 'bg_plain' }

// 内部：按 id 查皮肤定义。
function findSkin(id) {
  for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i]
  return null
}

// 输入：皮肤 id；输出：价格（未知 id 返回 -1）。
function skinPrice(id) {
  var d = findSkin(id)
  return d ? d.price : -1
}

// 输入：分类 mat|dice|piece|bg；输出：默认皮肤 id（未知分类返回空串）。
function defaultSkin(category) {
  return DEFAULT_SKIN[category] || ''
}

// 输入：storage 原始皮肤状态；输出：规范化新对象（默认皮肤必拥有；装备项缺失/未拥有回退默认）。
function normSkins(raw) {
  var r = raw && typeof raw === 'object' ? raw : {}
  var owned = []
  for (var i = 0; i < SKIN_CATS.length; i++) owned.push(DEFAULT_SKIN[SKIN_CATS[i]])
  var rawOwned = r.owned && r.owned.length ? r.owned : []
  for (var k = 0; k < rawOwned.length; k++) {
    var d = findSkin(rawOwned[k])
    if (d && owned.indexOf(d.id) < 0) owned.push(d.id)
  }
  var eq = {}
  var rawEq = r.equipped && typeof r.equipped === 'object' ? r.equipped : {}
  for (var j = 0; j < SKIN_CATS.length; j++) {
    var cat = SKIN_CATS[j]
    var want = rawEq[cat]
    var def = findSkin(want)
    eq[cat] = (def && def.category === cat && owned.indexOf(want) >= 0) ? want : DEFAULT_SKIN[cat]
  }
  return { owned: owned, equipped: eq }
}

// 输入：当前棋币、皮肤状态、皮肤 id；输出：{ok, reason, coins, skins}。
// reason：bad 非法 | owned 已拥有（不扣费） | poor 余额不足。
function buySkin(coins, skins, id) {
  var s = normSkins(skins)
  var c = intOf(coins, 0)
  var def = findSkin(id)
  if (!def) return { ok: false, reason: 'bad', coins: c, skins: s }
  if (s.owned.indexOf(id) >= 0) return { ok: false, reason: 'owned', coins: c, skins: s }
  if (c < def.price) return { ok: false, reason: 'poor', coins: c, skins: s }
  s.owned.push(id)
  return { ok: true, reason: '', coins: c - def.price, skins: s }
}

// 输入：皮肤状态、分类、皮肤 id；输出：{ok, reason, skins}。
// reason：bad 分类/皮肤不匹配 | locked 未拥有（未拥有不可装备）。
function equipSkin(skins, category, id) {
  var s = normSkins(skins)
  if (SKIN_CATS.indexOf(category) < 0) return { ok: false, reason: 'bad', skins: s }
  var def = findSkin(id)
  if (!def || def.category !== category) return { ok: false, reason: 'bad', skins: s }
  if (s.owned.indexOf(id) < 0) return { ok: false, reason: 'locked', skins: s }
  s.equipped[category] = id
  return { ok: true, reason: '', skins: s }
}

module.exports = {
  SEASON_ID: SEASON_ID,
  SEASON_NAME: SEASON_NAME,
  COIN: COIN,
  TASKS: TASKS,
  ITEMS: ITEMS,
  PALETTE_PRICES: PALETTE_PRICES,
  DEFAULT_PALETTES: DEFAULT_PALETTES,
  seasonLabel: seasonLabel,
  emptySeason: emptySeason,
  normSeason: normSeason,
  cloneSeason: cloneSeason,
  progressOf: progressOf,
  coinFor: coinFor,
  taskRows: taskRows,
  applyMatch: applyMatch,
  claim: claim,
  normItems: normItems,
  buyItem: buyItem,
  useItem: useItem,
  unlockPalette: unlockPalette,
  normPalettes: normPalettes,
  // 每日挑战
  DAILY_REWARD: DAILY_REWARD,
  DAILY_GAMES: DAILY_GAMES,
  emptyDaily: emptyDaily,
  normDaily: normDaily,
  selectDaily: selectDaily,
  completeDaily: completeDaily,
  // 终身成就
  ACH_CATS: ACH_CATS,
  ACHIEVEMENTS: ACHIEVEMENTS,
  SOLO_GAMES: SOLO_GAMES,
  emptyAch: emptyAch,
  normAch: normAch,
  bumpAch: bumpAch,
  applyAchEvents: applyAchEvents,
  deriveCounters: deriveCounters,
  unlockReady: unlockReady,
  matchEvents: matchEvents,
  // 皮肤
  SKINS: SKINS,
  SKIN_CATS: SKIN_CATS,
  DEFAULT_SKIN: DEFAULT_SKIN,
  skinPrice: skinPrice,
  defaultSkin: defaultSkin,
  normSkins: normSkins,
  buySkin: buySkin,
  equipSkin: equipSkin
}
