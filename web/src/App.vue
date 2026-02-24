<template>
  <div class="app">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <div>
            <h1>铁砧附魔最优顺序计算器</h1>
            <p class="subtitle">BestEnchSeq</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="tag tag-purple">v1.0</span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <StepIndicator />
      <div class="step-content fade-in" :key="store.currentStep">
        <StepOne v-if="store.currentStep === 1" />
        <StepThree v-else-if="store.currentStep === 2" />
      </div>
    </main>

    <footer class="app-footer">
      <p>
        <a href="https://github.com/Dinosaur-MC/BestEnchSeq" target="_blank">GitHub</a>
        · 基于 Minecraft 铁砧机制 · 支持 Java 版 & 基岩版
      </p>
    </footer>
  </div>
</template>

<script setup>
import { useEnchantStore } from './stores/enchant.js'
import StepIndicator from './components/StepIndicator.vue'
import StepOne from './views/StepOne.vue'
import StepThree from './views/StepThree.vue'

const store = useEnchantStore()
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
  background: rgba(26, 26, 36, 0.85);
}

.header-content {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
}


.logo h1 {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.3;
}

.logo .subtitle {
  font-size: 0.75rem;
  color: var(--text-dim);
  font-weight: 400;
  letter-spacing: 0.5px;
}

.app-main {
  flex: 1;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.step-content {
  margin-top: 24px;
}

.app-footer {
  text-align: center;
  padding: 24px;
  color: var(--text-dim);
  font-size: 0.8rem;
  border-top: 1px solid var(--border-color);
}

.app-footer a {
  color: var(--color-primary-light);
  text-decoration: none;
}

.app-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .app-main {
    padding: 16px;
  }
}
</style>
