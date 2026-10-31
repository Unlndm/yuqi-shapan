/**
 * tests/economy.js — 棋币 / 赛季 / 商店纯逻辑测试（不依赖 storage）。
 * 运行：node tests/economy.js
 */

var e = require('../src/utils/economy-core.js')
var rng = require('../src/utils/rng.js')
var h = require('./helper.js')

// 输入：成就定义数组；输出：id 数组（断言用）。
function achIds(list) {
  var out = []
  for (var i = 0; i < list.length; i++) out.push(list[i].id)
  return out
}

h.suite('economy/赛季归一')
var s0 = e.emptySeason()
h.eq('空赛季 id', s0.id, e.SEASON_ID)
h.eq('空赛季进度 0', e.taskRows(s0)[0].cur, 0)
var old = e.emptySeason()
old.id = e.SEASON_ID - 1
old.games = 99
h.eq('旧赛季进度被重置', e.normSeason(old).games, 0)
// 2026-10-24：SEASON_ID 曾误升到 2，玩家未要求换季；回退到 1 时必须保留已写入的进度
var legacy2 = { id: 2, games: 5, wins: 2, aiGames: 1, streak: 1, bestStreak: 2, seen: { chess: true }, claimed: { games: true } }
h.eq('误升第 2 赛季回退后保留局数', e.normSeason(legacy2).games, 5)
h.eq('误升第 2 赛季回退后 id=1', e.normSeason(legacy2).id, 1)
h.eq('误升第 2 赛季回退后保留领取记录', e.normSeason(legacy2).claimed.games, true)
h.eq('脏值兜底', e.normSeason({ id: e.SEASON_ID, games: -5, wins: 'x' }).games, 0)

h.suite('economy/对局发币与赛季累计')
var r1 = e.applyMatch(s0, 'gomoku', 'win', 'ai')
h.eq('人机胜 +20 币', r1.coins, 20)
h.eq('完成局数 +1', r1.season.games, 1)
h.eq('胜场 +1', r1.season.wins, 1)
h.eq('连胜 1', r1.season.streak, 1)
h.eq('人机局 +1', r1.season.aiGames, 1)
var r2 = e.applyMatch(r1.season, 'chess', 'lose', 'ai')
h.eq('人机负 +5 币', r2.coins, 5)
h.eq('负局中断连胜', r2.season.streak, 0)
h.eq('最高连胜保留', r2.season.bestStreak, 1)
var r3 = e.applyMatch(r2.season, 'gomoku', 'draw', 'pvp')
h.eq('双人和 +8 币', r3.coins, 8)
h.eq('双人不计人机局', r3.season.aiGames, 2)
h.eq('不同玩法计数 2', e.progressOf(r3.season, 'variety'), 2)
h.eq('原状态未被修改', s0.games, 0)
// 单人（solo）通关：计入总局数与玩法种类，不计胜场 / 连胜 / 人机局数
var rs = e.applyMatch(e.emptySeason(), 'sokoban', 'win', 'solo')
h.eq('solo 计入总局数', rs.season.games, 1)
h.eq('solo 不计胜场', rs.season.wins, 0)
h.eq('solo 不计连胜', rs.season.streak, 0)
h.eq('solo 不计人机局', rs.season.aiGames, 0)
h.eq('solo 计入玩法种类', e.progressOf(rs.season, 'variety'), 1)

h.suite('economy/任务完成与领取')
// 连胜任务：连续 3 胜
var st = e.emptySeason()
st = e.applyMatch(st, 'gomoku', 'win', 'ai').season
st = e.applyMatch(st, 'gomoku', 'win', 'ai').season
var r4 = e.applyMatch(st, 'gomoku', 'win', 'ai')
h.ok('第 3 胜完成连胜任务', r4.tasks.indexOf('streak') >= 0)
h.eq('连胜任务进度 3', e.progressOf(r4.season, 'streak'), 3)
var c0 = e.claim(r4.season, 0, 'streak')
h.eq('领取连胜任务', c0.ok, true)
h.eq('奖励 80 币', c0.coins, 80)
h.eq('重复领取被拒', e.claim(c0.season, c0.coins, 'streak').ok, false)
h.eq('未完成奖励任务被拒', e.claim(r4.season, 0, 'wins').ok, false)
h.eq('领取后状态标记', e.taskRows(c0.season)[2].claimed, true)
h.eq('领取行不可再领', e.taskRows(c0.season)[2].canClaim, false)
// 完成 6 局的任务
var st6 = e.emptySeason()
st6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai').season
st6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai').season
st6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai').season
st6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai').season
st6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai').season
var r6 = e.applyMatch(st6, 'gomoku', 'lose', 'ai')
h.ok('第 6 局完成对局任务', r6.tasks.indexOf('games') >= 0)
h.eq('对局任务进度封顶显示', e.taskRows(r6.season)[0].cur, 6)

