# scripts/check-features.py — 校验 RPK 内新特性（解码 unicode 转义后断言）
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.0.0.rpk')


def dec(s):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)


gm = dec(z.read('pages/game/game.js').decode('utf-8', 'ignore'))
for kw in ['继续上局', 'saveSnapshot', 'restoreFrom', 'clearPref']:
    assert kw in gm, kw + ' missing'
# 棋盘平移＝框架原生 scroll（屏幕＝摄像机、棋盘＝舞台）：不再有自定义平移/钳制函数，
# 落子改由铺满舞台的 .tap-layer 的 click 驱动（offsetX/offsetY 减棋盘偏移即棋盘内坐标）
assert 'scrollX' in gm and 'bounces' in gm and 'stageW' in gm, '原生滚动承载棋盘缺失'
assert 'tap-layer' in gm and 'onBoardClick' in gm, '落子热区缺失'
assert 'clampX' not in gm and 'clampY' not in gm, '旧的自定义平移残留'
# 舞台内不用「绝对定位的中间盒」：该机型运行时对其 left/top/width/height 不可靠（实测被撑满
# 并落在原点，导致棋盘底板比棋盘大一圈、上下左右留白都不等）。棋盘改为**流式**子项 + 外边距定位
assert 'margin-left:' in gm and 'margin-top:' in gm, '棋盘未用流式盒 + 外边距定位'
assert 'board-wrap' not in gm and 'board-bg' not in gm, '绝对定位的中间盒残留'
# 对局中不设返回按钮：侧滑返回呼出控制抽屉
assert 'showMenu' in gm and 'onBackPress' in gm, '侧滑返回抽屉入口缺失'

# 骰子两页：同样改由原生滚动承载环体/航道，且放大后把摄像机对准场景中心
for pg in ['monopoly', 'aeroplane']:
    s = dec(z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore'))
    assert 'scrollX' in s and 'bounces' in s and 'stageW' in s, pg + ' 原生滚动承载棋盘缺失'
    assert 'centerScene' in s, pg + ' 缺缩放后对准场景中心'
    assert 'margin-left:' in s and 'margin-top:' in s, pg + ' 环体未用流式盒 + 外边距定位'
    assert 'wrapX' not in s and 'wrapY' not in s and 'board-wrap' not in s, pg + ' 旧的自定义平移/中间盒残留'

ix = dec(z.read('pages/index/index.js').decode('utf-8', 'ignore'))
assert 'card-sub' in ix and '(shape:rect)' in ix, '机型适配（媒体查询）缺失'

# ── 护栏 A：模板里 @click 绑定的方法必须都有定义 ────────────────────
# 实测踩坑：monopoly.ux 模板写成 @click="startMatching"，脚本里却只有 startMatch()，
# 框架找不到该方法会**静默失败**（点「开始对局」毫无反应，也没有报错）。此处逐页核对。
for pg in ['monopoly', 'aeroplane', 'g2048', 'slide', 'minesweeper', 'game', 'season',
           'draughts', 'jungle', 'sokoban', 'sudoku', 'achievements', 'puzzles']:
    s = dec(z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore'))
    refs = set(re.findall(r'_vm_\.([A-Za-z0-9_]+)\(', s))
    defs = set(re.findall(r'(?m)^\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{', s))
    miss = sorted(refs - defs)
    assert not miss, (pg, '模板绑定的方法未定义：' + ','.join(miss))

# ── 护栏 B：包内引用的素材路径必须真实存在 ──────────────────────────
# 实测踩坑：theme.js 的 diceImage() 把素材后缀写成 '.jpg'，而实际文件是 dice_0.png~dice_6.png，
# 真机上就是**破图感叹号**（图片加载失败）。此处核对两页引用的每个 /common/img 完整路径。
# 注意：只匹配「带扩展名」的完整路径 —— 形如 '/common/img/dice_' 的拼接前缀不算文件名。
names = set(z.namelist())
for pg in ['monopoly', 'aeroplane', 'g2048', 'slide', 'minesweeper', 'index', 'start',
           'about', 'game', 'settings', 'stats', 'help', 'season',
           'draughts', 'jungle', 'sokoban', 'sudoku', 'achievements', 'puzzles']:
    s = dec(z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore'))
    for ref in sorted(set(re.findall(r'/common/img/[A-Za-z0-9_]+\.(?:png|jpg)', s))):
        assert ref.lstrip('/') in names, (pg, '引用了包内不存在的素材：' + ref)

# ── 护栏 C：拼接出来的素材路径也要能对上 ────────────────────────────
# 骰子面是「前缀 + 点数 + 后缀」拼出来的，护栏 B 只看得见前缀，抓不到后缀写错。
# 此处直接核对：① 7 张骰面素材都在包里；② 编译后的 diceImage() 结尾后缀是 .png。
for k in range(0, 7):
    assert ('common/img/dice_%d.png' % k) in names, '骰面素材缺失：dice_%d.png' % k
# 骰面路径在 utils/skin-assets.js 的 diceFace(id, face)；该模块 2026-10-30 起挂到
# global.YQ（打进 app.js），故同时接受页面包或 app.js。
app = dec(z.read('app.js').decode('utf-8', 'ignore'))
for pg in ['monopoly', 'aeroplane']:
    s = dec(z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore'))
    m = re.search(r'diceFace\s*\(id,\s*face\)\s*\{[^}]*\}', s) or \
        re.search(r'diceFace\s*\(id,\s*face\)\s*\{[^}]*\}', app)
    assert m, (pg, 'diceFace 未找到')
    assert ".png'" in m.group(0), (pg, '骰子素材后缀不是 .png（真机会显示破图感叹号）')

print('快照恢复 / 原生滚动承载棋盘 / 落子热区 / 侧滑返回抽屉 / 机型参数 全部进包 ✓')
print('模板绑定方法齐全 + 素材路径全部存在 ✓')
