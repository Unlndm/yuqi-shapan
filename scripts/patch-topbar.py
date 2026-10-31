# scripts/patch-topbar.py — 子页面顶栏重构：返回+标题按屏幕形状分别布局
import io

PAGES = [('settings', '设置'), ('stats', '战绩大厅'), ('help', '玩法介绍'), ('about', '关于')]


def patch(path, subs):
    with io.open(path, encoding='utf-8') as f:
        t = f.read()
    for old, new in subs:
        assert old in t, (path, old[:60])
        t = t.replace(old, new)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('patched', path)


    # 2) CSS 基础块：旧 .title/.title-line/.back-fab → 新 .topbar/.back-fab/.title
    with io.open(css, encoding='utf-8') as f:
        t = f.read()
    old_base = """.title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}

.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}"""
    new_base = """.topbar {
  width: 192px;
  height: 56px;
  flex-direction: row;
  align-items: center;
  padding-left: 16px;
  padding-right: 12px;
  border-bottom-width: 1px;
}

.back-fab {
  width: 38px;
  height: 38px;
  border-radius: 19px;
  border-width: 1px;
  font-size: 18px;
  padding: 0;
  margin-right: 10px;
  background-color: transparent;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
}"""
    assert old_base in t, css + ' base'
    t = t.replace(old_base, new_base)

    # 移除旧的绝对定位 back-fab（若存在）
    old_abs = """.back-fab {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border-width: 1px;
  font-size: 20px;
  padding: 0;
  background-color: transparent;
}
"""
    if old_abs in t:
        t = t.replace(old_abs, '')

    # 3) rect 媒体查询：返回钮左上角、标题右对齐（用户指定的方屏布局）
    old_rect_title = """  .title {
    font-size: 18px;
    line-height: 24px;
    height: 24px;
  }
  .title-line {
    margin-top: 4px;
  }"""
    new_rect = """  .topbar {
    height: 44px;
    padding-left: 4px;
    padding-right: 12px;
  }
  .back-fab {
    position: absolute;
    left: 4px;
    top: 3px;
    width: 38px;
    height: 38px;
  }
  .title {
    text-align: right;
    padding-right: 10px;
    font-size: 18px;
    line-height: 24px;
  }"""
    assert old_rect_title in t, css + ' rect'
    t = t.replace(old_rect_title, new_rect)

    with io.open(css, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('css ok', css)
