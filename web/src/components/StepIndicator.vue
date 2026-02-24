<template>
  <div class="step-indicator">
    <div
      v-for="(step, i) in steps"
      :key="i"
      class="step-item"
      :class="{
        'step-active': store.currentStep === i + 1,
        'step-done': store.currentStep > i + 1
      }"
      @click="goToStep(i + 1)"
    >
      <div class="step-number">
        <span v-if="store.currentStep > i + 1">✓</span>
        <span v-else>{{ i + 1 }}</span>
      </div>
      <span class="step-label">{{ step }}</span>
    </div>
    <div class="step-line" :style="lineStyle"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEnchantStore } from '../stores/enchant.js'

const store = useEnchantStore()
const steps = ['物品池配置', '计算结果']

const lineStyle = computed(() => ({
  width: `${((store.currentStep - 1) / (steps.length - 1)) * 100}%`
}))

function goToStep(step) {
  if (step < store.currentStep) {
    store.currentStep = step
  }
}
</script>

<style scoped>
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  padding: 0 20px;
}

.step-indicator::before {
  content: '';
  position: absolute;
  top: 18px;
  left: 50px;
  right: 50px;
  height: 3px;
  background: var(--border-color);
  border-radius: 2px;
  z-index: 0;
}

.step-line {
  position: absolute;
  top: 18px;
  left: 50px;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary-dim), var(--color-primary));
  border-radius: 2px;
  z-index: 1;
  transition: width var(--transition-slow);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 2;
  cursor: pointer;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  background: var(--bg-surface-2);
  border: 2px solid var(--border-color);
  color: var(--text-dim);
  transition: all var(--transition-normal);
}

.step-active .step-number {
  background: var(--color-primary-dim);
  border-color: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-glow);
}

.step-done .step-number {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.step-label {
  font-size: 0.8rem;
  color: var(--text-dim);
  font-weight: 500;
  transition: color var(--transition-normal);
}

.step-active .step-label {
  color: var(--color-primary-light);
}

.step-done .step-label {
  color: var(--text-secondary);
}
</style>
