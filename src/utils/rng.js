/**
 * utils/rng.js — 确定性伪随机工具（日期种子 → 可复现序列）。
 * 纯函数、无 @system / window / document 依赖，node 可直接 require 测试。
 * 用途（每日挑战）：同一天、同一玩法 → 同一颗种子 → 骰子 / 卡牌 / AI 并列决策 /
 * 单人棋盘与关卡全部可复现；不改变普通对局（普通对局仍用 Math.random）。
 * 实现：FNV-1a 变体哈希（按 31 进位，避免 32 位乘法超出 JS 双精度整数范围）
 *       + mulberry32（32 位状态，序列稳定、无浮点平台差异）。
 */

// 内部：32 位整数乘法（Vela 旧引擎无 Math.imul 时的等价实现）。
var imul = (typeof Math.imul === 'function') ? Math.imul : function (a, b) {
  var ah = (a >>> 16) & 0xffff
  var al = a & 0xffff
  var bh = (b >>> 16) & 0xffff
  var bl = b & 0xffff
  return ((al * bl) + ((((ah * bl) + (al * bh)) << 16) >>> 0) | 0)
}

// 输入：任意字符串；输出：32 位无符号哈希（稳定，不受运行环境影响）。
function hash32(str) {
  var s = String(str === undefined || str === null ? '' : str)
  var h = 5381
  for (var i = 0; i < s.length; i++) {
    h = ((h * 33) + s.charCodeAt(i)) % 4294967296
  }
  return h >>> 0
}

// 输入：日期串（YYYYMMDD 或 YYYY-MM-DD 等）；输出：只含 8 位数字的日期串（非法时原样截断）。
function cleanDate(dateStr) {
  var s = String(dateStr === undefined || dateStr === null ? '' : dateStr).replace(/[^0-9]/g, '')
  return s.length > 8 ? s.substring(0, 8) : s
}

// 输入：日期串；输出：自 1970-01-01 起的天序号（UTC 解析，避免时区影响；非法日期 → 0）。
function dayNumber(dateStr) {
  var s = cleanDate(dateStr)
  if (s.length !== 8) return 0
  var y = parseInt(s.substring(0, 4), 10)
  var m = parseInt(s.substring(4, 6), 10)
  var d = parseInt(s.substring(6, 8), 10)
  if (!isFinite(y) || !isFinite(m) || !isFinite(d) || m < 1 || m > 12 || d < 1 || d > 31) return 0
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

// 输入：Date（缺省为当前时间）；输出：本地日期串 YYYYMMDD。
// 每日挑战以「本地日期」为准（玩家换时区 / 跨零点时自然切到新一天）。
function dateStr(d) {
  var date = d || new Date()
  var y = date.getFullYear()
  var m = date.getMonth() + 1
  var day = date.getDate()
  return '' + y + (m < 10 ? '0' : '') + m + (day < 10 ? '0' : '') + day
}

// 输入：日期串、玩法 id；输出：32 位种子（同日同玩法恒定，跨日或换玩法必变）。
function dateSeed(dateStrValue, gameId) {
  var gid = gameId === undefined || gameId === null ? '' : String(gameId)
  return hash32(cleanDate(dateStrValue) + '|' + gid)
}

// 输入：32 位种子；输出：随机器 { next(), int(n), pick(arr), shuffle(arr), chance(p) }。
// 同一颗种子构造出的随机器，调用顺序相同则输出序列完全一致。
function create(seed) {
  var a = (typeof seed === 'number' && isFinite(seed) ? Math.floor(seed) : 0) >>> 0

  // 输出：[0, 1) 浮点随机数。
  function next() {
    a = (a + 0x6D2B79F5) | 0
    var t = a
    t = imul(t ^ (t >>> 15), t | 1)
    t = (t + imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // 输入：上界 n；输出：[0, n) 整数（n <= 0 时返回 0）。
  function int(n) {
    var lim = typeof n === 'number' && isFinite(n) ? Math.floor(n) : 0
    if (lim <= 0) return 0
    var v = Math.floor(next() * lim)
    return v >= lim ? lim - 1 : v
  }

  // 输入：数组；输出：随机元素（空数组返回 null）。
  function pick(arr) {
    if (!arr || !arr.length) return null
    return arr[int(arr.length)]
  }

  // 输入：数组；输出：洗牌后的新数组（不改入参）。
  function shuffle(arr) {
    var out = arr ? arr.slice() : []
    for (var i = out.length - 1; i > 0; i--) {
      var j = int(i + 1)
      var tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }

  // 输入：概率 p（0~1）；输出：true / false（p <= 0 恒 false，p >= 1 恒 true）。
  function chance(p) {
    var v = typeof p === 'number' && isFinite(p) ? p : 0
    if (v <= 0) return false
    if (v >= 1) return true
    return next() < v
  }

  return { next: next, int: int, pick: pick, shuffle: shuffle, chance: chance }
}

module.exports = {
  create: create,
  dateSeed: dateSeed,
  dateStr: dateStr,
  cleanDate: cleanDate,
  dayNumber: dayNumber
}
