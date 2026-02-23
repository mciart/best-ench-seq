/**
 * 算法二：汉明分层 (Hamming)
 * 移植自 C++ Calculator::Alg_Hamming()
 *
 * 策略：
 * 构建二叉树分层结构，利用 popcount（二进制中 1 的个数）对物品排序，
 * 使高费用物品位于树的更深层，减少其作为牺牲品被重复计算乘数的次数。
 */

import { ENCHANTED_BOOK } from '../types.js'
import { calcForgeCost, calcItemCost, mergeItems } from '../forge.js'
import { ForgeMode } from '../types.js'

/**
 * 计算数字的二进制中 1 的个数 (popcount)
 * 对应原 C++ 的 duplicationSeries
 * @param {number} x
 * @returns {number}
 */
function popcount(x) {
    if (x < 0) return -1
    let count = 0
    for (let j = x; j > 0; j = Math.floor(j / 2)) {
        if (j % 2 === 1) count++
    }
    return count
}

/**
 * 找到在 [0, n) 范围内 popcount 等于 x 的所有数
 * 对应原 C++ 的 dupFloorMembers
 * @param {number} x - 目标 popcount 值
 * @param {number} n - 范围上限
 * @returns {number[]}
 */
function popcountMembers(x, n) {
    const result = []
    for (let i = 0; i < n; i++) {
        if (popcount(i) === x) result.push(i)
    }
    return result
}

/**
 * 按附魔价值降序排序物品数组
 * @param {Array} items
 */
function sortByValue(items) {
    items.sort((a, b) => {
        const costA = calcItemCost(a, ForgeMode.NORMAL)
        const costB = calcItemCost(b, ForgeMode.NORMAL)
        return costB - costA
    })
}

/**
 * @param {import('../itemPool.js').ItemPool} pool - 物品池
 * @param {string} forgeMode - ForgeMode 枚举值
 * @param {string} edition - 'java' | 'bedrock'
 * @returns {Array} 锻造步骤数组
 */
export function hamming(pool, forgeMode, edition) {
    const steps = []

    if (pool.count <= 1) return steps

    // 找到最大 penalty
    let maxP = 0
    for (let i = 0; i < pool.count; i++) {
        maxP = Math.max(maxP, pool.get(i).penalty)
    }

    // 按 penalty 分组
    let triangle = []
    for (let i = 0; i <= maxP; i++) {
        triangle.push([])
    }
    for (let i = 0; i < pool.count; i++) {
        triangle[pool.get(i).penalty].push(pool.get(i))
    }

    // 对每一层进行汉明排序和合并
    const itemTriangle = []
    for (let i = 0; i < triangle.length; i++) {
        // 确保 itemTriangle 足够大
        while (itemTriangle.length <= i) itemTriangle.push([])

        const n = triangle[i].length
        if (n === 0) continue

        sortByValue(triangle[i])

        // 构建排序后的数组
        const sorted = new Array(n).fill(null)

        // 把武器/工具放在位置 0
        for (let j = 0; j < triangle[i].length; j++) {
            if (triangle[i][j].name !== ENCHANTED_BOOK) {
                sorted[0] = triangle[i].splice(j, 1)[0]
                break
            }
        }

        // 按 popcount 排列剩余物品
        for (let j = 1; j < n; j++) {
            const members = popcountMembers(j, n)
            if (members.length === 0) break
            for (let k = 0; k < members.length && triangle[i].length > 0; k++) {
                sorted[members[k]] = triangle[i].shift()
            }
        }

        // 填充 null（可能有的位置没被填充）
        const layer = sorted.filter(x => x !== null)
        itemTriangle[i] = [...layer]

        // 将剩余的 triangle[i] 放回
        triangle[i] = [...layer]

        if (triangle[i].length < 2) continue

        // 配对合并
        while (triangle[i].length > 1) {
            const a = triangle[i].shift()
            const b = triangle[i].shift()
            const merged = mergeItems(a, b)

            // 确保目标层存在
            while (triangle.length <= merged.penalty) triangle.push([])
            while (triangle.length <= i + 1) triangle.push([])

            if (merged.name !== ENCHANTED_BOOK) {
                // 非附魔书放到下一层
                triangle[i + 1].push(merged)
            } else {
                // 附魔书按 penalty 放
                triangle[merged.penalty].push(merged)
            }
        }

        // 剩余单个物品推到下一层
        if (triangle[i].length === 1) {
            while (triangle.length <= i + 1) triangle.push([])
            triangle[i + 1].push(triangle[i].shift())
        }
    }

    // 从 itemTriangle 生成步骤记录
    for (let i = 0; i < itemTriangle.length; i++) {
        while (itemTriangle[i].length > 1) {
            const a = itemTriangle[i].shift()
            const b = itemTriangle[i].shift()
            steps.push(calcForgeCost(a, b, forgeMode, edition))
        }
        if (itemTriangle[i].length === 1 && i + 1 < itemTriangle.length) {
            itemTriangle[i + 1].push(itemTriangle[i].shift())
        } else if (itemTriangle[i].length === 1) {
            itemTriangle.push([])
            itemTriangle[i + 1] = [itemTriangle[i].shift()]
        }
    }

    // 更新 pool 为最终物品
    if (steps.length > 0) {
        const lastStep = steps[steps.length - 1]
        const finalItem = mergeItems(lastStep.target, lastStep.sacrifice)
        while (pool.count > 0) pool.remove(0)
        pool.add(finalItem)
    }

    return steps
}
