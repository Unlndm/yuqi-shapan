# scripts/check-all.py — 全量特性审计：解码 unicode 转义后逐页断言所有已承诺特性
import glob
import os
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.0.0.rpk')


def dec(n):
    s = z.read(n).decode('utf-8', 'ignore')
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)


FAILED = []


# 共享模块（config/theme/economy/skin-assets）在 2026-10-30 起挂到 app.ux 的 global.YQ，
# 相关文案与素材路径会打进 app.js 而不是各页面包 —— 断言允许「页面包或 app.js」命中。
APP = dec('app.js')


def expect(page, kws):
    s = dec('pages/%s/%s.js' % (page, page))
    for kw in kws:
        if kw not in s and kw not in APP:
            FAILED.append((page, kw))


# 主界面
expect('index', ['card-sub', 'tabbar', 'openStats', 'openSettings',
                 'season-bar', 'openSeason', '棋币', 'openCampaign', '赛季', '闯关',
                 'shape:rect', '五子连珠', '买地收租', '合数翻倍', '挪格归位', '推理排雷',
                 '强制吃子', '鼠象斗智', '推箱入位', '数理推演', '月下推理', '攀梯避蛇',
                 '寻宝闯迷宫', '眼力寻异'])
# 图片化改造（原创 AI 素材）：整页背景纹样 + 棋种徽标位图 + 标题品牌徽标
# 背景/棋盘/骰面路径在 skin-assets.js 里以 BASE + '文件名' 拼接，按文件名断言。
expect('index', ['pageBg', 'card-icon', 'icon-dim', 'toggleCardMode', 'home_cards', 'cardMode',
                 'title-toggle', 'applyCardMode', '/common/img/ic_gomoku.png',
                 '/common/img/ic_g2048.png', '/common/img/ic_slide.png',
                 '/common/img/ic_minesweeper.png',
                 '/common/img/ic_draughts.png', '/common/img/ic_jungle.png',
                 '/common/img/ic_sokoban.png', '/common/img/ic_sudoku.png',
                 '/common/img/ic_werewolf.png', '/common/img/ic_snake.png',
                 '/common/img/ic_maze.png', '/common/img/ic_spotdiff.png',
                 '/common/img/brand.png',
                 'pageBg',
                 # 2026-10-30 UI 重构：首页四组分类 + 悬浮 tab 坞 + 赛季主卡
                 'group-head', 'group-body', 'card-chev', 'season-dot', 'title-sub',
                 'buildGroups', 'cardBg', 'hairline'])
# 对局页（棋盘平移＝原生 scroll：scrollX/bounces/stageW；落子＝tap-layer 的 click）
expect('game', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开', '退出对局',
                'saveSnapshot', 'restoreFrom', 'continueGame', 'zoomIn', 'zoomOut',
                'makeGeo', 'showMenu', 'cancelRestart', '重开对局？', 'lastUndoTime', '将军',
                'scrollX', 'bounces', 'stageW', 'tap-layer', 'onBoardClick', 'scrollTo',
                'menu-fab', 'openMenu',
                'PILL_CLEAR_CAPSULE', 'pillScreen',
                'pageBg',
                'board-mat', 'board_dark.png', 'board_light.png'])
# 设置
expect('settings', ['seg-item', 'pick', 'toggleVibrate', 'onClear', 'topbar',
                    'back-fab', 'goBack', 'openHelp', 'openAbout', 'fontTokens',
                    'seg-grid', 'seg-chip', '琥珀', '绯红', 'unlockPalette', 'confirmUnlock',
                    # 2026-10-31 对手强度手动挡
                    '对手强度', 'ai_level', '自动', '简单', '普通', '困难'])
# 战绩
expect('stats', ['streakCur', 'streakBest', 'timeLabel', 'aggregateRecords',
                 'back-fab', 'goBack'])
# 赛季 / 棋币 / 商店（主线：任务领取 + 道具购买）
expect('season', ['top-coins', 'taskRowsOf', 'claimTask', 'askBuy', 'confirmBuy',
                  '赛季任务', '赛季商店', '棋币', 'back-fab', 'goBack', 'pageBg'])
