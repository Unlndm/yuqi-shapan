/**
 * utils/screen.js — 多屏适配布局参数。
 * 职责：读取设备屏幕（宽/高/形状），换算出「设计像素画布高」与「大屏 UI 收敛系数」。
 *  - designH：设计像素画布高 = 屏高dp × (192/屏宽dp)，与设备上报单位制无关地收敛。
 *    旧版用 Math.max(300, …) 兜底：宽屏会被高估（REDMI Watch 5 实际画布约 192×228 被抬到 300），
 *    全屏棋盘/弹窗按 300 布局 → 上下溢出、整体显得过大。
 *  - uiScale：仅对「大屏方表」收敛（rect 且屏宽 dp ≥ 190，如 REDMI Watch 5 216dp）。
 *    小米手环 Pro（rect，168dp）与跑道屏（胶囊 96/106dp）保持 1，即原有设计尺寸。
 *    内联绑定的 font-size 无法被 CSS 媒体查询覆盖，故字号/几何尺寸靠 uiScale 收敛。
 * 结果模块级缓存，全应用只取一次。失败兜底手环 9（96×245dp → 192×490）。
 */

var device = require('@system.device')
var brightness = require('@system.brightness')

// 大屏方表（如 REDMI Watch 5：2.07 英寸 / 216dp 宽）的 UI 收敛系数。
// 该值是可调参数：改大更接近原尺寸，改小更紧凑。
var LARGE_RECT_UI_SCALE = 0.8
// 判定「大屏方表」的屏宽 dp 阈值（小米手环 Pro = 168dp，须排除在外）
var LARGE_RECT_MIN_WIDTH = 190

var cached = null

// 输入：无；输出：Promise<{designH, scale, shape, profile, uiScale, compact, widePill, fontBump}>。
function getLayout() {
  if (cached) return Promise.resolve(cached)
  return new Promise(function (resolve) {
    var fallback = {
      designH: 490, scale: 2, shape: 'pill-shaped', profile: 'pill-small',
      uiScale: 1, compact: false, widePill: false, fontBump: 0
    }
    try {
      device.getInfo({
        success: function (info) {
          var sw = info && typeof info.screenWidth === 'number' && info.screenWidth > 0 ? info.screenWidth : 96
          var sh = info && typeof info.screenHeight === 'number' && info.screenHeight > 0 ? info.screenHeight : 245
          var scale = 192 / sw
          var shape = (info && info.screenShape) || 'pill-shaped'
          // 屏型三档：rect=方屏（手环 Pro / REDMI Watch）；pill-small=手环9（96dp）；
          // pill=手环10 及更宽胶囊（106dp）—— 后两者即「跑道屏」。
          // widePill 单独标记「宽胶囊」（小米手环10：106dp / 192×471）：
          //   它的物理屏更大，选项类按钮可以并排、字号可以整体放大；
          //   手环9（96dp）与方屏保持原设计。CSS 用 (shape: pill-shaped) and (min-width: 100) 对应。
          var widePill = shape !== 'rect' && sw >= 100
          var profile = shape === 'rect' ? 'rect' : (widePill ? 'pill' : 'pill-small')
          // 大屏方表（REDMI Watch 5 = 216dp）取真实画布高：旧代码的 Math.max(300, …) 兜底
          // 会把它的 192×228 画布抬到 300，全屏棋盘/弹窗按 300 布局而上下溢出（用户反馈
          // 「整体过大」）。其余机型（跑道屏、小米手环 Pro）沿用旧兜底值，版面保持原样。
          var largeRect = shape === 'rect' && sw >= LARGE_RECT_MIN_WIDTH
          var designH = Math.max(largeRect ? 120 : 300, Math.round(sh * scale))
          var uiScale = largeRect ? LARGE_RECT_UI_SCALE : 1
          cached = {
            designH: designH,
            scale: scale,
            shape: shape,
            profile: profile,
            uiScale: uiScale,
            compact: designH < 400 || shape === 'rect',
            widePill: widePill,
            // 内联字号增量（px）：手环10 只放大文字与控件，不改棋盘几何。
            fontBump: widePill ? 3 : 0
          }
          resolve(cached)
        },
        fail: function () {
          cached = fallback
          resolve(cached)
        }
      })
    } catch (e) {
      cached = fallback
      resolve(cached)
    }
  })
}

// 对局常亮：回合制游戏灭屏体验极差；无该能力设备静默失败。
// 输入：on(bool)；输出：无。
function keepScreenOn(on) {
  try {
    brightness.setKeepScreenOn({ keepScreenOn: !!on })
  } catch (e) {}
}

// 输入：无；输出：已缓存的布局（未读过则为 null）。
// 供页面在 onInit 里同步取画布高，避免「先按默认 490 渲染一帧、再异步改成真实值」
// 造成的一次整页重排（主页/单人页每次进入都会碰到，体感就是「切换卡」）。
function cachedLayout() {
  return cached
}

module.exports = { getLayout: getLayout, cachedLayout: cachedLayout, keepScreenOn: keepScreenOn }
