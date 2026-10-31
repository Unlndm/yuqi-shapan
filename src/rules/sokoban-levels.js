/**
 * rules/sokoban-levels.js — 20 个推箱子内置关卡（纯数据）。
 * 生成方式：离线的「反向拉箱」随机生成，再用 BFS 求正向最短解复核；
 *   solution 即 BFS 得到的最短步数解（u/d/l/r），测试会逐关回放验证。
 * 全部关卡尺寸 ≤ 10×10，适配 192 设计宽。
 *
 * 每关字段：{ id, name, map, solution, moves, pushes }
 *   map —— 关卡字符串数组（# 墙 / 空格地 / . 目标 / $ 箱 / * 箱在目标 / @ 人 / + 人在目标）
 *   solution —— 最短解（u 上 / d 下 / l 左 / r 右）
 *   moves / pushes —— 该解对应的步数与推动数
 */

var LEVELS = [
  {
    id: 1,
    name: "第 1 关",
    map: [
      "##########",
      "#        #",
      "#  ##  . #",
      "#        #",
      "#    ##  #",
      "#    @$  #",
      "#        #",
      "##########"
    ],
    solution: "rdruuu",
    moves: 6,
    pushes: 4
  },
  {
    id: 2,
    name: "第 2 关",
    map: [
      "##########",
      "#        #",
      "#  ##    #",
      "# @   $  #",
      "#    ##  #",
      "#      . #",
      "#        #",
      "##########"
    ],
    solution: "rrrrurdd",
    moves: 8,
    pushes: 3
  },
  {
    id: 3,
    name: "第 3 关",
    map: [
      "##########",
      "#        #",
      "#  ##@$  #",
      "#        #",
      "#    ##  #",
      "#        #",
      "#     .  #",
      "##########"
    ],
    solution: "rurddddrdl",
    moves: 10,
    pushes: 6
  },
  {
    id: 4,
    name: "第 4 关",
    map: [
      "#######",
      "#     #",
      "#@    #",
      "#     #",
      "# * $ #",
      "# .   #",
      "#######"
    ],
    solution: "drrrdrdll",
    moves: 9,
    pushes: 3
  },
  {
    id: 5,
    name: "第 5 关",
    map: [
      "#########",
      "#      *#",
      "#  ###  #",
      "# $     #",
      "#  ###  #",
      "#@    . #",
      "#########"
    ],
    solution: "uuurddldrrrr",
    moves: 12,
    pushes: 6
  },
  {
    id: 6,
    name: "第 6 关",
    map: [
      "#######",
      "#     #",
      "#     #",
      "#+  $ #",
      "#     #",
      "#.  $ #",
      "#######"
    ],
    solution: "urrrrdllldrrrdlll",
    moves: 17,
    pushes: 6
  },
  {
    id: 7,
    name: "第 7 关",
    map: [
      "#######",
      "#     #",
      "#.   $#",
      "#  $ .#",
      "#   @ #",
      "#     #",
      "#######"
    ],
    solution: "luruurdlll",
    moves: 10,
    pushes: 4
  },
  {
    id: 8,
    name: "第 8 关",
    map: [
      "########",
      "#      #",
      "#*#### #",
      "#  . $ #",
      "#@#### #",
      "#      #",
      "########"
    ],
    solution: "drrrrruull",
    moves: 10,
    pushes: 2
  },
  {
    id: 9,
    name: "第 9 关",
    map: [
      "########",
      "#  .   #",
      "#  ##  #",
      "# @    #",
      "#  ##  #",
      "#* $   #",
      "#      #",
      "########"
    ],
    solution: "ddrrdruuuurull",
    moves: 14,
    pushes: 8
  },
  {
    id: 10,
    name: "第 10 关",
    map: [
      "##########",
      "#  .   . #",
      "#  ## $  #",
      "#        #",
      "#    ##  #",
      "# $      #",
      "#@       #",
      "##########"
    ],
    solution: "ruuuulurddrrrurdru",
    moves: 18,
    pushes: 7
  },
  {
    id: 11,
    name: "第 11 关",
    map: [
      "#######",
      "#     #",
      "#   $$#",
      "#.   .#",
      "#@    #",
      "# *   #",
      "#######"
    ],
    solution: "uuurrrrdllluld",
    moves: 14,
    pushes: 5
  },
  {
    id: 12,
    name: "第 12 关",
    map: [
      "#######",
      "# $ . #",
      "#     #",
      "# $   #",
      "#   .*#",
      "#  @  #",
      "#######"
    ],
    solution: "uuullurrdldldrr",
    moves: 15,
    pushes: 5
  },
  {
    id: 13,
    name: "第 13 关",
    map: [
      "##########",
      "# .      #",
      "#  ####  #",
      "#      . #",
      "# $#  #  #",
      "#  .     #",
      "# $####$ #",
      "#      @ #",
      "##########"
    ],
    solution: "uuudddllllluluruuu",
    moves: 18,
    pushes: 8
  },
  {
    id: 14,
    name: "第 14 关",
    map: [
      "##########",
      "#  .  @  #",
      "#  ##    #",
      "# $      #",
      "#    ##  #",
      "# .    $ #",
      "#*       #",
      "##########"
    ],
    solution: "ddrdrdllllluluulur",
    moves: 18,
    pushes: 8
  },
  {
    id: 15,
    name: "第 15 关",
    map: [
      "##########",
      "#     .$ #",
      "#  #### @#",
      "#  .  $  #",
      "#  #  #  #",
      "#        #",
      "#  ####$ #",
      "#   .    #",
      "##########"
    ],
    solution: "ulddlllddrrrdrdlll",
    moves: 18,
    pushes: 8
  },
  {
    id: 16,
    name: "第 16 关",
    map: [
      "##########",
      "#        #",
      "# $##  $ #",
      "# .  @   #",
      "#    ##  #",
      "#        #",
      "#  *.    #",
      "##########"
    ],
    solution: "uullldurrrrrddddrdlll",
    moves: 21,
    pushes: 8
  },
  {
    id: 17,
    name: "第 17 关",
    map: [
      "#########",
      "# .     #",
      "# $###@ #",
      "#       #",
      "# $### .#",
      "# $.    #",
      "#########"
    ],
    solution: "dlllludlddrulurrrrrurd",
    moves: 22,
    pushes: 9
  },
  {
    id: 18,
    name: "第 18 关",
    map: [
      "########",
      "#      #",
      "#.$## @#",
      "#      #",
      "# $##  #",
      "# .    #",
      "# $  . #",
      "########"
    ],
    solution: "ulllldurrrddllldludddrrr",
    moves: 24,
    pushes: 7
  },
  {
    id: 19,
    name: "第 19 关",
    map: [
      "########",
      "#.  .$ #",
      "#  ##  #",
      "#      #",
      "#  ##  #",
      "#$ $   #",
      "#   @. #",
      "########"
    ],
    solution: "uldlluuuuddrdldrrruruuurul",
    moves: 26,
    pushes: 10
  },
  {
    id: 20,
    name: "第 20 关",
    map: [
      "#########",
      "# .   $ #",
      "#$ ###  #",
      "#     . #",
      "#. ###$ #",
      "#     @ #",
      "#########"
    ],
    solution: "uulllluulddrrrrrruuldulll",
    moves: 25,
    pushes: 9
  }
]

module.exports = {
  LEVELS: LEVELS,
  COUNT: LEVELS.length
}
