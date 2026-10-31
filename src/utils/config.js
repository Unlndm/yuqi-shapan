/**
 * utils/config.js — 全局配置与棋种数据源（唯一来源，主界面与对局页共用）。
 * 职责：DEFAULT_SETTINGS / GAME_TYPES / loadSettings / saveSetting / 对局记录读写。
 * 存储 key（storage.js 统一加 chess_ 前缀）：
 *   vibrate / vibrate_level / difficulty / theme / first_player / records / stats
 *
 * ── 阶段自检（第 1~2 批：manifest + utils） ─────────────────────────
 * 1. manifest：designWidth=192、deviceTypeList=["watch"]、minPlatformVersion=1100、
 *    三页面注册齐全；已移除不存在的 /common/logo.png 图标引用与无效 detail 页。
 * 2. storage 全部 Promise 化并兜底默认值，脏 JSON / 读失败不白屏。
 * 3. theme 只输出 Token，页面零裸色值；haptic 合并设置强度与场景等级。
 * 4. 遇到的问题：icon 缺失，暂不内联 base64 图标（FMP 优先），见 TODO.md。
 * 5. 下一阶段：core 层几何 / 渲染视图模型 / 通用博弈搜索。
 * ────────────────────────────────────────────────────────────────
 */

var storage = require('./storage.js')
var themeMod = require('./theme.js')
var economy = require('./economy.js')
var toastMod = require('./toast.js')

// 默认设置（storage 读失败时的兜底值）。
// v1.3.0 起「难度」不再是每局开局面板里的必选项；2026-10-31 起改为设置页的
// 「对手强度」偏好：默认 auto 按最近战绩匹配，也可手动锁 easy / normal / hard。
// 执黑执白仍每局随机，不作为设置项。
var DEFAULT_SETTINGS = {
  vibrate: true,             // 震动开关
  vibrateLevel: 'normal',    // 落子震动强度 weak | normal | strong
  theme: 'dark',             // 深色/浅色模式 dark | light
  palette: 'purple',         // MD3 配色风格 purple | green | blue | amber(解锁) | rose(解锁)
  fontSize: 'normal',        // 字体大小 normal | large | xlarge
  aiLevel: 'auto'            // 对手强度 auto | easy | normal | hard（2026-10-31 手动挡）
}

// 字体档位 → 正文/辅助文字设计像素。标题与按钮字号不参与缩放（已足够大，
// 且放大易溢出）；large ≈ +2px，xlarge ≈ +4px。
var FONT_SCALES = {
  normal: { md: 14, sm: 11 },
  large: { md: 16, sm: 13 },
  xlarge: { md: 18, sm: 15 }
}

// 输入：fontSize 档位、可选字号增量（px，手环10 宽胶囊为 3）；输出：{md, sm} 字号 Token。
// 增量只作用于内联绑定的字号（CSS 静态字号由各页的宽胶囊媒体查询单独放大）。
function fontTokens(size, bump) {
  var b = FONT_SCALES[size] || FONT_SCALES.normal
  var n = typeof bump === 'number' && isFinite(bump) ? bump : 0
  if (!n) return b
  return { md: b.md + n, sm: b.sm + n }
}

