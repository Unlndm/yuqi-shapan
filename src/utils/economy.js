/**
 * utils/economy.js — 棋币 / 赛季 / 商店 / 每日挑战 / 成就 / 皮肤的 storage 封装
 * （页面只 require 本文件）。纯逻辑在 economy-core.js（node 可测）。
 * storage key（storage.js 统一加 chess_ 前缀）：
 *   coins / items / season / palettes（原有，语义不变）
 *   daily（每日挑战）/ lifetime（终身计数）/ achievements（已解锁成就）/ skin_state（皮肤）
 * 新增 key 全部独立存放：换季、旧存档升级都不会互相覆盖。
 * 所有读失败 / 脏值均静默兜底为默认值，不抛错、不白屏。
 */
var storage = require('./storage.js')
var core = require('./economy-core.js')
var rng = require('./rng.js')
var toastMod = require('./toast.js')

function normCoins(v) {
  var n = typeof v === 'number' && isFinite(v) ? Math.floor(v) : 0
  return n > 0 ? n : 0
}

// 输入：无；输出：Promise<{coins, items, season, palettes}>（四项一起归一）。
function load() {
  return Promise.all([
    storage.getItem('coins', 0),
    storage.getItem('items', {}),
    storage.getItem('season', null),
    storage.getItem('palettes', core.DEFAULT_PALETTES.slice())
  ]).then(function (vals) {
    var season = core.normSeason(vals[2])
    // 赛季号变了：立即落一份空进度，避免旧季数据被反复读取
    if (!vals[2] || vals[2].id !== core.SEASON_ID) storage.setItem('season', season)
    return {
      coins: normCoins(vals[0]),
      items: core.normItems(vals[1]),
      season: season,
      palettes: core.normPalettes(vals[3])
    }
  })
}

// ── 终身成就 storage 封装 ──────────────────────────────────────────
// 计数与解锁分两个 key 存放：lifetime（普通对象，便于单独导出/排查）+
// achievements（已解锁 id 集合）。换季只清 season，不碰这两个 key。
function loadAch() {
  return Promise.all([
    storage.getItem('lifetime', {}),
    storage.getItem('achievements', {})
  ]).then(function (vals) {
    return core.normAch({ counters: vals[0], unlocked: vals[1] })
  }, function () {
    return core.emptyAch()
  })
}

// 输入：成就状态；输出：Promise<规范化状态>。计数与解锁一起落盘。
function saveAch(state) {
  var s = core.normAch(state)
  return Promise.all([
    storage.setItem('lifetime', s.counters),
    storage.setItem('achievements', s.unlocked)
  ]).then(function () {
    return s
  })
}

// 输入：本次新解锁的成就定义数组；输出：无。
// 所有结算路径（对局 / 每日 / 任务 / 购买 / 皮肤 / 残局）都经 recordAchEvents，
// 因此提示只在这里播报一次，页面不再各写一份，避免漏提示或同一动作弹两次。
function notifyUnlocked(unlocked) {
  if (!unlocked || !unlocked.length) return
  toastMod.toast('成就解锁 · ' + unlocked.length + ' 项', 1600)
}

// 输入：事件表（数字 = 累加；{max: n} = 取历史最大值）；
// 输出：Promise<{ach, unlocked, reward, coins}>。
// unlocked 为本次新解锁的成就定义数组，reward 为本次奖励合计（已加入 coins）。
// 无新增奖励时 coins 为 null（调用方沿用自己算出的余额），失败静默返回空结果。
function recordAchEvents(events) {
  return loadAch().then(function (ach) {
    var bumped = core.applyAchEvents(ach, events)
    var r = core.unlockReady(bumped, bumped.counters, core.deriveCounters(bumped.counters))
    return saveAch(r.state).then(function (saved) {
      if (!r.reward) {
        notifyUnlocked(r.unlocked)
        return { ach: saved, unlocked: [], reward: 0, coins: null }
      }
      return storage.getItem('coins', 0).then(function (raw) {
        var coins = normCoins(raw) + r.reward
        return storage.setItem('coins', coins).then(function () {
          notifyUnlocked(r.unlocked)
          return { ach: saved, unlocked: r.unlocked, reward: r.reward, coins: coins }
        })
      })
    })
  }, function () {
    return { ach: core.emptyAch(), unlocked: [], reward: 0, coins: null }
  }).then(null, function () {
    return { ach: core.emptyAch(), unlocked: [], reward: 0, coins: null }
  })
}

