/**
 * 算法四：状态压缩动态规划 (State Compression DP)
 *
 * 用二进制 Mask 表示「当前已合并了哪些物品」。
 * 对每个 Mask，枚举所有子集划分 (left, right)，尝试合并。
 * 对于相同的产物状态 (附魔+惩罚+耐久)，只保留花费最低的路径。
 *
 * 复杂度：O(3^N)，N=10 时只需 ~59K 次操作，瞬间完成。
 * 结果与穷举法完全一致（数学保证：最优子结构 + 无后效性）。
 *
 * @module core/algorithms/dpSearch
 */

import { ENCHANTED_BOOK } from '../types.js'
import { calcForgeCost, mergeItems } from '../forge.js'

/**
 * @param {import('../itemPool.js').ItemPool} pool - 物品池
 * @param {string} forgeMode - ForgeMode 枚举值
 * @param {string} edition - 'java' | 'bedrock'
 * @param {Object} options - 额外选项
 * @returns {{ steps: Array, totalCost: number, maxStepCost: number, feasible: boolean, timedOut: boolean, permutationsChecked: number }}
 */
export function dpSearch(pool, forgeMode, edition, options = {}) {
    const { timeout = 60000, ignoreCostLimit = false, onProgress = null } = options

    // 收集所有物品
    const items = []
    for (let i = 0; i < pool.count; i++) items.push(pool.get(i))
    const N = items.length

    if (N <= 1) {
        return {
            steps: [], totalCost: 0, maxStepCost: 0,
            feasible: true, timedOut: false, permutationsChecked: 0,
        }
    }

    // 物品上限检查（2^20 = 1M 个 mask，仍可处理）
    if (N > 20) {
        throw new Error(`物品数量 ${N} 超过 DP 算法上限 (20)`)
    }

    const startTime = Date.now()
    let permutationsChecked = 0
    let timedOut = false

    // ========== 状态定义 ==========
    // dp[mask] = Map<stateKey, DPState>
    // stateKey = "enchId:level,...|penalty|durability"
    // DPState  = { cost, item, steps, enchValue }
    //
    // 对于同一个 mask 的同一个 stateKey，只保留最低 cost 的路径。
    // 不同 stateKey 代表不同的合并结果（惩罚值不同、附魔等级因升级不同），都保留。

    const totalMasks = 1 << N
    const dp = new Array(totalMasks)
    for (let i = 0; i < totalMasks; i++) dp[i] = null

    /** 计算附魔总价值 */
    function enchValue(item) {
        let val = 0
        for (const e of item.enchants) val += e.level
        return val
    }

    /** 生成状态签名：相同的附魔+惩罚+耐久 = 相同状态 */
    function stateKey(item) {
        const enchStr = item.enchants.map(e => `${e.id}:${e.level}`).sort().join(',')
        return `${item.name}|${enchStr}|${item.penalty}|${item.durability}`
    }

    /** 向 dp[mask] 插入或更新状态 */
    function upsert(mask, key, state) {
        if (!dp[mask]) dp[mask] = new Map()
        const existing = dp[mask].get(key)
        if (!existing) {
            dp[mask].set(key, state)
            return
        }
        // 先最大化附魔价值，再最小化花费
        if (state.enchValue > existing.enchValue ||
            (state.enchValue === existing.enchValue && state.cost < existing.cost)) {
            dp[mask].set(key, state)
        }
    }

    // ========== 初始化：每个单物品 ==========
    for (let i = 0; i < N; i++) {
        const mask = 1 << i
        const key = stateKey(items[i])
        upsert(mask, key, {
            cost: 0,
            item: items[i],
            steps: [],
            enchValue: enchValue(items[i]),
        })
    }

    // ========== DP 转移：按 mask 从小到大 ==========
    for (let mask = 1; mask < totalMasks; mask++) {
        // 跳过只有 1 位的 mask（单物品，已初始化）
        if ((mask & (mask - 1)) === 0) continue
        // 跳过没有任何状态的 mask（不可达）
        // 注意：此时 dp[mask] 可能尚未创建，由子集合并时创建

        // 超时检查
        if (Date.now() - startTime > timeout) {
            timedOut = true
            break
        }

        const lowestBit = mask & (-mask)

        // 枚举 mask 的所有非空真子集对
        // 对称性剪枝：强制 left 包含最低位，避免 (A,B) 和 (B,A) 重复
        for (let left = (mask - 1) & mask; left > 0; left = (left - 1) & mask) {
            if ((left & lowestBit) === 0) continue
            const right = mask ^ left

            const leftStates = dp[left]
            const rightStates = dp[right]
            if (!leftStates || !rightStates) continue

            for (const lState of leftStates.values()) {
                for (const rState of rightStates.values()) {
                    permutationsChecked++

                    // 尝试双方向合并：L 做目标 + R 做牺牲，以及反过来
                    tryMerge(mask, lState, rState)
                    tryMerge(mask, rState, lState)
                }
            }
        }

        // 进度回调（每处理 64 个 mask 报告一次）
        if (onProgress && (mask & 63) === 0) {
            onProgress({ checked: permutationsChecked, bestCost: 0, bestEnchValue: 0 })
        }
    }

    /** 尝试一次合并并更新 dp[mask] */
    function tryMerge(mask, tgtState, sacState) {
        const tgt = tgtState.item
        const sac = sacState.item

        // 类型兼容性检查
        const tgtIsBook = tgt.name === ENCHANTED_BOOK || tgt.name === ''
        const sacIsBook = sac.name === ENCHANTED_BOOK || sac.name === ''
        // 两个非书物品必须同类型
        if (!tgtIsBook && !sacIsBook && tgt.name !== sac.name) return
        // 不能把非书物品放到右侧（书牺牲给武器可以，武器牺牲给书没意义）
        // 实际上 MC 允许，但结果是一本带武器附魔的书，不是我们想要的
        // 正确规则：如果一方是武器一方是书，武器必须做目标
        if (tgtIsBook && !sacIsBook) return

        const step = calcForgeCost(tgt, sac, forgeMode, edition)

        // 40 级上限剪枝
        if (!ignoreCostLimit && step.cost >= 40) return

        const merged = mergeItems(tgt, sac)
        const totalCost = tgtState.cost + sacState.cost + step.cost
        const key = stateKey(merged)
        const ev = enchValue(merged)

        upsert(mask, key, {
            cost: totalCost,
            item: merged,
            steps: [...tgtState.steps, ...sacState.steps, step],
            enchValue: ev,
        })
    }

    // ========== 提取最优解 ==========
    // 找到目标物品（非书物品）的索引
    let targetIdx = -1
    for (let i = 0; i < N; i++) {
        if (items[i].name !== ENCHANTED_BOOK && items[i].name !== '') {
            targetIdx = i
            break
        }
    }

    // 遍历所有包含目标物品的 mask（不再强制用完所有物品）
    // 这样多余的书会被自动跳过
    let bestState = null
    let bestMask = 0
    for (let mask = 1; mask < totalMasks; mask++) {
        // 必须包含目标物品（如果有的话）
        if (targetIdx >= 0 && !(mask & (1 << targetIdx))) continue
        // 至少 2 个物品才有合并
        if ((mask & (mask - 1)) === 0) continue

        const states = dp[mask]
        if (!states) continue

        for (const state of states.values()) {
            // 只考虑合并结果是武器/装备的（不是书）
            if (targetIdx >= 0) {
                const isBook = state.item.name === ENCHANTED_BOOK || state.item.name === ''
                if (isBook) continue
            }
            if (!bestState) {
                bestState = state
                bestMask = mask
            } else if (state.enchValue > bestState.enchValue) {
                bestState = state
                bestMask = mask
            } else if (state.enchValue === bestState.enchValue && state.cost < bestState.cost) {
                bestState = state
                bestMask = mask
            }
        }
    }

    // 40 级限制下无解 → 放宽重试
    if (!bestState && !ignoreCostLimit) {
        return dpSearch(pool, forgeMode, edition, { ...options, ignoreCostLimit: true })
    }

    // 计算最大单步花费
    let maxStepCost = 0
    if (bestState) {
        for (const step of bestState.steps) {
            maxStepCost = Math.max(maxStepCost, step.cost)
        }
    }

    // 收集未使用的物品索引
    const skippedItems = []
    for (let i = 0; i < N; i++) {
        if (!(bestMask & (1 << i))) {
            skippedItems.push(i)
        }
    }

    // 将最终物品写回 pool（与 enumeration 保持一致的副作用）
    if (bestState && bestState.steps.length > 0) {
        while (pool.count > 0) pool.remove(0)
        pool.add(bestState.item)
    }

    return {
        steps: bestState ? bestState.steps : [],
        totalCost: bestState ? bestState.cost : 0,
        maxStepCost,
        feasible: maxStepCost < 40,
        timedOut,
        permutationsChecked,
        skippedItems,           // 未使用的物品索引列表
        usedCount: N - skippedItems.length,  // 实际参与合并的物品数
    }
}