// 棋种清单。cell 为单格设计像素（28~32px 铁律，大棋盘相应调小以兼顾可点性），
// mode 为拓扑：cross = 落子在网格线交点；cell = 落子在格子中心。
// sizes：可选拳盘大小（label 供开局设置面板展示）；仅 1 项时对局页不显示大小选择。
// enabled=false 的棋种在主界面置灰展示，标注「需要更大屏幕」。
// 图标策略：全部改用原创 AI 生成的「徽标式」位图图标（96×96，自带深靛蓝底与琥珀点缀），
// 主界面按 40×40 显示（方屏 34×34）。不再依赖设备字体字形（旧版 '◐ ▦ ♞' 等符号在手表
// 字体缺字时会显示豆腐块），也不需要 CSS 自绘 ring/dots。禁用棋种用灰度版图标。
// intro：玩法介绍（帮助页展示）。
var GAME_TYPES = [
  {
    id: 'gomoku', cat: 'board', name: '五子棋', icon: '/common/img/ic_gomoku.png', mode: 'cross', enabled: true,
    intro: '黑白轮流落子，先连成五子者获胜。',
    short: '五子连珠',
    how: '点击交叉点落子，落子后可用控制抽屉悔棋或重开。',
    tip: '先做活三再冲四，不要只顾着堵对手。',
    sizes: [
      { cols: 7, rows: 7, cell: 30, label: '7×7' },
      { cols: 9, rows: 9, cell: 26, label: '9×9' },
      { cols: 11, rows: 11, cell: 22, label: '11×11' },
      { cols: 13, rows: 13, cell: 21, label: '13×13' }
    ]
  },
  {
    id: 'tictactoe', cat: 'board', name: '井字棋', icon: '/common/img/ic_tictactoe.png', mode: 'cell', enabled: true,
    intro: '三连成线即获胜，先手优势明显。',
    short: '三连成线',
    how: '点击空格落子，三枚连成一线即胜。',
    tip: '先占中心和角；井字棋按最优解走是不败的。',
    sizes: [{ cols: 3, rows: 3, cell: 54, label: '3×3' }]
  },
  {
    id: 'othello', cat: 'board', name: '黑白棋', icon: '/common/img/ic_othello.png', mode: 'cell', enabled: true,
    intro: '落子须夹住对方棋子并将其翻面，终局子多者胜；轮到你时，合法落点会以小圆点提示。',
    short: '夹翻对手',
    how: '点击高亮合法点落子，夹住的对方棋子会翻面。',
    tip: '优先占角和边，少给对手翻盘机会。',
    sizes: [
      { cols: 6, rows: 6, cell: 30, label: '6×6' },
      { cols: 8, rows: 8, cell: 26, label: '8×8' },
      { cols: 10, rows: 10, cell: 22, label: '10×10' }
    ]
  },
  {
    id: 'connect4', cat: 'board', name: '四子棋', icon: '/common/img/ic_connect4.png', mode: 'cell', enabled: true,
    intro: '棋子受重力下沉，先连成四子者获胜。',
    short: '四子连珠',
    how: '点击列顶部落子，棋子受重力下落到最低空位。',
    tip: '先抢中间列，制造两个同时成立的威胁。',
    sizes: [
      { cols: 6, rows: 5, cell: 32, label: '6×5' },
      { cols: 7, rows: 6, cell: 28, label: '7×6' },
      { cols: 8, rows: 7, cell: 26, label: '8×7' },
      { cols: 9, rows: 8, cell: 24, label: '9×8' }
    ]
  },
  {
    id: 'chess', cat: 'board', name: '国际象棋', icon: '/common/img/ic_chess.png', mode: 'cell', enabled: true,
    intro: '将死对方王者胜；兵到底线弹窗选升后/车/象/马；点击目标格即走子（多子可达同格时自动选最合适的一枚）。完整支持王车易位、吃过路兵、兵升变、将死/困毙、五十回合与子力不足判和，以及三次重复局面判和。',
    short: '将死为王',
    how: '点己方棋子看合法落点，再点目标格；兵到底线会弹升变选择。',
    tip: '开局先出轻子、尽快易位，不要贪吃边兵。',
    sizes: [{ cols: 8, rows: 8, cell: 26, label: '8×8' }]
  },
  {
    id: 'go', cat: 'board', name: '围棋', icon: '/common/img/ic_go.png', mode: 'cross', enabled: true,
    intro: '围住无气的对方棋子即可提掉；终局按子数+围空数子（白贴6.5目）。可点「停一手」，双方连续停一手即终局。',
    short: '围地成空',
    how: '点击交叉点落子；停一手在控制抽屉里。',
    tip: '先围空再缠斗，注意征子、眼位与劫。',
    sizes: [
      { cols: 7, rows: 7, cell: 30, label: '7×7' },
      { cols: 9, rows: 9, cell: 26, label: '9×9' },
      { cols: 13, rows: 13, cell: 21, label: '13×13' },
      { cols: 19, rows: 19, cell: 21, label: '19×19' }
    ]
  },
  {
    id: 'aeroplane', cat: 'party', name: '飞行棋', icon: '/common/img/ic_aeroplane.png', mode: 'cell', enabled: true,
    page: 'pages/aeroplane',
    intro: '飞行棋：外圈 28 格、每方 4 架飞机。掷 6 才能起飞并获连投，落点撞到对方飞机把它送回机库（撞机也连投），落上「飞」格前跳 4 格，进冲刺道需精确点数到家。四机先全部到家者获胜。支持人机对战与双人同机轮流。',
    short: '展翅飞行',
    how: '掷骰后点飞机选择行动；掷 6 才能起飞，撞机回机库。',
    tip: '冲刺道需要精确点数，别把飞机停在对手射程内。',
    sizes: [{ cols: 28, rows: 1, cell: 30, label: '28 格' }]
  },
  {
    id: 'monopoly', cat: 'party', name: '大富翁', icon: '/common/img/ic_monopoly.png', mode: 'cell', enabled: true,
    page: 'pages/monopoly',
    intro: '大富翁：24 格盘面、12 块地产分 6 个色组 + 4 条铁路 + 2 家公用事业（价格与租金均取自官方标准盘）。单骰轮流投掷（监狱掷出 6 才能出狱，连续三次未掷出则缴罚金后行动）；买地收租、凑齐整组基础租金加倍；成套后可均匀盖房、满 5 级为旅馆。可抵押换钱（赎回多付 10% 利息）、放弃购买即进入拍卖、资不抵债可卖房抵押筹钱，仍不足则破产清算。支持人机对战与双人同机轮流。',
    short: '买地收租',
    how: '掷骰移动，按弹窗决定买地、拍卖、盖房或抵押。',
    tip: '先凑成套，成套后均匀盖房收益最高。',
    sizes: [{ cols: 24, rows: 1, cell: 40, label: '24 格' }]
  },
  {
    id: 'g2048', cat: 'puzzle', name: '2048', icon: '/common/img/ic_g2048.png', mode: 'cell', enabled: true,
    page: 'pages/g2048',
    intro: '2048：4×4 棋盘上的单人拼图。用方向键整体推格，相同的两块数字合并翻倍；每次有效移动后随机新生一块，合成 2048 即达成（仍可继续冲高分）。无路可推时终局。',
    short: '合数翻倍',
    how: '用方向键整体推格，相同数字相撞合并翻倍。',
    tip: '把最大数固定在一角，沿一条边排成递增序列。',
    sizes: [{ cols: 4, rows: 4, cell: 41, label: '4×4' }]
  },
  {
    id: 'slide', cat: 'puzzle', name: '数字华容道', icon: '/common/img/ic_slide.png', mode: 'cell', enabled: true,
    page: 'pages/slide',
    intro: '数字华容道：3×3 九宫格，八个数字块 + 一个空位。点「与空位同行或同列且紧邻」的块就能把它挪进空位，不自绘滑动。把 1~8 顺序排好（空位落在右下角）即通关；步数越少越好，最少步数会被记住。',
    short: '挪格归位',
    how: '点与空位紧邻的块，把它挪进空位。',
    tip: '先归位第一行，再收第二行，最后处理右下 2×2。',
    sizes: [{ cols: 3, rows: 3, cell: 54, label: '3×3' }]
  },
  {
    id: 'minesweeper', cat: 'solo', name: '扫雷', icon: '/common/img/ic_minesweeper.png', mode: 'cell', enabled: true,
    page: 'pages/minesweeper',
    intro: '扫雷：单人推理。点开格子，格内数字表示它周围 8 格里的雷数；底部「点开 / 插旗」键切换操作模式，插旗标出你判断的雷。第一次点开的格子一定安全（首点后才布雷），翻开空白格会自动连锁展开。挖开全部非雷格即获胜，用时越短越好（各档分别记纪录）。',
    short: '推理排雷',
    how: '切换「点开 / 插旗」模式，点开安全格；首点必安全。',
    tip: '用数字反推，1-2-1、1-2-2-1 是经典定式。',
    sizes: [{ cols: 6, rows: 6, cell: 26, label: '6×6' }]
  },
  {
    id: 'draughts', cat: 'board', name: '国际跳棋', icon: '/common/img/ic_draughts.png', mode: 'cell', enabled: true,
    page: 'pages/draughts',
    intro: '国际跳棋：8×8 棋盘、每方 12 兵，兵只能斜向前进。存在吃子着法时强制吃子，连吃必须走完整条链；兵到达对方底线立即升王，王可双向移动与吃子。一方无子或无合法着判负，50 回合无吃子判和。',
    short: '强制吃子',
    how: '点兵再点目标格；有吃子时必须吃，连吃要走完整条链。',
    tip: '保持后排完整，逼对手换子后再升王。',
    sizes: [{ cols: 8, rows: 8, cell: 22, label: '8×8' }]
  },
  {
    id: 'jungle', cat: 'board', name: '斗兽棋', icon: '/common/img/ic_jungle.png', mode: 'cell', enabled: true,
    page: 'pages/jungle',
    intro: '斗兽棋：7×9 棋盘、八兽按鼠<猫<狗<狼<豹<虎<狮<象分级，高等级吃低等级；鼠可吃象、象不能吃鼠。只有鼠能进河流，虎狮可沿直线跳过河流（路径中有水中鼠则不能跳）。站进对方陷阱时防御等级视为 0；进入对方兽穴立即获胜。无子判负，50 回合无吃子判和。',
    short: '鼠象斗智',
    how: '点兽再点目标格；鼠可入水，虎狮可跳河。',
    tip: '守住兽穴，用陷阱反吃对方大子。',
    sizes: [{ cols: 7, rows: 9, cell: 23, label: '7×9' }]
  },
  {
    id: 'sokoban', cat: 'puzzle', name: '推箱子', icon: '/common/img/ic_sokoban.png', mode: 'cell', enabled: true,
    page: 'pages/sokoban',
    intro: '推箱子：内置 20 关，方向键移动人物，走到箱子旁即可推动。支持撤销（步数与推动数同步回退）与重置本关；把所有箱子推到目标点即过关，关卡进度与每关最佳步数会自动保存。',
    short: '推箱入位',
    how: '方向键移动和推箱，撤销 / 重置在控制区。',
    tip: '不要把箱子推进墙角；尽量沿墙推进。',
    sizes: [{ cols: 10, rows: 10, cell: 17, label: '20 关' }]
  },
  {
    id: 'sudoku', cat: 'puzzle', name: '数独', icon: '/common/img/ic_sudoku.png', mode: 'cell', enabled: true,
    page: 'pages/sudoku',
    intro: '数独：9×9 盘面，内置 90 道唯一解题目（简单 / 普通 / 困难各 30）。选格后用键盘输入 1~9，冲突数字会标红并计错误。支持笔记、每局 3 次提示、撤销、计时与自动存档，填满且无冲突即通关。',
    short: '数理推演',
    how: '选格后用键盘输入 1-9，笔记记候选数。',
    tip: '先找唯一候选，再盯行、列、宫的交叉。',
    sizes: [{ cols: 9, rows: 9, cell: 18, label: '9×9' }]
  },
  {
    id: 'werewolf', cat: 'party', name: '狼人杀', icon: '/common/img/ic_werewolf.png', mode: 'cell', enabled: true,
    page: 'pages/werewolf',
    intro: '狼人杀：可选 9 人（3 狼 / 预言家 / 女巫 / 猎人 / 3 村民）或 6 人（2 狼 / 预言家 / 女巫 / 2 村民）局。夜晚狼人刀人、预言家查验、女巫用药；白天发言投票放逐，猎人出局可开枪。好人放逐全部狼人获胜，狼人杀光好人（或人数持平时）获胜。',
    short: '月下推理',
    how: '按身份在夜间行动，白天发言后投票放逐。',
    tip: '预言家别过早跳，女巫的药留给关键轮次。',
    sizes: [{ cols: 3, rows: 3, cell: 30, label: '9/6 人' }]
  },
  {
    id: 'snake', cat: 'party', name: '蛇棋', icon: '/common/img/ic_snake.png', mode: 'cell', enabled: true,
    page: 'pages/snake',
    intro: '蛇棋：100 格蛇形跑道，掷骰前进。踩到梯子向上跳、踩到蛇头滑下来；必须恰好掷到进入终点的点数，超出则原地不动。支持人机对战与双人同机轮流，先到第 100 格者获胜。',
    short: '攀梯避蛇',
    how: '掷骰前进，踩梯子上升、踩蛇头下滑。',
    tip: '接近 100 时算好点数，超出会原地不动。',
    sizes: [{ cols: 10, rows: 10, cell: 17, label: '100 格' }]
  },
  {
    id: 'maze', cat: 'solo', name: '迷宫探险', icon: '/common/img/ic_maze.png', mode: 'cell', enabled: true,
    page: 'pages/maze',
    intro: '迷宫探险：内置 20 关随机迷宫，方向键逐格移动。收集宝石与钥匙开启出口，踩到陷阱扣血（初始 3 点），药水回血；走到出口即过关。支持迷雾视野与进度自动存档。',
    short: '寻宝闯迷宫',
    how: '方向键逐格移动，收钥匙开出口，宝石计分。',
    tip: '先探钥匙再收宝石，血少时绕开陷阱。',
    sizes: [{ cols: 11, rows: 11, cell: 16, label: '20 关' }]
  },
  {
    id: 'spotdiff', cat: 'solo', name: '找不同', icon: '/common/img/ic_spotdiff.png', mode: 'cell', enabled: true,
    page: 'pages/spotdiff',
    intro: '找不同：内置 40 关，上下两幅图共 5 处不同。点出全部差异即过关，限时内完成并按用时评星；点错会扣时间，可用提示标出未找到的位置。',
    short: '眼力寻异',
    how: '点两图差异处，点错扣时间；同一处双击可放大。',
    tip: '按区域扫视，先找颜色和轮廓突变。',
    sizes: [{ cols: 2, rows: 2, cell: 40, label: '40 关' }]
  }
]

