/**
 * tests/geometry.js — BoardGeometry 几何与命中判定测试。
 * 运行：node tests/geometry.js
 */

var BoardGeometry = require('../src/core/geometry.js')
var h = require('./helper.js')

h.suite('geometry/cross(五子棋 7x7 cell30)')

var g = new BoardGeometry({ cols: 7, rows: 7, cell: 30, mode: 'cross', pad: 10 })

// cross 模式：跨度 = (cols-1)*cell（交点模式只有 cols-1 个间隔）
// 回归护栏：曾把盒算成 cols*cell+2*pad，比网格多出一整格、全落在右/下侧，
// 真机表现为「棋盘没居中：右/下留白比左/上大」。这条断言就是防它复发。
h.eq('尺寸 = 6*30+2*10（cross 跨度 = cols-1 个间隔）', g.size(), { w: 200, h: 200 })
h.eq('四边内缩相等（棋盘居中）', {
  left: g.pos(0, 0).x,
  top: g.pos(0, 0).y,
  right: g.size().w - g.pos(g.cols - 1, 0).x,
  bottom: g.size().h - g.pos(0, g.rows - 1).y
}, { left: 10, top: 10, right: 10, bottom: 10 })
h.eq('交点(0,0)坐标', g.pos(0, 0), { x: 10, y: 10 })
h.eq('交点(3,3)坐标', g.pos(3, 3), { x: 100, y: 100 })

var hit1 = g.hit(100, 100)
h.ok('交点正中命中(3,3)', hit1 && hit1.i === 3 && hit1.j === 3)
var hit2 = g.hit(95, 106)
h.ok('偏移 5~6px 仍命中(3,3)', hit2 && hit2.i === 3 && hit2.j === 3)
h.ok('棋盘外 >5px 不命中（防留白区误落子）', g.hit(3, 3) === null)
h.ok('棋盘外 4px 内仍命中边缘交点', (function () { var c = g.hit(8, 10); return c && c.i === 0 && c.j === 0 })())
h.ok('越界不命中', g.hit(500, 500) === null)
var hit3 = g.hit(88, 88)
h.ok('两交点中点吸附到(3,3)', hit3 && hit3.i === 3 && hit3.j === 3)

// 容差收紧（2026-10-23）：cross 模式容差 = 0.45×cell（cell30 → 13，此处按 14 计）
h.ok('偏 12px 仍吸附到(3,3)', (function () { var c = g.hit(112, 100); return c && c.i === 3 && c.j === 3 })())
h.ok('正中空当（离最近交点 15px）判无效，不落错格', g.hit(115, 100) === null)

h.suite('geometry/cell(黑白棋 6x6 cell30)')

var g2 = new BoardGeometry({ cols: 6, rows: 6, cell: 30, mode: 'cell', pad: 10 })
h.eq('格中心(0,0)', g2.pos(0, 0), { x: 25, y: 25 })
var c1 = g2.hit(26, 40)
h.ok('格中心附近命中(0,1)', c1 && c1.i === 0 && c1.j === 1)
h.eq('棋子直径 = cell-6', g2.stoneD, 24)

h.suite('geometry/assert')

var threw = false
try {
  var bad = new BoardGeometry({ cols: 7, rows: 7, cell: 0, mode: 'cross' })
  void bad
} catch (e) {
  threw = true
}
h.ok('非法 cell 抛断言异常', threw)

process.exitCode = h.summary()
