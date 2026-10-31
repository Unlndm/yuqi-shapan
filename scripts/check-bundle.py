# scripts/check-bundle.py — 校验 RPK 内关键内容（临时验收脚本）
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.3.1.rpk')
gm = z.read('pages/game/game.js').decode('utf-8', 'ignore')

# 表达式内的中文被编译为 \uXXXX 转义，解码后再校验
def decode_escapes(text):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)

decoded = decode_escapes(gm)
for kw in ['匹配成功', '正在匹配对手', '对手强度', '人机对战', 'startMatching', 'cancelMatch']:
    assert kw in decoded, kw + ' missing'
# 开局面板不应再出现难度选择
assert '按战绩匹配</text>' not in decoded and '对手强度 · 按战绩匹配' not in decoded

st = z.read('pages/stats/stats.js').decode('utf-8', 'ignore')
st_dec = decode_escapes(st)
for kw in ['总局数', '胜场', '胜率']:
    assert kw in st_dec, kw + ' missing'

ix = z.read('pages/index/index.js').decode('utf-8', 'ignore')
assert 'pages/stats' in ix

print('匹配加载页 ✓ 开局面板无难度 ✓ 战绩玩家视角 ✓')