// 输入：gameId、result win|lose|draw、mode ai|pvp；
// 输出：Promise<{coins, gain, tasks, achievements}>（coins 为发币后余额，tasks 为新完成的任务 id）。
// 棋币/赛季结算后顺带累计终身计数并结算成就（成就奖励也已计入 coins）。
function recordMatch(gameId, result, mode) {
  return load().then(function (st) {
    var r = core.applyMatch(st.season, gameId, result, mode)
    var coins = st.coins + r.coins
    return Promise.all([
      storage.setItem('coins', coins),
      storage.setItem('season', r.season)
    ]).then(function () {
      var ev = core.matchEvents(gameId, result, mode)
      // 最长连胜：{max} 保证只取历史最高值，负局不会回退
      ev.streakBest = { max: r.season.bestStreak }
      return recordAchEvents(ev).then(function (ar) {
        return {
          coins: ar && ar.coins !== null ? ar.coins : coins,
          gain: r.coins,
          tasks: r.tasks,
          achievements: ar ? ar.unlocked : []
        }
      })
    })
  })
}

// 输入：任务 id；输出：Promise<{ok, reason, coins, reward, season, achievements}>。
// 领取成功会累计「赛季任务完成数」；领满本季全部任务时额外累计「单季全勤」。
function claimTask(id) {
  return load().then(function (st) {
    var r = core.claim(st.season, st.coins, id)
    if (!r.ok) return { ok: false, reason: r.reason, coins: st.coins, reward: 0, season: st.season, achievements: [] }
    return Promise.all([
      storage.setItem('coins', r.coins),
      storage.setItem('season', r.season)
    ]).then(function () {
      var claimedCount = 0
      for (var k in r.season.claimed) if (r.season.claimed[k]) claimedCount++
      var ev = { seasonTasks: 1 }
      if (claimedCount >= core.TASKS.length) ev.seasonPerfect = 1
      return recordAchEvents(ev).then(function (ar) {
        return {
          ok: true,
          reason: '',
          coins: ar && ar.coins !== null ? ar.coins : r.coins,
          reward: r.reward,
          season: r.season,
          achievements: ar ? ar.unlocked : []
        }
      })
    })
  })
}

// 输入：物品 id；输出：Promise<{ok, reason, coins, items, achievements}>。
function buyItem(id) {
  return load().then(function (st) {
    var r = core.buyItem(st.coins, st.items, id)
    if (!r.ok) return { ok: false, reason: r.reason, coins: st.coins, items: st.items, achievements: [] }
    return Promise.all([
      storage.setItem('coins', r.coins),
      storage.setItem('items', r.items)
    ]).then(function () {
      return recordAchEvents({ purchases: 1 }).then(function (ar) {
        return {
          ok: true,
          reason: '',
          coins: ar && ar.coins !== null ? ar.coins : r.coins,
          items: r.items,
          achievements: ar ? ar.unlocked : []
        }
      })
    })
  })
}

// 输入：物品 id；输出：Promise<{ok, items}>。对局内手动使用时调用（扣 1）。
function useItem(id) {
  return load().then(function (st) {
    var r = core.useItem(st.items, id)
    if (!r.ok) return { ok: false, items: st.items }
    return storage.setItem('items', r.items).then(function () {
      return { ok: true, items: r.items }
    })
  })
}

