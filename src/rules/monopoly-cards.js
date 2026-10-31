/**
 * rules/monopoly-cards.js — 机会 / 命运 卡组（官方标准语义的中文化）。
 * 语义与金额全部按官方标准盘卡组，未自行编造。
 * ⚠️ 卡面上的「前往 X」坐标按本工程 **24 格精简盘面**（rules/monopoly-board.js）对齐：
 *   上海 = 22 号格、济南 = 16、武汉 = 6（替代原「圣查尔斯广场」）、陇海铁路 = 4。
 *   位置变动时必须同步改这里，否则卡片会把棋子送到错误的格子。
 */

// 效果类型：
//   advance     前往某格（salary=true 时经过起点领薪）
//   nearestRail 前往最近铁路（落点走正常结算；无主时由引擎给出购买决策）
//   nearestUtil 前往最近公用事业（有主时按骰子和的 10 倍付费）
//   back3       后退 3 格（落点走正常结算）
//   goJail      入狱
//   freeJail    获得免狱卡
//   money       资金增减（delta）
//   repairs     按持有房屋/旅馆数付费
//   payEach     付每位对手（amount）
//   collectEach 收取每位对手（amount）

// 机会（Chance）
var CHANCE = [
  { id: 'c01', text: '前往上海', effect: { kind: 'advance', to: 22, salary: true } },
  { id: 'c02', text: '前往起点，领取 $200', effect: { kind: 'advance', to: 0, salary: true } },
  { id: 'c03', text: '前往济南。若经过起点，领取 $200', effect: { kind: 'advance', to: 16, salary: true } },
  { id: 'c04', text: '前往武汉。若经过起点，领取 $200', effect: { kind: 'advance', to: 6, salary: true } },
  { id: 'c05', text: '前往最近的铁路。无主可购买，有主付双倍租金', effect: { kind: 'nearestRail' } },
  { id: 'c06', text: '前往最近的铁路。无主可购买，有主付双倍租金', effect: { kind: 'nearestRail' } },
  { id: 'c07', text: '前往最近的公用事业。无主可购买，有主掷骰付十倍点数', effect: { kind: 'nearestUtil' } },
  { id: 'c08', text: '银行付给你股息 $50', effect: { kind: 'money', delta: 50 } },
  { id: 'c09', text: '免狱卡一张，可保留备用', effect: { kind: 'freeJail' } },
  { id: 'c10', text: '后退三格', effect: { kind: 'back3' } },
  { id: 'c11', text: '入狱。不经过起点，不领取 $200', effect: { kind: 'goJail' } },
  { id: 'c12', text: '房屋大修：每栋房屋付 $25，每座旅馆付 $100', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'c13', text: '超速罚款 $15', effect: { kind: 'money', delta: -15 } },
  { id: 'c14', text: '前往陇海铁路。若经过起点，领取 $200', effect: { kind: 'advance', to: 4, salary: true } },
  { id: 'c15', text: '当选董事长，付给每位对手 $50', effect: { kind: 'payEach', amount: 50 } },
  { id: 'c16', text: '建筑贷款到期，收取 $150', effect: { kind: 'money', delta: 150 } }
]

// 命运（Community Chest）
var CHEST = [
  { id: 'd01', text: '前往起点，领取 $200', effect: { kind: 'advance', to: 0, salary: true } },
  { id: 'd02', text: '银行差错补足你 $200', effect: { kind: 'money', delta: 200 } },
  { id: 'd03', text: '医药费 $50', effect: { kind: 'money', delta: -50 } },
  { id: 'd04', text: '卖出股票得 $50', effect: { kind: 'money', delta: 50 } },
  { id: 'd05', text: '免狱卡一张，可保留备用', effect: { kind: 'freeJail' } },
  { id: 'd06', text: '入狱。不经过起点，不领取 $200', effect: { kind: 'goJail' } },
  { id: 'd07', text: '节日基金到期，收取 $100', effect: { kind: 'money', delta: 100 } },
  { id: 'd08', text: '所得税退税，收取 $20', effect: { kind: 'money', delta: 20 } },
  { id: 'd09', text: '今天是你的生日，每位对手付你 $10', effect: { kind: 'collectEach', amount: 10 } },
  { id: 'd10', text: '人寿保险到期，收取 $100', effect: { kind: 'money', delta: 100 } },
  { id: 'd11', text: '住院费 $100', effect: { kind: 'money', delta: -100 } },
  { id: 'd12', text: '学费 $50', effect: { kind: 'money', delta: -50 } },
  { id: 'd13', text: '咨询费收入 $25', effect: { kind: 'money', delta: 25 } },
  { id: 'd14', text: '街道整修：每栋房屋付 $40，每座旅馆付 $115', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
  { id: 'd15', text: '选美比赛亚军，收取 $10', effect: { kind: 'money', delta: 10 } },
  { id: 'd16', text: '继承遗产 $100', effect: { kind: 'money', delta: 100 } }
]

// 输入：卡组数组、rand（0~1，可注入）；输出：抽中的卡（含副本，避免调用方改写卡组）。
function draw(deck, rand) {
  var r = rand !== undefined ? rand : Math.random()
  var c = deck[Math.floor(r * deck.length) % deck.length]
  return { id: c.id, text: c.text, effect: c.effect }
}

module.exports = {
  CHANCE: CHANCE,
  CHEST: CHEST,
  draw: draw
}
