/**
 * 算法三：枚举搜索 (Enumeration) — 增强版
 *
 * 搜索所有可能的合并二叉树（包括书与书的组合），
 * 找到总经验花费最低的方案。
 *
 * 原理：
 * 给定 n 个物品（1 武器 + n-1 本书），找到最优的两两合并顺序。
 * 每一步从当前物品池中选两个合并，结果放回，直到只剩一个。
 * 使用分支定界 (Branch & Bound) 剪枝 + 超时保护。
 *
 * 复杂度：Catalan(n-1) 种合并树 × 每步 O(n²) 选择
 * n=7 → ~10K 棵树，n=10 → ~34M 棵树
 * 剪枝后实际搜索量远小于此。
 */

import { ENCHANTED_BOOK } from '../types.js'
import { calcForgeCost, mergeItems } from '../forge.js'

/**
 * @param {import('../itemPool.js').ItemPool} pool - 物品池
 * @param {string} forgeMode - ForgeMode 枚举值
 * @param {string} edition - 'java' | 'bedrock'
 * @param {Object} options - 额外选项
 * @param {number} options.timeout - 超时毫秒数（默认 5000）
 * @param {boolean} options.ignoreCostLimit - 是否忽略 40 级上限
 * @returns {{ steps: Array, totalCost: number, maxStepCost: number, feasible: boolean, timedOut: boolean, permutationsChecked: number }}
 */
