/**
 * BestEnchSeq 铁砧合并逻辑
 * 精确移植自原 C++ 的 itempool.cpp (preForge / forge / combine)
 * 参考: https://minecraft.fandom.com/wiki/Anvil_mechanics
 */

import { ENCHANTED_BOOK, ForgeMode, createEnch, createStep, cloneItem } from './types.js'
import enchantmentsData from './data/enchantments.json'

// 构建魔咒查找表（启动时一次性创建）
const enchantmentMap = new Map()
for (const e of enchantmentsData) {
    enchantmentMap.set(e.id, e)
}

/**
 * 根据版本获取魔咒数据（处理 JE/BE 双版本的穿刺等差异）
 * @param {string} enchId
 * @param {string} edition - 'java' | 'bedrock'
 * @returns {Object|null} 魔咒表条目
 */
export function getEnchantment(enchId, edition) {
    const ench = enchantmentMap.get(enchId)
    if (!ench) return null
    if (ench.edition === 'both' || ench.edition === edition) return ench
    return null
}

/**
 * 获取所有魔咒数据
 * @returns {Array}
 */
export function getAllEnchantments() {
    return enchantmentsData
}

/**
 * 等级合并规则
 * 同级且未到最大 → 升一级，否则取最大值
 * @param {string} enchId - 魔咒 ID
 * @param {number} levelA - 目标物品上的等级
 * @param {number} levelB - 牺牲物品上的等级
 * @returns {number} 合并后的等级
 */
export function combineLevel(enchId, levelA, levelB) {
    const data = enchantmentMap.get(enchId)
    if (!data) return Math.max(levelA, levelB)
    if (levelA === levelB && levelA < data.maxLevel) {
        return levelA + 1
    }
    return Math.max(levelA, levelB)
}

/**
 * 检查两个魔咒是否冲突
 * @param {string} enchIdA
 * @param {string} enchIdB
 * @returns {boolean}
 */
export function isConflicting(enchIdA, enchIdB) {
    const dataA = enchantmentMap.get(enchIdA)
    if (!dataA) return false
    return dataA.conflicts.includes(enchIdB)
}

/**
 * 在物品的魔咒列表中查找指定魔咒
 * @param {Array} enchants - 物品的魔咒数组
 * @param {string} enchId - 要查找的魔咒 ID
 * @returns {number} 索引，未找到返回 -1
 */
function findEnch(enchants, enchId) {
    return enchants.findIndex(e => e.id === enchId)
}

/**
 * 计算将物品 B 合并到物品 A 的经验花费（预计算，不修改物品）
 * 精确移植自 C++ ItemPool::preForge(Item A, Item B, ForgeMode mode)
 *
 * @param {Object} target - 目标物品 A（铁砧左侧）
 * @param {Object} sacrifice - 牺牲物品 B（铁砧右侧）
 * @param {string} mode - ForgeMode 枚举值
 * @param {string} edition - 'java' | 'bedrock'
 * @returns {{ target: Object, sacrifice: Object, cost: number, penalty: number }}
 */
export function calcForgeCost(target, sacrifice, mode, edition) {
    let cost = 0
    const newPenalty = Math.max(target.penalty, sacrifice.penalty) + 1

    for (const bEnch of sacrifice.enchants) {
        const data = enchantmentMap.get(bEnch.id)
        if (!data) continue

        // 检查冲突
        let conflicting = false
        for (const conflict of data.conflicts) {
            if (findEnch(target.enchants, conflict) !== -1) {
                // JE：冲突魔咒仍计 1 级费用
                if (edition === 'java') {
                    cost += 1
                }
                conflicting = true
                break
            }
        }
        if (conflicting) continue

        // 获取乘数
        const multiplier = sacrifice.name === ENCHANTED_BOOK
            ? data.bookMultiplier
            : data.itemMultiplier

        // 查找目标物品上是否已有同名魔咒
        const existIdx = findEnch(target.enchants, bEnch.id)
        if (existIdx !== -1) {
            const combinedLevel = combineLevel(bEnch.id, target.enchants[existIdx].level, bEnch.level)
            if (edition === 'java') {
                // JE：按合并后等级计费
                cost += multiplier * combinedLevel
            } else {
                // BE：按增量计费
                cost += multiplier * (combinedLevel - target.enchants[existIdx].level)
            }
        } else {
            // 新增魔咒
            cost += multiplier * bEnch.level
        }
    }

    // 累积惩罚值费用: 2^penalty - 1
    if (mode !== ForgeMode.IGNORE_PENALTY && mode !== ForgeMode.IGNORE_BOTH) {
        cost += Math.pow(2, target.penalty) - 1
        cost += Math.pow(2, sacrifice.penalty) - 1
    }

    // 耐久修复费用
    if (mode !== ForgeMode.IGNORE_FIXING && mode !== ForgeMode.IGNORE_BOTH) {
        if (target.durability !== 100 && sacrifice.durability !== 0) {
            cost += 2
        }
    }

    return createStep(target, sacrifice, cost, newPenalty)
}

/**
 * 计算单个物品的附魔价值（用于排序）
 * 移植自 C++ ItemPool::preForge(Item it, ForgeMode mode)
 *
 * @param {Object} item
 * @param {string} mode - ForgeMode 枚举值
 * @returns {number} 费用值
 */
export function calcItemCost(item, mode) {
    let cost = 0
    for (const ench of item.enchants) {
        const data = enchantmentMap.get(ench.id)
        if (!data) continue
        const multiplier = item.name === ENCHANTED_BOOK
            ? data.bookMultiplier
            : data.itemMultiplier
        cost += multiplier * ench.level
    }
    if (mode !== ForgeMode.IGNORE_PENALTY && mode !== ForgeMode.IGNORE_BOTH) {
        cost += Math.pow(2, item.penalty) - 1
    }
    return cost
}

/**
 * 执行物品合并，返回合并后的新物品（不修改输入）
 * 移植自 C++ ItemPool::forge(Item A, Item B)
 *
 * @param {Object} target - 目标物品 A
 * @param {Object} sacrifice - 牺牲物品 B
 * @returns {Object} 合并后的新物品
 */
export function mergeItems(target, sacrifice) {
    const result = cloneItem(target)

    for (const bEnch of sacrifice.enchants) {
        const data = enchantmentMap.get(bEnch.id)
        if (!data) continue

        // 检查冲突
        let conflicting = false
        for (const conflict of data.conflicts) {
            if (findEnch(result.enchants, conflict) !== -1) {
                conflicting = true
                break
            }
        }
        if (conflicting) continue

        // 查找已有同名魔咒
        const existIdx = findEnch(result.enchants, bEnch.id)
        if (existIdx !== -1) {
            result.enchants[existIdx].level = combineLevel(
                bEnch.id,
                result.enchants[existIdx].level,
                bEnch.level
            )
        } else {
            result.enchants.push(createEnch(bEnch.id, bEnch.level))
        }
    }

    // 耐久修复
    if (result.durability !== 100 && sacrifice.durability !== 0) {
        result.durability += sacrifice.durability
        result.durability = Math.round(result.durability * 1.12)
        if (result.durability > 100) result.durability = 100
    }

    // 惩罚值
    result.penalty = Math.max(target.penalty, sacrifice.penalty) + 1

    return result
}
