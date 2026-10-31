/**
 * tests/spotdiff.js — 「找不同」45 关数据与纯函数测试。
 * 覆盖：关数 / id 唯一且有序 / 字段与取值 / 每关 5 处差异 / 圆心半径合法且互不重叠 /
 *   图片存在且为 176×176 的 256 色优化 PNG（≤20KB、无文本块）/ 45 关画面不重复 /
 *   checkTap 命中与未命中、foundAll 全找到语义。
 * 运行：node tests/spotdiff.js
 */

var fs = require('fs')
var path = require('path')
var crypto = require('crypto')
var sd = require('../src/rules/spotdiff.js')
var h = require('./helper.js')

var IMG_ROOT = path.join(__dirname, '..', 'src')
var MAX_BYTES = 20 * 1024

// 输入：序号；输出：两位数字串（01..40）。
function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

// 输入：PNG 文件绝对路径；输出：{ w, h, depth, ctype, plte, size, text }，非 PNG 返回 null。
function pngMeta(file) {
  if (!fs.existsSync(file)) return null
  var buf = fs.readFileSync(file)
  if (buf.length < 33) return null
  var sig = [137, 80, 78, 71, 13, 10, 26, 10]
  for (var i = 0; i < 8; i++) if (buf[i] !== sig[i]) return null
  var meta = {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    depth: buf[24],
    ctype: buf[25],
    plte: 0,
    size: buf.length,
    text: false
  }
  var pos = 8
  while (pos + 8 <= buf.length) {
    var len = buf.readUInt32BE(pos)
    var type = buf.toString('ascii', pos + 4, pos + 8)
    if (type === 'PLTE') meta.plte = len / 3
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') meta.text = true
    if (type === 'IEND') break
    pos += 12 + len
  }
  return meta
}

// 输入：文件绝对路径；输出：内容 md5（用于判断画面是否重复）。
function md5Of(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
}

// ─────────────────────── 关卡结构 ───────────────────────
h.suite('spotdiff/关卡结构')
h.eq('45 关', sd.LEVELS.length, 45)
h.eq('getLevel(1) 取首关', sd.getLevel(1), sd.LEVELS[0])
h.eq('getLevel(45) 取末关', sd.getLevel(45), sd.LEVELS[44])
h.eq('getLevel("12") 支持数字字符串', sd.getLevel('12'), sd.LEVELS[11])
h.eq('未知 id 0 返回 null', sd.getLevel(0), null)
h.eq('未知 id 46 返回 null', sd.getLevel(46), null)
h.eq('非数字 id 返回 null', sd.getLevel('abc'), null)
h.eq('缺省 id 返回 null', sd.getLevel(), null)

var ids = {}
var idOk = true
var orderOk = true
var nameOk = true
var names = {}
var fieldOk = true
var diffOk = true
var rangeOk = true
var overlapOk = true
var timeOk = true
var imagePathOk = true

for (var i = 0; i < sd.LEVELS.length; i++) {
  var lv = sd.LEVELS[i]
  if (typeof lv.id !== 'number' || lv.id !== Math.floor(lv.id) || lv.id < 1 || lv.id > 45) idOk = false
  if (lv.id !== i + 1) orderOk = false
  if (ids[lv.id]) idOk = false
  ids[lv.id] = true
  if (typeof lv.name !== 'string' || !lv.name) nameOk = false
  if (names[lv.name]) nameOk = false
  names[lv.name] = true

  if (typeof lv.timeLimit !== 'number' || lv.timeLimit !== Math.floor(lv.timeLimit) || lv.timeLimit < 20 || lv.timeLimit > 300) timeOk = false
  if (typeof lv.reward !== 'number' || lv.reward !== Math.floor(lv.reward) || lv.reward < 1 || lv.reward > 500) timeOk = false

  var wantA = '/common/img/spot/a' + pad2(lv.id) + '.png'
  var wantB = '/common/img/spot/b' + pad2(lv.id) + '.png'
  if (lv.imageA !== wantA || lv.imageB !== wantB) imagePathOk = false

  if (!lv.diffs || lv.diffs.length !== 5) { diffOk = false; continue }
  for (var k = 0; k < lv.diffs.length; k++) {
    var df = lv.diffs[k]
    if (!df || typeof df.x !== 'number' || typeof df.y !== 'number' || typeof df.r !== 'number') fieldOk = false
    if (isNaN(df.x) || isNaN(df.y) || isNaN(df.r)) fieldOk = false
    if (df.x <= 0.05 || df.x >= 0.95 || df.y <= 0.05 || df.y >= 0.95) rangeOk = false
    if (df.r < 0.05 || df.r > 0.08) rangeOk = false
  }
  for (var p = 0; p < lv.diffs.length; p++) {
    for (var q = p + 1; q < lv.diffs.length; q++) {
      var ax = lv.diffs[p]
      var bx = lv.diffs[q]
      var dist = Math.sqrt((ax.x - bx.x) * (ax.x - bx.x) + (ax.y - bx.y) * (ax.y - bx.y))
      if (dist < ax.r + bx.r) overlapOk = false
    }
  }
}

