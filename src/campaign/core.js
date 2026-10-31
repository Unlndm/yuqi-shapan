/**
 * campaign/core.js — 闯关模式的纯函数引擎（无 storage、无 UI、node 可直接测）。
 *
 * 状态结构：
 *   { stars: { 'c1-01': 1~3 }, unlocked: 1~60（已解锁到的全局序号）, claimed: { 'c1-01': true } }
 *   全局序号 = LEVELS 数组下标 + 1（1~60）。
 *
 * 星级口径：
 *   · metric='win'：stats.win === true 得 1 星；star2/star3 按 stats.moves 手数（≤ 阈值）。
 *   · metric='score'：stats.score 越高越好（≥ star2 得 2 星，≥ star3 得 3 星）。
 *   · metric='moves'|'time'|'steps'：stats[metric] 越低越好（≤ star2 得 2 星，≤ star3 得 3 星）。
 *   · 未通关（win 不为 true）一律 0 星；单人关卡以「本关完成」作为 win。
 *   · 1 星即视为通关并解锁下一关；首次 ≥1 星发放 reward 棋币，之后不再发。
 */

var levelsData = require('./levels.js')

var CHAPTERS = levelsData.CHAPTERS
var LEVELS = levelsData.LEVELS
var TOTAL = LEVELS.length
var MAX_STARS = TOTAL * 3

// 内部：levelId → 全局序号（1 起）/ 序号 → 关卡对象。
var ID_SEQ = {}
var SEQ_LEVEL = {}
for (var i = 0; i < LEVELS.length; i++) {
  ID_SEQ[LEVELS[i].id] = i + 1
  SEQ_LEVEL[i + 1] = LEVELS[i]
}

// 内部：非负整数兜底；非法值返回 defVal。
function intOf(v, defVal) {
  if (typeof v !== 'number' || !isFinite(v)) return defVal
  var n = Math.floor(v)
  return n >= 0 ? n : defVal
}

// 内部：对象浅拷贝（Vela 不保证 Object.assign，手写更稳）。
function copyObj(src) {
  var o = {}
  if (src) for (var k in src) o[k] = src[k]
  return o
}

// 输入：无；输出：全新空存档（解锁第 1 关）。
function emptyState() {
  return { stars: {}, unlocked: 1, claimed: {} }
}

// 输入：storage 原始对象（可能为 null / 脏值 / 旧存档）；输出：规范化新对象。
// 旧存档兼容：只认已知关卡 id，星级截到 1~3，unlocked 夹在 1~TOTAL；
// 未知字段丢弃，不修改入参。
function normState(raw) {
  var r = raw && typeof raw === 'object' ? raw : {}
  var rawStars = r.stars && typeof r.stars === 'object' ? r.stars : {}
  var stars = {}
  for (var i = 0; i < LEVELS.length; i++) {
    var id = LEVELS[i].id
    var n = intOf(rawStars[id], 0)
    if (n > 3) n = 3
    if (n > 0) stars[id] = n
  }
  var rawClaimed = r.claimed && typeof r.claimed === 'object' ? r.claimed : {}
  var claimed = {}
  for (var j = 0; j < LEVELS.length; j++) {
    var cid = LEVELS[j].id
    if (rawClaimed[cid] === true) claimed[cid] = true
  }
  var u = intOf(r.unlocked, 1)
  if (u < 1) u = 1
  if (u > TOTAL) u = TOTAL
  return { stars: stars, unlocked: u, claimed: claimed }
}

// 输入：全局序号（1 起）；输出：关卡对象或 null。
function levelAt(seq) {
  if (typeof seq !== 'number' || !isFinite(seq) || Math.floor(seq) !== seq) return null
  return SEQ_LEVEL[seq] || null
}

// 输入：关卡 id；输出：关卡对象或 null。
function findLevel(levelId) {
  if (typeof levelId !== 'string' || !ID_SEQ[levelId]) return null
  return SEQ_LEVEL[ID_SEQ[levelId]]
}

// 输入：关卡 id；输出：全局序号（非法返回 0）。
function seqOf(levelId) {
  return ID_SEQ[levelId] || 0
}

// 输入：无；输出：全部关卡（浅拷贝数组，关卡对象共享只读数据）。
function allLevels() {
  return LEVELS.slice()
}

// 每章固定 10 关（与 levels.js 的数据分布一致）。
var PER_CHAPTER = 10

// 输入：闯关状态、章节下标（0 起）；输出：单章视图行，非法下标返回 null。
// 与 chapterRows 的字段完全一致，但只构造当前章 —— 页面一次只渲染 10 行，
// 避免全部 80 关的视图对象与节点树同时驻留（手表运存有限）。
function chapterAt(state, ci) {
  var s = normState(state)
  var ch = CHAPTERS[ci]
  if (!ch) return null
  var start = ci * PER_CHAPTER
  var end = start + PER_CHAPTER
  if (end > LEVELS.length) end = LEVELS.length
  var rows = []
  var chStars = 0
  for (var k = start; k < end; k++) {
    var lv = LEVELS[k]
    var seq = k + 1
    var st = s.stars[lv.id] || 0
    chStars += st
    rows.push({
      seq: seq,
      id: lv.id,
      chapter: lv.chapter,
      index: lv.index,
      game: lv.game,
      mode: lv.mode,
      difficulty: lv.difficulty,
      title: lv.title,
      desc: lv.desc,
      metric: lv.metric,
      star2: lv.star2,
      star3: lv.star3,
      reward: lv.reward,
      stars: st,
      cleared: st >= 1,
      locked: seq > s.unlocked
    })
  }
  return {
    id: ch.id,
    name: ch.name,
    desc: ch.desc,
    total: rows.length,
    stars: chStars,
    rows: rows
  }
}

