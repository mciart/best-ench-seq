/**
 * BestEnchSeq 核心模块统一导出
 *
 * 未来 WASM 迁移时，只需修改此文件的内部实现，
 * 对外接口保持不变，前端代码无需任何修改。
 */

export {
    // 数据结构
    ForgeMode,
    Edition,
    ENCHANTED_BOOK,
    createEnch,
    createItem,
    cloneItem,
    createStep,
} from './types.js'

export {
    // 铁砧合并逻辑
    combineLevel,
    isConflicting,
    calcForgeCost,
    calcItemCost,
    mergeItems,
    getEnchantment,
    getAllEnchantments,
} from './forge.js'

export {
    // 物品池
    ItemPool,
} from './itemPool.js'

export {
    // 计算入口
    calculate,
    getAvailableEnchantments,
    getWeapons,
} from './calculator.js'
