/**
 * BestEnchSeq 计算入口
 * 调度三种算法，返回统一格式的结果
 *
 * 这是前端与核心算法的唯一交互点
 * 输入输出均为纯 JSON，为未来 WASM 迁移做准备
 */

import { ENCHANTED_BOOK, ForgeMode, Edition, createItem, createEnch, cloneItem } from './types.js'
import { calcForgeCost, mergeItems, getAllEnchantments, getEnchantment } from './forge.js'
import { ItemPool } from './itemPool.js'
import { difficultyFirst } from './algorithms/difficultyFirst.js'
import { hamming } from './algorithms/hamming.js'
import { enumeration } from './algorithms/enumeration.js'

import weaponsData from './data/weapons.json' assert { type: 'json' }

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
 * 主计算函数
 *
 * @param {Object} options
 * @param {string} options.edition - 'java' | 'bedrock'
 * @param {Object} options.originItem - 初始物品 { name, enchants: [{id, level}], durability, penalty }
 * @param {Array} options.neededEnchs - 需求的魔咒列表 [{id, level}]
 * @param {string} options.algorithm - 'difficultyFirst' | 'hamming' | 'enumeration'
 * @param {string} [options.forgeMode='normal'] - 锻造模式
 * @param {boolean} [options.ignoreCostLimit=false] - 是否忽略 40 级上限
 * @param {number} [options.timeout=5000] - 枚举算法超时（毫秒）
 * @returns {{
 *   steps: Array, outputItem: Object, totalCost: number,
 *   maxStepCost: number, stepCount: number, feasible: boolean,
 *   algorithm: string, calcTime: number,
 *   timedOut?: boolean, permutationsChecked?: number
 * }}
 */
export function calculate(options) {
    const {
        edition = Edition.JAVA,
        originItem,
        neededEnchs = [],
        algorithm = 'difficultyFirst',
        forgeMode = ForgeMode.NORMAL,
        ignoreCostLimit = false,
        timeout = 5000,
    } = options

    const startTime = performance.now()

    // 构建物品池
    const pool = new ItemPool()

    // 添加初始物品（武器/装备）
    const weapon = createItem(
        originItem.name,
        (originItem.enchants || []).map(e => createEnch(e.id, e.level)),
        originItem.durability ?? 100,
        originItem.penalty ?? 0
    )
    pool.add(weapon)

    // 为每个需求的魔咒创建附魔书
    for (const ench of neededEnchs) {
        // 检查初始物品是否已有同名同级魔咒，如有且等级差 1，降低书的等级（优化）
        const originEnch = weapon.enchants.find(e => e.id === ench.id)
        let bookLevel = ench.level
        if (originEnch && ench.level - originEnch.level === 1) {
            bookLevel = ench.level - 1
        }

        const book = createItem(ENCHANTED_BOOK, [createEnch(ench.id, bookLevel)])
        pool.add(book)
    }

    // 运行算法
    let steps = []
    let extraResult = {}

    switch (algorithm) {
        case 'difficultyFirst':
            steps = difficultyFirst(pool, forgeMode, edition)
            break
        case 'hamming':
            steps = hamming(pool, forgeMode, edition)
            break
        case 'enumeration': {
            const result = enumeration(pool, forgeMode, edition, { timeout, ignoreCostLimit })
            steps = result.steps
            extraResult = {
                timedOut: result.timedOut,
                permutationsChecked: result.permutationsChecked,
            }
            break
        }
        default:
            steps = difficultyFirst(pool, forgeMode, edition)
    }

    // 计算汇总数据
    let totalCost = 0
    let maxStepCost = 0
    for (const step of steps) {
        totalCost += step.cost
        maxStepCost = Math.max(maxStepCost, step.cost)
    }

    // 获取最终物品
    const outputItem = pool.count > 0 ? pool.get(0) : weapon

    const calcTime = performance.now() - startTime

    return {
        steps,
        outputItem,
        totalCost,
        maxStepCost,
        stepCount: steps.length,
        feasible: maxStepCost < 40,
        algorithm,
        calcTime: Math.round(calcTime * 100) / 100, // 保留 2 位小数（毫秒）
        ...extraResult,
    }
}
