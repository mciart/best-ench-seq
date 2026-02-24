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

    /**
     * 递归搜索所有合并方案
     * @param {Array} currentItems - 当前物品池
     * @param {Array} currentSteps - 已记录的步骤
     * @param {number} currentCost - 当前累计费用
     */
    function search(currentItems, currentSteps, currentCost) {
        if (timedOut) return

        // 只剩一个物品 → 搜索完成
        if (currentItems.length === 1) {
            checked++
            if (currentCost < bestCost) {
                bestCost = currentCost
                bestSteps = [...currentSteps]
            }
            return
        }

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

                // 确定要尝试的合并方向
                // 武器必须做目标（左侧），两本书则尝试双向
                const orders = []
                if (!aIsBook && bIsBook) {
                    // A 是武器，B 是书 → A 做目标
                    orders.push([itemA, itemB])
                } else if (aIsBook && !bIsBook) {
                    // B 是武器，A 是书 → B 做目标
                    orders.push([itemB, itemA])
                } else {
                    // 两本书或两个武器 → 尝试双向
                    orders.push([itemA, itemB])
                    orders.push([itemB, itemA])
                }

                for (const [target, sacrifice] of orders) {
                    const step = calcForgeCost(target, sacrifice, forgeMode, edition)

                    // 剪枝 1: 单步超过 40 级上限
                    if (!ignoreCostLimit && step.cost >= 40) continue

                    // 剪枝 2: 累计费用已超过当前最优解
                    if (currentCost + step.cost >= bestCost) continue

                    // 合并物品
                    const merged = mergeItems(target, sacrifice)

                    // 构建新的物品池（去掉 i 和 j，加入合并结果）
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

    // 更新 pool 为最终物品
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
