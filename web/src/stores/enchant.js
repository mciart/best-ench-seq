import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import weaponsData from '@core/data/weapons.json'
import enchantmentsData from '@core/data/enchantments.json'

export const useEnchantStore = defineStore('enchant', () => {
    // === 状态 ===
    const edition = ref('java')
    const selectedWeaponId = ref('sword')
    const originPenalty = ref(0)
    const originDamaged = ref(false)
    const originEnchs = ref([])    // [{id, level}] 初始已有的魔咒
    const neededEnchs = ref([])    // [{id, level}] 需求的魔咒
    const algorithm = ref('difficultyFirst')
    const forgeMode = ref('normal')
    const ignoreCostLimit = ref(false)
    const enumTimeout = ref(5)      // 枚举算法超时（秒）

    // 步骤控制
    const currentStep = ref(1)

    // 计算结果
    const result = ref(null)
    const isCalculating = ref(false)

    // === 计算属性 ===
    const weapons = computed(() => weaponsData)

    const selectedWeapon = computed(() =>
        weaponsData.find(w => w.id === selectedWeaponId.value)
    )

    /** 当前武器+版本下可用的魔咒 */
    const availableEnchantments = computed(() => {
        return enchantmentsData.filter(ench => {
            if (ench.edition !== 'both' && ench.edition !== edition.value) return false
            if (!ench.suitableWeapons.includes(selectedWeaponId.value)) return false
            return true
        })
    })

    /** 过滤掉已在初始魔咒中且等级已满的魔咒，以及与已选魔咒冲突的 */
    const selectableEnchs = computed(() => {
        const selectedIds = new Set(neededEnchs.value.map(e => e.id))
        const originIds = new Set(originEnchs.value.map(e => e.id))

        return availableEnchantments.value.filter(ench => {
            // 已经在需求列表中
            if (selectedIds.has(ench.id)) return false
            // 检查与已选魔咒的冲突
            for (const selected of neededEnchs.value) {
                if (ench.conflicts.includes(selected.id)) return false
                const selectedData = enchantmentsData.find(e => e.id === selected.id)
                if (selectedData && selectedData.conflicts.includes(ench.id)) return false
            }
            return true
        })
    })

    // === 方法 ===
    function setEdition(ed) {
        edition.value = ed
        // 清除不兼容的魔咒
        originEnchs.value = originEnchs.value.filter(e => {
            const data = enchantmentsData.find(d => d.id === e.id)
            return data && (data.edition === 'both' || data.edition === ed)
        })
        neededEnchs.value = neededEnchs.value.filter(e => {
            const data = enchantmentsData.find(d => d.id === e.id)
            return data && (data.edition === 'both' || data.edition === ed)
        })
    }

    function setWeapon(id) {
        selectedWeaponId.value = id
        originEnchs.value = []
        neededEnchs.value = []
    }

    function addNeededEnch(id, level) {
        const data = enchantmentsData.find(e => e.id === id)
        if (!data) return
        neededEnchs.value.push({ id, level: level || data.maxLevel })
    }

    function removeNeededEnch(id) {
        neededEnchs.value = neededEnchs.value.filter(e => e.id !== id)
    }

    function updateNeededEnchLevel(id, level) {
        const ench = neededEnchs.value.find(e => e.id === id)
        if (ench) ench.level = level
    }

    function addOriginEnch(id, level) {
        const data = enchantmentsData.find(e => e.id === id)
        if (!data) return
        originEnchs.value.push({ id, level: level || 1 })
    }

    function removeOriginEnch(id) {
        originEnchs.value = originEnchs.value.filter(e => e.id !== id)
    }

    async function runCalculation() {
        isCalculating.value = true
        try {
            // 动态导入避免循环依赖
            const { calculate } = await import('@core/calculator.js')
            result.value = calculate({
                edition: edition.value,
                originItem: {
                    name: selectedWeapon.value.name,
                    enchants: originEnchs.value,
                    durability: originDamaged.value ? 0 : 100,
                    penalty: originPenalty.value,
                },
                neededEnchs: neededEnchs.value,
                algorithm: algorithm.value,
                forgeMode: forgeMode.value,
                ignoreCostLimit: ignoreCostLimit.value,
                timeout: enumTimeout.value * 1000,
            })
            currentStep.value = 3
        } finally {
            isCalculating.value = false
        }
    }

    function reset() {
        originEnchs.value = []
        neededEnchs.value = []
        originPenalty.value = 0
        originDamaged.value = false
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
        edition, selectedWeaponId, originPenalty, originDamaged,
        originEnchs, neededEnchs, algorithm, forgeMode, ignoreCostLimit, enumTimeout,
        currentStep, result, isCalculating,
        // 计算属性
        weapons, selectedWeapon, availableEnchantments, selectableEnchs,
        // 方法
        setEdition, setWeapon, addNeededEnch, removeNeededEnch, updateNeededEnchLevel,
        addOriginEnch, removeOriginEnch, runCalculation, reset,
        getEnchName, getEnchData, intToRoman,
    }
})
