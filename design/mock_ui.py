# -*- coding: utf-8 -*-
"""1:1 mock of the redesigned home / season screens (design px, 3x render).

This is a design-review artifact only: the Vela runtime draws the real UI.
It mirrors the token names and geometry used by src/pages/index/* and
src/common/ui.css so spacing / text fit can be checked without a device.
"""
from PIL import Image, ImageDraw, ImageFont

S = 3
W, H = 192, 490

DARK = {
    'bg': '#1C1B1F',
    'card': '#221F26',
    'high': '#2B2930',
    'on': '#E6E1E5',
    'var': '#CAC4D0',
    'pri': '#D0BCFF',
    'pc': '#4F378B',
    'onpc': '#EADDFF',
    'hair': (230, 225, 229, 31),
}
FONT = r'C:\Windows\Fonts\msyh.ttc'
BOLD = r'C:\Windows\Fonts\msyhbd.ttc'


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, int(size * S))


def blend(rgba, under):
    a = rgba[3] / 255.0
    u = tuple(int(under[i:i + 2], 16) for i in (1, 3, 5))
    return tuple(int(rgba[i] * a + u[i] * (1 - a)) for i in range(3))


def rr(d, box, r, fill):
    d.rounded_rectangle([int(v * S) for v in box], radius=int(r * S), fill=fill)


def text(d, x, y, s, size, color, bold=False, anchor='la', tracking=0):
    f = font(size, bold)
    if tracking:
        cx = x
        for ch in s:
            d.text((int(cx * S), int(y * S)), ch, font=f, fill=color, anchor=anchor)
            cx += (f.getlength(ch) + tracking) / S
        return cx
    d.text((int(x * S), int(y * S)), s, font=f, fill=color, anchor=anchor)
    return x + f.getlength(s) / S


def tw(s, size, bold=False, tracking=0):
    f = font(size, bold)
    if not tracking:
        return f.getlength(s) / S
    return sum(f.getlength(ch) + tracking for ch in s) / S - tracking


def capsule_mask():
    m = Image.new('L', (W * S, H * S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, W * S - 1, H * S - 1], radius=96 * S, fill=255)
    return m


def icon(base, path, x, y, size, dim=False):
    im = Image.open(path).convert('RGBA').resize((int(size * S), int(size * S)), Image.LANCZOS)
    if dim:
        a = im.getchannel('A')
        im = Image.eval(im.convert('RGB'), lambda v: int(v * 0.45)).convert('RGBA')
        im.putalpha(a)
    base.alpha_composite(im, (int(x * S), int(y * S)))


