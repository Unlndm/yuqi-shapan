/**
 * puzzles/go.js — 围棋残局题库（黑先净杀，共 10 题）。
 * 数据约定：
 *   board：7×7 / 9×9 数组，board[j][i]，0 空 / 1 黑 / 2 白；
 *   turn：解题方（固定 1 黑）；goal：固定 'capture'（提掉指定白棋块）；
 *   moveLimit：黑方手数上限（1~3）；
 *   target：起始白棋块的坐标 [[i,j], ...]，题目的目标就是让这些点全部变空；
 *   solution：完整 ply 序列；多手题含白方局部抵抗，最后一手完成提子；
 *   solution[k] = { turn, move }，move 为 { i, j }，可按 ply 直接取作提示。
 * 口径（与 goal 一致，不虚标「做活」）：全部为「提子/净杀」题；
 *   白方抵抗限定在目标块邻域（切比雪夫 1 格内的合法着手）；生成时另加
 *   「黑方每块 ≥3 气」的稳定条件，使白方任何远端着手都无法在步数上限内
 *   为白块增气或提掉黑方包围子，并对白方全盘每一种合法应手做强制复核；
 *   生成后逐手用 rules/go.js 校验合法性（气/禁自杀）并在终局确认 target 全部提空。
 * 纯数据模块：不引用全局、不读 storage、不碰 UI。
 */