h.ok('id 全为 1..45 整数且唯一', idOk)
h.ok('关卡按 id 升序排列', orderOk)
h.ok('name 非空且 45 关互不相同', nameOk)
h.ok('diffs 存在且每关恰好 5 处、字段为数字', diffOk && fieldOk)
h.ok('x/y 在图片内部、r 在 0.05~0.08', rangeOk)
h.ok('同一关差异圆心互不重叠（dist ≥ r1 + r2）', overlapOk)
h.ok('timeLimit / reward 为合法整数', timeOk)
h.ok('imageA / imageB 路径与关卡号一致', imagePathOk)

// ─────────────────────── 图片素材 ───────────────────────
h.suite('spotdiff/图片素材')
var hashA = {}
var hashB = {}
var hashOk = true
var distinctOk = true
for (var j = 0; j < sd.LEVELS.length; j++) {
  var lvv = sd.LEVELS[j]
  var fa = path.join(IMG_ROOT, lvv.imageA)
  var fb = path.join(IMG_ROOT, lvv.imageB)
  var ma = pngMeta(fa)
  var mb = pngMeta(fb)
  var okA = !!ma && ma.w === 176 && ma.h === 176 && ma.ctype === 3 && ma.plte > 0 && ma.plte <= 256 &&
    ma.size <= MAX_BYTES && !ma.text
  var okB = !!mb && mb.w === 176 && mb.h === 176 && mb.ctype === 3 && mb.plte > 0 && mb.plte <= 256 &&
    mb.size <= MAX_BYTES && !mb.text
  h.ok(lvv.id + ' A/B 为 176×176 的 256 色优化 PNG（≤20KB、无文本块）', okA && okB)
  if (ma && mb) {
    if (hashA[md5Of(fa)] || hashB[md5Of(fb)]) hashOk = false
    hashA[md5Of(fa)] = true
    hashB[md5Of(fb)] = true
    if (md5Of(fa) === md5Of(fb)) distinctOk = false
  }
}
h.ok('45 关 A 图互不相同、B 图互不相同（画面不重复）', hashOk)
h.ok('每关 A / B 两张图内容不同', distinctOk)

// ─────────────────────── 点击判定 ───────────────────────
h.suite('spotdiff/checkTap')
var centerOk = true
var edgeOk = true
var cornerOk = true
var invalidOk = true
for (var m = 0; m < sd.LEVELS.length; m++) {
  var lv2 = sd.LEVELS[m]
  for (var n = 0; n < lv2.diffs.length; n++) {
    var d2 = lv2.diffs[n]
    if (sd.checkTap(lv2, d2.x, d2.y) !== n) centerOk = false
    var ex = d2.x + d2.r * 0.9
    if (sd.checkTap(lv2, ex, d2.y) !== n) edgeOk = false
  }
  if (sd.checkTap(lv2, 0, 0) !== -1 || sd.checkTap(lv2, 1, 1) !== -1) cornerOk = false
}
h.ok('每处差异圆心必命中对应下标', centerOk)
h.ok('半径内 0.9r 偏移仍命中对应下标', edgeOk)
h.ok('画面四角不误命中', cornerOk)

var lv1 = sd.LEVELS[0]
if (sd.checkTap(null, 0.5, 0.5) !== -1) invalidOk = false
if (sd.checkTap(lv1, NaN, 0.5) !== -1) invalidOk = false
if (sd.checkTap(lv1, 0.5, NaN) !== -1) invalidOk = false
if (sd.checkTap(lv1, -0.1, 0.5) !== -1) invalidOk = false
if (sd.checkTap(lv1, 0.5, 1.1) !== -1) invalidOk = false
if (sd.checkTap(lv1, '0.5', 0.5) !== -1) invalidOk = false
if (sd.checkTap({}, 0.5, 0.5) !== -1) invalidOk = false
h.ok('非法关卡 / 非数字坐标 / 越界坐标返回 -1', invalidOk)

var d1 = lv1.diffs[0]
h.eq('圆心 + 0.999r 命中', sd.checkTap(lv1, d1.x + d1.r * 0.999, d1.y), 0)
h.eq('圆心 + 1.2r 未命中', sd.checkTap(lv1, d1.x + d1.r * 1.2, d1.y), -1)
h.eq('命中结果为整数下标', typeof sd.checkTap(lv1, d1.x, d1.y) === 'number' && sd.checkTap(lv1, d1.x, d1.y) === 0, true)

// ─────────────────────── foundAll ───────────────────────
h.suite('spotdiff/foundAll')
h.eq('5 处全标记为 true → 全部找到', sd.foundAll(lv1, [true, true, true, true, true]), true)
h.eq('少标记 1 处 → 未全部找到', sd.foundAll(lv1, [true, true, false, true, true]), false)
h.eq('全 false → 未全部找到', sd.foundAll(lv1, [false, false, false, false, false]), false)
h.eq('标记数组不足 5 项 → false', sd.foundAll(lv1, [true, true, true]), false)
h.eq('非数组标记 → false', sd.foundAll(lv1, null), false)
h.eq('空关卡 → false', sd.foundAll(null, [true, true, true, true, true]), false)
h.eq('按下标数组（非布尔）不算已找到', sd.foundAll(lv1, [0, 1, 2, 3, 4]), false)
h.eq('多出的标记不影响结果', sd.foundAll(lv1, [true, true, true, true, true, true]), true)

process.exitCode = h.summary()
