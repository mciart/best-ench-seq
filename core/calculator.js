/**
 * BestEnchSeq 计算入口
 * 枚举搜索算法，返回最优合并方案
 *
 * 这是前端与核心算法的唯一交互点
 * 输入输出均为纯 JSON，为未来 WASM 迁移做准备
 */

import { ENCHANTED_BOOK, ForgeMode, Edition, createItem, createEnch, cloneItem } from './types.js'
import { calcForgeCost, mergeItems, getAllEnchantments, getEnchantment } from './forge.js'
import { ItemPool } from './itemPool.js'
import { dpSearch } from './algorithms/dpSearch.js'

import weaponsData from './data/weapons.json'

/**
 * 获取指定武器在指定版本下可用的魔咒列表
 * @param {string} weaponId - 武器 ID
 * @param {string} edition - 'java' | 'bedrock'
 * @returns {Array} 魔咒数据数组
 */
export function getAvailableEnchantments(weaponId, edition) {
    const allEnchs = getAllEnchantments()
    return allEnchs.filter(ench => {
        // 版本过滤
        if (ench.edition !== 'both' && ench.edition !== edition) return false
        // 武器适用性过滤
        if (!ench.suitableWeapons.includes(weaponId)) return false
        return true
    })
}

/**
 * 获取武器列表
 * @returns {Array}
 */
export function getWeapons() {
    return weaponsData
}



/**
 * 从物品池直接计算（方案 B 入口）
 * 接受物品数组，固定使用枚举搜索
 *
 * @param {Object} options
 * @param {string} options.edition - 'java' | 'bedrock'
 * @param {Array} options.items - 物品数组 [{ type, enchants: [{id, level}], penalty, damaged }]
 * @param {string} [options.forgeMode='normal']
 * @param {boolean} [options.ignoreCostLimit=false]
 * @param {number} [options.timeout=60000]
 * @returns {Object} 计算结果
 */
export function calculateFromPool(options) {
    const {
        edition = Edition.JAVA,
        items = [],
        forgeMode = ForgeMode.NORMAL,
        ignoreCostLimit = false,
        timeout = 60000,
        onProgress = null,
    } = options

    const startTime = performance.now()

    // 构建物品池
    const pool = new ItemPool()

    for (const item of items) {
        const name = item.type === 'enchanted_book' ? ENCHANTED_BOOK : item.type
        const enchants = (item.enchants || []).map(e => createEnch(e.id, e.level))
        const durability = item.damaged ? 0 : 100
        const penalty = item.penalty ?? 0
        const origEnchs = item.originalEnchants
            ? item.originalEnchants.map(e => createEnch(e.id, e.level))
            : null
        pool.add(createItem(name, enchants, durability, penalty, origEnchs))
    }

    // 使用状态压缩 DP 搜索（O(3^N)，比穷举快数个数量级）
    const enumResult = dpSearch(pool, forgeMode, edition, { timeout, ignoreCostLimit, onProgress })
    const steps = enumResult.steps

    // 计算汇总数据
    let totalCost = 0
    let maxStepCost = 0
    for (const step of steps) {
        totalCost += step.cost
        maxStepCost = Math.max(maxStepCost, step.cost)
    }

    // 获取最终物品
    const outputItem = pool.count > 0 ? pool.get(0) : null

    const calcTime = performance.now() - startTime

    return {
        steps,
        outputItem,
        totalCost,
        maxStepCost,
        stepCount: steps.length,
        feasible: maxStepCost < 40,
        algorithm: 'dp',
        calcTime: Math.round(calcTime * 100) / 100,
        timedOut: enumResult.timedOut,
        permutationsChecked: enumResult.permutationsChecked,
    }
}
