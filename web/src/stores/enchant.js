import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import weaponsData from '@core/data/weapons.json'
import enchantmentsData from '@core/data/enchantments.json'

let nextId = 1

export const useEnchantStore = defineStore('enchant', () => {
    // === 状态 ===
    const edition = ref('java')

    // --- 编辑区（正在配置的物品，尚未加入池子）---
    const editingItemType = ref('sword')       // 物品类型 ID 或 'enchanted_book'
    const editingPenalty = ref(0)
    const editingDamaged = ref(false)
    const editingEnchs = ref([])               // [{id, level}]

    // --- 物品池（已确认的物品列表）---
    const itemPool = ref([])                   // [{ uid, type, penalty, damaged, enchants }]

    // --- 算法选项 ---
    const forgeMode = ref('normal')
    const ignoreCostLimit = ref(false)
    const enumTimeout = ref(60)

    // --- 步骤控制 ---
    const currentStep = ref(1)
    const result = ref(null)
    const isCalculating = ref(false)

    // === 计算属性 ===
    const weapons = computed(() => weaponsData)

    const editingWeapon = computed(() =>
        weaponsData.find(w => w.id === editingItemType.value)
    )

    const isEditingBook = computed(() => editingItemType.value === 'enchanted_book')

    /** 当前编辑物品类型+版本下可用的魔咒 */
    const availableEnchantments = computed(() => {
        const typeId = editingItemType.value
        return enchantmentsData.filter(ench => {
            if (ench.edition !== 'both' && ench.edition !== edition.value) return false
            // 附魔书可以放任何附魔
            if (typeId === 'enchanted_book') return true
            if (!ench.suitableWeapons.includes(typeId)) return false
            return true
        })
    })

    /** 编辑区中尚未选择的、不冲突的可选魔咒 */
    const selectableEnchs = computed(() => {
        const selectedIds = new Set(editingEnchs.value.map(e => e.id))
        return availableEnchantments.value.filter(ench => {
            if (selectedIds.has(ench.id)) return false
            for (const selected of editingEnchs.value) {
                if (ench.conflicts.includes(selected.id)) return false
                const selectedData = enchantmentsData.find(e => e.id === selected.id)
                if (selectedData && selectedData.conflicts.includes(ench.id)) return false
            }
            return true
        })
    })

    /** 物品池中的总物品数 */
    const poolCount = computed(() => itemPool.value.length)

    /** 物品池中是否有实际物品（非书）*/
    const hasRealItem = computed(() => itemPool.value.some(i => i.type !== 'enchanted_book'))

    /** 物品池中是否至少 2 个物品 */
    const canCalculate = computed(() => itemPool.value.length >= 2)

    // === 方法 ===
    function setEdition(ed) {
        edition.value = ed
        // 清除编辑区中不兼容的魔咒
        editingEnchs.value = editingEnchs.value.filter(e => {
            const data = enchantmentsData.find(d => d.id === e.id)
            return data && (data.edition === 'both' || data.edition === ed)
        })
        // 清除物品池中不兼容的魔咒
        for (const item of itemPool.value) {
            item.enchants = item.enchants.filter(e => {
                const data = enchantmentsData.find(d => d.id === e.id)
                return data && (data.edition === 'both' || data.edition === ed)
            })
        }
    }

    function setEditingType(id) {
        editingItemType.value = id
        editingEnchs.value = []
        editingPenalty.value = 0
        editingDamaged.value = false
    }

    function addEditingEnch(id, level) {
        const data = enchantmentsData.find(e => e.id === id)
        if (!data) return
        editingEnchs.value.push({ id, level: level || data.maxLevel })
    }

    function removeEditingEnch(id) {
        editingEnchs.value = editingEnchs.value.filter(e => e.id !== id)
    }

    function updateEditingEnchLevel(id, level) {
        const ench = editingEnchs.value.find(e => e.id === id)
        if (ench) ench.level = level
    }

    /** 将编辑中的物品加入物品池 */
    function addToPool() {
        if (editingEnchs.value.length === 0 && editingItemType.value === 'enchanted_book') return

        const item = {
            uid: nextId++,
            type: editingItemType.value,
            penalty: editingPenalty.value,
            damaged: editingDamaged.value,
            enchants: [...editingEnchs.value.map(e => ({ ...e }))],
        }
        itemPool.value.push(item)

        // 重置编辑区（保持类型选择不变，方便快速连续添加）
        editingEnchs.value = []
        editingPenalty.value = 0
        editingDamaged.value = false
    }

    /** 从物品池移除指定物品 */
    function removeFromPool(uid) {
        itemPool.value = itemPool.value.filter(i => i.uid !== uid)
    }

    async function runCalculation() {
        if (!canCalculate.value) return
        isCalculating.value = true
        try {
            const { calculateFromPool } = await import('@core/calculator.js')
            result.value = calculateFromPool({
                edition: edition.value,
                items: itemPool.value,
                forgeMode: forgeMode.value,
                ignoreCostLimit: ignoreCostLimit.value,
                timeout: enumTimeout.value * 1000,
            })
            currentStep.value = 2
        } finally {
            isCalculating.value = false
        }
    }

    function reset() {
        itemPool.value = []
        editingEnchs.value = []
        editingPenalty.value = 0
        editingDamaged.value = false
        result.value = null
        currentStep.value = 1
    }

    function getEnchName(id) {
        const data = enchantmentsData.find(e => e.id === id)
        return data ? data.name : id
    }

    function getEnchData(id) {
        return enchantmentsData.find(e => e.id === id)
    }

    /** 通过物品类型 ID 获取物品显示名 */
    function getItemDisplayName(type) {
        if (type === 'enchanted_book') return '附魔书'
        const w = weaponsData.find(w => w.id === type)
        return w ? w.name : type
    }

    /** 通过物品类型 ID 获取图标 */
    function getItemIcon(type) {
        if (type === 'enchanted_book') return 'enchanted_book.png'
        const w = weaponsData.find(w => w.id === type)
        return w ? w.icon : ''
    }

    function intToRoman(num) {
        if (num <= 0 || num > 10) return String(num)
        const vals = [10, 9, 5, 4, 1]
        const syms = ['X', 'IX', 'V', 'IV', 'I']
        let result = ''
        for (let i = 0; i < vals.length; i++) {
            while (num >= vals[i]) {
                result += syms[i]
                num -= vals[i]
            }
        }
        return result
    }

    return {
        // 状态
        edition, editingItemType, editingPenalty, editingDamaged, editingEnchs,
        itemPool, forgeMode, ignoreCostLimit, enumTimeout,
        currentStep, result, isCalculating,
        // 计算属性
        weapons, editingWeapon, isEditingBook,
        availableEnchantments, selectableEnchs,
        poolCount, hasRealItem, canCalculate,
        // 方法
        setEdition, setEditingType,
        addEditingEnch, removeEditingEnch, updateEditingEnchLevel,
        addToPool, removeFromPool,
        runCalculation, reset,
        getEnchName, getEnchData, getItemDisplayName, getItemIcon,
        intToRoman,
    }
})
