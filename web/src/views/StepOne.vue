<template>
  <div class="step-one">
    <!-- 游戏版本选择 -->
    <div class="card">
      <div class="card-title">游戏版本</div>
      <div class="radio-group">
        <label>
          <input type="radio" value="java" v-model="store.edition" @change="store.setEdition('java')">
          <span>Java 版</span>
        </label>
        <label>
          <input type="radio" value="bedrock" v-model="store.edition" @change="store.setEdition('bedrock')">
          <span>基岩版</span>
        </label>
      </div>
    </div>

    <!-- 武器选择 -->
    <div class="card">
      <div class="card-title">选择物品</div>
      <div class="weapon-grid">
        <button
          v-for="w in store.weapons"
          :key="w.id"
          class="weapon-card"
          :class="{ 'weapon-active': store.selectedWeaponId === w.id }"
          :title="`${w.name} (${w.nameEn})`"
          @click="store.setWeapon(w.id)"
        >
          <img
            class="weapon-icon"
            :src="`/icons/${w.icon}`"
            :alt="w.name"
          >
          <span class="weapon-name">{{ w.name }}</span>
        </button>
      </div>

      <div class="item-props">
        <div class="prop-row">
          <label class="form-label">累积惩罚值 (Penalty)</label>
          <div class="number-input">
            <button class="btn btn-ghost btn-sm" @click="store.originPenalty = Math.max(0, store.originPenalty - 1)">−</button>
            <input class="form-input" type="number" v-model.number="store.originPenalty" min="0" max="31">
            <button class="btn btn-ghost btn-sm" @click="store.originPenalty++">+</button>
          </div>
        </div>
        <div class="prop-row">
          <label class="form-label">耐久度 (%)</label>
          <div class="number-input">
            <input class="range-slider" type="range" v-model.number="store.originDurability" min="0" max="100">
            <span class="durability-value">{{ store.originDurability }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 初始魔咒 -->
    <div class="card">
      <div class="card-title">
        初始魔咒
        <span class="tag">物品已有的魔咒</span>
      </div>

      <div class="origin-enchs" v-if="store.originEnchs.length > 0">
        <div class="origin-ench-card" v-for="ench in store.originEnchs" :key="ench.id">
          <div class="origin-ench-header">
            <span class="ench-name">{{ store.getEnchName(ench.id) }}</span>
            <button class="remove-btn" @click="store.removeOriginEnch(ench.id)">✕</button>
          </div>
          <div class="level-selector">
            <button
              v-for="l in store.getEnchData(ench.id)?.maxLevel"
              :key="l"
              class="level-btn"
              :class="{ 'level-active': ench.level === l }"
              @click="ench.level = l"
            >
              {{ store.intToRoman(l) }}
            </button>
          </div>
        </div>
      </div>
      <p v-else class="empty-hint">暂无初始魔咒（大多数情况下留空即可）</p>

      <div class="ench-add" v-if="availableOriginEnchs.length > 0">
        <select class="form-select" v-model="originEnchToAdd">
          <option value="">+ 添加初始魔咒...</option>
          <option v-for="e in availableOriginEnchs" :key="e.id" :value="e.id">
            {{ e.name }} ({{ e.id }})
          </option>
        </select>
      </div>
    </div>

    <!-- 导航 -->
    <div class="nav-buttons">
      <div></div>
      <button class="btn btn-primary" @click="store.currentStep = 2">
        下一步 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useEnchantStore } from '../stores/enchant.js'

const store = useEnchantStore()
const originEnchToAdd = ref('')

const availableOriginEnchs = computed(() => {
  const existIds = new Set(store.originEnchs.map(e => e.id))
  return store.availableEnchantments.filter(e => !existIds.has(e.id))
})

watch(originEnchToAdd, (id) => {
  if (id) {
    store.addOriginEnch(id, 1)
    originEnchToAdd.value = ''
  }
})
</script>

<style scoped>
.step-one {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 隐藏 number input 浏览器自带的上下箭头 */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}

.weapon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  margin-bottom: 4px;
}

.weapon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: var(--bg-surface-2);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-sans);
}

.weapon-card:hover {
  border-color: var(--color-primary-dim);
  background: var(--bg-surface-3);
  transform: translateY(-1px);
}

.weapon-active {
  border-color: var(--color-primary);
  background: var(--color-primary-dim);
  box-shadow: 0 0 12px var(--color-primary-glow);
}

.weapon-icon {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.weapon-name {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.weapon-active .weapon-name {
  color: white;
  font-weight: 600;
}

.item-props {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.durability-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary-light);
  min-width: 50px;
  text-align: right;
}

.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 160px;
  height: 6px;
  background: var(--bg-surface-3);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid var(--color-primary-light);
  box-shadow: 0 0 8px var(--color-primary-glow);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid var(--color-primary-light);
}

.origin-enchs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.origin-ench-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  padding: 12px;
  animation: fadeIn 200ms ease;
  transition: border-color var(--transition-fast);
}

.origin-ench-card:hover {
  border-color: var(--color-primary-dim);
}

.origin-ench-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ench-name {
  color: var(--color-primary-light);
  font-weight: 600;
  font-size: 0.9rem;
}

.level-selector {
  display: flex;
  gap: 4px;
}

.level-btn {
  width: 30px;
  height: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-3);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.level-btn:hover {
  border-color: var(--color-primary-dim);
}

.level-active {
  background: var(--color-primary-dim);
  border-color: var(--color-primary);
  color: white;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 2px;
  transition: color var(--transition-fast);
}

.remove-btn:hover {
  color: var(--color-danger);
}

.empty-hint {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  margin-bottom: 12px;
}

.ench-add {
  margin-top: 4px;
}

.nav-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
</style>
