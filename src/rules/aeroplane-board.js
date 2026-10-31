/**
 * rules/aeroplane-board.js — 飞行棋盘面数据表（**28 格外圈** + 每方 6 格冲刺道）。
 * 为什么是 28 格：玩家真机反馈「格数太多、格子太小」，并给了同类手表端参考设计
 *   （格子大、名字清楚）。28 格 = 每边 8 格含两角（8×4−4），在 192 设计像素宽的表上
 *   每格约 22px（原来 52 格时只有 12px）。**玩法机制原样保留**：4 架飞机、掷 6 起飞、
 *   撞机回库、航线前跳、进冲刺道需精确点数、四机全部到家者胜；只是航程变短、节奏更快。
 * 数据来源（公开资料核对）：
 *   · 飞行棋（Aeroplane Chess）标准盘：外圈四色均分、四角为起飞点、每色一条通向中心的终点道、
 *     每色一格「近路格」，落本色格前跳 4 格（各厂商规则说明一致）。
 * 近路格（航线格）坐标：按「每色区（7 格）内的相对偏移 3、四色对称」布置 → 环 3 / 10 / 17 / 24，
 *   为对称化设计（公开资料未给逐格坐标）；航线格对所有飞机生效。
 * 本工程为双人对局（蓝 = 玩家 0 / 红 = 玩家 1），只启用起飞点 0、7；14 / 21 两色为盘面完整保留。
 */

var TRACK = 28          // 外圈格数（4 边 × 7）
var PLANES = 4          // 每方飞机数
var START = [0, 7, 14, 21]    // 四方起飞点（环坐标，正好是四个角）
var HOME_N = 6          // 冲刺道格数
var FINISH = TRACK + HOME_N   // 到家的步数：0..27 外圈 + 28..33 冲刺道 + 34 到家
var MAX_ROUNDS = 40     // 轮次上限（到顶比双方总进度）
var ZONE = TRACK / 4    // 每色区（每边）格数 = 7
var JUMP = 4            // 航线格前跳格数
var FLY_OFFSET = 3      // 航线格在各色区内的相对偏移（每边 1 个，取区中）

// 盘面表：每格 { kind:'normal'|'start'|'fly'|'entry', color:0|1|2|3, flyTo? }
//   start = 各色区首格（起飞点）；entry = 各色区末格（冲刺道入口）；
//   fly   = 各色区航线格（落地前跳 JUMP 格至 flyTo）。
var RING = []
for (var r = 0; r < TRACK; r++) {
  var off = r % ZONE
  var cell = { kind: 'normal', color: (r - off) / ZONE }
  if (off === 0) {
    cell.kind = 'start'
  } else if (off === ZONE - 1) {
    cell.kind = 'entry'
  } else if (off === FLY_OFFSET) {
    cell.kind = 'fly'
    cell.flyTo = (r + JUMP) % TRACK
  }
  RING.push(cell)
}

module.exports = {
  RING: RING,
  TRACK: TRACK,
  PLANES: PLANES,
  START: START,
  HOME_N: HOME_N,
  FINISH: FINISH,
  MAX_ROUNDS: MAX_ROUNDS
}
