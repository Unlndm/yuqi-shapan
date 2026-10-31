# scripts/check-backclean.py — 校验返回按钮清理：唯一返回 = 左上角按钮
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.0.0.rpk')


def dec(s):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)


for pg in ['stats', 'help', 'about', 'settings', 'season', 'achievements', 'puzzles']:
    s = dec(z.read('pages/%s/%s.js' % (pg, pg)).decode('utf-8', 'ignore'))
    assert 'back-fab' in s, pg + ' 缺左上角返回钮'
    assert 'goBack' in s, pg + ' 缺 goBack 处理器'
    assert '返 回' not in s, pg + ' 残留旧底栏返回'
    assert 'value: "返回"' not in s, pg + ' 残留旧底栏返回'
print('七个内容页返回入口唯一（左上角按钮）且回调齐全 ✓')