// 对战模式（开局设置面板选择，玩家上次选择持久化于 chess_mode）
var MODES = [
  { v: 'ai', n: '人机对战' },
  { v: 'pvp', n: '双人对战' }
]

// 输入：无；输出：棋种对象或 null（用于对局页参数校验）。
function getGame(id) {
  for (var i = 0; i < GAME_TYPES.length; i++) {
    if (GAME_TYPES[i].id === id) return GAME_TYPES[i]
  }
  return null
}

// 输入：无；输出：Promise<settings>，逐项读取并与 DEFAULT_SETTINGS 合并。
// 同时把结果缓存成同步快照（cachedSettings）：页面首帧/重复赋值守卫要用到，
// 避免「异步读回来再赋值 → 整页重渲染」造成的首帧闪动与切换卡顿（见 index.ux）。
var lastSettings = null

function loadSettings() {
  return Promise.all([
    storage.getItem('vibrate', DEFAULT_SETTINGS.vibrate),
    storage.getItem('vibrate_level', DEFAULT_SETTINGS.vibrateLevel),
    storage.getItem('theme', DEFAULT_SETTINGS.theme),
    storage.getItem('palette', DEFAULT_SETTINGS.palette),
    storage.getItem('font_size', DEFAULT_SETTINGS.fontSize),
    economy.loadSkins(),
    storage.getItem('ai_level', DEFAULT_SETTINGS.aiLevel)
  ]).then(function (vals) {
    var s = {
      vibrate: vals[0] !== false,
      vibrateLevel: RANK_GUARD('weak normal strong', vals[1]) ? vals[1] : DEFAULT_SETTINGS.vibrateLevel,
      theme: vals[2] === 'light' ? 'light' : 'dark',
      palette: RANK_GUARD('purple green blue amber rose', vals[3]) ? vals[3] : DEFAULT_SETTINGS.palette,
      fontSize: RANK_GUARD('normal large xlarge', vals[4]) ? vals[4] : DEFAULT_SETTINGS.fontSize,
      aiLevel: RANK_GUARD('auto easy normal hard', vals[6]) ? vals[6] : DEFAULT_SETTINGS.aiLevel
    }
    // 记住本次配色与已装备皮肤：页面 data 用 theme.current() 同步取值，
    // 避免首帧画默认紫/深、默认素材造成闪屏。
    themeMod.rememberSkins(vals[5] && vals[5].equipped)
    themeMod.remember(s.palette, s.theme)
    lastSettings = s
    return s
  })
}