# 帮助（2026-10-23 修正为与实现一致：侧滑返回＝呼出控制抽屉，不是直接弹离开确认）
expect('help', ['back-fab', '通用操作', '对战模式', '侧滑返回会先呼出控制抽屉',
                '24 格盘面', '28 格外圈', '规则简化说明', '赛季与棋币'])
# 关于
expect('about', ['back-fab', 'hero-text', 'getInfo', '弦起悲歌赴寒江', '914824845'])
# 大富翁（24 格盘面：色带格 + 金额板在环内 + 单骰热区 + 完整规则动作；人机/双人）
expect('monopoly', ['onBackPress', '离开对局？', 'celebrate',
                    'saveSnapshot', 'continueGame', 'showMenu',
                    'scrollX', 'bounces', 'stageW', 'centerScene',
                    'pageBg',
                    'cell-band', 'money-plate', 'dice-hit', 'dice-disc', 'ring-status',
                    'pvp', 'toast', '加盖', '拍卖', '抵押', '破产', 'reRoll',
                    'menu-fab', 'openMenu', 'shape:pill-shaped',
                    # 赛季商店免狱卡：资产面板里的「免狱卡出狱」
                    'shopJailCard', 'useJailCardItem', '免狱卡',
                    # 竞拍全程无消息气泡：实时叫价走环内状态行（玩家反馈：气泡浪费时间）
                    # （事件 kind 的契约由 tests/rules-monopoly.js 断言，这里只看页面侧的可见文案）
                    '拍卖 $',
                    'dice_',
                    '/common/img/pawn_p0.png', '/common/img/pawn_p1.png',
                    '/common/img/estate_1.png', '/common/img/estate_2.png', '/common/img/estate_3.png'])
# 飞行棋（标准 52 格：四色色区 + 冲刺道 + 金额板在环内 + 掷骰确认；人机/双人）
expect('aeroplane', ['onBackPress', '离开对局？', '起飞', 'celebrate',
                     'saveSnapshot', 'continueGame', 'showMenu',
                     'scrollX', 'bounces', 'stageW', 'centerScene',
                     'pageBg',
                     'home-cell', 'money-plate', 'dice-hit', 'dice-disc', 'ring-status',
                     'pvp', 'toast', '选择行动', '冲刺道',
                     'menu-fab', 'openMenu', 'shape:pill-shaped',
                     # 赛季商店重掷券：掷骰后弹窗
                     'doReroll', 'confirmMove', '重掷券',
                     'dice_',
                     '/common/img/plane_p0.png', '/common/img/plane_p1.png'])
# 2048（单人拼图：16 个固定节点不用 for、十字/一行方向键、分数与最高分持久化）
expect('g2048', ['onBackPress', 'moveUp', 'moveDown', 'moveLeft', 'moveRight',
                 'newGame', 'continuePlay', 'syncTiles', 'tileLook', 'sameTile',
                 'g2048_best', '达成 ', '无路可走', 'isPill',
                 'szbtn', 'sizeLabel', 'tapSize', 'confirmSize', 'winTile',
                 # 统一顶栏：圆形返回键 + 两行状态块（尺寸取自 utils/metrics.js 的 nav）
                 'nav-fab', 'hud-stat', 'navSize', 'navFont', 'navR',
                 'pageBg'])
# 数字华容道（单人滑块：9 个固定块不用 for、点相邻块挪动、最少步数持久化）
expect('slide', ['onBackPress', 'tap0', 'tap8', 'onTap', 'newGame', 'syncTiles',
                 'writeTile', 'sameTile', 'slide_best', '拼好了', 'isPill',
                 'szbtn', 'sizeLabel', 'tapSize', 'tap15', 'slide_best_4',
                 'nav-fab', 'hud-stat', 'navSize',
                 'pageBg'])
# 扫雷（单人推理：for 循环格 + 棋盘热区反推格号 + 点开/插旗模式键 + 首点安全 + 各档记时）
expect('minesweeper', ['onBackPress', 'tap-layer', 'onBoardTap', 'hitCell', 'measureTouch',
                       'toggleMode', 'switchTier', 'newGame', 'doDig', 'doFlag',
                       'minesweeper_best_', '扫清雷区', '踩到雷了', '旗', '雷', 'isPill',
                       'clientKx', 'getBoundingClientRect',
                       'nav-fab', 'hud-stat', 'navSize',
                       'pageBg'])