// 输入：配色 id；输出：Promise<{ok, reason, coins, palettes, achievements}>。
function unlockPalette(id) {
  return load().then(function (st) {
    var r = core.unlockPalette(st.coins, st.palettes, id)
    if (!r.ok) return { ok: false, reason: r.reason, coins: st.coins, palettes: st.palettes, achievements: [] }
    return Promise.all([
      storage.setItem('coins', r.coins),
      storage.setItem('palettes', r.palettes)
    ]).then(function () {
      return recordAchEvents({ palettesBought: 1, purchases: 1 }).then(function (ar) {
        return {
          ok: true,
          reason: '',
          coins: ar && ar.coins !== null ? ar.coins : r.coins,
          palettes: r.palettes,
          achievements: ar ? ar.unlocked : []
        }
      })
    })
  })
}

// ── 每日挑战 storage 封装 ─────────────────────────────────────────
// 输入：可选玩法 id 数组（主页传 config.GAME_TYPES 的 id）；输出：Promise<每日状态>。
// 换日时自动重选当天玩法并清空完成标记，保留 streak / lastDate 用于连续天数。
function loadDaily(gameIds) {
  var today = rng.dateStr()
  return storage.getItem('daily', null).then(function (raw) {
    var d = core.normDaily(raw)
    var isToday = raw && raw.date === today
    if (!isToday || !d.gameId || !d.seed) {
      var pick = core.selectDaily(today, gameIds)
      d.date = today
      if (pick.gameId) {
        d.gameId = pick.gameId
        d.seed = pick.seed
      }
      if (!isToday) {
        d.completed = false
        d.rewardClaimed = false
      }
      return storage.setItem('daily', d).then(function () {
        return d
      })
    }
    return d
  }, function () {
    var fallback = core.normDaily(null)
    var pick = core.selectDaily(today, gameIds)
    fallback.date = today
    fallback.gameId = pick.gameId
    fallback.seed = pick.seed
    return fallback
  })
}

// 输入：完成的玩法 id（可选 gameIds 仅用于无存档时补选当天玩法）；
// 输出：Promise<{ok, reward, already, state, coins, achievements}>。
// 当天首次完成发棋币并累计成就（dailyDone / dailyStreak），重复完成不发。
function completeDaily(gameId, gameIds) {
  var today = rng.dateStr()
  return storage.getItem('daily', null).then(function (raw) {
    var d = core.normDaily(raw)
    if (d.date !== today) {
      var pick = core.selectDaily(today, gameIds)
      d = {
        date: today,
        gameId: pick.gameId,
        seed: pick.seed,
        completed: false,
        rewardClaimed: false,
        streak: d.streak,
        lastDate: d.lastDate
      }
    }
    var r = core.completeDaily(d, today, gameId)
    return storage.setItem('daily', r.state).then(function () {
      if (!r.reward) {
        return { ok: true, reward: 0, already: r.already, state: r.state, coins: null, achievements: [] }
      }
      return storage.getItem('coins', 0).then(function (rawCoins) {
        var coins = normCoins(rawCoins) + r.reward
        return storage.setItem('coins', coins).then(function () {
          return { ok: true, reward: r.reward, already: false, state: r.state, coins: coins, achievements: [] }
        })
      })
    })
  }, function () {
    return { ok: false, reward: 0, already: false, state: core.emptyDaily(), coins: null, achievements: [] }
  }).then(function (res) {
    if (!res || !res.reward) return res
    return recordAchEvents({ dailyDone: 1, dailyStreak: { max: res.state.streak } }).then(function (ar) {
      if (ar && ar.coins !== null) res.coins = ar.coins
      res.achievements = ar ? ar.unlocked : []
      return res
    }, function () {
      return res
    })
  }, function () {
    return { ok: false, reward: 0, already: false, state: core.emptyDaily(), coins: null, achievements: [] }
  })
}

// ── 皮肤 storage 封装 ────────────────────────────────────────────
// 输入：无；输出：Promise<{owned, equipped}>（默认皮肤必拥有、缺失装备回退默认）。
function loadSkins() {
  return storage.getItem('skin_state', null).then(function (raw) {
    return core.normSkins(raw)
  }, function () {
    return core.normSkins(null)
  })
}

