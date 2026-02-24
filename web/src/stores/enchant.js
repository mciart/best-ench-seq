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
    const enumTimeout = ref(10)  // 默认 10 分钟

    // --- 步骤控制 ---
    const currentStep = ref(1)
    const result = ref(null)
    const isCalculating = ref(false)
    const calcElapsed = ref(0)          // 已用时间（秒）
    const calcProgress = ref(0)         // 已搜索排列数
    let calcTimer = null
    let calcWorker = null

    // === 计算属性 ===
    const weapons = computed(() => weaponsData)

    const editingWeapon = computed(() =>
        weaponsData.find(w => w.id === editingItemType.value)
    )

    const isEditingBook = computed(() => editingItemType.value === 'enchanted_book')

    /** 物品池中已有的非书物品类型（用于约束后续添加）*/
    const poolItemType = computed(() => {
        const realItem = itemPool.value.find(i => i.type !== 'enchanted_book')
        return realItem ? realItem.type : null
    })

    /** 当前编辑物品类型+版本下可用的魔咒 */
    const availableEnchantments = computed(() => {
        const typeId = editingItemType.value
        return enchantmentsData.filter(ench => {
            if (ench.edition !== 'both' && ench.edition !== edition.value) return false
            if (typeId === 'enchanted_book') {
                // 附魔书：如果池中已有真实物品，只显示该物品类型适用的附魔
                if (poolItemType.value) {
                    return ench.suitableWeapons.includes(poolItemType.value)
                }
                // 池中没有真实物品时显示所有附魔
                return true
            }
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

    /** 当前编辑的物品类型是否可以添加到池中（非书物品必须同类型） */
    const canAddToPool = computed(() => {
        const typeId = editingItemType.value
        if (typeId === 'enchanted_book') {
            return editingEnchs.value.length > 0
        }
        // 非书物品：如果池中已有不同类型的真实物品，不允许添加
        if (poolItemType.value && poolItemType.value !== typeId) return false
        return true
    })

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
        calcElapsed.value = 0
        calcProgress.value = 0

        // 启动计时器
        const startTime = Date.now()
        calcTimer = setInterval(() => {
            calcElapsed.value = Math.round((Date.now() - startTime) / 1000)
        }, 200)

        return new Promise((resolve) => {
            calcWorker = new Worker(
                new URL('../workers/calc.worker.js', import.meta.url),
                { type: 'module' }
            )

            calcWorker.onmessage = (e) => {
                const { type, payload } = e.data
                if (type === 'result') {
                    result.value = payload
                    currentStep.value = 2
                    cleanup()
                    resolve()
                } else if (type === 'progress') {
                    calcProgress.value = payload.checked
                } else if (type === 'error') {
                    console.error('Worker error:', payload)
                    cleanup()
                    resolve()
                }
            }

            calcWorker.onerror = (err) => {
                console.error('Worker crashed:', err)
                cleanup()
                resolve()
            }

            calcWorker.postMessage({
                type: 'calculate',
                payload: {
                    edition: edition.value,
                    items: JSON.parse(JSON.stringify(itemPool.value)),
                    forgeMode: forgeMode.value,
                    ignoreCostLimit: ignoreCostLimit.value,
                    timeout: enumTimeout.value * 60 * 1000, // 分钟 → 毫秒
                },
            })
        })

        function cleanup() {
            clearInterval(calcTimer)
            calcTimer = null
            if (calcWorker) {
                calcWorker.terminate()
                calcWorker = null
            }
            isCalculating.value = false
        }
    }

    function cancelCalculation() {
        if (calcWorker) {
            calcWorker.terminate()
            calcWorker = null
        }
        clearInterval(calcTimer)
        calcTimer = null
        isCalculating.value = false
        calcElapsed.value = 0
        calcProgress.value = 0
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
        currentStep, result, isCalculating, calcElapsed, calcProgress,
        // 计算属性
        weapons, editingWeapon, isEditingBook,
        availableEnchantments, selectableEnchs,
        poolCount, poolItemType, hasRealItem, canCalculate, canAddToPool,
        // 方法
        setEdition, setEditingType,
        addEditingEnch, removeEditingEnch, updateEditingEnchLevel,
        addToPool, removeFromPool,
        runCalculation, cancelCalculation, reset,
        getEnchName, getEnchData, getItemDisplayName, getItemIcon,
        intToRoman,
    }
})
