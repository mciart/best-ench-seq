<template>
  <div class="step-two">
    <!-- 算法选择 -->
    <div class="card">
      <div class="card-title">算法选择</div>
      <div class="radio-group algo-group">
        <label>
          <input type="radio" value="difficultyFirst" v-model="store.algorithm">
          <span>难度优先</span>
        </label>
        <label>
          <input type="radio" value="hamming" v-model="store.algorithm">
          <span>汉明分层</span>
        </label>
        <label>
          <input type="radio" value="enumeration" v-model="store.algorithm">
          <span>枚举搜索</span>
        </label>
      </div>
      <div class="algo-desc">
        <p v-if="store.algorithm === 'difficultyFirst'">
          贪心策略，按惩罚值分层优先合并，速度最快。推荐日常使用。
        </p>
        <p v-else-if="store.algorithm === 'hamming'">
          构建二叉树分层结构，优化高费用魔咒的合并顺序。
        </p>
        <p v-else>
          全排列搜索最优解，保证结果最优但耗时较长（≤10 个魔咒时秒出）。
        </p>
      </div>

      <!-- 附加选项 -->
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
        <div class="timeout-setting" v-show="store.algorithm === 'enumeration'">
          <label class="form-label">枚举搜索超时</label>
          <div class="timeout-row">
            <input
              type="range"
              class="range-slider"
              min="1"
              max="120"
              step="1"
              v-model.number="store.enumTimeout"
            >
            <span class="timeout-value">{{ store.enumTimeout }}s</span>
          </div>
          <p class="timeout-hint">
            魔咒越多搜索空间越大。建议: 6个以内 1-5s，7-8个 5-15s，9个以上 15-30s
          </p>
        </div>
      </div>
    </div>

    <!-- 需求的魔咒 -->
    <div class="card">
      <div class="card-title">
        需求的魔咒
        <span class="tag tag-purple" v-if="store.neededEnchs.length > 0">
          {{ store.neededEnchs.length }} 个已选
        </span>
      </div>

      <!-- 已选魔咒 -->
      <div class="selected-enchs" v-if="store.neededEnchs.length > 0">
        <div class="ench-card" v-for="ench in store.neededEnchs" :key="ench.id">
          <div class="ench-card-header">
            <span class="ench-name">{{ store.getEnchName(ench.id) }}</span>
            <button class="remove-btn" @click="store.removeNeededEnch(ench.id)">✕</button>
          </div>
          <div class="ench-card-body">
            <div class="level-selector">
              <button
                v-for="l in store.getEnchData(ench.id)?.maxLevel"
                :key="l"
                class="level-btn"
                :class="{ 'level-active': ench.level === l }"
                @click="store.updateNeededEnchLevel(ench.id, l)"
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

      <!-- 可选魔咒 -->
      <div class="available-enchs">
        <p class="section-label">点击添加魔咒：</p>
        <div class="ench-buttons">
          <button
            v-for="e in store.selectableEnchs"
            :key="e.id"
            class="ench-btn"
            @click="store.addNeededEnch(e.id)"
          >
            {{ e.name }}
          </button>
        </div>
        <p v-if="store.selectableEnchs.length === 0" class="empty-hint">
          没有更多可选的魔咒了
        </p>
      </div>
    </div>

    <!-- 导航 -->
    <div class="nav-buttons">
      <button class="btn btn-secondary" @click="store.currentStep = 1">
        ← 上一步
      </button>
      <button
        class="btn btn-primary"
        :disabled="store.neededEnchs.length === 0 || store.isCalculating"
        @click="store.runCalculation()"
      >
        <span v-if="store.isCalculating" class="loading">计算中...</span>
        <span v-else>开始计算</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useEnchantStore } from '../stores/enchant.js'
import enchantmentsData from '@core/data/enchantments.json'

const store = useEnchantStore()

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
.step-two {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.algo-desc {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--bg-surface-2);
  border-radius: var(--border-radius-xs);
  font-size: 0.85rem;
  color: var(--text-secondary);
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

.timeout-value {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-primary-light);
  min-width: 40px;
}

.timeout-hint {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-top: 4px;
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

.selected-enchs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
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

.ench-name {
  font-weight: 600;
  color: var(--color-primary-light);
  font-size: 0.9rem;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 0.85rem;
  transition: color var(--transition-fast);
}

.remove-btn:hover {
  color: var(--color-danger);
}

.ench-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.section-label {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-bottom: 10px;
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
}

.nav-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.loading {
  animation: pulse 1.5s infinite;
}

@media (max-width: 768px) {
  .selected-enchs {
    grid-template-columns: 1fr;
  }
}
</style>