// 输入：页面实例、screen.getLayout() 结果；输出：无。
// 手环10（宽胶囊）用 layout.fontBump 放大内联字号；其余设备为 0，行为不变。
// 在布局回调里调用即可，先于/晚于 loadSettings 都能收敛到正确字号（lastSettings 拿到后 applyTheme 也会用 fontBump）。
function applyFontBump(that, layout) {
  if (!that) return
  that.fontBump = layout && typeof layout.fontBump === 'number' ? layout.fontBump : 0
  that.fz = fontTokens(lastSettings ? lastSettings.fontSize : 'normal', that.fontBump)
}

// 输入：无；输出：最近一次 loadSettings 的同步快照（未读过则为 null）。
function cachedSettings() {
  return lastSettings
}

// 输入：settings；输出：配色/深浅/字号/皮肤的签名串（用于「变了才赋值」判重）。
// 皮肤签名来自 theme 的模块缓存（loadSettings 已先 rememberSkins），
// 因此换装后即使配色未变，applyTheme 也会返回 true 并重绑素材。
function themeKey(s) {
  return s.palette + '/' + s.theme + '/' + s.fontSize + '/' + themeMod.skinKey()
}

// 输入：页面实例、settings；输出：true = 本次真的换了主题（已赋值），false = 无变化（什么都没碰）。
// ⚠️ 为什么必须判重（2026-10-23 玩家反馈「黑白夜模式一闪一闪」）：
//   ① 页面 onShow/onInit 里无条件 `that.t = …` 会让运行时重绑所有颜色绑定；
//   ② 更致命的是 `<image src>` 被重新赋值（哪怕是同一个路径）——旧图卸载、新图重新解码，
//      中间那一帧就是「白底/空白」，体感就是闪。
//   ③ 三个值一次赋完，避免「背景先换、文字后换」的中间态帧。
function applyTheme(that, s) {
  var key = themeKey(s)
  if (that && that.themeKey === key) return false
  if (that) that.themeKey = key
  if (!that) return false
  that.t = themeMod.get(s.palette, s.theme)
  // 整页底色已并入 t.pageBg（2026-10-30 去掉整页背景位图，省 368KB/页解码内存）
  that.fz = fontTokens(s.fontSize, that.fontBump || 0)
  // 棋盘底材只在页面声明了该字段时更新（对局页）；皮肤/深浅变了要同步换图，
  // 缺失的页面（骰子页/内容页）不新增无关绑定。
  // 同路径不重复赋值：仅字号变化时也要避免 <image> 重新解码造成的空白帧。
  if (that.boardMatSrc !== undefined) {
    var mat = themeMod.currentBoardBg()
    if (that.boardMatSrc !== mat) that.boardMatSrc = mat
  }
  return true
}