export function enumeration(pool, forgeMode, edition, options = {}) {
    const { timeout = 5000, ignoreCostLimit = false } = options

    // 收集所有物品
    const items = []
    for (let i = 0; i < pool.count; i++) {
        items.push(pool.get(i))
    }

    if (items.length <= 1) {
        return {
            steps: [], totalCost: 0, maxStepCost: 0,
            feasible: true, timedOut: false, permutationsChecked: 0,
        }
    }

    const startTime = Date.now()
    let checked = 0
    let timedOut = false
    let bestSteps = null
    let bestCost = Infinity
    let bestEnchValue = -1  // 目标物品的附魔总价值（越大越好）

    /**
     * 计算一个物品的附魔价值 = 所有附魔等级之和
     * 用于比较候选解：先最大化附魔，再最小化成本
     */
    function enchValue(item) {
        if (!item || !item.enchants) return 0
        let val = 0
        for (const e of item.enchants) {
            val += e.level
        }
        return val
    }

    /**
     * 计算目标物品合并所有剩余书后的最大可能附魔价值（乐观上界）
     * 用于剪枝：如果上界 <= bestEnchValue 且成本也不优，直接跳过
     */
    function maxPossibleEV(currentItems) {
        // 找目标物品
        const target = currentItems.find(i => i.name !== ENCHANTED_BOOK && i.name !== '')
        if (!target) {
            // 全是书：合并所有书后的最大价值
            const allEnchs = new Map()
            for (const item of currentItems) {
                for (const e of item.enchants) {
                    const cur = allEnchs.get(e.id) || 0
                    allEnchs.set(e.id, Math.max(cur, e.level))
                }
            }
            let val = 0
            for (const level of allEnchs.values()) val += level
            return val
        }
        // 合并目标已有附魔 + 所有书的附魔（取每种的最高等级）
        const enchMap = new Map()
        for (const e of target.enchants) {
            enchMap.set(e.id, e.level)
        }
        for (const item of currentItems) {
            if (item === target) continue
            for (const e of item.enchants) {
                const cur = enchMap.get(e.id) || 0
                // 乐观估计：同 ID 魔咒可以合并提升（实际取 max 或 +1）
                enchMap.set(e.id, Math.max(cur, e.level))
            }
        }
        let val = 0
        for (const level of enchMap.values()) val += level
        return val
    }

    /**
     * 递归搜索所有合并方案
     * @param {Array} currentItems - 当前物品池
     * @param {Array} currentSteps - 已记录的步骤
     * @param {number} currentCost - 当前累计费用
     */
    function search(currentItems, currentSteps, currentCost) {
        if (timedOut) return

        // === 候选解评估 ===
        const target = currentItems.find(i => i.name !== ENCHANTED_BOOK && i.name !== '')
        const resultItem = target || (currentItems.length === 1 ? currentItems[0] : null)

        if (resultItem) {
            const ev = enchValue(resultItem)
            checked++
            if (ev > bestEnchValue || (ev === bestEnchValue && currentCost < bestCost)) {
                bestEnchValue = ev
                bestCost = currentCost
                bestSteps = [...currentSteps]
            }
        }

        // 不足 2 个物品则无法再合并
        if (currentItems.length <= 1) return

        // === 剪枝 A: 乐观上界剪枝 ===
        // 即使合并所有剩余物品也达不到更高 enchValue → 只需比较成本
        const upperEV = maxPossibleEV(currentItems)
        if (upperEV <= bestEnchValue && currentCost >= bestCost) return

        // 超时检查
        checked++
        if (checked % 5000 === 0 && Date.now() - startTime > timeout) {
            timedOut = true
            return
        }

        // 尝试所有 (i, j) 配对
        for (let i = 0; i < currentItems.length; i++) {
            for (let j = i + 1; j < currentItems.length; j++) {
                const itemA = currentItems[i]
                const itemB = currentItems[j]

                const aIsBook = itemA.name === ENCHANTED_BOOK || itemA.name === ''
                const bIsBook = itemB.name === ENCHANTED_BOOK || itemB.name === ''

                // 两个非书物品必须是同类型才能合并
                if (!aIsBook && !bIsBook && itemA.name !== itemB.name) continue

                // === 剪枝 B: 对称性剪枝 ===
                // 两本「完全相同附魔」的书只需尝试一个方向
                let tryBothOrders = true
                if (aIsBook && bIsBook) {
                    const aKey = itemA.enchants.map(e => e.id + ':' + e.level).sort().join(',')
                    const bKey = itemB.enchants.map(e => e.id + ':' + e.level).sort().join(',')
                    if (aKey === bKey && itemA.penalty === itemB.penalty) {
                        tryBothOrders = false
                    }
                }

                // 确定要尝试的合并方向
                const orders = []
                if (!aIsBook && bIsBook) {
                    orders.push([itemA, itemB])
                } else if (aIsBook && !bIsBook) {
                    orders.push([itemB, itemA])
                } else {
                    orders.push([itemA, itemB])
                    if (tryBothOrders) orders.push([itemB, itemA])
                }

                for (const [tgt, sac] of orders) {
                    const step = calcForgeCost(tgt, sac, forgeMode, edition)

                    // 剪枝 1: 单步超过 40 级上限
                    if (!ignoreCostLimit && step.cost >= 40) continue

                    // 剪枝 2: enchValue 和成本双指标
                    const merged = mergeItems(tgt, sac)
                    const mergedEV = enchValue(merged)
                    if (mergedEV <= bestEnchValue && currentCost + step.cost >= bestCost) continue

                    // 构建新的物品池
                    const remaining = []
                    for (let k = 0; k < currentItems.length; k++) {
                        if (k !== i && k !== j) remaining.push(currentItems[k])
                    }
                    remaining.push(merged)

                    // 递归搜索
                    currentSteps.push(step)
                    search(remaining, currentSteps, currentCost + step.cost)
                    currentSteps.pop()
                }
            }
        }
    }

    search(items, [], 0)

    // 如果没有找到可行方案（所有方案都超过 40 级限制），放宽限制重试
    if (!bestSteps && !ignoreCostLimit) {
        return enumeration(pool, forgeMode, edition, { ...options, ignoreCostLimit: true })
    }

    // 计算汇总数据
    let maxStepCost = 0
    if (bestSteps) {
        for (const step of bestSteps) {
            maxStepCost = Math.max(maxStepCost, step.cost)
        }
    }

    // 重放最后一步得到最终物品
    if (bestSteps && bestSteps.length > 0) {
        const lastStep = bestSteps[bestSteps.length - 1]
        const finalItem = mergeItems(lastStep.target, lastStep.sacrifice)
        while (pool.count > 0) pool.remove(0)
        pool.add(finalItem)
    }

    return {
        steps: bestSteps || [],
        totalCost: bestCost === Infinity ? 0 : bestCost,
        maxStepCost,
        feasible: maxStepCost < 40,
        timedOut,
        permutationsChecked: checked,
    }
}