h.suite('economy/商店购买与使用')
var b1 = e.buyItem(100, {}, 'jailCard')
h.eq('买免狱卡成功', b1.ok, true)
h.eq('扣 80 币', b1.coins, 20)
h.eq('库存 1', b1.items.jailCard, 1)
var b2 = e.buyItem(20, b1.items, 'reroll')
h.eq('余额不足被拒', b2.ok, false)
h.eq('不足不改库存', b2.items.reroll, 0)
var u1 = e.useItem(b1.items, 'jailCard')
h.eq('使用后库存 0', u1.items.jailCard, 0)
h.eq('库存为 0 时使用被拒', e.useItem(u1.items, 'jailCard').ok, false)
h.eq('脏库存归一', e.normItems({ jailCard: 'x' }).jailCard, 0)

h.suite('economy/配色解锁')
var p1 = e.unlockPalette(500, e.DEFAULT_PALETTES, 'amber')
h.eq('解锁琥珀成功', p1.ok, true)
h.eq('扣 200 币', p1.coins, 300)
h.ok('列表含 amber', p1.palettes.indexOf('amber') >= 0)
h.eq('重复解锁被拒', e.unlockPalette(500, p1.palettes, 'amber').ok, false)
h.eq('余额不足解锁绯红被拒', e.unlockPalette(100, p1.palettes, 'rose').ok, false)
h.eq('非法配色被拒', e.unlockPalette(500, p1.palettes, 'unknown').ok, false)
h.eq('默认三套始终在列', e.normPalettes([]).length, 3)

h.suite('economy/RNG 确定性')
h.eq('日期清洗', rng.cleanDate('2026-10-24'), '20261024')
h.eq('天序号连续 +1', rng.dayNumber('20261025') - rng.dayNumber('20261024'), 1)
h.eq('本地日期串', rng.dateStr(new Date(2026, 9, 24, 12, 0, 0)), '20261024')
h.eq('dateSeed 稳定', rng.dateSeed('20261024', 'chess'), rng.dateSeed('20261024', 'chess'))
h.ok('dateSeed 换日不同', rng.dateSeed('20261025', 'chess') !== rng.dateSeed('20261024', 'chess'))
h.ok('dateSeed 换玩法不同', rng.dateSeed('20261024', 'go') !== rng.dateSeed('20261024', 'chess'))
var g1 = rng.create(20261024)
var g2 = rng.create(20261024)
var seq1 = []
var seq2 = []
for (var gi = 0; gi < 8; gi++) {
  seq1.push(g1.next())
  seq2.push(g2.next())
}
h.eq('同种子序列一致', seq1, seq2)
h.ok('不同种子序列不同', rng.create(1).next() !== rng.create(2).next())
h.ok('next 落在 [0,1)', seq1[0] >= 0 && seq1[0] < 1)
var g3 = rng.create(7)
var iv = g3.int(6)
h.ok('int 落在 [0,6)', iv >= 0 && iv < 6)
h.eq('int 上界非法兜底', rng.create(7).int(0), 0)
h.eq('pick 空数组', rng.create(7).pick([]), null)
h.eq('pick 命中集合内', ['a', 'b', 'c'].indexOf(rng.create(7).pick(['a', 'b', 'c'])) >= 0, true)
var src = [1, 2, 3, 4, 5]
var sh1 = rng.create(7).shuffle(src)
h.eq('shuffle 不改入参', src, [1, 2, 3, 4, 5])
h.eq('shuffle 同种子一致', rng.create(7).shuffle(src), sh1)
h.eq('shuffle 元素不增不减', sh1.slice().sort(), [1, 2, 3, 4, 5])
h.eq('chance(0) 恒 false', rng.create(7).chance(0), false)
h.eq('chance(1) 恒 true', rng.create(7).chance(1), true)

