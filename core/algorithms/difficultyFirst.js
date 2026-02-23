/**
 * 算法一：难度优先贪心 (DifficultyFirst)
 * 移植自 C++ Calculator::Alg_DifficultyFirst()
 *
 * 策略：
 * 1. penalty 相同且 penalty 低的组合优先
 * 2. 与武器组合且等级花费高的优先
 * 3. 若 penalty 不相同，则 penalty 相近的组合优先
 */

import { ItemPool } from '../itemPool.js'
import { calcForgeCost, mergeItems } from '../forge.js'

/**
 * @param {ItemPool} pool - 物品池
 * @param {string} forgeMode - ForgeMode 枚举值
 * @param {string} edition - 'java' | 'bedrock'
 * @returns {Array} 锻造步骤数组
 */
export function difficultyFirst(pool, forgeMode, edition) {
    const steps = []
    let curPenalty = pool.get(0).penalty
    let mode = 0 // 0: 同 penalty 合并, 1: 跨 penalty 合并

    while (pool.count > 1) {
        pool.sort()
        const { begin, end } = pool.penaltyRange(curPenalty)

        if (mode === 0) {
            // 同 penalty 层内只剩 1 个或 0 个物品
            if (begin === -1 || end - begin === 0) {
                if (curPenalty >= pool.maxPenalty) {
                    curPenalty = pool.minPenalty
                    mode = 1
                } else {
                    curPenalty++
                }
                continue
            }

            const w = pool.findWeapon()
            if (w !== -1 && pool.get(w).penalty === curPenalty) {
                // 武器在当前 penalty 层内，优先与武器合并
                let sacrificeIdx = begin
                if (sacrificeIdx === w) sacrificeIdx++
                const step = calcForgeCost(pool.get(w), pool.get(sacrificeIdx), forgeMode, edition)
                const merged = mergeItems(pool.get(w), pool.get(sacrificeIdx))
                steps.push(step)
                pool.replace(w, merged)
                pool.remove(sacrificeIdx > w ? sacrificeIdx : sacrificeIdx)
                // 如果移除的索引在 w 前面，需要注意 w 的偏移（但由于我们 replace 后再 remove，这里需要处理）
            } else {
                // 武器不在当前层，合并层内前两个
                const step = calcForgeCost(pool.get(begin), pool.get(begin + 1), forgeMode, edition)
                const merged = mergeItems(pool.get(begin), pool.get(begin + 1))
                steps.push(step)
                pool.replace(begin + 1, merged)
                pool.remove(begin)
            }
        } else {
            // 跨 penalty 合并：合并前两个物品
            const w = pool.findWeapon()
            if (w === 1) {
                // 武器在位置 1，将其作为目标
                const step = calcForgeCost(pool.get(1), pool.get(0), forgeMode, edition)
                const merged = mergeItems(pool.get(1), pool.get(0))
                steps.push(step)
                pool.replace(0, merged)
            } else {
                const step = calcForgeCost(pool.get(0), pool.get(1), forgeMode, edition)
                const merged = mergeItems(pool.get(0), pool.get(1))
                steps.push(step)
                pool.replace(0, merged)
            }
            pool.remove(1)

            // 检查是否可以回到同 penalty 合并模式
            for (let i = 0; i <= pool.maxPenalty; i++) {
                const range = pool.penaltyRange(i)
                if (range.begin !== -1 && range.end - range.begin > 0) {
                    curPenalty = i
                    mode = 0
                    break
                }
            }
        }
    }

    return steps
}
