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

    <!-- 物品选择 + 编辑区 -->
    <div class="card">
      <div class="card-title">添加物品</div>
      <div class="weapon-grid">
        <button
          v-for="w in store.weapons"
          :key="w.id"
          class="weapon-card"
          :class="{ 'weapon-active': store.editingItemType === w.id }"
          :title="`${w.name} (${w.nameEn})`"
          @click="store.setEditingType(w.id)"
        >
          <img class="weapon-icon" :src="`/icons/${w.icon}`" :alt="w.name">
          <span class="weapon-name">{{ w.name }}</span>
        </button>
        <!-- 附魔书卡片 -->
        <button
          class="weapon-card"
          :class="{ 'weapon-active': store.isEditingBook }"
          title="附魔书 (Enchanted Book)"
          @click="store.setEditingType('enchanted_book')"
        >
          <img class="weapon-icon" src="/icons/enchanted_book.png" alt="附魔书">
          <span class="weapon-name">附魔书</span>
        </button>
      </div>

      <!-- 物品属性编辑区（非附魔书时显示） -->
      <div class="editing-area" v-if="!store.isEditingBook">
        <div class="item-props">
          <div class="prop-row">
            <label class="form-label">累积惩罚值 (Penalty)</label>
            <div class="number-input">
              <button class="btn btn-ghost btn-sm" @click="store.editingPenalty = Math.max(0, store.editingPenalty - 1)">−</button>
              <input class="form-input" type="number" v-model.number="store.editingPenalty" min="0" max="31">
              <button class="btn btn-ghost btn-sm" @click="store.editingPenalty++">+</button>
            </div>
          </div>
          <div class="prop-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="store.editingDamaged">
              <span>物品已受损（非满耐久，铁砧额外 +2 级经验）</span>
            </label>
          </div>
        </div>

        <!-- 物品已有附魔 -->
        <div class="ench-section">
          <p class="section-label">物品已有附魔：</p>
          <div class="selected-enchs" v-if="store.editingEnchs.length > 0">
            <div class="ench-card" v-for="ench in store.editingEnchs" :key="ench.id">
              <div class="ench-card-header">
                <span class="ench-name">{{ store.getEnchName(ench.id) }}</span>
                <button class="remove-btn" @click="store.removeEditingEnch(ench.id)">✕</button>
              </div>
              <div class="level-selector">
                <button
                  v-for="l in store.getEnchData(ench.id)?.maxLevel"
                  :key="l"
                  class="level-btn"
                  :class="{ 'level-active': ench.level === l }"
                  @click="store.updateEditingEnchLevel(ench.id, l)"
                >
                  {{ store.intToRoman(l) }}
                </button>
              </div>
            </div>
          </div>
          <div class="ench-buttons" v-if="store.selectableEnchs.length > 0">
            <button
              v-for="e in store.selectableEnchs"
              :key="e.id"
              class="ench-btn"
              @click="store.addEditingEnch(e.id)"
            >
              {{ e.name }}
            </button>
          </div>
          <p v-else-if="store.editingEnchs.length === 0" class="empty-hint">
            无初始附魔（可直接添加空物品到池子）
          </p>
        </div>
      </div>

      <!-- 附魔书编辑区 -->
      <div class="editing-area" v-else>
        <div class="item-props">
          <div class="prop-row">
            <label class="form-label">累积惩罚值 (Penalty)</label>
            <div class="number-input">
              <button class="btn btn-ghost btn-sm" @click="store.editingPenalty = Math.max(0, store.editingPenalty - 1)">−</button>
              <input class="form-input" type="number" v-model.number="store.editingPenalty" min="0" max="31">
              <button class="btn btn-ghost btn-sm" @click="store.editingPenalty++">+</button>
            </div>
          </div>
        </div>
        <div class="ench-section">
          <p class="section-label">选择附魔：</p>
          <div class="selected-enchs" v-if="store.editingEnchs.length > 0">
            <div class="ench-card" v-for="ench in store.editingEnchs" :key="ench.id">
              <div class="ench-card-header">
                <span class="ench-name">{{ store.getEnchName(ench.id) }}</span>
                <button class="remove-btn" @click="store.removeEditingEnch(ench.id)">✕</button>
              </div>
              <div class="ench-card-body">
                <div class="level-selector">
                  <button
                    v-for="l in store.getEnchData(ench.id)?.maxLevel"
                    :key="l"
                    class="level-btn"
                    :class="{ 'level-active': ench.level === l }"
                    @click="store.updateEditingEnchLevel(ench.id, l)"
                  >
                    {{ store.intToRoman(l) }}
                  </button>
                </div>
                <div class="ench-meta">
                  <span class="tag" :class="multiplierClass(ench.id)">
                    ×{{ getMultiplier(ench.id) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="ench-buttons" v-if="store.selectableEnchs.length > 0">
            <button
              v-for="e in store.selectableEnchs"
              :key="e.id"
              class="ench-btn"
              @click="store.addEditingEnch(e.id)"
            >
              {{ e.name }}
            </button>
          </div>
          <p v-else-if="store.editingEnchs.length === 0" class="empty-hint">
            没有可选的魔咒
          </p>
        </div>
      </div>

      <!-- 添加按钮 -->
      <div class="add-btn-row">
        <button
          class="btn btn-accent"
          :disabled="!store.canAddToPool"
          @click="store.addToPool()"
        >
          + 添加到物品池
        </button>
        <p class="type-conflict-hint" v-if="!store.isEditingBook && store.poolItemType && store.poolItemType !== store.editingItemType">
          ⚠ 物品池中已有「{{ store.getItemDisplayName(store.poolItemType) }}」，不同类型物品无法合并
        </p>
      </div>
    </div>

    <!-- 物品池列表 -->
    <div class="card" v-if="store.poolCount > 0">
      <div class="card-title">
        物品池
        <span class="tag tag-purple">{{ store.poolCount }} 个物品</span>
      </div>
      <div class="pool-list">
        <div class="pool-item" v-for="item in sortedPool" :key="item.uid">
          <div class="pool-item-left">
            <img class="pool-icon" :src="`/icons/${store.getItemIcon(item.type)}`" :alt="store.getItemDisplayName(item.type)">
            <div class="pool-item-info">
              <span class="pool-item-name">{{ store.getItemDisplayName(item.type) }}</span>
              <span class="pool-item-meta" v-if="item.penalty > 0 || (item.type !== 'enchanted_book' && item.damaged)">
                P:{{ item.penalty }}{{ item.damaged ? ' · 已受损' : '' }}
              </span>
            </div>
          </div>
          <div class="pool-item-enchs">
            <span class="pool-ench" v-for="e in item.enchants" :key="e.id">
              {{ store.getEnchName(e.id) }} {{ store.intToRoman(e.level) }}
            </span>
            <span class="pool-ench empty" v-if="item.enchants.length === 0">无附魔</span>
          </div>
          <button class="remove-btn" @click="store.removeFromPool(item.uid)">✕</button>
        </div>
      </div>
    </div>

    <!-- 算法选项（折叠） -->
    <details class="card options-card">
      <summary class="card-title options-summary">高级选项</summary>
      <div class="options">
        <label class="checkbox-label">
          <input type="checkbox" v-model="store.ignoreCostLimit">
          <span>允许「过于昂贵」的操作 (单步 ≥ 40 级)</span>
        </label>
        <div class="forge-mode">
          <label class="form-label">锻造模式</label>
          <select class="form-select" v-model="store.forgeMode" style="max-width: 240px;">
            <option value="normal">标准模式</option>
            <option value="ignoreFixing">忽略修复费用</option>
            <option value="ignorePenalty">忽略累积惩罚</option>
            <option value="ignoreBoth">忽略修复+惩罚</option>
          </select>
        </div>
        <div class="timeout-setting">
          <label class="form-label">枚举搜索超时</label>
          <div class="timeout-row">
            <input
              type="number"
              class="form-input timeout-input"
              min="1"
              max="60"
              step="1"
              v-model.number="store.enumTimeout"
            >
            <span class="timeout-unit">分钟</span>
          </div>
          <p class="timeout-hint">
            物品越多搜索空间越大。7 个物品约 1 秒，10+ 个可能需要数分钟
          </p>
        </div>
      </div>
    </details>

    <!-- 计算按钮 -->
    <div class="nav-buttons">
      <div></div>
      <div class="calc-area">
        <button
          v-if="!store.isCalculating"
          class="btn btn-primary btn-lg"
          :disabled="!store.canCalculate"
          @click="store.runCalculation()"
        >
          开始计算
        </button>
        <template v-else>
          <span class="calc-timer">计算中… {{ formatElapsed(store.calcElapsed) }}</span>
          <button class="btn btn-danger" @click="store.cancelCalculation()">
            取消
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEnchantStore } from '../stores/enchant.js'
import enchantmentsData from '@core/data/enchantments.json'

const store = useEnchantStore()

function formatElapsed(seconds) {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m${s}s`
}

// 物品池排序：真实物品在前，附魔书在后
const sortedPool = computed(() =>
  [...store.itemPool].sort((a, b) => {
    const aBook = a.type === 'enchanted_book' ? 1 : 0
    const bBook = b.type === 'enchanted_book' ? 1 : 0
    return aBook - bBook
  })
)

function getMultiplier(id) {
  const data = enchantmentsData.find(e => e.id === id)
  return data ? data.bookMultiplier : '?'
}

function multiplierClass(id) {
  const m = getMultiplier(id)
  if (m <= 1) return 'tag-green'
  if (m <= 2) return 'tag-purple'
  return 'tag-red'
}
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

/* 编辑区 */
.editing-area {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.item-props {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* 附魔区 */
.ench-section {
  margin-top: 4px;
}

.section-label {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.selected-enchs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.ench-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  padding: 12px;
  animation: fadeIn 200ms ease;
  transition: border-color var(--transition-fast);
}

.ench-card:hover {
  border-color: var(--color-primary-dim);
}

.ench-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ench-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.ench-meta {
  font-size: 0.75rem;
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

.ench-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ench-btn {
  padding: 6px 14px;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ench-btn:hover {
  background: var(--color-primary-dim);
  border-color: var(--color-primary);
  color: white;
  transform: scale(1.02);
}

.empty-hint {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  margin-bottom: 12px;
}

/* 添加按钮 */
.add-btn-row {
  margin-top: 16px;
  text-align: center;
}

.type-conflict-hint {
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--color-warning, #f0ad4e);
}

.btn-accent {
  background: linear-gradient(135deg, var(--color-primary-dim), var(--color-primary));
  color: white;
  border: none;
  padding: 10px 28px;
  border-radius: var(--border-radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-sans);
}

.btn-accent:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px var(--color-primary-glow);
}

.btn-accent:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 物品池列表 */
.pool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pool-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  animation: fadeIn 200ms ease;
  transition: border-color var(--transition-fast);
}

.pool-item:hover {
  border-color: var(--color-primary-dim);
}

.pool-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.pool-icon {
  width: 24px;
  height: 24px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.pool-item-info {
  display: flex;
  flex-direction: column;
}

.pool-item-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.pool-item-meta {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.pool-item-enchs {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pool-ench {
  padding: 2px 8px;
  background: var(--bg-surface-3);
  border-radius: 10px;
  font-size: 0.75rem;
  color: var(--color-primary-light);
}

.pool-ench.empty {
  color: var(--text-dim);
  font-style: italic;
}

/* 高级选项 */
.options-card {
  cursor: default;
}

.options-summary {
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.options-summary::marker,
.options-summary::-webkit-details-marker {
  display: none;
}

.options-summary::after {
  content: '▸';
  margin-left: 8px;
  transition: transform var(--transition-fast);
  display: inline-block;
}

details[open] .options-summary::after {
  transform: rotate(90deg);
}

.options {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forge-mode {
  margin-top: 4px;
}

.timeout-setting {
  margin-top: 8px;
}

.timeout-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.timeout-input {
  width: 70px;
  text-align: center;
}

.timeout-unit {
  font-size: 0.9rem;
  color: var(--text-dim);
}

.timeout-hint {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-top: 4px;
}

.calc-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.calc-timer {
  font-size: 0.9rem;
  color: var(--color-primary-light);
  font-variant-numeric: tabular-nums;
}

.btn-danger {
  background: rgba(220, 53, 69, 0.8);
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}
.btn-danger:hover {
  background: rgba(220, 53, 69, 1);
}

.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 200px;
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

/* 计算按钮 */
.nav-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.btn-lg {
  padding: 12px 32px;
  font-size: 1rem;
}

.loading {
  animation: pulse 1.5s infinite;
}

@media (max-width: 768px) {
  .selected-enchs {
    grid-template-columns: 1fr;
  }
  .pool-item {
    flex-wrap: wrap;
  }
}
</style>