# 国际跳棋（8×8：强制吃子 / 连吃 / 升王 / 悔棋 / 存档 / 挑战种子）
expect('draughts', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开',
                    'saveSnapshot', 'continueGame', 'showMenu', 'menu-fab', 'openMenu',
                    'scrollX', 'bounces', 'stageW', 'tap-layer', 'onBoardClick',
                    'mustCapture', 'history', 'restoreFrom', 'challenge', 'dailyRng',
                    'completeDaily', 'pageBg'])
# 斗兽棋（7×9：鼠象 / 陷阱 / 河流 / 兽穴 / 虎狮跳河 / 存档 / 挑战种子）
expect('jungle', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开',
                  'saveSnapshot', 'continueGame', 'showMenu', 'menu-fab', 'openMenu',
                  'scrollX', 'bounces', 'stageW', 'tap-layer', 'onBoardClick',
                  'trapOwner', 'inWater', 'denOwner', 'restoreFrom', 'challenge',
                  'dailyRng', 'completeDaily', 'pageBg'])
# 推箱子（20 关：方向键 / 撤销 / 重置 / 过关解锁 / 挑战种子）
expect('sokoban', ['onBackPress', 'moveUp', 'moveDown', 'moveLeft', 'moveRight',
                   'undo', 'resetLevel', 'nextLevel', 'loadLevel', 'finishWin',
                   'sokoban_unlocked', 'sokoban_best', 'sokoban_level',
                   'challenge', 'dailyRng', 'completeDaily', 'nav-fab', 'hud-stat',
                   'pageBg'])
# 数独（9×9：笔记 / 提示 / 撤销 / 计时 / 错误数 / 自动存档 / 挑战种子）
expect('sudoku', ['onBackPress', 'onBoardTap', 'toggleNotes', 'useHint', 'undoMove',
                  'saveGame', 'restore', 'newPuzzle', 'finishWin', 'MAX_HINTS',
                  'sudoku_difficulty', 'save_sudoku', 'challenge', 'dailyRng',
                  'completeDaily', 'nav-fab', 'hud-stat', 'pageBg'])
# 闯关（60 关 6 章：章节列表 / 星级圆点 / 锁 / 首通奖励 / 结算钩子）
expect('campaign', ['back-fab', 'goBack', 'chapterRows', 'openLevel', 'campaignId',
                    'campaignDiff', 'campaignMode', 'campaignLevel', 'subLevelOf',
                    '总星数', '通关关卡', '完成度', '未解锁', '已通关',
                    'pageBg', 'ui-page-in'])
# 狼人杀（9/6 人：身份揭示 / 夜昼 / AI 发言 / 投票 / 猎人 / 终局 / 挑战种子）
expect('werewolf', ['onBackPress', 'startGame', 'syncEnd', 'visibleInfo', 'pickTarget',
                    'doAct', 'closeRole', 'challenge', 'dailyRng', 'completeDaily',
                    'campaignId', '9 人标准局', '6 人精简局', '预言家', '女巫', '猎人',
                    'ww-hud-in', 'pageBg'])
# 蛇棋（100 格：蛇形编号 / 梯子与蛇 / 恰好到终点 / 人机与双人 / 骰子动画）
expect('snake', ['onBackPress', 'tapRoll', 'performRoll', 'snakeRule', 'jumpOf',
                 'LADDERS', 'SNAKES', 'campaignId', 'challenge', 'dailyRng', 'completeDaily',
                 's-back', 'ui-hud-in', 'pageBg', '/common/img/board_snake.png'])
# 迷宫探险（20 关：方向键 / 迷雾 / 血钥匙宝石 / 存档 / 挑战种子）
expect('maze', ['onBackPress', 'moveUp', 'moveDown', 'moveLeft', 'moveRight',
                'loadLevel', 'finishWin', 'maze_unlocked', 'save_maze',
                'campaignId', 'campaignLevel', 'challenge', 'dailyRng', 'completeDaily',
                'nav-fab', 'pageBg'])
