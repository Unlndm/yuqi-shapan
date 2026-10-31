# scripts/check-backpress.py — 校验 onBackPress 拦截与退出确认弹窗
import re
import zipfile

z = zipfile.ZipFile('dist/com.application.watch.yiqishapan.debug.1.0.0.rpk')


def dec(s):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)


for n, kws in [
    ('pages/game/game.js', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开',
                            'saveSnapshot', 'showMenu']),
    ('pages/monopoly/monopoly.js', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开', 'saveSnapshot']),
    ('pages/aeroplane/aeroplane.js', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开', 'saveSnapshot']),
    ('pages/draughts/draughts.js', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开', 'saveSnapshot']),
    ('pages/jungle/jungle.js', ['onBackPress', '离开对局？', '继续游戏', '回到主页', '狠心离开', 'saveSnapshot']),
]:
    s = dec(z.read(n).decode('utf-8', 'ignore'))
    for kw in kws:
        assert kw in s, (n, kw)

print('onBackPress 拦截 + 三选离开弹窗 + 对局快照 全部进包 ✓')
