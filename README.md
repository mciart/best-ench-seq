# ⚒️ BestEnchSeq — Minecraft 最优附魔顺序计算器

计算在铁砧上附魔的**最优合并顺序**，以最低经验消耗获得满附魔物品。

支持 **Java Edition** 和 **Bedrock Edition**，覆盖 1.21+ 版本全部 **42 种附魔**和 **21 种可附魔物品**。

## ✨ 功能

- 🎯 **三种算法** — 从快速近似到全局最优，满足不同需求
  - **难度优先** (Difficulty First)：按附魔权重排序，快速得出较优解
  - **海明距离** (Hamming Weight)：利用二进制权重优化合并树
  - **穷举搜索** (Enumeration)：分支定界全搜索，找到绝对最优解
- ⏱️ **可配置超时** — 穷举搜索支持 1–30 秒超时设置
- 🔄 **惩罚值支持** — 可为已使用过铁砧的物品设置先验惩罚
- 📋 **逐步指南** — 清晰展示每一步的合并操作和经验消耗
- 🌏 **双语界面** — 中文界面，附魔名称中英文对照
- 🎮 **完整数据** — 覆盖包括锤(Mace)在内的所有 1.21+ 物品和附魔

## 📸 截图

<!-- TODO: 添加应用截图 -->

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- npm 或 pnpm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-username/BestEnchSeq.git
cd BestEnchSeq

# 安装依赖
cd web
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:5173`

### 构建生产版本

```bash
cd web
npm run build
```

构建输出位于 `web/dist/`，可直接部署到任何静态托管服务。

## 📁 项目结构

```
BestEnchSeq/
├── core/                       # 核心计算逻辑（框架无关）
│   ├── algorithms/
│   │   ├── difficultyFirst.js  # 难度优先算法
│   │   ├── hamming.js          # 海明距离算法
│   │   └── enumeration.js      # 穷举搜索算法（分支定界）
│   ├── data/
│   │   ├── weapons.json        # 可附魔物品数据
│   │   └── enchantments.json   # 附魔属性数据
│   ├── calculator.js           # 计算入口，算法调度
│   ├── forge.js                # 铁砧合并机制实现
│   ├── itemPool.js             # 物品池管理
│   ├── types.js                # 类型定义
│   └── index.js                # 核心模块导出
├── web/                        # Vue 3 前端
│   ├── src/
│   │   ├── views/              # 页面组件（三步向导）
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── components/         # 通用组件
│   │   └── assets/             # 样式资源
│   ├── public/
│   │   └── icons/              # Minecraft 物品图标
│   └── vite.config.js
├── .gitignore
└── README.md
```

## 🎮 使用方法

### 第一步：选择物品

选择要附魔的物品类型（如剑、镐、头盔等），设置铁砧先验惩罚值（默认 0，适用于全新物品）。

### 第二步：选择附魔

1. 选择计算算法（推荐穷举搜索获得最优解）
2. 勾选需要的附魔及等级
3. 可选：允许 "Too Expensive!" 操作（突破单步 40 级上限）

### 第三步：查看结果

查看最优合并顺序、总经验消耗、逐步操作指南。

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 (Composition API) |
| 构建工具 | Vite 7 |
| 状态管理 | Pinia 3 |
| 核心逻辑 | 原生 JavaScript (ES Modules) |
| 样式 | CSS (Minecraft 暗色主题) |

## 📊 算法说明

### 难度优先 (Difficulty First)

按附魔的权重（`maxLevel × itemMultiplier`）从大到小排序，依次合并。时间复杂度 O(n log n)。

### 海明距离 (Hamming Weight)

利用每个附魔在合并序列中的位置的二进制表示的海明权重来优化排序。在大多数情况下能得到接近最优的解。

### 穷举搜索 (Enumeration)

使用分支定界（Branch and Bound）算法搜索所有可能的合并树，包括书与书之间的预合并。保证在超时时间内找到最优解或已知最优近似解。

## 📜 物品图标

物品图标来源于 [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)（Minecraft 官方基岩版资源包），版权归 Mojang Studios / Microsoft 所有。

## 📄 License

MIT