// 输入：页面实例；输出：true = 已用同步快照把首帧配色定下来。
// onInit 里最先调用：有快照时（冷启动读完一次设置之后的所有页面）首帧就是对的，
// 不会「先画默认紫/深、异步回来再闪成用户主题」。
function seedTheme(that) {
  if (!lastSettings) return false
  return applyTheme(that, lastSettings)
}

// 输入：settings；输出：无。把「当前生效值」写进同步快照并 remember 配色。
// ⚠️ 设置页改完必须调用：theme 的 pageBg 依赖 remember 的配色/深浅/皮肤，
// 不 remember 的话底色还指着旧配色（换主题后文字变了、底色没变）。
// 同时刷新快照，下一页 seedTheme 才能在第一帧就用新主题。
function rememberSettings(s) {
  lastSettings = s
  themeMod.remember(s.palette, s.theme)
}

// 内部：枚举合法性校验，防止 storage 脏值穿透。
function RANK_GUARD(list, v) {
  return list.indexOf(v) >= 0
}

// 输入：key（去掉前缀的设置名）、value；输出：Promise<boolean>。每项改动立即落盘。
function saveSetting(key, value) {
  return storage.setItem(key, value)
}

// 输入：key（不带前缀）、defVal；输出：Promise<值>。开局偏好（模式/棋盘大小）读取。
function getPref(key, defVal) {
  return storage.getItem(key, defVal)
}

