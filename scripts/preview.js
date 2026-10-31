/**
 * scripts/preview.js — 用真实的 geometry/board-renderer 输出渲染 PNG 预览，
 * 人工核对棋盘网格与棋子的横竖排列。纯 node 无依赖（复用 gen-icon 的 PNG 编码）。
 * 运行：node scripts/preview.js  →  生成 build/preview-*.png
 */

var fs = require('fs')
var path = require('path')
var zlib = require('zlib')

// node 不识别 @system.*，拷贝 utils 并替换 import 为 stub（同 tests/smoke.js 做法）
var SRC = path.join(__dirname, '..', 'src', 'utils')
var TMP = path.join(__dirname, '..', 'tests', '.tmp', 'utils')
fs.mkdirSync(TMP, { recursive: true })
fs.readdirSync(SRC).forEach(function (f) {
  var text = fs.readFileSync(path.join(SRC, f), 'utf8')
  text = text.replace(/import\s+(\w+)\s+from\s+'([^']+)'/g, "var $1 = require('$2')")
  text = text.replace(/'@system\.storage'/g, "'../../stubs/storage.js'")
  text = text.replace(/'@system\.vibrator'/g, "'../../stubs/vibrator.js'")
  fs.writeFileSync(path.join(TMP, f), text)
})
var BoardGeometry = require('../src/core/geometry.js')
var renderer = require('../src/core/board-renderer.js')
var rulesReg = require('../src/rules/index.js')
var theme = require('../tests/.tmp/utils/theme.js')
var config = require('../tests/.tmp/utils/config.js')

// ── PNG 编码（RGBA） ─────────────────────────────────────────────
var _table = null
function crc32Table() {
  if (_table) return _table
  _table = []
  for (var n = 0; n < 256; n++) {
    var c = n
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    _table[n] = c
  }
  return _table
}

function chunk(type, data) {
  var len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  var body = Buffer.concat([Buffer.from(type), data])
  var t = crc32Table()
  var crc = 0xffffffff
  for (var i = 0; i < body.length; i++) crc = t[(crc ^ body[i]) & 0xff] ^ (crc >>> 8)
  var tail = Buffer.alloc(4)
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([len, body, tail])
}

