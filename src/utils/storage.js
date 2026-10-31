/**
 * utils/storage.js — @system.storage 的 Promise 化封装。
 * 职责：统一 key 前缀 chess_；JSON 序列化；读失败/不存在时以默认值兜底，绝不抛错白屏。
 * 注意：Vela storage.get 为回调异步 API，success 收到原始字符串。
 */

import storage from '@system.storage'

const PREFIX = 'chess_'

// 输入：key（不带前缀）、defVal 默认值；输出：Promise<值>，失败/缺失时 resolve(defVal)。
function getItem(key, defVal) {
  return new Promise(function (resolve) {
    try {
      storage.get({
        key: PREFIX + key,
        success: function (raw) {
          if (raw === undefined || raw === null || raw === '') {
            resolve(defVal)
            return
          }
          try {
            resolve(JSON.parse(raw))
          } catch (e) {
            resolve(defVal) // 脏数据兜底：解析失败按默认值
          }
        },
        fail: function () {
          resolve(defVal)
        }
      })
    } catch (e) {
      resolve(defVal)
    }
  })
}

// 输入：key、value（任意可 JSON 化值）；输出：Promise<boolean> 是否写入成功。
function setItem(key, value) {
  return new Promise(function (resolve) {
    try {
      storage.set({
        key: PREFIX + key,
        value: JSON.stringify(value),
        success: function () { resolve(true) },
        fail: function () { resolve(false) }
      })
    } catch (e) {
      resolve(false)
    }
  })
}

// 输入：key；输出：Promise<boolean>。用于清空对局记录等场景。
function removeItem(key) {
  return new Promise(function (resolve) {
    try {
      storage.delete({
        key: PREFIX + key,
        success: function () { resolve(true) },
        fail: function () { resolve(false) }
      })
    } catch (e) {
      resolve(false)
    }
  })
}

module.exports = { getItem: getItem, setItem: setItem, removeItem: removeItem }
