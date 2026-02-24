import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
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
            // 附魔书：显示所有附魔（含诅咒），因为捡到的书可能有任何附魔
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

    /**
     * 检测物品池中跨物品的附魔冲突
     * 返回: [{ key, options: [{id, name, maxLevel}] }]
     */
    const poolConflicts = computed(() => {
        // 收集池中所有不重复的附魔 ID
        const enchIds = new Set()
        for (const item of itemPool.value) {
            for (const e of item.enchants) enchIds.add(e.id)
        }

        // 用 Union-Find 分组冲突
        const ids = [...enchIds]
        const parent = new Map()
        for (const id of ids) parent.set(id, id)
        function find(x) {
            if (parent.get(x) !== x) parent.set(x, find(parent.get(x)))
            return parent.get(x)
        }
        function union(a, b) { parent.set(find(a), find(b)) }

        for (const id of ids) {
            const data = enchantmentsData.find(e => e.id === id)
            if (!data) continue
            for (const cid of data.conflicts) {
                if (enchIds.has(cid)) union(id, cid)
            }
        }

        // 收集冲突组
        const groups = new Map()
        for (const id of ids) {
            const root = find(id)
            if (!groups.has(root)) groups.set(root, [])
            groups.get(root).push(id)
        }

        const conflicts = []
        for (const [, groupIds] of groups) {
            if (groupIds.length <= 1) continue
            const sortedIds = [...groupIds].sort()
            const key = sortedIds.join('|')
            const options = sortedIds.map(id => {
                const data = enchantmentsData.find(e => e.id === id)
                return { id, name: data?.name || id, maxLevel: data?.maxLevel || 1 }
            })
            conflicts.push({ key, options })
        }
        return conflicts
    })

    /** 用户对冲突的选择偏好  { conflictKey: chosenEnchId } */
    const conflictResolutions = ref({})

    /** 当池变化时，清除不再相关的冲突选择 */
    watch(poolConflicts, (groups) => {
        const validKeys = new Set(groups.map(g => g.key))
        for (const k of Object.keys(conflictResolutions.value)) {
            if (!validKeys.has(k)) delete conflictResolutions.value[k]
        }
    })

    /** 是否所有冲突都已解决 */
    const allConflictsResolved = computed(() =>
        poolConflicts.value.every(g => conflictResolutions.value[g.key])
    )

    /** 池中是否有至少一个附魔书包含适用于目标物品的附魔 */
    const hasApplicableBooks = computed(() => {
        const targetType = poolItemType.value
        if (!targetType) return true  // 没有目标物品时不限制
        return itemPool.value.some(item => {
            if (item.type !== 'enchanted_book') return false
            return item.enchants.some(e => {
                const data = enchantmentsData.find(d => d.id === e.id)
                return data && data.suitableWeapons.includes(targetType)
            })
        })
    })

    /** 物品池中是否至少 2 个物品、所有冲突已解决、且有有效附魔书 */
    const canCalculate = computed(() =>
        itemPool.value.length >= 2
        && (poolConflicts.value.length === 0 || allConflictsResolved.value)
        && hasApplicableBooks.value
    )

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

    /** 清空物品池 */
    function clearPool() {
        itemPool.value = []
        conflictResolutions.value = {}
    }

    /** 设置冲突偏好（选择保留哪个附魔） */
    function resolveConflict(groupKey, chosenEnchId) {
        conflictResolutions.value[groupKey] = chosenEnchId
    }

    /** 根据冲突选择生成清洗后的物品列表（不修改原始池） */
    function getResolvedItems() {
        // 收集要移除的附魔 ID
        const removeIds = new Set()
        for (const group of poolConflicts.value) {
            const chosen = conflictResolutions.value[group.key]
            if (chosen) {
                for (const opt of group.options) {
                    if (opt.id !== chosen) removeIds.add(opt.id)
                }
            }
        }

        // 深拷贝并过滤，保留原始附魔用于显示
        const items = JSON.parse(JSON.stringify(itemPool.value))
        for (const item of items) {
            const hasRemoved = item.enchants.some(e => removeIds.has(e.id))
            if (hasRemoved) {
                item.originalEnchants = [...item.enchants]  // 保存原始附魔
                item.enchants = item.enchants.filter(e => !removeIds.has(e.id))
            }
        }
        // 移除空书 + 移除所有附魔都不适用目标物品的书
        const targetType = items.find(i => i.type !== 'enchanted_book')?.type
        return items.filter(i => {
            if (i.type !== 'enchanted_book') return true
            if (i.enchants.length === 0) return false
            // 如果池中有目标物品，检查书中是否有任何附魔适用
            if (targetType) {
                const hasApplicable = i.enchants.some(e => {
                    const data = enchantmentsData.find(d => d.id === e.id)
                    return data && data.suitableWeapons.includes(targetType)
                })
                if (!hasApplicable) return false
            }
            return true
        })
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
                    items: getResolvedItems(),
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
        poolConflicts, conflictResolutions, allConflictsResolved,
        // 方法
        setEdition, setEditingType,
        addEditingEnch, removeEditingEnch, updateEditingEnchLevel,
        addToPool, removeFromPool, clearPool, resolveConflict,
        runCalculation, cancelCalculation, reset,
        getEnchName, getEnchData, getItemDisplayName, getItemIcon,
        intToRoman,
    }
})