// 输入：key；输出：Promise<boolean>。对局快照等临时数据清理。
function clearPref(key) {
  return storage.removeItem(key)
}

// 输入：gameId、result（人机 'win'|'lose'|'draw'，双人 'black'|'white'|'draw'，
//       单人通关 'win' 且 mode='solo'）、mode；输出：Promise<最新列表>。
// 记录上限 200 条（战绩大厅统计基于此），超出丢弃最旧。
function recordResult(gameId, result, mode) {
  // 棋币与赛季进度跟战绩同步结算（2026-10-24）：对局页只调用本函数，
  // 经济结算就一定会发生，不会因为新增玩法漏接线。失败静默（storage 兜底）。
  // 新完成任务时提示一次：玩家不一定每局都会主动进赛季页，避免奖励被遗忘。
  economy.recordMatch(gameId, result, mode).then(function (r) {
    if (r && r.tasks && r.tasks.length) toastMod.toast('赛季任务已可领取', 1600)
  }, function () {})
  return storage.getItem('records', []).then(function (list) {
    if (!list || !list.length) list = []
    list.push({ game: gameId, mode: mode || 'ai', result: result, ts: Date.now() })
    while (list.length > 200) list.shift()
    return storage.setItem('records', list).then(function () { return list })
  })
}

// 输入：records（时间正序）；输出：{cur, best} 当前连胜与最长连胜（玩家视角，
// 人机/双人；负/和中断连胜）。
// mode='solo'（推箱子/数独通关）不属于对战，跳过不计入连胜，避免单人通关延长对战胜场。
function streakOf(records) {
  var list = records || []
  var cur = 0
  var best = 0
  var run = 0
  for (var i = 0; i < list.length; i++) {
    if (list[i].mode === 'solo') continue
    if (list[i].result === 'win') {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  for (var j = list.length - 1; j >= 0; j--) {
    if (list[j].mode === 'solo') continue
    if (list[j].result === 'win') cur++
    else break
  }
  return { cur: cur, best: best }
}

// ── 战绩匹配与统计（纯函数，node 可测） ────────────────────────────

// 匹配机制（spec：去掉难度选择，按战绩随机匹配对手强度）：
//   取该棋种最近 5 局人机战绩，胜率分 s = (胜 + 0.5×和) / 局数；
//   s ≥ 0.65 → hard，s ≤ 0.35 → easy，其余 → normal；无战绩 → normal。
//   再加随机浮动：15% 概率上浮一档、15% 概率下浮一档（对手强度有变化感，
//   且整体略偏向挑战——赢多了必然升档）。
// 输入：recent（最近的 ai 对局结果数组 'win'|'lose'|'draw'，旧→新或新→旧均可）、
//       rand（0~1 随机数，测试注入用）；输出：'easy'|'normal'|'hard'。
function matchCore(recent, rand) {
  var tier
  if (!recent || !recent.length) {
    tier = 'normal'
  } else {
    var s = 0
    for (var k = 0; k < recent.length; k++) {
      s += recent[k] === 'win' ? 1 : (recent[k] === 'draw' ? 0.5 : 0)
    }
    s /= recent.length
    tier = s >= 0.65 ? 'hard' : (s <= 0.35 ? 'easy' : 'normal')
  }
  var order = ['easy', 'normal', 'hard']
  var idx = order.indexOf(tier)
  if (rand < 0.15 && idx < 2) idx++
  else if (rand > 0.85 && idx > 0) idx--
  return order[idx]
}

// 输入：偏好强度（auto/easy/normal/hard）、最近战绩、随机数；
// 输出：'easy'|'normal'|'hard'。固定挡直接采用，auto 才走战绩匹配。
function chooseDifficulty(pref, recent, rand) {
  if (pref === 'easy' || pref === 'normal' || pref === 'hard') return pref
  return matchCore(recent, rand)
}

// 输入：gameId；输出：Promise<'easy'|'normal'|'hard'>。
// 设置页选了固定对手强度时直接返回；auto 才读最近 5 局人机战绩。
function matchDifficulty(gameId) {
  var pref = lastSettings ? lastSettings.aiLevel : 'auto'
  if (pref === 'easy' || pref === 'normal' || pref === 'hard') return Promise.resolve(pref)
  return storage.getItem('records', []).then(function (list) {
    var recent = []
    var arr = list || []
    for (var i = arr.length - 1; i >= 0 && recent.length < 5; i--) {
      if (arr[i].game === gameId && arr[i].mode !== 'pvp' && arr[i].mode !== 'solo') recent.push(arr[i].result)
    }
    return chooseDifficulty(pref, recent, Math.random())
  })
}

// 输入：records 数组 [{game, mode, result, ts}]；输出：聚合统计（均为玩家视角）：
//   total（全部记录，含单人通关）/ winCount / loseCount / drawCount /
//   aiCount / aiWin / aiLose / aiDraw / pvpCount /
//   soloCount / soloWin（mode='solo' 的通关数，不计入任何胜负/对战计数）/
//   perGame[gameId] = { count, aiWin, aiLose, aiDraw, pvpWin, pvpLose, pvpDraw,
//   pvpBlack, pvpWhite(旧版黑/白记录，仅计局数不参与胜负), soloCount, soloWin }
// 注：v1.3.1 起双人对局也按本机玩家视角记录 win/lose/draw；旧版 'black'/'white'
// 无法归属到玩家，只计入总局数。
// 单人玩法（推箱子/数独）只记 'win'+'solo'：既不算人机/双人场次，也不算玩家胜场；
// 战绩大厅的胜率分母固定为 aiCount + pvpCount（加单人记录不会改变分母）。
function aggregateRecords(records) {
  var st = streakOf(records)
  var s = {
    total: 0, winCount: 0, loseCount: 0, drawCount: 0,
    aiCount: 0, aiWin: 0, aiLose: 0, aiDraw: 0, pvpCount: 0,
    soloCount: 0, soloWin: 0,
    streakCur: st.cur, streakBest: st.best, perGame: {}
  }
  var list = records || []
  for (var i = 0; i < list.length; i++) {
    var r = list[i]
    s.total++
    if (!s.perGame[r.game]) {
      s.perGame[r.game] = {
        count: 0, aiWin: 0, aiLose: 0, aiDraw: 0,
        pvpWin: 0, pvpLose: 0, pvpDraw: 0, pvpBlack: 0, pvpWhite: 0,
        soloCount: 0, soloWin: 0
      }
    }
    var g = s.perGame[r.game]
    g.count++
    if (r.mode === 'solo') {
      s.soloCount++
      if (r.result === 'win') { s.soloWin++; g.soloWin++ }
      g.soloCount++
      continue
    }
    if (r.mode === 'pvp') {
      s.pvpCount++
      if (r.result === 'win') { s.winCount++; g.pvpWin++ }
      else if (r.result === 'lose') { s.loseCount++; g.pvpLose++ }
      else if (r.result === 'draw') { s.drawCount++; g.pvpDraw++ }
      else if (r.result === 'black') g.pvpBlack++
      else if (r.result === 'white') g.pvpWhite++
    } else {
      s.aiCount++
      if (r.result === 'win') { s.winCount++; s.aiWin++; g.aiWin++ }
      else if (r.result === 'lose') { s.loseCount++; s.aiLose++; g.aiLose++ }
      else { s.drawCount++; s.aiDraw++; g.aiDraw++ }
    }
  }
  return s
}

// 输入：无；输出：Promise<boolean>。清空对局记录（设置页二次确认后调用）。
function clearRecords() {
  return storage.removeItem('records')
}

module.exports = {
  DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  GAME_TYPES: GAME_TYPES,
  MODES: MODES,
  getGame: getGame,
  loadSettings: loadSettings,
  cachedSettings: cachedSettings,
  applyFontBump: applyFontBump,
  themeKey: themeKey,
  applyTheme: applyTheme,
  seedTheme: seedTheme,
  rememberSettings: rememberSettings,
  saveSetting: saveSetting,
  getPref: getPref,
  clearPref: clearPref,
  recordResult: recordResult,
  streakOf: streakOf,
  fontTokens: fontTokens,
  matchCore: matchCore,
  chooseDifficulty: chooseDifficulty,
  matchDifficulty: matchDifficulty,
  aggregateRecords: aggregateRecords,
  clearRecords: clearRecords
}