function encodePng(w, h, rgba) {
  var ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  var raw = Buffer.alloc((w * 4 + 1) * h)
  for (var y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  var sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ── 画布 ─────────────────────────────────────────────────────────
function Canvas(w, h, bg) {
  this.w = w
  this.h = h
  this.buf = Buffer.alloc(w * h * 4)
  for (var i = 0; i < w * h; i++) {
    this.buf[i * 4] = bg[0]
    this.buf[i * 4 + 1] = bg[1]
    this.buf[i * 4 + 2] = bg[2]
    this.buf[i * 4 + 3] = 255
  }
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

Canvas.prototype.rect = function (x, y, w, h, color) {
  var c = hex(color)
  for (var yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) {
    for (var xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
      var p = (yy * this.w + xx) * 4
      this.buf[p] = c[0]
      this.buf[p + 1] = c[1]
      this.buf[p + 2] = c[2]
      this.buf[p + 3] = 255
    }
  }
}

Canvas.prototype.circle = function (cx, cy, r, color) {
  for (var yy = cy - r; yy <= cy + r; yy++) {
    for (var xx = cx - r; xx <= cx + r; xx++) {
      if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r * r) this.rect(xx, yy, 1, 1, color)
    }
  }
}

// ── 场景绘制 ─────────────────────────────────────────────────────
var t = theme.dark

// 画棋盘（与 game.ux 模板完全同构：线段 → 星位 → 棋子）
function drawBoard(cv, game, board, lastMove, ox, oy) {
  var geo = new BoardGeometry({ cols: game.cols, rows: game.rows, cell: game.cell, mode: game.mode, pad: 10 })
  var size = geo.size()
  cv.rect(ox, oy, size.w, size.h, t.boardBg)
  renderer.buildGridLines(geo).forEach(function (l) {
    cv.rect(ox + l.x, oy + l.y, l.w, l.h, t.boardLine)
  })
  renderer.buildStars(geo, rulesReg.get(game.id, game.cols, game.rows).STARS).forEach(function (s) {
    cv.circle(ox + s.x + 2, oy + s.y + 2, 2, t.boardLine)
  })
  renderer.buildStones(board, geo, lastMove, t).forEach(function (s) {
    cv.circle(ox + s.x + s.d / 2, oy + s.y + s.d / 2, s.d / 2, s.bg)
    if (s.last) cv.circle(ox + s.x + s.mo + 3, oy + s.y + s.mo + 3, 3, t.lastMark)
  })
  return size
}

// 场景 1：主界面（卡片列表）
function sceneIndex() {
  var cv = new Canvas(192, 490, hex(t.surface))
  cv.rect(0, 24, 192, 28, t.surface) // 标题区占位
  var y = 64
  config.GAME_TYPES.forEach(function (g) {
    cv.rect(12, y, 168, 52, t.surfaceVariant)
    cv.rect(12 + 12, y + 16, 20, 20, t.primary) // 图标占位
    cv.rect(12 + 52, y + 22, g.enabled ? 60 : 90, 8, g.enabled ? t.onSurface : t.outline) // 文字占位
    if (!g.enabled) cv.rect(12 + 150, y + 22, 24, 8, t.outline)
    y += 60
  })
  cv.rect(12, 426, 168, 40, t.surface)
  cv.circle(30, 446, 2, t.outline)
  cv.rect(40, 442, 112, 8, t.onSurfaceVariant)
  return cv
}

// 场景 2：五子棋中盘（交叉点模式）
function sceneGomoku() {
  var cv = new Canvas(192, 490, hex(t.surface))
  cv.rect(0, 0, 192, 36, t.surface)
  cv.circle(24, 18, 5, t.stoneBlackBorder)
  var g = rulesReg.get('gomoku')
  var b = g.init()
  b[2][1] = 1; b[3][2] = 1; b[4][3] = 1
  b[2][3] = 2; b[3][4] = 2; b[1][2] = 2
  drawBoard(cv, { id: 'gomoku', cols: 7, rows: 7, cell: 30, mode: 'cross' }, b, { i: 4, j: 3 }, 12, 80)
  cv.rect(12, 410, 52, 40, t.surface)
  cv.rect(70, 410, 52, 40, t.primaryContainer)
  cv.rect(128, 410, 52, 40, t.surface)
  return cv
}

// 场景 3：黑白棋初始（格子中心模式）
function sceneOthello() {
  var cv = new Canvas(192, 490, hex(t.surface))
  var g = rulesReg.get('othello')
  drawBoard(cv, { id: 'othello', cols: 6, rows: 6, cell: 30, mode: 'cell' }, g.init(), null, 12, 80)
  return cv
}

// 场景 4：四子棋中盘（重力列模式）
function sceneConnect4() {
  var cv = new Canvas(192, 490, hex(t.surface))
  var g = rulesReg.get('connect4')
  var b = g.init()
  b[5][2] = 1; b[4][2] = 1; b[3][2] = 2; b[5][3] = 2; b[5][4] = 1
  drawBoard(cv, { id: 'connect4', cols: 7, rows: 6, cell: 28, mode: 'cell' }, b, { i: 2, j: 4 }, 12, 80)
  return cv
}

var outDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(outDir, { recursive: true })
var scenes = {
  'preview-index.png': sceneIndex(),
  'preview-gomoku.png': sceneGomoku(),
  'preview-othello.png': sceneOthello(),
  'preview-connect4.png': sceneConnect4()
}
Object.keys(scenes).forEach(function (name) {
  var cv = scenes[name]
  fs.writeFileSync(path.join(outDir, name), encodePng(cv.w, cv.h, cv.buf))
  console.log('written', name)
})