// 输入：皮肤 id；输出：Promise<{ok, reason, coins, skins, achievements}>。
// 重复购买不扣币（reason='owned'）；成功后累计 skinsBought / purchases。
function buySkin(id) {
  return Promise.all([
    storage.getItem('coins', 0),
    storage.getItem('skin_state', null)
  ]).then(function (vals) {
    var coins = normCoins(vals[0])
    var skins = core.normSkins(vals[1])
    var r = core.buySkin(coins, skins, id)
    if (!r.ok) return { ok: false, reason: r.reason, coins: coins, skins: r.skins, achievements: [] }
    return Promise.all([
      storage.setItem('coins', r.coins),
      storage.setItem('skin_state', r.skins)
    ]).then(function () {
      return recordAchEvents({ skinsBought: 1, purchases: 1 }).then(function (ar) {
        return {
          ok: true,
          reason: '',
          coins: ar && ar.coins !== null ? ar.coins : r.coins,
          skins: r.skins,
          achievements: ar ? ar.unlocked : []
        }
      })
    })
  }).then(null, function () {
    return { ok: false, reason: 'error', coins: null, skins: core.normSkins(null), achievements: [] }
  })
}

// 输入：分类 mat|dice|piece|bg、皮肤 id；输出：Promise<{ok, reason, skins}>。
// 未拥有不可装备（reason='locked'），分类/皮肤不匹配为 bad；失败不改存档。
function equipSkin(category, id) {
  return storage.getItem('skin_state', null).then(function (raw) {
    var r = core.equipSkin(raw, category, id)
    if (!r.ok) return { ok: false, reason: r.reason, skins: r.skins }
    return storage.setItem('skin_state', r.skins).then(function () {
      return { ok: true, reason: '', skins: r.skins }
    })
  }, function () {
    return { ok: false, reason: 'error', skins: core.normSkins(null) }
  })
}

// 输入：棋币数量（可为负，但结果不会低于 0）；输出：Promise<number> 结算后的余额。
// 供闯关首通奖励等「非对局」路径统一发币：不碰赛季进度，只改 coins 余额。
function addCoins(n) {
  var delta = typeof n === 'number' && isFinite(n) ? Math.floor(n) : 0
  if (!delta) {
    return storage.getItem('coins', 0).then(function (raw) {
      return normCoins(raw)
    }, function () {
      return 0
    })
  }
  return storage.getItem('coins', 0).then(function (raw) {
    var coins = normCoins(raw) + delta
    if (coins < 0) coins = 0
    return storage.setItem('coins', coins).then(function () {
      return coins
    })
  }, function () {
    return 0
  })
}

module.exports = {
  // 常量（页面/设置页直接引用，避免两处各写一份）
  SEASON_ID: core.SEASON_ID,
  SEASON_NAME: core.SEASON_NAME,
  COIN: core.COIN,
  TASKS: core.TASKS,
  ITEMS: core.ITEMS,
  PALETTE_PRICES: core.PALETTE_PRICES,
  // 每日挑战 / 成就 / 皮肤常量（页面直接引用，避免两处各写一份）
  DAILY_REWARD: core.DAILY_REWARD,
  DAILY_GAMES: core.DAILY_GAMES,
  ACH_CATS: core.ACH_CATS,
  ACHIEVEMENTS: core.ACHIEVEMENTS,
  SKINS: core.SKINS,
  SKIN_CATS: core.SKIN_CATS,
  DEFAULT_SKIN: core.DEFAULT_SKIN,
  skinPrice: core.skinPrice,
  defaultSkin: core.defaultSkin,
  matchEvents: core.matchEvents,
  seasonLabel: core.seasonLabel,
  coinFor: core.coinFor,
  taskRows: core.taskRows,
  load: load,
  addCoins: addCoins,
  recordMatch: recordMatch,
  claimTask: claimTask,
  buyItem: buyItem,
  useItem: useItem,
  unlockPalette: unlockPalette,
  // 每日挑战
  loadDaily: loadDaily,
  completeDaily: completeDaily,
  // 终身成就
  loadAch: loadAch,
  recordAchEvents: recordAchEvents,
  // 皮肤
  loadSkins: loadSkins,
  buySkin: buySkin,
  equipSkin: equipSkin
}