var GO_PUZZLES = [
  {
    id: 'go-01',
    game: 'go',
    name: '提掉白一子·一',
    difficulty: 'normal',
    board: [
      [0, 1, 0, 0, 2, 2, 0],
      [0, 0, 2, 0, 1, 0, 0],
      [2, 1, 1, 0, 1, 0, 1],
      [0, 1, 2, 0, 2, 1, 0],
      [0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 2, 0, 0, 2],
      [2, 0, 0, 2, 0, 0, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 2,
    target: [
      [6, 5]
    ],
    solution: [
      { turn: 1, move: { i: 5, j: 5 } },
      { turn: 2, move: { i: 5, j: 6 } },
      { turn: 1, move: { i: 6, j: 6 } }
    ]
  },
  {
    id: 'go-02',
    game: 'go',
    name: '提掉白一子·二',
    difficulty: 'normal',
    board: [
      [0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0],
      [2, 0, 0, 1, 0, 0, 2],
      [2, 0, 1, 0, 1, 1, 0],
      [0, 0, 1, 2, 0, 2, 0],
      [0, 2, 2, 0, 0, 1, 1],
      [0, 2, 0, 0, 0, 1, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 2,
    target: [
      [5, 4]
    ],
    solution: [
      { turn: 1, move: { i: 4, j: 4 } },
      { turn: 2, move: { i: 6, j: 3 } },
      { turn: 1, move: { i: 6, j: 4 } }
    ]
  },
  {
    id: 'go-03',
    game: 'go',
    name: '提掉白一子·三',
    difficulty: 'normal',
    board: [
      [0, 2, 0, 0, 1, 1, 1],
      [0, 0, 2, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 0, 0],
      [1, 1, 2, 1, 2, 1, 2],
      [2, 0, 2, 1, 0, 1, 1],
      [0, 0, 0, 2, 0, 1, 1],
      [0, 0, 2, 2, 2, 0, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 2,
    target: [
      [4, 3]
    ],
    solution: [
      { turn: 1, move: { i: 4, j: 4 } },
      { turn: 2, move: { i: 4, j: 2 } },
      { turn: 1, move: { i: 5, j: 2 } }
    ]
  },
  {
    id: 'go-04',
    game: 'go',
    name: '提掉白一子·四',
    difficulty: 'normal',
    board: [
      [2, 0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 1, 1, 2, 0],
      [0, 0, 0, 0, 1, 0, 0],
      [1, 1, 0, 0, 2, 2, 0],
      [1, 0, 1, 0, 1, 1, 0],
      [2, 2, 0, 1, 0, 2, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 2,
    target: [
      [5, 6]
    ],
    solution: [
      { turn: 1, move: { i: 4, j: 6 } },
      { turn: 2, move: { i: 6, j: 5 } },
      { turn: 1, move: { i: 6, j: 6 } }
    ]
  },
  {
    id: 'go-05',
    game: 'go',
    name: '提掉白一子·五',
    difficulty: 'easy',
    board: [
      [2, 1, 1, 0, 1, 1, 1],
      [0, 0, 1, 1, 0, 2, 0],
      [0, 1, 2, 0, 0, 0, 1],
      [0, 0, 0, 2, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 2],
      [0, 2, 0, 1, 0, 1, 2],
      [0, 0, 0, 0, 1, 0, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 1,
    target: [
      [0, 0]
    ],
    solution: [
      { turn: 1, move: { i: 0, j: 1 } }
    ]
  },
  {
    id: 'go-06',
    game: 'go',
    name: '提掉白一子·六',
    difficulty: 'easy',
    board: [
      [0, 2, 1, 2, 0, 0, 0],
      [2, 0, 1, 1, 0, 1, 0],
      [0, 2, 0, 1, 0, 2, 0],
      [1, 0, 2, 0, 2, 1, 0],
      [0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 1,
    target: [
      [3, 0]
    ],
    solution: [
      { turn: 1, move: { i: 4, j: 0 } }
    ]
  },
  {
    id: 'go-07',
    game: 'go',
    name: '提掉白一子·七',
    difficulty: 'easy',
    board: [
      [1, 1, 1, 0, 0, 1, 0],
      [0, 0, 0, 1, 1, 1, 0],
      [0, 1, 0, 2, 0, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [1, 2, 0, 0, 0, 2, 2],
      [1, 1, 0, 1, 0, 2, 0],
      [0, 2, 0, 0, 2, 0, 2]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 1,
    target: [
      [1, 4]
    ],
    solution: [
      { turn: 1, move: { i: 2, j: 4 } }
    ]
  },
  {
    id: 'go-08',
    game: 'go',
    name: '提掉白一子·八',
    difficulty: 'easy',
    board: [
      [0, 1, 0, 0, 0, 2, 0, 0, 2],
      [2, 0, 1, 1, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 2, 0, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 1, 2, 1, 0],
      [0, 0, 2, 0, 1, 0, 1, 1, 1],
      [0, 2, 0, 0, 2, 0, 1, 1, 1],
      [1, 0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 1, 1, 2, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 1,
    target: [
      [6, 4]
    ],
    solution: [
      { turn: 1, move: { i: 6, j: 3 } }
    ]
  },
  {
    id: 'go-09',
    game: 'go',
    name: '提掉白二子·九',
    difficulty: 'hard',
    board: [
      [0, 1, 2, 0, 1, 1, 0, 0, 2],
      [0, 1, 1, 2, 1, 1, 0, 1, 0],
      [1, 0, 1, 2, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 0, 0, 1, 1, 1],
      [0, 1, 0, 1, 1, 0, 1, 1, 0],
      [2, 0, 0, 1, 0, 1, 1, 2, 0],
      [1, 1, 1, 0, 1, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 2],
      [0, 2, 2, 1, 1, 1, 0, 0, 0]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 3,
    target: [
      [1, 8],
      [2, 8]
    ],
    solution: [
      { turn: 1, move: { i: 1, j: 7 } },
      { turn: 2, move: { i: 0, j: 7 } },
      { turn: 1, move: { i: 2, j: 7 } },
      { turn: 2, move: { i: 3, j: 7 } },
      { turn: 1, move: { i: 0, j: 8 } }
    ]
  },
  {
    id: 'go-10',
    game: 'go',
    name: '提掉白二子·十',
    difficulty: 'hard',
    board: [
      [2, 0, 0, 0, 2, 0, 0, 2, 0],
      [2, 0, 0, 0, 2, 2, 0, 1, 1],
      [2, 0, 0, 1, 0, 1, 1, 1, 1],
      [0, 0, 1, 0, 1, 0, 2, 2, 0],
      [1, 0, 1, 1, 0, 0, 0, 1, 0],
      [1, 0, 1, 0, 2, 0, 0, 0, 2],
      [0, 0, 1, 0, 0, 0, 2, 1, 0],
      [0, 0, 1, 2, 2, 0, 1, 1, 1],
      [0, 0, 1, 2, 0, 0, 0, 0, 2]
    ],
    turn: 1,
    goal: 'capture',
    moveLimit: 3,
    target: [
      [6, 3],
      [7, 3]
    ],
    solution: [
      { turn: 1, move: { i: 6, j: 4 } },
      { turn: 2, move: { i: 5, j: 3 } },
      { turn: 1, move: { i: 5, j: 4 } },
      { turn: 2, move: { i: 8, j: 3 } },
      { turn: 1, move: { i: 8, j: 4 } }
    ]
  }
]

module.exports = GO_PUZZLES