// 输入：闯关状态；输出：{ cleared, stars, total, maxStars }（总览三列直接用）。
function summary(state) {
  var s = normState(state)
  var cleared = 0
  var stars = 0
  for (var i = 0; i < LEVELS.length; i++) {
    var n = s.stars[LEVELS[i].id] || 0
    stars += n
    if (n >= 1) cleared++
  }
  return { cleared: cleared, stars: stars, total: TOTAL, maxStars: MAX_STARS }
}

// 输入：闯关状态；输出：8 章视图行（页面可直接绑定）。
// 每行 = 关卡字段 + { seq, stars, cleared, locked }；locked = 全局序号 > unlocked。
// ⚠️ 会一次性构造全部 60 行 —— 列表页改用 chapterAt，本函数保留给测试/统计用。
function chapterRows(state) {
  var s = normState(state)
  var out = []
  var cursor = 0
  for (var c = 0; c < CHAPTERS.length; c++) {
    var ch = CHAPTERS[c]
    var rows = []
    var chStars = 0
    for (var k = 0; k < 10 && cursor < LEVELS.length; k++, cursor++) {
      var lv = LEVELS[cursor]
      var seq = cursor + 1
      var st = s.stars[lv.id] || 0
      chStars += st
      rows.push({
        seq: seq,
        id: lv.id,
        chapter: lv.chapter,
        index: lv.index,
        game: lv.game,
        mode: lv.mode,
        difficulty: lv.difficulty,
        title: lv.title,
        desc: lv.desc,
        metric: lv.metric,
        star2: lv.star2,
        star3: lv.star3,
        reward: lv.reward,
        stars: st,
        cleared: st >= 1,
        locked: seq > s.unlocked
      })
    }
    out.push({
      id: ch.id,
      name: ch.name,
      desc: ch.desc,
      total: rows.length,
      stars: chStars,
      rows: rows
    })
  }
  return out
}

// 输入：关卡、stats；输出：本次可达星级（0~3）。
function starsOf(level, stats) {
  if (!level || !stats || typeof stats !== 'object') return 0
  if (stats.win !== true) return 0
  var metric = level.metric
  var value = metric === 'win' ? stats.moves : stats[metric]
  if (typeof value !== 'number' || !isFinite(value)) return 1
  value = Math.floor(value)
  var s = 1
  if (metric === 'score') {
    if (value >= level.star3) s = 3
    else if (value >= level.star2) s = 2
  } else {
    if (value <= level.star3) s = 3
    else if (value <= level.star2) s = 2
  }
  return s
}

// 输入：闯关状态、关卡 id、统计 {win, moves, score, time, steps, undos}；
// 输出：{state, level, stars, best, prevStars, reward, unlocked, locked, isNew}。
// stars = 本次星级；best = 历史最高；reward = 本次实发棋币（首次 ≥1 星才有）。
// 未解锁关卡不结算（locked=true）；非法关卡 id 返回 level=null 且状态不变。
function finish(state, levelId, stats) {
  var s = normState(state)
  var lv = findLevel(levelId)
  if (!lv) {
    return { state: s, level: null, stars: 0, best: 0, prevStars: 0, reward: 0, unlocked: false, locked: false, isNew: false }
  }
  var seq = ID_SEQ[lv.id]
  var prev = s.stars[lv.id] || 0
  if (seq > s.unlocked) {
    return { state: s, level: lv, stars: 0, best: prev, prevStars: prev, reward: 0, unlocked: false, locked: true, isNew: false }
  }

  var earned = starsOf(lv, stats)
  var best = earned > prev ? earned : prev
  if (earned > 0) s.stars[lv.id] = best

  var reward = 0
  if (earned >= 1 && !s.claimed[lv.id]) {
    s.claimed[lv.id] = true
    reward = lv.reward
  }

  var unlocked = false
  if (earned >= 1 && seq < TOTAL && s.unlocked < seq + 1) {
    s.unlocked = seq + 1
    unlocked = true
  }

  return {
    state: s,
    level: lv,
    stars: earned,
    best: best,
    prevStars: prev,
    reward: reward,
    unlocked: unlocked,
    locked: false,
    isNew: earned > prev
  }
}

// 输入：闯关状态；输出：累计星数（0~240）。
function totalStars(state) {
  var s = normState(state)
  var n = 0
  for (var i = 0; i < LEVELS.length; i++) n += s.stars[LEVELS[i].id] || 0
  return n
}

// 输入：闯关状态；输出：进度文案，如「通关 3/80 · ★ 7/240」。
function progressText(state) {
  var s = normState(state)
  var cleared = 0
  var stars = 0
  for (var i = 0; i < LEVELS.length; i++) {
    var n = s.stars[LEVELS[i].id] || 0
    stars += n
    if (n >= 1) cleared++
  }
  return '通关 ' + cleared + '/' + TOTAL + ' · ★ ' + stars + '/' + MAX_STARS
}

module.exports = {
  CHAPTERS: CHAPTERS,
  LEVELS: LEVELS,
  TOTAL: TOTAL,
  MAX_STARS: MAX_STARS,
  emptyState: emptyState,
  normState: normState,
  levelAt: levelAt,
  findLevel: findLevel,
  seqOf: seqOf,
  allLevels: allLevels,
  chapterAt: chapterAt,
  summary: summary,
  chapterRows: chapterRows,
  starsOf: starsOf,
  finish: finish,
  totalStars: totalStars,
  progressText: progressText
}
