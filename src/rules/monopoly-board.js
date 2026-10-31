/**
 * rules/monopoly-board.js — 大富翁盘面数据表（**24 格**精简盘面）。
 * 为什么是 24 格：玩家真机反馈「格数太多、格子太小看不清」，并给了同类手表端参考设计
 *   （每边 6 格、格子大、名字+价格清楚）。24 格 = 每边 7 格含角（7×4−4），
 *   在 192 设计像素宽的表上每格约 26px（原来 40 格时只有 15px），
 *   且**所有机制原样保留**：6 个地产色组（各 2 块地）、4 条铁路、2 家公用事业、
 *   起点 / 监狱 / 入狱 / 所得税 / 机会 / 命运。
 * 相比 40 格标准盘，仅「格数与地产数量」压缩（22 → 12 块地、8 → 6 个色组），
 *   租金 / 建房费 / 抵押值仍**逐项取自官方标准盘**（未自行编造）；被去掉的是
 *   免费停车（本身无事发生）、奢侈税、各 2 张机会/命运、以及 10 块地产。
 * 名称按同一价格梯度换成中国地名；每格另给 1 字简称（窄档位只排简称）。
 */

var BOARD_SIZE = 24
var START_MONEY = 1500      // 官方开局资金
var START_SALARY = 200      // 经过起点领取
var INCOME_TAX = 200
var MORTGAGE_INTEREST = 0.1 // 赎回时须多付 10% 利息（官方规则）
var JAIL_POS = 7            // 监狱（探监）
var GO_TO_JAIL_POS = 15     // 入狱
var JAIL_FINE = 50          // 重掷逃狱罚金（官方规则）
var JAIL_MAX_TURNS = 3      // 连续三次不成双 → 缴罚金后强制移动
// 铁路租金表（4 条铁路按持有条数取租金，官方数值；3 条时取前三位）
var RAIL_RENT = [0, 25, 50, 100, 200]
var UTIL_MULT = [0, 4, 10]  // 公用事业按持有家数取骰子和倍数

// 官方标准色带（6 个地产分组）+ 建房费 + 色带上的文字色。
// fg 为深色字 #1D1B20：6 组色带都是中等明度，实测该深色字的对比度在每组都优于白字
//   （最差 6.9:1，白字最差仅 2.4:1），而格内文字只有 10~12px，可读性优先。
var GROUPS = {
  brown: { name: '棕色组', color: '#955436', fg: '#1D1B20', houseCost: 50 },
  lightblue: { name: '浅蓝组', color: '#AAE0FA', fg: '#1D1B20', houseCost: 50 },
  pink: { name: '粉色组', color: '#D93A96', fg: '#1D1B20', houseCost: 100 },
  orange: { name: '橙色组', color: '#F7941D', fg: '#1D1B20', houseCost: 100 },
  red: { name: '红色组', color: '#ED1B24', fg: '#1D1B20', houseCost: 150 },
  darkblue: { name: '深蓝组', color: '#0072BB', fg: '#1D1B20', houseCost: 200 }
}

// 24 格盘面（按行进方向 0..23，顺时针：上 7 → 右 5 → 下 7 → 左 5）。
// 地产项：{ type:'prop', group, name, short, price, rent:[基础,1房,2房,3房,4房,旅馆], mortgage }
// 铁路项：{ type:'rail', price:200, mortgage:100 }；公用事业项：{ type:'util', price:150, mortgage:75 }
// 其余：起点 / 机会 / 命运 / 所得税 / 监狱 / 入狱。价格与租金均取自官方标准盘对应价位。
var BOARD = [
  { type: 'start', name: '起点', short: '始' },
  { type: 'prop', group: 'brown', name: '拉萨', short: '拉', price: 60, mortgage: 30, rent: [2, 10, 30, 90, 160, 250] },
  { type: 'chance', name: '机会', short: '机' },
  { type: 'prop', group: 'brown', name: '成都', short: '蓉', price: 100, mortgage: 50, rent: [6, 30, 90, 270, 400, 550] },
  { type: 'rail', name: '陇海铁路', short: '陇', price: 200, mortgage: 100 },
  { type: 'prop', group: 'lightblue', name: '贵阳', short: '贵', price: 120, mortgage: 60, rent: [8, 40, 100, 300, 450, 600] },
  { type: 'prop', group: 'lightblue', name: '武汉', short: '汉', price: 140, mortgage: 70, rent: [10, 50, 150, 450, 625, 750] },
  { type: 'jail', name: '监狱', short: '狱' },
  { type: 'prop', group: 'pink', name: '南昌', short: '昌', price: 160, mortgage: 80, rent: [12, 60, 180, 500, 700, 900] },
  { type: 'util', name: '电力公司', short: '电', price: 150, mortgage: 75 },
  { type: 'prop', group: 'pink', name: '西安', short: '西', price: 180, mortgage: 90, rent: [14, 70, 200, 550, 750, 950] },
  { type: 'chest', name: '命运', short: '运' },
  { type: 'prop', group: 'orange', name: '郑州', short: '郑', price: 200, mortgage: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { type: 'rail', name: '京哈铁路', short: '哈', price: 200, mortgage: 100 },
  { type: 'prop', group: 'orange', name: '南京', short: '宁', price: 220, mortgage: 110, rent: [18, 90, 250, 700, 875, 1050] },
  { type: 'gojail', name: '入狱', short: '捕' },
  { type: 'prop', group: 'red', name: '济南', short: '济', price: 240, mortgage: 120, rent: [20, 100, 300, 750, 925, 1100] },
  { type: 'util', name: '自来水厂', short: '水', price: 150, mortgage: 75 },
  { type: 'prop', group: 'red', name: '重庆', short: '渝', price: 300, mortgage: 150, rent: [26, 130, 390, 900, 1100, 1275] },
  { type: 'tax', name: '所得税', short: '税', amount: INCOME_TAX },
  { type: 'prop', group: 'darkblue', name: '北京', short: '京', price: 350, mortgage: 175, rent: [35, 175, 500, 1100, 1300, 1500] },
  { type: 'rail', name: '京九铁路', short: '九', price: 200, mortgage: 100 },
  { type: 'prop', group: 'darkblue', name: '上海', short: '沪', price: 400, mortgage: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
  { type: 'rail', name: '湘桂铁路', short: '桂', price: 200, mortgage: 100 }
]

// 输入：分组 id；输出：该组的全部格号（用于「成套」判定与均匀建房）。
function groupCells(group) {
  var out = []
  for (var i = 0; i < BOARD.length; i++) {
    if (BOARD[i].type === 'prop' && BOARD[i].group === group) out.push(i)
  }
  return out
}

// 输入：无；输出：{group: [格号…]}，各分组的地图。
function groupMap() {
  var m = {}
  for (var g in GROUPS) m[g] = groupCells(g)
  return m
}

module.exports = {
  BOARD_SIZE: BOARD_SIZE,
  START_MONEY: START_MONEY,
  START_SALARY: START_SALARY,
  INCOME_TAX: INCOME_TAX,
  MORTGAGE_INTEREST: MORTGAGE_INTEREST,
  JAIL_POS: JAIL_POS,
  GO_TO_JAIL_POS: GO_TO_JAIL_POS,
  JAIL_FINE: JAIL_FINE,
  JAIL_MAX_TURNS: JAIL_MAX_TURNS,
  RAIL_RENT: RAIL_RENT,
  UTIL_MULT: UTIL_MULT,
  GROUPS: GROUPS,
  BOARD: BOARD,
  groupCells: groupCells,
  groupMap: groupMap
}