h.suite('economy/每日挑战状态')
h.eq('每日默认值', e.normDaily(null), { date: '', gameId: '', seed: 0, completed: false, rewardClaimed: false, streak: 0, lastDate: '' })
h.eq('每日脏值兜底', e.normDaily({ date: 1, seed: -5, streak: 'x', completed: 'yes' }).streak, 0)
var dailyIds = ['gomoku', 'chess', 'go']
var selA = e.selectDaily('20261024', dailyIds)
var selB = e.selectDaily('20261024', dailyIds)
h.eq('同日选择一致', selA, selB)
h.eq('选择结果含日期', selA.date, '20261024')
h.ok('选择带非零种子', selA.seed > 0)
h.eq('种子与 rng 一致', selA.seed, rng.dateSeed('20261024', selA.gameId))
h.ok('跨日玩法切换', e.selectDaily('20261025', dailyIds).gameId !== selA.gameId)
var dayOne = { date: selA.date, gameId: selA.gameId, seed: selA.seed, completed: false, rewardClaimed: false, streak: 0, lastDate: '' }
var cd1 = e.completeDaily(dayOne, '20261024', selA.gameId)
h.eq('首次完成发币', cd1.reward, e.DAILY_REWARD)
h.eq('首次完成非重复', cd1.already, false)
h.eq('首次完成连续 1', cd1.state.streak, 1)
h.eq('首次完成标记', cd1.state.completed, true)
h.eq('首次完成记录日期', cd1.state.lastDate, '20261024')
h.eq('入参未被修改', dayOne.completed, false)
var cd2 = e.completeDaily(cd1.state, '20261024', selA.gameId)
h.eq('同日重复不发币', cd2.reward, 0)
h.eq('同日重复标记 already', cd2.already, true)
h.eq('同日重复连续不变', cd2.state.streak, 1)
var selNext = e.selectDaily('20261025', dailyIds)
var dayTwo = { date: selNext.date, gameId: selNext.gameId, seed: selNext.seed, completed: false, rewardClaimed: false, streak: cd2.state.streak, lastDate: cd2.state.lastDate }
var cd3 = e.completeDaily(dayTwo, '20261025', selNext.gameId)
h.eq('连续日 +1', cd3.state.streak, 2)
var dayGap = { date: '20261028', gameId: 'gomoku', seed: 1, completed: false, rewardClaimed: false, streak: 2, lastDate: '20261025' }
h.eq('断签重置 1', e.completeDaily(dayGap, '20261028', 'gomoku').state.streak, 1)
h.eq('非当天玩法不发币', e.completeDaily(dayOne, '20261024', 'tictactoe').reward, 0)
h.eq('非当天玩法不标记完成', e.completeDaily(dayOne, '20261024', 'tictactoe').state.completed, false)

h.suite('economy/48 项终身成就')
h.eq('成就总数 48', e.ACHIEVEMENTS.length, 48)
var catCount = { match: 0, game: 0, season: 0, collect: 0, daily: 0, puzzle: 0, campaign: 0 }
var idSet = {}
var fieldBad = 0
for (var ai = 0; ai < e.ACHIEVEMENTS.length; ai++) {
  var a = e.ACHIEVEMENTS[ai]
  if (catCount[a.category] === undefined) fieldBad++
  else catCount[a.category]++
  if (!a.id || !a.name || !a.key || !(a.threshold > 0) || !(a.reward > 0)) fieldBad++
  idSet[a.id] = true
}
h.eq('分类数量 8/9/8/8/5/5/5', catCount, { match: 8, game: 9, season: 8, collect: 8, daily: 5, puzzle: 5, campaign: 5 })
h.eq('成就 id 唯一', Object.keys(idSet).length, 48)
h.eq('成就字段完整', fieldBad, 0)
h.eq('空成就计数为 0', e.normAch(null).counters.games, 0)
h.eq('脏计数兜底', e.normAch({ counters: { games: -3, wins: 'x' } }).counters.games, 0)
h.eq('非法成就 id 被丢弃', Object.keys(e.normAch({ unlocked: { bogus: true } }).unlocked).length, 0)
var emptyA = e.emptyAch()
var bump1 = e.bumpAch(emptyA, 'games', 1)
h.eq('bump 返回新对象', emptyA.counters.games, 0)
h.eq('bump 累加', bump1.counters.games, 1)
h.eq('bump 负值归零', e.bumpAch(bump1, 'games', -9).counters.games, 0)
var beacon = e.applyAchEvents(e.emptyAch(), { games: 2, streakBest: { max: 3 } })
h.eq('事件累加', beacon.counters.games, 2)
h.eq('事件取历史最大', beacon.counters.streakBest, 3)
h.eq('最大值不回退', e.applyAchEvents(beacon, { streakBest: { max: 2 } }).counters.streakBest, 3)
h.eq('事件不改入参', e.emptyAch().counters.games, 0)
var mev = e.matchEvents('g2048', 'win', 'ai')
h.eq('对局事件局数', mev.games, 1)
h.eq('单人胜计 soloWins', mev.soloWins, 1)
h.eq('玩法计数键', mev['played_g2048'], 1)
h.eq('负局不计胜场', e.matchEvents('gomoku', 'lose', 'ai').wins, undefined)
var u1 = e.unlockReady(bump1, bump1.counters)
h.eq('首局解锁 1 项', achIds(u1.unlocked), ['m_first'])
h.eq('首局奖励 10', u1.reward, 10)
h.eq('解锁写入状态', u1.state.unlocked.m_first, true)
h.eq('未解锁项不在状态', u1.state.unlocked.m_games_10, undefined)
var u2 = e.unlockReady(u1.state, u1.state.counters)
h.eq('重复达标不重复解锁', u2.unlocked.length, 0)
h.eq('重复达标不发奖', u2.reward, 0)
h.eq('入参状态未被改', bump1.unlocked.m_first, undefined)
var u3 = e.unlockReady(e.emptyAch(), e.emptyAch().counters)
h.eq('零计数不解锁', u3.unlocked.length, 0)
var nine = e.bumpAch(e.emptyAch(), 'games', 9)
var u4 = e.unlockReady(nine, nine.counters)
h.eq('9 局只解锁首局', achIds(u4.unlocked), ['m_first'])
var ten = e.bumpAch(nine, 'games', 1)
var u5 = e.unlockReady(ten, ten.counters)
h.eq('10 局解锁首局+十局', achIds(u5.unlocked), ['m_first', 'm_games_10'])
h.eq('10 局奖励合计 30', u5.reward, 30)
var varietyState = e.normAch({ counters: { played_gomoku: 1, played_chess: 2, played_go: 1, played_othello: 1 } })
h.eq('玩法种类派生', e.deriveCounters(varietyState.counters).variety, 4)
var v4 = e.unlockReady(varietyState, varietyState.counters, e.deriveCounters(varietyState.counters))
h.eq('派生达标解锁棋种', achIds(v4.unlocked), ['g_var_4'])
var oldSeason = e.emptySeason()
oldSeason.id = e.SEASON_ID - 1
oldSeason.games = 99
h.eq('旧赛季进度被重置', e.normSeason(oldSeason).games, 0)
h.eq('换季成就解锁保留', e.normAch(u1.state).unlocked.m_first, true)
h.eq('换季终身计数保留', e.normAch(u1.state).counters.games, 1)