# 找不同（40 关：A/B 叠放或切换 / 点击差异 / 计时 / 提示 / 错误 / 星级）
expect('spotdiff', ['onBackPress', 'onTapA', 'handleTap', 'measureTouch', 'beginLevel', 'finishWin',
                    'spot_unlocked', 'spot_best', 'spot_save', 'HINT_MAX',
                    'campaignId', 'campaignLevel', 'challenge', 'dailyRng', 'completeDaily',
                    'nav-fab', 'pageBg'])
# 成就（48 项七类，进度条 + 解锁状态）
expect('achievements', ['back-fab', 'goBack', 'loadAch', 'ACH_CATS', 'ACHIEVEMENTS',
                        'unlockedCount', 'pctText', 'ach-fill', '已解锁', '未解锁',
                        'pageBg', 'ui-page-in'])
# 残局列表（象棋 / 五子棋 / 围棋各 10 题，完成状态与最佳步数）
expect('puzzles', ['back-fab', 'goBack', 'getPuzzles', 'openPuzzle', 'puzzle_best_',
                   'puzzle_done_', 'PUZZLE_GAMES', '已完成', '未完成',
                   'pageBg', 'ui-page-in'])
# 启动页 / 关于页：背景纹样 + 品牌徽标
expect('start', ['轻触任意位置', 'enter', '#1c1b1f', '/common/img/brand.png'])
expect('about', ['pageBg', '/common/img/brand.png'])
# 设置 / 战绩 / 玩法：背景纹样
expect('settings', ['pageBg'])
expect('stats', ['pageBg'])
expect('help', ['pageBg'])
expect('season', ['pageBg'])

# 回归护栏：三页的临时诊断读数已彻底移除（类名与数据字段都不应残留）
for pg in ['game', 'monopoly', 'aeroplane']:
    s = dec('pages/%s/%s.js' % (pg, pg))
    for kw in ['diag', 'camX', 'camY']:
        if kw in s:
            FAILED.append((pg, '残留临时诊断：' + kw))

# 回归护栏：滚动容器（<scroll>）内不得再放 <image> 位图。
# 实测教训：棋盘/环体纸纹曾以绝对定位 <image> 放在 <scroll> 里，运行时被撑满整块
# 舞台 —— 表现为「图片过大 + 能滑到下面一大片留白」。此类背景/质感一律改用底色。
for pg in ['game', 'monopoly', 'aeroplane']:
    s = dec('pages/%s/%s.js' % (pg, pg))
    for kw in ['board-tex', 'ring-tex', 'tex_grain']:
        if kw in s:
            FAILED.append((pg, '滚动容器内仍有位图：' + kw))

# 回归护栏：环体/航道的「棋盘底衬」已被玩家否决（要能玩的图，不要背景图），不得回加。
for pg in ['monopoly', 'aeroplane']:
    s = dec('pages/%s/%s.js' % (pg, pg))
    for kw in ['ring-mat', 'ring_monopoly', 'ring_aeroplane']:
        if kw in s:
            FAILED.append((pg, '已否决的棋盘底衬回加：' + kw))

# 回归护栏：两页的顶部跑马灯播报已被系统 Toast 取代（玩家决策），不得回加。
for pg in ['monopoly', 'aeroplane']:
    s = dec('pages/%s/%s.js' % (pg, pg))
    if 'marquee' in s:
        FAILED.append((pg, '跑马灯播报回加（应改系统 Toast）'))

# ── 护栏 D：跨页度量一致性（本轮「度量 Token」的核心保证）────────────────
# 编译产物里 CSS 规则形如：[[[0,"m-btn"]],{ width: "130px", height: "40px", ... }]
# 默认档 = 胶囊屏（130×40）；方屏档（140×34）在源码的 @media (shape: rect) 里，另查源文件。
for pg in ['game', 'monopoly', 'aeroplane', 'draughts', 'jungle', 'g2048', 'slide',
           'minesweeper', 'sokoban', 'sudoku', 'settings', 'season']:
    s = z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore')
    m = re.search(r'"m-btn"\s*\]\s*\],\s*\{([^}]*)\}', s)
    if not m:
        FAILED.append((pg, '弹窗按钮 .m-btn 规则缺失（八个弹窗页都应有）'))
        continue
    body = m.group(1)
    if 'width: "130px"' not in body or 'height: "40px"' not in body:
        FAILED.append((pg, '弹窗按钮 .m-btn 未按统一规格（胶囊屏档应为 130×40，见 utils/metrics.js）'))
    css_path = os.path.join('src', 'pages', pg, pg + '.css')
    if not os.path.exists(css_path):
        FAILED.append((pg, '缺源码 CSS，无法核对方屏档'))
        continue
    css = open(css_path, encoding='utf-8').read()
    if '(shape: rect)' not in css or 'height: 34px' not in css or 'width: 140px' not in css:
        FAILED.append((pg, '弹窗缺方屏档（rect 媒体查询里应有按钮 140×34，否则矮画布会铺满整屏）'))

