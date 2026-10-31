/**
 * scripts/gen-icon.js — 生成应用图标 src/common/icon.png（96×96，纯 node 无依赖）。
 * 设计：primaryContainer 紫底 + 黑白双子（呼应棋类主题，无文字避免字体栅格问题）。
 * 运行：node scripts/gen-icon.js
 */

var fs = require('fs')
var path = require('path')
var zlib = require('zlib')

var SIZE = 96

// 生成 RGBA 像素数据。
function pixels() {
  var bg = [0x4f, 0x37, 0x8b, 0xff]      // primaryContainer
  var black = [0x1c, 0x1b, 0x1f, 0xff]   // 黑子
  var white = [0xe6, 0xe1, 0xe5, 0xff]   // 白子
  var rows = []
  for (var y = 0; y < SIZE; y++) {
    var row = []
    for (var x = 0; x < SIZE; x++) {
      var c = bg
      // 左上黑子 / 右下白子，各带 3px 留边
      var d1 = Math.pow(x - 34, 2) + Math.pow(y - 34, 2)
      var d2 = Math.pow(x - 62, 2) + Math.pow(y - 62, 2)
      if (d1 <= 20 * 20) c = black
      else if (d2 <= 20 * 20) c = white
      row.push.apply(row, c)
    }
    // PNG 每行前置 filter byte 0
    rows.push([0].concat(row))
  }
  return Array.prototype.concat.apply([], rows)
}

// 输出：最小 PNG（IHDR/IDAT/IEND）。
function png(raw) {
  function chunk(type, data) {
    var len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    var body = Buffer.concat([Buffer.from(type), data])
    var crcTable = crc32Table()
    var crc = 0xffffffff
    for (var i = 0; i < body.length; i++) {
      crc = crcTable[(crc ^ body[i]) & 0xff] ^ (crc >>> 8)
    }
    var tail = Buffer.alloc(4)
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, tail])
  }
  var ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  var idat = zlib.deflateSync(Buffer.from(raw), { level: 9 })
  var sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

var _table = null
function crc32Table() {
  if (_table) return _table
  _table = []
  for (var n = 0; n < 256; n++) {
    var c = n
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    _table[n] = c
  }
  return _table
}

var out = path.join(__dirname, '..', 'src', 'common', 'icon.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, png(pixels()))
console.log('icon written:', out, fs.statSync(out).size, 'bytes')
