/**
 * BestEnchSeq 物品池管理
 * 简化版——用 JS 原生数组替代原 C++ 手动内存管理
 */

import { ENCHANTED_BOOK, ForgeMode } from './types.js'
import { calcItemCost } from './forge.js'

export class ItemPool {
    constructor(items = []) {
        this.items = items.map(item => ({ ...item, enchants: item.enchants.map(e => ({ ...e })) }))
    }

    /** 添加物品 */
    add(item) {
        this.items.push({ ...item, enchants: item.enchants.map(e => ({ ...e })) })
    }

    /** 移除指定索引的物品 */
    remove(index) {
        this.items.splice(index, 1)
    }

    /** 替换指定索引的物品 */
    replace(index, item) {
        this.items[index] = { ...item, enchants: item.enchants.map(e => ({ ...e })) }
    }

    /** 获取指定索引的物品 */
    get(index) {
        return this.items[index]
    }

    /** 物品数量 */
    get count() {
        return this.items.length
    }

    /**
     * 排序：按 penalty 升序，同 penalty 内按附魔价值降序
     * 非武器物品（附魔书）排在同 penalty 区间的后面
     */
    sort() {
        this.items.sort((a, b) => {
            if (a.penalty !== b.penalty) return a.penalty - b.penalty
            const isBookA = a.name === ENCHANTED_BOOK || a.name === ''
            const isBookB = b.name === ENCHANTED_BOOK || b.name === ''
            // 武器排在前面
            if (!isBookA && isBookB) return -1
            if (isBookA && !isBookB) return 1
            // 同类按费用降序
            const costA = calcItemCost(a, ForgeMode.IGNORE_PENALTY)
            const costB = calcItemCost(b, ForgeMode.IGNORE_PENALTY)
            return costB - costA
        })
    }

    /**
     * 查找第一个非附魔书的物品（即武器/装备）
     * @returns {number} 索引，未找到返回 -1
     */
    findWeapon() {
        return this.items.findIndex(item =>
            item.name !== ENCHANTED_BOOK && item.name !== ''
        )
    }

    /**
     * 获取指定 penalty 值的物品区间 [begin, end]
     * 前提：items 已按 penalty 排序
     * @param {number} penalty
     * @returns {{ begin: number, end: number }} 包含首尾索引，无匹配返回 { begin: -1, end: -1 }
     */
    penaltyRange(penalty) {
        let begin = -1
        let end = -1
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].penalty === penalty) {
                if (begin === -1) begin = i
                end = i
            }
        }
        return { begin, end }
    }

    /** 当前最大 penalty 值 */
    get maxPenalty() {
        return this.items.reduce((max, item) => Math.max(max, item.penalty), 0)
    }

    /** 当前最小 penalty 值 */
    get minPenalty() {
        return this.items.reduce((min, item) => Math.min(min, item.penalty), Infinity)
    }
}
