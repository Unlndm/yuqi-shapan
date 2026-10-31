/**
 * campaign/report.js — 闯关结算的统一入口（各玩法页只调这一行）。
 *
 * 用法（页面在对局/关卡结束时）：
 *   var campaign = require('../../campaign/report.js')
 *   campaign.report(this.campaignId, { win: true, moves: 12, score: 300, time: 45, steps: 60 })
 *
 * 职责：
 *   1. 写闯关存档（星级 / 最高星 / 解锁下一关 / 首通标记）；
 *   2. 首通奖励通过 economy.addCoins 发棋币（只发一次）；
 *   3. 返回可直接展示的结果对象 {stars, best, reward, coins, unlocked, text}。
 * 未传 levelId（普通自由对局）时直接返回 null，页面不必写 if 判断业务。
 */

var store = require('./store.js')
var core = require('./core.js')
var economy = require('../utils/economy.js')
var toastMod = require('../utils/toast.js')

// 输入：闯关状态；输出：已通关关卡数（≥1 星的关卡）。
function clearedCount(state) {
  var n = 0
  for (var i = 0; i < core.LEVELS.length; i++) {
    if ((state.stars[core.LEVELS[i].id] || 0) >= 1) n++
  }
  return n
}

// 输入：星级 0~3；输出：三星符号文本（0 星返回空串）。
function starsText(n) {
  if (n >= 3) return '★★★'
  if (n === 2) return '★★☆'
  if (n === 1) return '★☆☆'
  return ''
}

// 输入：关卡 id（可为空）、统计 {win, moves, score, time, steps, undos}；
// 输出：Promise<结果对象|null>。永不 reject（失败静默返回 null）。
function report(levelId, stats) {
  if (!levelId || typeof levelId !== 'string') return Promise.resolve(null)
  return store.finishLevel(levelId, stats).then(function (r) {
    if (!r) return null
    var info = {
      levelId: levelId,
      stars: r.stars,
      best: r.best,
      reward: 0,
      coins: 0,
      unlocked: r.unlocked,
      locked: r.locked,
      isNew: r.isNew,
      text: ''
    }
    if (r.locked) {
      info.text = '关卡未解锁'
      return info
    }
    if (r.stars <= 0) {
      info.text = '未通关'
      return info
    }
    info.text = '闯关 ' + starsText(r.stars) + (r.unlocked ? ' · 解锁下一关' : '')
    if (!r.reward) {
      return recordAch(info, r.state)
    }
    return economy.addCoins(r.reward).then(function (coins) {
      info.reward = r.reward
      info.coins = coins
      toastMod.toast('首通 +' + r.reward + ' 棋币', 1600)
      return recordAch(info, r.state)
    }, function () {
      return recordAch(info, r.state)
    })
  }, function () {
    return null
  })
}

// 输入：结果对象、最新闯关状态；输出：Promise<结果对象>。
// 闯关进度用「历史最大值」喂给终身成就（重复通关不虚增），失败静默。
function recordAch(info, state) {
  return economy.recordAchEvents({
    campaignLevels: { max: clearedCount(state) },
    campaignStars: { max: core.totalStars(state) }
  }).then(function (ar) {
    if (ar && ar.coins !== null && ar.coins !== undefined) info.coins = ar.coins
    info.achievements = ar ? ar.unlocked : []
    return info
  }, function () {
    return info
  })
}

module.exports = {
  starsText: starsText,
  report: report
}