h.suite('economy/皮肤购买与装备')
h.eq('皮肤目录 10 套', e.SKINS.length, 10)
var skinCat = { mat: 0, dice: 0, piece: 0, bg: 0 }
for (var si = 0; si < e.SKINS.length; si++) skinCat[e.SKINS[si].category]++
h.eq('皮肤分类 3/3/2/2', skinCat, { mat: 3, dice: 3, piece: 2, bg: 2 })
var sk0 = e.normSkins(null)
h.eq('默认拥有四套', sk0.owned, ['mat_classic', 'dice_classic', 'piece_classic', 'bg_plain'])
h.eq('默认装备', sk0.equipped, { mat: 'mat_classic', dice: 'dice_classic', piece: 'piece_classic', bg: 'bg_plain' })
h.eq('皮肤价格', e.skinPrice('mat_walnut'), 120)
h.eq('未知皮肤价格 -1', e.skinPrice('nope'), -1)
h.eq('默认皮肤查询', e.defaultSkin('bg'), 'bg_plain')
h.eq('未知分类默认皮肤', e.defaultSkin('nope'), '')
var bs1 = e.buySkin(500, sk0, 'mat_walnut')
h.eq('购买皮肤成功', bs1.ok, true)
h.eq('购买扣 120', bs1.coins, 380)
h.ok('购买后入库', bs1.skins.owned.indexOf('mat_walnut') >= 0)
h.eq('购买不改入参', sk0.owned.length, 4)
var bs2 = e.buySkin(500, bs1.skins, 'mat_walnut')
h.eq('重复购买被拒', bs2.ok, false)
h.eq('重复购买原因 owned', bs2.reason, 'owned')
h.eq('重复购买不扣费', bs2.coins, 500)
h.eq('重复购买不重复入库', bs2.skins.owned.length, bs1.skins.owned.length)
h.eq('余额不足被拒', e.buySkin(10, sk0, 'bg_cloud').reason, 'poor')
h.eq('非法皮肤被拒', e.buySkin(500, sk0, 'nope').reason, 'bad')
var eq1 = e.equipSkin(bs1.skins, 'mat', 'mat_walnut')
h.eq('装备成功', eq1.ok, true)
h.eq('装备写入', eq1.skins.equipped.mat, 'mat_walnut')
h.eq('装备不改入参', bs1.skins.equipped.mat, 'mat_classic')
h.eq('未拥有不可装备', e.equipSkin(sk0, 'mat', 'mat_walnut').reason, 'locked')
h.eq('分类不匹配被拒', e.equipSkin(bs1.skins, 'dice', 'mat_walnut').reason, 'bad')
h.eq('装备缺失回退默认', e.normSkins({ owned: [], equipped: { mat: 'mat_walnut' } }).equipped.mat, 'mat_classic')
h.eq('脏 owned 丢弃', e.normSkins({ owned: ['bogus', 'bg_cloud'] }).owned.indexOf('bogus'), -1)

process.exitCode = h.summary()
