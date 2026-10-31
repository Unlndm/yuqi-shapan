# scripts/check-opensrc.py — 校验开源参考落地项（解码 unicode 转义后断言）
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.0.0.rpk')


def dec(s):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)


ix = z.read('pages/index/index.js').decode('utf-8', 'ignore')
assert ix.count('(shape:rect)') >= 6, '方屏媒体查询缺失'
assert 'card-sub' in ix, '卡片副标题缺失'
app = dec(z.read('app.js').decode('utf-8', 'ignore'))
assert '五子连珠' in ix or '五子连珠' in app, 'short 文案缺失'

ab = dec(z.read('pages/about/about.js').decode('utf-8', 'ignore'))
for kw in ['弦起悲歌赴寒江', '914824845', 'hero-text']:
    assert kw in ab, kw

for n in ['pages/settings/settings.js', 'pages/game/game.js', 'pages/monopoly/monopoly.js',
          'pages/aeroplane/aeroplane.js', 'pages/stats/stats.js', 'pages/help/help.js',
          'pages/season/season.js', 'pages/draughts/draughts.js', 'pages/jungle/jungle.js',
          'pages/sokoban/sokoban.js', 'pages/sudoku/sudoku.js',
          'pages/achievements/achievements.js', 'pages/puzzles/puzzles.js']:
    s = z.read(n).decode('utf-8', 'ignore')
    assert '(shape:rect)' in s, n + ' 缺方屏适配'

print('方屏双列网格 / 双行卡片 / 关于页重设计 / 全页 rect 适配 全部进包 ✓')
