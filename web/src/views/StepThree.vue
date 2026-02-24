<template>
  <div class="step-three" v-if="store.result">
    <!-- 结果汇总 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-value">{{ store.result.stepCount }}</div>
        <div class="summary-label">总步数</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ store.result.totalCost }}</div>
        <div class="summary-label">总花费等级</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ store.result.maxStepCost }}</div>
        <div class="summary-label">最大单步花费</div>
      </div>
      <div class="summary-card" :class="store.result.feasible ? 'card-success' : 'card-danger'">
        <div class="summary-value">{{ store.result.feasible ? '✓' : '!' }}</div>
        <div class="summary-label">{{ store.result.feasible ? '可行' : '过于昂贵' }}</div>
      </div>
    </div>

    <!-- 算法信息 -->
    <div class="card meta-card">
      <div class="meta-row">
        <span class="meta-label">使用算法</span>
        <span class="tag tag-purple">DP 搜索</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">计算耗时</span>
        <span>{{ store.result.calcTime }} ms</span>
      </div>
      <div class="meta-row" v-if="store.result.timedOut !== undefined">
        <span class="meta-label">搜索状态</span>
        <span :class="store.result.timedOut ? 'text-warning' : 'text-success'">
          {{ store.result.timedOut ? '超时（部分搜索）' : '完整搜索' }}
          ({{ store.result.permutationsChecked?.toLocaleString() }} 种排列)
        </span>
      </div>
    </div>

    <!-- 超时警告 -->
    <div v-if="store.result.timedOut" class="timeout-warning">
      ⚠️ 搜索因超时中断，当前结果可能不是全局最优。增加超时时间或减少物品数量可能获得更优方案。
    </div>

    <!-- 跳过物品提示 -->
    <div v-if="store.result.skippedItems?.length > 0" class="card skipped-card">
      <div class="card-title skipped-title">💡 以下物品未参与合并（多余）</div>
      <p class="skipped-desc">算法判定这些物品对最终结果无贡献，你可以保留它们做其他用途。</p>
      <div class="skipped-count">跳过 {{ store.result.skippedItems.length }} 个物品，实际使用 {{ store.result.usedCount }} 个</div>
    </div>

    <div class="card">
      <div class="card-title">锻造流程</div>
      <div class="flow-list">
        <div class="flow-step" v-for="(step, i) in store.result.steps" :key="i" :style="{ animationDelay: `${i * 80}ms` }">
          <div class="flow-header">
            <span class="flow-number">{{ i + 1 }}</span>
            <span class="flow-cost" :class="step.cost >= 40 ? 'cost-danger' : 'cost-normal'">
              花费: {{ step.cost }} 级
            </span>
          </div>
          <div class="flow-body">
            <div class="flow-item flow-target">
              <div class="flow-item-label">A 目标</div>
              <div class="flow-item-name">{{ itemDisplayName(step.target.name) }}</div>
              <div class="flow-enchants">
                <span class="flow-ench" v-for="e in getDisplayEnchants(step.target)" :key="e.id"
                  :class="{ 'ench-removed': e.removed }">
                  {{ store.getEnchName(e.id) }} {{ store.intToRoman(e.level) }}
                </span>
              </div>
            </div>
            <div class="flow-plus">+</div>
            <div class="flow-item flow-sacrifice">
              <div class="flow-item-label">B 牺牲</div>
              <div class="flow-item-name">{{ itemDisplayName(step.sacrifice.name) }}</div>
              <div class="flow-enchants">
                <span class="flow-ench" v-for="e in getDisplayEnchants(step.sacrifice)" :key="e.id"
                  :class="{ 'ench-removed': e.removed }">
                  {{ store.getEnchName(e.id) }} {{ store.intToRoman(e.level) }}
                </span>
              </div>
            </div>
            <div class="flow-equals">=</div>
            <div class="flow-item flow-result">
              <div class="flow-item-label">结果</div>
              <div class="flow-item-name">{{ itemDisplayName(step.target.name) }}</div>
              <div class="flow-enchants">
                <span class="flow-ench" v-for="e in getMergedEnchants(step)" :key="e.id">
                  {{ store.getEnchName(e.id) }} {{ store.intToRoman(e.level) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最终物品信息 -->
    <div class="card">
      <div class="card-title">最终物品</div>
      <div class="output-item">
        <div class="output-enchants">
          <div class="output-ench" v-for="e in store.result.outputItem.enchants" :key="e.id">
            <span class="ench-name">{{ store.getEnchName(e.id) }}</span>
            <span class="ench-level">{{ store.intToRoman(e.level) }}</span>
          </div>
        </div>
        <div class="output-meta">
          <span>惩罚值: {{ store.result.outputItem.penalty }}</span>
        </div>
      </div>
    </div>

    <!-- 导出 & 导航 -->
    <div class="nav-buttons">
      <button class="btn btn-secondary" @click="store.currentStep = 1">
        ← 修改配置
      </button>
      <div class="nav-right">
        <button class="btn btn-secondary" @click="exportResult">
          导出结果
        </button>
        <button class="btn btn-danger" @click="store.reset()">
          重新开始
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEnchantStore } from '../stores/enchant.js'
import { ENCHANTED_BOOK } from '@core/types.js'
import { mergeItems } from '@core/forge.js'

const store = useEnchantStore()

function itemDisplayName(name) {
  if (name === ENCHANTED_BOOK || name === '') return '附魔书'
  return store.getItemDisplayName(name) || name
}

/**
 * 获取显示用附魔列表
 * 如果物品有 originalEnchants，显示完整原始附魔，被移除的标记 removed
 */
function getDisplayEnchants(item) {
  if (!item.originalEnchants) return item.enchants.map(e => ({ ...e, removed: false }))

  const activeIds = new Set(item.enchants.map(e => e.id))
  return item.originalEnchants.map(e => ({
    ...e,
    removed: !activeIds.has(e.id),
  }))
}

/**
 * 计算合并后的附魔结果
 */
function getMergedEnchants(step) {
  const merged = mergeItems(step.target, step.sacrifice)
  return merged.enchants
}

function exportResult() {
  if (!store.result) return
  const r = store.result
  let text = `铁砧附魔最优顺序计算结果\n`
  text += `========================\n`
  text += `步数: ${r.stepCount}  总花费: ${r.totalCost} 级  ${r.feasible ? '可行' : '过于昂贵'}\n`
  text += `算法: DP 搜索  耗时: ${r.calcTime}ms\n\n`

  for (let i = 0; i < r.steps.length; i++) {
    const s = r.steps[i]
    text += `(${i + 1}) 花费: ${s.cost} 级\n`
    text += `  A. ${itemDisplayName(s.target.name)}\n`
    for (const e of getDisplayEnchants(s.target)) {
      text += `     ${e.removed ? '✗' : '-'} ${store.getEnchName(e.id)} ${store.intToRoman(e.level)}${e.removed ? ' (冲突丢弃)' : ''}\n`
    }
    text += `  B. ${itemDisplayName(s.sacrifice.name)}\n`
    for (const e of getDisplayEnchants(s.sacrifice)) {
      text += `     ${e.removed ? '✗' : '-'} ${store.getEnchName(e.id)} ${store.intToRoman(e.level)}${e.removed ? ' (冲突丢弃)' : ''}\n`
    }
    text += `  => ${itemDisplayName(s.target.name)}\n`
    for (const e of getMergedEnchants(s)) {
      text += `     - ${store.getEnchName(e.id)} ${store.intToRoman(e.level)}\n`
    }
    text += `\n`
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `enchant_result_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.step-three {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 汇总卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.summary-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  padding: 20px 16px;
  text-align: center;
  animation: fadeIn 300ms ease both;
}

.summary-card:nth-child(2) { animation-delay: 80ms; }
.summary-card:nth-child(3) { animation-delay: 160ms; }
.summary-card:nth-child(4) { animation-delay: 240ms; }

.card-success {
  border-color: rgba(52, 211, 153, 0.4);
  background: rgba(52, 211, 153, 0.08);
}

.card-danger {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.08);
}

.summary-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-primary-light);
  line-height: 1.2;
}

.card-success .summary-value { color: var(--color-success); }
.card-danger .summary-value { color: var(--color-danger); }

.summary-label {
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-top: 4px;
}

/* 元信息 */
.meta-card {
  padding: 16px 20px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 0.9rem;
}

.meta-label {
  color: var(--text-dim);
}

.text-warning { color: var(--color-warning); }
.text-success { color: var(--color-success); }

.timeout-warning {
  background: rgba(255, 193, 7, 0.12);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 10px;
  padding: 12px 16px;
  color: #ffc107;
  font-size: 0.88rem;
  line-height: 1.5;
}

.skipped-card {
  border: 1px solid rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}
.skipped-title {
  color: #10b981;
}
.skipped-desc {
  color: var(--text-dim);
  font-size: 0.85rem;
  margin-bottom: 6px;
}
.skipped-count {
  color: #6ee7b7;
  font-size: 0.9rem;
  font-weight: 600;
}

/* 锻造流程 */
.flow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flow-step {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  overflow: hidden;
  animation: fadeIn 300ms ease both;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-surface-3);
  border-bottom: 1px solid var(--border-color);
}

.flow-number {
  width: 26px;
  height: 26px;
  background: var(--color-primary-dim);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.flow-cost {
  font-weight: 600;
  font-size: 0.9rem;
}

.cost-normal { color: var(--color-success); }
.cost-danger { color: var(--color-danger); }

.flow-body {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 12px;
  padding: 14px 16px;
  align-items: start;
}

.flow-plus,
.flow-equals {
  display: flex;
  align-items: center;
  align-self: center;
  font-size: 1.5rem;
  color: var(--text-dim);
}



.flow-item-label {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-bottom: 4px;
  font-weight: 600;
}

.flow-item-name {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.flow-enchants {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.flow-ench {
  font-size: 0.8rem;
  color: var(--color-primary-light);
}

.flow-ench.ench-removed {
  text-decoration: line-through;
  color: var(--text-dim);
  opacity: 0.5;
}

.flow-result .flow-item-label {
  color: var(--color-success);
}

.flow-result .flow-ench {
  color: var(--color-success);
}
.output-enchants {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.output-ench {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-surface-2);
  border-radius: var(--border-radius-xs);
  border: 1px solid var(--border-color);
}

.output-ench .ench-name {
  color: var(--color-primary-light);
  font-weight: 500;
  font-size: 0.9rem;
}

.output-ench .ench-level {
  color: var(--color-warning);
  font-weight: 700;
  font-size: 0.9rem;
}

.output-meta {
  display: flex;
  gap: 20px;
  color: var(--text-dim);
  font-size: 0.85rem;
}

/* 导航 */
.nav-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.nav-right {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .flow-body {
    grid-template-columns: 1fr;
  }

  .flow-plus {
    padding: 0;
    justify-content: center;
  }

  .nav-right {
    flex-direction: column;
  }
}
</style>
