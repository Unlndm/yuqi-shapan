/**
 * campaign/store.js — 闯关状态的存储封装（页面唯一入口）。
 * 只通过 utils/storage.js 读写 key 'campaign_state'，不直接调用系统存储接口。
 * 所有方法返回 Promise：读失败/脏数据自动兜底，写失败返回 saved=false（不抛异常）。
 */

var storage = require('../utils/storage.js')
var core = require('./core.js')

var STORAGE_KEY = 'campaign_state'

// 输入：无；输出：Promise<规范化闯关状态>。
function loadCampaign() {
  return storage.getItem(STORAGE_KEY, core.emptyState()).then(function (raw) {
    return core.normState(raw)
  })
}

// 输入：闯关状态；输出：Promise<boolean> 是否落盘成功（写入前先规范化）。
function saveCampaign(state) {
  return storage.setItem(STORAGE_KEY, core.normState(state))
}

// 输入：关卡 id、统计 {win, moves, score, time, steps, undos}；
// 输出：Promise<{state, stars, best, reward, unlocked, locked, isNew, saved}>。
// 奖励棋币只在此返回（由页面调用 economy 发放），本模块不直接改棋币。
function finishLevel(levelId, stats) {
  return loadCampaign().then(function (state) {
    var r = core.finish(state, levelId, stats)
    return saveCampaign(r.state).then(function (saved) {
      return {
        state: r.state,
        stars: r.stars,
        best: r.best,
        reward: r.reward,
        unlocked: r.unlocked,
        locked: r.locked,
        isNew: r.isNew,
        saved: saved
      }
    })
  })
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  loadCampaign: loadCampaign,
  saveCampaign: saveCampaign,
  finishLevel: finishLevel
}