# 护栏 F：矮画布（方屏画布高 300 / 228）适配（2026-10-23）
# 开局面板内容约 322px、抽屉单列 4~7 项约 200~350px —— 都高于方屏画布，
# 必须分别走 scroll（panel-vp）与 rect 双列网格（d-grid），否则底部按钮被裁（点不到退出）。
for pg in ['game', 'monopoly', 'aeroplane']:
    s = dec('pages/%s/%s.js' % (pg, pg))
    if 'panel-vp' not in s or 'd-grid' not in s:
        FAILED.append((pg, '开局面板 / 抽屉缺矮画布适配（panel-vp / d-grid）'))
    css_p = os.path.join('src', 'pages', pg, pg + '.css')
    css = open(css_p, encoding='utf-8').read()
    if 'flex-wrap: wrap' not in css:
        FAILED.append((pg, '抽屉缺方屏双列网格（rect 里应有 flex-wrap: wrap）'))

# 护栏 G：小控件不得低于 34 设计像素（触摸目标下限）——
# chip / 分段控件原为 32，开关原为 26，都是「点不准」的直接原因。
for pg, cls in [('game', 'chip'), ('monopoly', 'chip'), ('aeroplane', 'chip'), ('settings', 'seg')]:
    css = open(os.path.join('src', 'pages', pg, pg + '.css'), encoding='utf-8').read()
    m = re.search(r'\.%s\s*\{[^}]*height:\s*(\d+)px' % cls, css)
    if not m or int(m.group(1)) < 34:
        FAILED.append((pg, '%s 高度低于 34（触摸目标下限）' % cls))

# 护栏 E：内容/对局页都要有入场动效（挂静态 class，不依赖动态 class 绑定）
# 单人/说明类页用 ui-page-in（内容淡入 + 微上移）或 ui-hud-in（顶栏）；
# 三个对局页的入场由面板/弹窗动效承担（ui-panel-in / ui-modal-in）。
for pg in ['start', 'index', 'settings', 'stats', 'help', 'about', 'season',
           'achievements', 'puzzles', 'campaign']:
    s = z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore')
    if 'ui-page-in' not in s:
        FAILED.append((pg, '缺入场动效（ui-page-in）'))
for pg in ['g2048', 'slide', 'minesweeper', 'sokoban', 'sudoku', 'snake', 'maze', 'spotdiff']:
    s = z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore')
    if 'ui-hud-in' not in s:
        FAILED.append((pg, '缺顶栏入场动效（ui-hud-in）'))
for pg in ['game', 'monopoly', 'aeroplane', 'draughts', 'jungle']:
    s = z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore')
    if 'ui-modal-in' not in s or 'ui-panel-in' not in s:
        FAILED.append((pg, '缺面板/弹窗入场动效'))
# 狼人杀使用自有前缀的入场动效（ww-*），同样只动 opacity/transform
s = z.read('pages/werewolf/werewolf.js').decode('utf-8', 'ignore')
if 'ww-hud-in' not in s or 'ww-modal-in' not in s:
    FAILED.append(('werewolf', '缺入场动效（ww-hud-in / ww-modal-in）'))