def home():
    c = DARK
    img = Image.new('RGBA', (W * S, H * S), c['bg'])
    d = ImageDraw.Draw(img)
    # title row
    rowx = (W - 120) / 2
    icon(img, 'src/common/img/brand.png', rowx, 33, 24)
    text(d, rowx + 32, 24, '驭棋沙盘', 22, c['on'], True, tracking=1)
    text(d, rowx + 32, 53, '棋类 · 拼图 · 推理', 10, c['var'], tracking=1)

    # season card (primaryContainer hero)
    y = 76
    rr(d, (12, y, 180, y + 56), 16, c['pc'])
    text(d, 24, y + 9, '第 1 赛季', 12, c['onpc'])
    text(d, 180 - 12, y + 8, '128 棋币 ＞', 14, c['onpc'], True, anchor='ra')
    d.ellipse([24 * S, (y + 34) * S, 30 * S, (y + 40) * S], fill=c['var'])
    text(d, 36, y + 31, '今日挑战 · 未完成', 10, c['onpc'])

    # first group + cards
    y = 150
    text(d, 12, y, '棋类对弈', 12, c['on'], True, tracking=1)
    name_w = tw('棋类对弈', 12, True, 1)
    d.line([(12 + name_w + 8) * S, (y + 8) * S, (180 - 8 - 14) * S, (y + 8) * S],
           fill=blend(c['hair'], c['bg']), width=S)
    text(d, 180, y, '8', 10, c['var'], anchor='ra')
    y += 24

    games = [
        ('五子棋', '五子连珠', 'ic_gomoku.png'),
        ('井字棋', '三连成线', 'ic_tictactoe.png'),
        ('黑白棋', '夹翻对手', 'ic_othello.png'),
        ('四子棋', '四子连珠', 'ic_connect4.png'),
        ('国际象棋', '将死为王', 'ic_chess.png'),
    ]
    for name, sub, ic in games:
        if y > 334:
            break
        rr(d, (12, y, 180, y + 58), 14, c['card'])
        icon(img, 'src/common/img/' + ic, 24, y + 13, 32)
        text(d, 66, y + 12, name, 16, c['on'], True)
        text(d, 66, y + 33, sub, 11, c['var'])
        text(d, 168, y + 20, '＞', 14, c['var'], anchor='ra')
        y += 66

    # floating 2x2 dock 176x96 at bottom 44
    rr(d, (8, 334, 184, 430), 22, c['high'])
    d.rounded_rectangle([8 * S, 334 * S, 184 * S, 430 * S], radius=22 * S,
                        outline=blend(c['hair'], c['high']) + (255,), width=S)
    for i, t in enumerate(['赛季', '闯关', '战绩', '设置']):
        x = 53 + (i % 2) * 86
        y = 358 + (i // 2) * 48
        text(d, x, y, t, 13, c['on'], anchor='mm')

    img.putalpha(capsule_mask())
    return img


def season():
    c = DARK
    img = Image.new('RGBA', (W * S, H * S), c['bg'])
    d = ImageDraw.Draw(img)
    # topbar
    d.rounded_rectangle([16 * S, 38 * S, 60 * S, 82 * S], radius=22 * S, fill=c['high'])
    text(d, 38, 60, '＜', 20, c['on'], anchor='mm')
    text(d, 80, 45, '赛季', 22, c['on'], True, tracking=0.5)
    d.line([0, 88 * S, W * S, 88 * S], fill=blend(c['hair'], c['bg']), width=S)

    # topbar compact coins (no duplicate hero/hint)
    text(d, 180, 45, '128 棋币', 12, c['pri'], True, anchor='ra')
    # content starts immediately at daily challenge
    y = 96
    text(d, 12, y, '每日挑战', 11, c['var'], True, tracking=1)
    y += 20
    rr(d, (12, y, 180, y + 92), 14, c['card'])
    text(d, 24, y + 9, '今日 · 五子棋', 14, c['on'], True)
    text(d, 168, y + 10, '连续 3 天', 11, c['pri'], anchor='ra')
    text(d, 24, y + 31, '目标 赢得/通关一局五子棋', 11, c['var'])
    text(d, 24, y + 45, '奖励 40 棋币', 11, c['var'])
    text(d, 24, y + 62, '未开始', 12, c['var'])
    rr(d, (112, y + 52, 168, y + 86), 17, c['pri'])
    text(d, 140, y + 69, '开始挑战', 12, '#381E72', anchor='mm')
    y += 104
    text(d, 12, y, '终身成就', 11, c['var'], True, tracking=1)
    y += 18
    rr(d, (12, y, 180, y + 40), 20, c['high'])
    text(d, 96, y + 20, '成就 12/48 ＞', 13, c['on'], anchor='mm')

    # page-specific floating dock: 每日 / 任务 / 商店 / 皮肤
    rr(d, (8, 334, 184, 430), 22, c['high'])
    d.rounded_rectangle([8 * S, 334 * S, 184 * S, 430 * S], radius=22 * S,
                        outline=blend(c['hair'], c['high']) + (255,), width=S)
    for i, t in enumerate(['每日', '任务', '商店', '皮肤']):
        x = 53 + (i % 2) * 86
        y = 358 + (i // 2) * 48
        if i == 0:
            rr(d, (8, 334, 94, 382), 22, c['pc'])
            text(d, x, y, t, 13, c['onpc'], anchor='mm')
        else:
            text(d, x, y, t, 13, c['on'], anchor='mm')

    img.putalpha(capsule_mask())
    return img




def home_rect():
    c = DARK
    RW, RH = 192, 228
    img = Image.new('RGBA', (RW * S, RH * S), c['bg'])
    d = ImageDraw.Draw(img)
    # title row 8..42
    icon(img, 'src/common/img/brand.png', 8, 16, 18)
    text(d, 32, 8, '驭棋沙盘', 16, c['on'], True, tracking=0.5)
    rr(d, (140, 8, 184, 42), 17, c['high'])
    text(d, 162, 25, '列表', 11, c['var'], anchor='mm')
    # season 42
    y = 50
    rr(d, (8, y, 184, y + 42), 16, c['pc'])
    text(d, 20, y + 5, '第 1 赛季', 11, c['onpc'])
    text(d, 172, y + 5, '128 棋币 ＞', 13, c['onpc'], True, anchor='ra')
    d.ellipse([20 * S, (y + 25) * S, 25 * S, (y + 30) * S], fill=c['var'])
    text(d, 31, y + 23, '今日挑战 · 未完成', 9, c['onpc'])
    # 双列网格：无组头，首屏整排 85 卡
    y = 98
    games = [('五子棋', '五子连珠', 'ic_gomoku.png'), ('井字棋', '三连成线', 'ic_tictactoe.png')]
    for i, (name, sub, ic) in enumerate(games):
        x = 8 + i * 91
        rr(d, (x, y, x + 85, y + 85), 14, c['card'])
        icon(img, 'src/common/img/' + ic, x + 29.5, y + 16, 26)
        text(d, x + 42.5, y + 48, name, 12, c['on'], True, anchor='ma')
        text(d, x + 42.5, y + 65, sub, 9, c['var'], anchor='ma')
    # floating dock 176x44 at bottom 4
    rr(d, (8, 180, 184, 224), 22, c['high'])
    d.rounded_rectangle([8 * S, 180 * S, 184 * S, 224 * S], radius=22 * S,
                        outline=blend(c['hair'], c['high']) + (255,), width=S)
    for i, t in enumerate(['赛季', '闯关', '战绩', '设置']):
        text(d, 30 + i * 44, 202, t, 11, c['on'], anchor='mm')
    return img


def setup_rect():
    c = DARK
    RW, RH = 192, 228
    img = Image.new('RGBA', (RW * S, RH * S), c['bg'])
    d = ImageDraw.Draw(img)
    # title / labels left aligned
    text(d, 8, 12, '五子棋', 20, c['on'], True)
    text(d, 8, 46, '对战模式', 12, c['var'])
    # mode row: 2 x 84 x 34
    for i, t in enumerate(['人机对战', '双人对战']):
        x = 8 + i * 92
        rr(d, (x, 62, x + 84, 96), 17, c['pc'] if i == 0 else c['high'])
        text(d, x + 42, 79, t, 12, c['onpc'] if i == 0 else c['on'], True, anchor='mm')
    text(d, 8, 104, '棋盘大小', 12, c['var'])
    # size row: 4 x 40 x 34
    for i, t in enumerate(['7×7', '9×9', '11×11', '13×13']):
        x = 8 + i * 42
        rr(d, (x, 120, x + 40, 154), 17, c['pc'] if i == 1 else c['high'])
        text(d, x + 20, 137, t, 11, c['onpc'] if i == 1 else c['on'], False, anchor='mm')
    text(d, 8, 160, '黑白执子每局随机', 11, c['var'])
    rr(d, (8, 180, 184, 224), 22, c['pc'])
    text(d, 96, 202, '开始对局', 15, c['onpc'], True, anchor='mm')
    return img

if __name__ == '__main__':
    home().convert('RGB').save('design/ui-preview-home.png')
    season().convert('RGB').save('design/ui-preview-season.png')
    home_rect().convert('RGB').save('design/ui-preview-home-rect.png')
    setup_rect().convert('RGB').save('design/ui-preview-setup-rect.png')
    print('ok')
