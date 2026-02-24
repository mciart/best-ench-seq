# ⚒️ BestEnchSeq — Minecraft 铁砧附魔最优顺序计算器

> **用最少的经验，打出最强的装备。**

BestEnchSeq 通过**状态压缩动态规划 (Bitmask DP)**，找到铁砧附魔的**全局最优合并顺序**，最小化经验消耗、最大化附魔价值。

支持 **Java Edition** 和 **Bedrock Edition** | 覆盖 1.21+ 版本全部 **42 种附魔** · **23 种可附魔物品**（含矛、锤、刷子）

🌐 **在线使用** → [bes.ozo.ooo](https://bes.ozo.ooo)

---

## ✨ 核心特性

- 🔍 **全局最优解** — 动态规划 O(3^N) 精确搜索，数学意义上的最优，10 物品毫秒出结果
- 🧹 **自动跳过多余物品** — 多余的附魔书自动排除，只用对结果有贡献的物品，节省经验
- 📋 **合成预览** — 计算前就能预览最终附魔结果，帮助你判断物品池是否合理
- ⚔️ **冲突智能处理** — 自动检测互斥附魔，选择保留哪个，计算时自动清洗
- ⚠️ **无效书警告** — 检测不适用于目标物品的附魔书，提示用户移除
- 🔄 **锻造可视化** — 每步展示 A 目标 + B 牺牲 = 结果，附魔变化一目了然
- ⚡ **Web Worker 后台计算** — UI 不卡顿，实时显示进度
- 🎮 **完整物品数据** — 覆盖所有 1.21+ 物品（含矛、锤、刷子），42 种附魔含诅咒
- 📤 **一键导出** — 导出合并方案为文本文件

---

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18

### 安装与运行

```bash
git clone https://github.com/mciart/best-ench-seq.git
cd best-ench-seq/web
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`

### 构建部署

```bash
cd web
npm run build    # 输出到 web/dist/
```

<details>
<summary>EdgeOne Pages / Cloudflare Pages 配置</summary>

| 配置项 | 值 |
|--------|---------| 
| 框架预设 | `Other` / `None` |
| 构建命令 | `npm run build` |
| 输出目录 | `web/dist` |

</details>

---

## 🎮 使用流程

### 1️⃣ 配置物品池

1. 选择游戏版本（Java / 基岩）
2. 选择物品或附魔书 → 配置附魔、惩罚值、耐久
3. 点击「添加到物品池」，重复直到配齐

### 2️⃣ 解决冲突

如果物品池中存在互斥附魔（如保护 vs 弹射物保护），系统会提示选择保留哪个。

### 3️⃣ 查看结果

- **合成预览** — 计算前预览最终附魔结果 + 多余书提示
- **锻造流程** — 每步展示 A 目标 + B 牺牲 = 结果
- **跳过物品** — 自动标注未参与合并的多余物品
- **导出** — 下载文本文件，方便边看边操作

---

## 🧠 算法

BestEnchSeq 内置两种搜索算法，均保证全局最优解：

### 动态规划 (Bitmask DP) — 默认

用二进制掩码表示「已合并物品子集」，对每个子集保留最优状态，枚举子集划分进行合并。不强制使用所有物品——多余物品自动排除。

```
物品池:  [剑, 锋利IV书, 耐久III书, 火焰II书, 掠夺III书]
mask:     0      1         2        3        4

mask = 01011 → 已合并物品 1 和 3
mask = 11111 → 所有物品合并完毕

最终从所有包含目标物品的 mask 中选最优解
→ 多余的书自动被排除（不增加 enchValue 则不选）
```

| 物品数 N | 搜索量 3^N | 耗时 |
|---------|-----------|------|
| 5 | 243 | ~3 ms |
| 8 | 6,561 | ~10 ms |
| 10 | 59,049 | ~50 ms |
| 12 | 531,441 | ~500 ms |

**正确性保证**：合并花费只取决于当前两物品状态（附魔+惩罚），具有最优子结构和无后效性，DP 结果与穷举**数学等价**。

### 枚举搜索 (Branch and Bound) — 备选

对所有可能的合并二叉树进行穷举搜索（Catalan 数量级），采用分支定界 + 乐观上界 + 对称性剪枝。8+ 物品搜索量爆炸，建议使用 DP。

### 计算流程

```mermaid
flowchart TD
    A["用户配置物品池"] --> B["选择物品/附魔书"]
    B --> C["设置属性<br>惩罚值 · 已附魔 · 耐久"]
    C --> D["添加到物品池"]
    D --> E{"还需添加?"}
    E -- 是 --> B
    E -- 否 --> F{"存在冲突附魔?"}

    F -- 是 --> G["用户选择保留哪个"]
    G --> H["开始计算"]
    F -- 否 --> H

    H --> I["构建 ItemPool<br>清洗冲突 · 过滤无效书"]
    I --> J["状态压缩 DP<br>Bitmask 子集枚举"]
    J --> K["遍历所有子集<br>自动跳过多余物品"]
    K --> L["输出最优方案<br>标注未使用物品"]
```

---

## 📁 项目结构

```
BestEnchSeq/
├── core/                       # 核心计算逻辑（框架无关，可独立使用）
│   ├── algorithms/
│   │   ├── dpSearch.js         # 状态压缩动态规划（默认，O(3^N)）
│   │   └── enumeration.js     # 枚举搜索（备选，分支定界 + 多重剪枝）
│   ├── data/
│   │   ├── weapons.json        # 23 种可附魔物品
│   │   └── enchantments.json   # 42 种附魔属性 + 冲突关系
│   ├── calculator.js           # 计算入口
│   ├── forge.js                # 铁砧合并机制（JE/BE 双版本）
│   ├── itemPool.js             # 物品池管理
│   └── types.js                # 类型定义
├── web/                        # Vue 3 前端
│   ├── src/
│   │   ├── views/              # 配置 · 结果 页面
│   │   ├── stores/             # Pinia 状态（冲突检测 · 预览 · 无效书检测）
│   │   └── workers/            # Web Worker 后台计算
│   └── public/icons/           # Minecraft 物品图标
└── README.md
```

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 (Composition API) + Pinia |
| 构建工具 | Vite 7 |
| 核心逻辑 | 原生 JavaScript (ES Modules) |
| 并行计算 | Web Worker |
| 样式 | CSS (Minecraft 暗色主题) |

## 📄 License

MIT

---

物品图标来源于 [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)，版权归 Mojang Studios / Microsoft 所有。