# ── 护栏 H：共享模块必须是 app.ux 的 global.YQ 单例（2026-10-30 运存优化）──
# 背景：24 个页面各自被 SDK 打成独立包；若页面再写 require('../../utils/...')，
# 同一份 config/theme/economy/skin-assets 会被复制回每个页面包（包体与堆内存成倍增长）。
SHARED_REQ = ['utils/config.js', 'utils/theme.js', 'utils/screen.js', 'utils/storage.js',
              'utils/haptic.js', 'utils/toast.js', 'utils/rng.js', 'utils/metrics.js',
              'utils/economy.js', 'core/ai.js', 'core/geometry.js',
              'core/board-renderer.js', 'campaign/report.js']
for fp in sorted(glob.glob(os.path.join('src', 'pages', '*', '*.ux'))):
    src = open(fp, encoding='utf-8').read()
    for mod in SHARED_REQ:
        if ("require('../../" + mod + "')") in src:
            FAILED.append((os.path.basename(os.path.dirname(fp)),
                           '共享模块未走 global.YQ：' + mod))
app_src = open(os.path.join('src', 'app.ux'), encoding='utf-8').read()
if 'global.YQ' not in app_src:
    FAILED.append(('app', '缺少 global.YQ 单例挂载'))
for key in ['config', 'theme', 'screen', 'storage', 'haptic', 'toast', 'rng',
            'metrics', 'economy', 'ai', 'BoardGeometry', 'boardRenderer', 'campaignReport']:
    if (key + ':') not in app_src:
        FAILED.append(('app', 'global.YQ 缺少模块：' + key))

# ── 护栏 I：悬浮 dock 统一口径（2026-10-31）──
dock_css = open(os.path.join('src', 'common', 'dock.css'), encoding='utf-8').read()
for kw in ['position: absolute', 'left: 8px', 'bottom: 60px', 'width: 176px',
           'height: 80px', 'border-radius: 20px', 'width: 86px', 'height: 144px']:
    if kw not in dock_css:
        FAILED.append(('dock', '悬浮覆盖 dock 口径缺失：' + kw))
for pg in ['index', 'settings']:
    src = open(os.path.join('src', 'pages', pg, pg + '.ux'), encoding='utf-8').read()
    if 'common/dock.css' not in src or 'dock-item' not in src:
        FAILED.append((pg, '未接入悬浮 dock'))
if 'dock-2' not in open(os.path.join('src', 'pages', 'settings', 'settings.ux'), encoding='utf-8').read():
    FAILED.append(('settings', '2 项 dock 未使用 dock-2'))

# ── 护栏 J：页面内分类 dock（2026-10-31）──
# dock 必须和本页内容相关：赛季=每日/任务/商店/皮肤；闯关=全部/可挑战/已通关；
# 战绩=总览/棋种/最近；残局=象棋/五子棋/围棋。不再做全局导航。
page_dock = {
    'season': ['pickTab', "tab === 'daily'", "tab === 'tasks'", "tab === 'shop'", "tab === 'skin'"],
    'campaign': ['pickFilter', 'applyFilter', "filter === 'todo'", "filter === 'done'"],
    'stats': ['pickTab', "tab === 'overview'", "tab === 'games'", "tab === 'recent'"],
    'puzzles': ['pickTab', 'viewGroups', "tab === 'chess'", "tab === 'gomoku'"]
}
for pg, kws in page_dock.items():
    src = open(os.path.join('src', 'pages', pg, pg + '.ux'), encoding='utf-8').read()
    if 'common/dock.css' not in src or 'dock-item' not in src:
        FAILED.append((pg, '页面内 dock 容器缺失'))
    for kw in kws:
        if kw not in src:
            FAILED.append((pg, '页面内分类缺失：' + kw))

# ── 护栏 K：帮助页 19 款玩法的内容要点（操作 / 技巧）──
help_src = open(os.path.join('src', 'pages', 'help', 'help.ux'), encoding='utf-8').read()
for kw in ['h-meta', 'h.how', 'h.tip', '棋类对弈', '桌面派对', '益智拼图', '探索推理']:
    if kw not in help_src:
        FAILED.append(('help', '玩法内容升级缺失：' + kw))

if FAILED:
    print('缺失 %d 项：' % len(FAILED))
    for f in FAILED:
        print('  -', f[0], '::', f[1])
else:
    print('全部特性均在包内 ✓（含 19 款玩法、闯关、跨页度量一致性 + 入场动效）')
