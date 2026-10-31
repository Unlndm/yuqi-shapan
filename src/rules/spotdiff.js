/**
 * rules/spotdiff.js — 「找不同」45 关纯数据 + 纯函数（node 可直接测）。
 * 数据口径：每关 A/B 两张 176×176 PNG（src/common/img/spot/），整体构图一致、恰好 5 处差异；
 *   差异类型覆盖 物体缺失 / 颜色变化 / 大小变化 / 位置移动 / 形状替换（每关各 1 处）。
 *   diffs[i] 的 x / y 为 0~1 归一化中心（相对图片宽高），r 为归一化点击半径（0.05~0.08）。
 *   timeLimit 单位秒；reward 为通关棋币（与 utils/economy-core.js 的币值同量级）。
 * 纯函数：不依赖 @system、不读写 storage、不碰 UI；「已找到」标记由调用方维护。
 * 图片与坐标由项目外脚本 D:/andlua/_yqart_work/gen_spotdiff.py 同步生成，勿手改单边。
 */

var LEVELS = [
  { id: 1, name: '书房·晨光', imageA: '/common/img/spot/a01.png', imageB: '/common/img/spot/b01.png',
    diffs: [{ x: 0.2500, y: 0.2841, r: 0.065 }, { x: 0.4943, y: 0.2177, r: 0.075 }, { x: 0.7727, y: 0.2670, r: 0.060 }, { x: 0.7727, y: 0.7784, r: 0.060 }, { x: 0.4943, y: 0.5455, r: 0.060 }], timeLimit: 70, reward: 20 },
  { id: 2, name: '花园·初春', imageA: '/common/img/spot/a02.png', imageB: '/common/img/spot/b02.png',
    diffs: [{ x: 0.5000, y: 0.3480, r: 0.075 }, { x: 0.7784, y: 0.2898, r: 0.065 }, { x: 0.2216, y: 0.2841, r: 0.060 }, { x: 0.7557, y: 0.7955, r: 0.060 }, { x: 0.7443, y: 0.5170, r: 0.060 }], timeLimit: 70, reward: 20 },
  { id: 3, name: '星际·远航', imageA: '/common/img/spot/a03.png', imageB: '/common/img/spot/b03.png',
    diffs: [{ x: 0.7614, y: 0.2955, r: 0.060 }, { x: 0.2500, y: 0.7841, r: 0.065 }, { x: 0.5445, y: 0.7898, r: 0.075 }, { x: 0.7443, y: 0.5170, r: 0.060 }, { x: 0.2330, y: 0.5455, r: 0.060 }], timeLimit: 70, reward: 20 },
  { id: 4, name: '海底·珊瑚', imageA: '/common/img/spot/a04.png', imageB: '/common/img/spot/b04.png',
    diffs: [{ x: 0.4943, y: 0.5284, r: 0.060 }, { x: 0.2386, y: 0.7841, r: 0.060 }, { x: 0.7670, y: 0.7557, r: 0.060 }, { x: 0.4683, y: 0.8045, r: 0.075 }, { x: 0.7500, y: 0.5227, r: 0.065 }], timeLimit: 70, reward: 20 },
  { id: 5, name: '厨房·早餐', imageA: '/common/img/spot/a05.png', imageB: '/common/img/spot/b05.png',
    diffs: [{ x: 0.7500, y: 0.5227, r: 0.060 }, { x: 0.5463, y: 0.2955, r: 0.075 }, { x: 0.7443, y: 0.7614, r: 0.060 }, { x: 0.5170, y: 0.7557, r: 0.060 }, { x: 0.2330, y: 0.2727, r: 0.065 }], timeLimit: 70, reward: 20 },
  { id: 6, name: '街道·清晨', imageA: '/common/img/spot/a06.png', imageB: '/common/img/spot/b06.png',
    diffs: [{ x: 0.7557, y: 0.5511, r: 0.060 }, { x: 0.2386, y: 0.7727, r: 0.060 }, { x: 0.5057, y: 0.5455, r: 0.060 }, { x: 0.8051, y: 0.8107, r: 0.075 }, { x: 0.2443, y: 0.2841, r: 0.065 }], timeLimit: 70, reward: 20 },
  { id: 7, name: '森林·晨雾', imageA: '/common/img/spot/a07.png', imageB: '/common/img/spot/b07.png',
    diffs: [{ x: 0.2557, y: 0.7670, r: 0.060 }, { x: 0.7500, y: 0.5170, r: 0.060 }, { x: 0.7500, y: 0.7784, r: 0.060 }, { x: 0.5057, y: 0.5398, r: 0.065 }, { x: 0.7443, y: 0.2191, r: 0.075 }], timeLimit: 70, reward: 20 },
  { id: 8, name: '海滩·日出', imageA: '/common/img/spot/a08.png', imageB: '/common/img/spot/b08.png',
    diffs: [{ x: 0.8112, y: 0.7399, r: 0.075 }, { x: 0.4943, y: 0.5511, r: 0.060 }, { x: 0.4943, y: 0.7955, r: 0.060 }, { x: 0.2273, y: 0.7500, r: 0.060 }, { x: 0.5170, y: 0.3068, r: 0.065 }], timeLimit: 70, reward: 20 },
  { id: 9, name: '客厅·午后', imageA: '/common/img/spot/a09.png', imageB: '/common/img/spot/b09.png',
    diffs: [{ x: 0.2500, y: 0.7841, r: 0.060 }, { x: 0.4830, y: 0.2670, r: 0.065 }, { x: 0.4943, y: 0.7841, r: 0.060 }, { x: 0.7614, y: 0.7955, r: 0.060 }, { x: 0.5676, y: 0.5170, r: 0.075 }], timeLimit: 65, reward: 30 },
  { id: 10, name: '花园·盛夏', imageA: '/common/img/spot/a10.png', imageB: '/common/img/spot/b10.png',
    diffs: [{ x: 0.2500, y: 0.7784, r: 0.060 }, { x: 0.2330, y: 0.2841, r: 0.060 }, { x: 0.7670, y: 0.7500, r: 0.065 }, { x: 0.4943, y: 0.5284, r: 0.060 }, { x: 0.7670, y: 0.4764, r: 0.075 }], timeLimit: 65, reward: 30 },
  { id: 11, name: '星际·月蚀', imageA: '/common/img/spot/a11.png', imageB: '/common/img/spot/b11.png',
    diffs: [{ x: 0.7784, y: 0.7841, r: 0.060 }, { x: 0.2500, y: 0.7841, r: 0.060 }, { x: 0.5057, y: 0.5227, r: 0.065 }, { x: 0.2443, y: 0.2491, r: 0.075 }, { x: 0.2500, y: 0.5170, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 12, name: '海底·浅滩', imageA: '/common/img/spot/a12.png', imageB: '/common/img/spot/b12.png',
    diffs: [{ x: 0.7500, y: 0.7557, r: 0.065 }, { x: 0.4943, y: 0.7614, r: 0.060 }, { x: 0.7670, y: 0.2784, r: 0.060 }, { x: 0.4886, y: 0.4819, r: 0.075 }, { x: 0.2443, y: 0.3068, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 13, name: '厨房·烘焙', imageA: '/common/img/spot/a13.png', imageB: '/common/img/spot/b13.png',
    diffs: [{ x: 0.4943, y: 0.2727, r: 0.060 }, { x: 0.5114, y: 0.7955, r: 0.065 }, { x: 0.2330, y: 0.7557, r: 0.060 }, { x: 0.1899, y: 0.3328, r: 0.075 }, { x: 0.7500, y: 0.7784, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 14, name: '街道·黄昏', imageA: '/common/img/spot/a14.png', imageB: '/common/img/spot/b14.png',
    diffs: [{ x: 0.2443, y: 0.5114, r: 0.065 }, { x: 0.8145, y: 0.8088, r: 0.075 }, { x: 0.5057, y: 0.3011, r: 0.060 }, { x: 0.5000, y: 0.7500, r: 0.060 }, { x: 0.2500, y: 0.2955, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 15, name: '森林·溪谷', imageA: '/common/img/spot/a15.png', imageB: '/common/img/spot/b15.png',
    diffs: [{ x: 0.2500, y: 0.5398, r: 0.060 }, { x: 0.7888, y: 0.8058, r: 0.075 }, { x: 0.7443, y: 0.5057, r: 0.065 }, { x: 0.7784, y: 0.2955, r: 0.060 }, { x: 0.2443, y: 0.2841, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 16, name: '海滩·正午', imageA: '/common/img/spot/a16.png', imageB: '/common/img/spot/b16.png',
    diffs: [{ x: 0.8083, y: 0.7955, r: 0.075 }, { x: 0.7500, y: 0.2670, r: 0.060 }, { x: 0.7557, y: 0.5398, r: 0.065 }, { x: 0.2443, y: 0.2614, r: 0.060 }, { x: 0.2557, y: 0.5341, r: 0.060 }], timeLimit: 65, reward: 30 },
  { id: 17, name: '卧室·黄昏', imageA: '/common/img/spot/a17.png', imageB: '/common/img/spot/b17.png',
    diffs: [{ x: 0.7960, y: 0.5744, r: 0.075 }, { x: 0.2500, y: 0.2898, r: 0.060 }, { x: 0.7500, y: 0.2955, r: 0.060 }, { x: 0.2557, y: 0.5398, r: 0.060 }, { x: 0.4886, y: 0.5227, r: 0.065 }], timeLimit: 60, reward: 40 },
  { id: 18, name: '花园·金秋', imageA: '/common/img/spot/a18.png', imageB: '/common/img/spot/b18.png',
    diffs: [{ x: 0.7670, y: 0.5760, r: 0.075 }, { x: 0.7443, y: 0.2955, r: 0.060 }, { x: 0.4830, y: 0.2670, r: 0.060 }, { x: 0.4886, y: 0.5114, r: 0.060 }, { x: 0.2557, y: 0.2614, r: 0.065 }], timeLimit: 60, reward: 40 },
  { id: 19, name: '星际·彗星', imageA: '/common/img/spot/a19.png', imageB: '/common/img/spot/b19.png',
    diffs: [{ x: 0.8184, y: 0.5513, r: 0.075 }, { x: 0.7557, y: 0.2784, r: 0.060 }, { x: 0.7614, y: 0.7614, r: 0.060 }, { x: 0.2216, y: 0.2614, r: 0.060 }, { x: 0.5170, y: 0.5057, r: 0.065 }], timeLimit: 60, reward: 40 },
  { id: 20, name: '海底·鱼群', imageA: '/common/img/spot/a20.png', imageB: '/common/img/spot/b20.png',
    diffs: [{ x: 0.2330, y: 0.2955, r: 0.060 }, { x: 0.2443, y: 0.7614, r: 0.060 }, { x: 0.4886, y: 0.5455, r: 0.065 }, { x: 0.8064, y: 0.5341, r: 0.075 }, { x: 0.4943, y: 0.7955, r: 0.060 }], timeLimit: 60, reward: 40 },
  { id: 21, name: '厨房·晚餐', imageA: '/common/img/spot/a21.png', imageB: '/common/img/spot/b21.png',
    diffs: [{ x: 0.5520, y: 0.2605, r: 0.075 }, { x: 0.2330, y: 0.2898, r: 0.060 }, { x: 0.7557, y: 0.5170, r: 0.065 }, { x: 0.2330, y: 0.5170, r: 0.060 }, { x: 0.2216, y: 0.7614, r: 0.060 }], timeLimit: 60, reward: 40 },
  { id: 22, name: '街道·雨天', imageA: '/common/img/spot/a22.png', imageB: '/common/img/spot/b22.png',
    diffs: [{ x: 0.7784, y: 0.2841, r: 0.060 }, { x: 0.2386, y: 0.6079, r: 0.075 }, { x: 0.7614, y: 0.5511, r: 0.065 }, { x: 0.5000, y: 0.7557, r: 0.060 }, { x: 0.2500, y: 0.3011, r: 0.060 }], timeLimit: 60, reward: 40 },
  { id: 23, name: '森林·秋叶', imageA: '/common/img/spot/a23.png', imageB: '/common/img/spot/b23.png',
    diffs: [{ x: 0.2216, y: 0.2614, r: 0.060 }, { x: 0.2500, y: 0.7614, r: 0.060 }, { x: 0.5114, y: 0.5057, r: 0.065 }, { x: 0.8117, y: 0.8060, r: 0.075 }, { x: 0.4886, y: 0.2727, r: 0.060 }], timeLimit: 60, reward: 40 },
  { id: 24, name: '海滩·傍晚', imageA: '/common/img/spot/a24.png', imageB: '/common/img/spot/b24.png',
    diffs: [{ x: 0.5114, y: 0.3068, r: 0.060 }, { x: 0.7784, y: 0.7727, r: 0.065 }, { x: 0.5057, y: 0.7339, r: 0.075 }, { x: 0.2386, y: 0.7841, r: 0.060 }, { x: 0.2557, y: 0.2784, r: 0.060 }], timeLimit: 60, reward: 40 },
  { id: 25, name: '画室·晴日', imageA: '/common/img/spot/a25.png', imageB: '/common/img/spot/b25.png',
    diffs: [{ x: 0.7915, y: 0.2312, r: 0.075 }, { x: 0.7670, y: 0.5455, r: 0.060 }, { x: 0.2273, y: 0.5114, r: 0.060 }, { x: 0.5114, y: 0.2784, r: 0.065 }, { x: 0.2273, y: 0.2898, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 26, name: '花园·雨后', imageA: '/common/img/spot/a26.png', imageB: '/common/img/spot/b26.png',
    diffs: [{ x: 0.4943, y: 0.5341, r: 0.060 }, { x: 0.4943, y: 0.7670, r: 0.060 }, { x: 0.2330, y: 0.7727, r: 0.060 }, { x: 0.8144, y: 0.2670, r: 0.075 }, { x: 0.5057, y: 0.2955, r: 0.065 }], timeLimit: 55, reward: 50 },
  { id: 27, name: '星际·哨站', imageA: '/common/img/spot/a27.png', imageB: '/common/img/spot/b27.png',
    diffs: [{ x: 0.1949, y: 0.2176, r: 0.075 }, { x: 0.7784, y: 0.7557, r: 0.060 }, { x: 0.5057, y: 0.5284, r: 0.065 }, { x: 0.7670, y: 0.2955, r: 0.060 }, { x: 0.5000, y: 0.7614, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 28, name: '海底·沉船', imageA: '/common/img/spot/a28.png', imageB: '/common/img/spot/b28.png',
    diffs: [{ x: 0.7557, y: 0.7670, r: 0.060 }, { x: 0.5000, y: 0.5511, r: 0.060 }, { x: 0.2953, y: 0.8066, r: 0.075 }, { x: 0.7614, y: 0.5170, r: 0.065 }, { x: 0.2557, y: 0.5398, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 29, name: '厨房·下午茶', imageA: '/common/img/spot/a29.png', imageB: '/common/img/spot/b29.png',
    diffs: [{ x: 0.2216, y: 0.3011, r: 0.065 }, { x: 0.5057, y: 0.7784, r: 0.060 }, { x: 0.7670, y: 0.2614, r: 0.060 }, { x: 0.8032, y: 0.7841, r: 0.075 }, { x: 0.4830, y: 0.5114, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 30, name: '街道·夜市', imageA: '/common/img/spot/a30.png', imageB: '/common/img/spot/b30.png',
    diffs: [{ x: 0.5000, y: 0.7784, r: 0.060 }, { x: 0.7500, y: 0.5114, r: 0.060 }, { x: 0.5057, y: 0.5341, r: 0.060 }, { x: 0.4830, y: 0.2955, r: 0.065 }, { x: 0.2012, y: 0.5455, r: 0.075 }], timeLimit: 55, reward: 50 },
  { id: 31, name: '森林·鸟鸣', imageA: '/common/img/spot/a31.png', imageB: '/common/img/spot/b31.png',
    diffs: [{ x: 0.2889, y: 0.5114, r: 0.075 }, { x: 0.2216, y: 0.2727, r: 0.065 }, { x: 0.7557, y: 0.2841, r: 0.060 }, { x: 0.2557, y: 0.7670, r: 0.060 }, { x: 0.5170, y: 0.7898, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 32, name: '海滩·拾贝', imageA: '/common/img/spot/a32.png', imageB: '/common/img/spot/b32.png',
    diffs: [{ x: 0.7614, y: 0.7841, r: 0.060 }, { x: 0.5170, y: 0.5284, r: 0.060 }, { x: 0.2714, y: 0.7999, r: 0.075 }, { x: 0.7557, y: 0.5284, r: 0.065 }, { x: 0.2216, y: 0.5170, r: 0.060 }], timeLimit: 55, reward: 50 },
  { id: 33, name: '阁楼·夜灯', imageA: '/common/img/spot/a33.png', imageB: '/common/img/spot/b33.png',
    diffs: [{ x: 0.7727, y: 0.7557, r: 0.060 }, { x: 0.7614, y: 0.5057, r: 0.060 }, { x: 0.2083, y: 0.7917, r: 0.075 }, { x: 0.4830, y: 0.7614, r: 0.065 }, { x: 0.2330, y: 0.5227, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 34, name: '花园·晚照', imageA: '/common/img/spot/a34.png', imageB: '/common/img/spot/b34.png',
    diffs: [{ x: 0.7670, y: 0.7614, r: 0.060 }, { x: 0.4830, y: 0.7955, r: 0.060 }, { x: 0.4886, y: 0.5455, r: 0.065 }, { x: 0.1941, y: 0.7841, r: 0.075 }, { x: 0.7443, y: 0.5341, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 35, name: '星际·深空', imageA: '/common/img/spot/a35.png', imageB: '/common/img/spot/b35.png',
    diffs: [{ x: 0.7500, y: 0.7898, r: 0.060 }, { x: 0.5000, y: 0.5398, r: 0.060 }, { x: 0.7819, y: 0.5603, r: 0.075 }, { x: 0.2216, y: 0.5341, r: 0.065 }, { x: 0.7557, y: 0.3068, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 36, name: '海底·深蓝', imageA: '/common/img/spot/a36.png', imageB: '/common/img/spot/b36.png',
    diffs: [{ x: 0.1926, y: 0.5227, r: 0.075 }, { x: 0.5170, y: 0.5057, r: 0.060 }, { x: 0.7443, y: 0.2841, r: 0.060 }, { x: 0.5000, y: 0.2955, r: 0.065 }, { x: 0.7500, y: 0.5341, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 37, name: '厨房·夜宵', imageA: '/common/img/spot/a37.png', imageB: '/common/img/spot/b37.png',
    diffs: [{ x: 0.7614, y: 0.2898, r: 0.065 }, { x: 0.5114, y: 0.7500, r: 0.060 }, { x: 0.5000, y: 0.2614, r: 0.060 }, { x: 0.2330, y: 0.4772, r: 0.075 }, { x: 0.2386, y: 0.7841, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 38, name: '街道·周末', imageA: '/common/img/spot/a38.png', imageB: '/common/img/spot/b38.png',
    diffs: [{ x: 0.2557, y: 0.3011, r: 0.060 }, { x: 0.7727, y: 0.2670, r: 0.065 }, { x: 0.2443, y: 0.6103, r: 0.075 }, { x: 0.7614, y: 0.5057, r: 0.060 }, { x: 0.5057, y: 0.7727, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 39, name: '森林·月夜', imageA: '/common/img/spot/a39.png', imageB: '/common/img/spot/b39.png',
    diffs: [{ x: 0.7557, y: 0.7500, r: 0.060 }, { x: 0.5170, y: 0.5057, r: 0.060 }, { x: 0.4613, y: 0.8114, r: 0.075 }, { x: 0.7614, y: 0.3068, r: 0.065 }, { x: 0.2330, y: 0.7557, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 40, name: '海滩·椰影', imageA: '/common/img/spot/a40.png', imageB: '/common/img/spot/b40.png',
    diffs: [{ x: 0.2273, y: 0.2614, r: 0.060 }, { x: 0.2698, y: 0.5030, r: 0.075 }, { x: 0.5170, y: 0.5511, r: 0.065 }, { x: 0.2557, y: 0.7727, r: 0.060 }, { x: 0.7727, y: 0.3011, r: 0.060 }], timeLimit: 50, reward: 60 },
  { id: 41, name: '镜面·海底·深蓝', imageA: '/common/img/spot/a41.png', imageB: '/common/img/spot/b41.png',
    diffs: [{ x: 0.8074, y: 0.4773, r: 0.075 }, { x: 0.4830, y: 0.4943, r: 0.060 }, { x: 0.2557, y: 0.7159, r: 0.060 }, { x: 0.5000, y: 0.7045, r: 0.065 }, { x: 0.2500, y: 0.4659, r: 0.060 }], timeLimit: 45, reward: 80 },
  { id: 42, name: '镜面·厨房·夜宵', imageA: '/common/img/spot/a42.png', imageB: '/common/img/spot/b42.png',
    diffs: [{ x: 0.2386, y: 0.7102, r: 0.065 }, { x: 0.4886, y: 0.2500, r: 0.060 }, { x: 0.5000, y: 0.7386, r: 0.060 }, { x: 0.7670, y: 0.5228, r: 0.075 }, { x: 0.7614, y: 0.2159, r: 0.060 }], timeLimit: 45, reward: 80 },
  { id: 43, name: '镜面·街道·周末', imageA: '/common/img/spot/a43.png', imageB: '/common/img/spot/b43.png',
    diffs: [{ x: 0.7443, y: 0.6989, r: 0.060 }, { x: 0.2273, y: 0.7330, r: 0.065 }, { x: 0.7557, y: 0.3897, r: 0.075 }, { x: 0.2386, y: 0.4943, r: 0.060 }, { x: 0.4943, y: 0.2273, r: 0.060 }], timeLimit: 45, reward: 80 },
  { id: 44, name: '镜面·森林·月夜', imageA: '/common/img/spot/a44.png', imageB: '/common/img/spot/b44.png',
    diffs: [{ x: 0.2443, y: 0.2500, r: 0.060 }, { x: 0.4830, y: 0.4943, r: 0.060 }, { x: 0.5387, y: 0.1886, r: 0.075 }, { x: 0.2386, y: 0.6932, r: 0.065 }, { x: 0.7670, y: 0.2443, r: 0.060 }], timeLimit: 45, reward: 80 },
  { id: 45, name: '镜面·海滩·椰影', imageA: '/common/img/spot/a45.png', imageB: '/common/img/spot/b45.png',
    diffs: [{ x: 0.7727, y: 0.7386, r: 0.060 }, { x: 0.7302, y: 0.4970, r: 0.075 }, { x: 0.4830, y: 0.4489, r: 0.065 }, { x: 0.7443, y: 0.2273, r: 0.060 }, { x: 0.2273, y: 0.6989, r: 0.060 }], timeLimit: 45, reward: 80 }
]

// 输入：关卡 id（数字或数字字符串）；输出：关卡对象，未找到返回 null。
function getLevel(id) {
  var n = id
  if (typeof n === 'string' && n) n = parseInt(n, 10)
  if (typeof n !== 'number' || !isFinite(n)) return null
  n = Math.floor(n)
  for (var i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].id === n) return LEVELS[i]
  }
  return null
}

// 输入：关卡、0~1 归一化点击坐标；输出：命中的差异下标（0 起），未命中/非法入参返回 -1。
// 命中半径按「圆心距离 ≤ r」判定；是否已找到由调用方自行记录（本模块不持有状态）。
function checkTap(level, x, y) {
  if (!level || !level.diffs || !level.diffs.length) return -1
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return -1
  if (x < 0 || x > 1 || y < 0 || y > 1) return -1
  for (var i = 0; i < level.diffs.length; i++) {
    var dx = x - level.diffs[i].x
    var dy = y - level.diffs[i].y
    var r = level.diffs[i].r
    if (dx * dx + dy * dy <= r * r) return i
  }
  return -1
}

// 输入：关卡、与 diffs 同序的命中标记数组（true = 已找到）；输出：是否 5 处全部找到。
function foundAll(level, found) {
  if (!level || !level.diffs || !level.diffs.length) return false
  if (!found || typeof found.length !== 'number') return false
  if (found.length < level.diffs.length) return false
  for (var i = 0; i < level.diffs.length; i++) {
    if (found[i] !== true) return false
  }
  return true
}

module.exports = {
  LEVELS: LEVELS,
  getLevel: getLevel,
  checkTap: checkTap,
  foundAll: foundAll
}
