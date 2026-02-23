/**
 * BestEnchSeq 核心数据结构定义
 * 纯 JS，零依赖，所有函数返回纯 JSON 对象（为未来 WASM 迁移做准备）
 */

/** 锻造模式枚举 */
export const ForgeMode = Object.freeze({
  NORMAL: 'normal',
  IGNORE_FIXING: 'ignoreFixing',
  IGNORE_PENALTY: 'ignorePenalty',
  IGNORE_BOTH: 'ignoreBoth',
})

/** 游戏版本枚举 */
export const Edition = Object.freeze({
  JAVA: 'java',
  BEDROCK: 'bedrock',
})

/** 附魔书的特殊物品名 */
export const ENCHANTED_BOOK = '__enchanted_book__'

/**
 * 创建魔咒实例
 * @param {string} id - 魔咒 ID（如 "sharpness"）
 * @param {number} level - 当前等级
 * @returns {{ id: string, level: number }}
 */
export function createEnch(id, level) {
  return { id, level }
}

/**
 * 创建物品
 * @param {string} name - 物品名称或 ENCHANTED_BOOK
 * @param {Array} enchants - 魔咒数组
 * @param {number} durability - 耐久度百分比 (0-100)
 * @param {number} penalty - 累积惩罚值（铁砧使用次数）
 * @returns {{ name: string, enchants: Array, durability: number, penalty: number }}
 */
export function createItem(name, enchants = [], durability = 100, penalty = 0) {
  return {
    name,
    enchants: enchants.map(e => ({ ...e })),
    durability,
    penalty,
  }
}

/**
 * 深拷贝物品
 * @param {Object} item
 * @returns {Object}
 */
export function cloneItem(item) {
  return createItem(item.name, item.enchants, item.durability, item.penalty)
}

/**
 * 创建锻造步骤记录
 * @param {Object} target - 目标物品 A（放在铁砧左侧）
 * @param {Object} sacrifice - 牺牲物品 B（放在铁砧右侧）
 * @param {number} cost - 经验等级花费
 * @param {number} penalty - 合并后的惩罚值
 * @returns {{ target: Object, sacrifice: Object, cost: number, penalty: number }}
 */
export function createStep(target, sacrifice, cost, penalty) {
  return {
    target: cloneItem(target),
    sacrifice: cloneItem(sacrifice),
    cost,
    penalty,
  }
}
