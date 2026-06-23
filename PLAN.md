# 武侠MUD Web版 — 项目计划 (v3)

> **实现状态：** Phase 1–5 ✅ 全部完成 — 436 个测试全绿，AWS ECS Fargate 生产部署成功。
> 已实现：角色创建、6维属性、地图探索、门派武功、回合战斗、NPC交互、商店拍卖、任务系统、聊天社交、帮派、银行、合成。

---

## 一、方案概览

**技术路线：Node.js + WebSocket + React 复古终端前端 → AWS ECS 云端部署**

参考炎黄MUD设计体系，用 TypeScript 从零重建。WebSocket + HTTPS 替代 telnet，浏览器复古终端风格 UI。

---

## 二、当前实现状态

### 2.1 已完成系统

| 系统 | 状态 | 说明 |
|---|---|---|
| **角色系统** | ✅ | 6维属性（臂力/悟性/根骨/身法/容貌/福缘）、等级、经验、潜能、气血/内力 |
| **地图系统** | ✅ | 120+ 房间、29 个门派、30+ 区域、交互式 HTML 地图 |
| **战斗系统** | ✅ | 回合制、招式技（perform）、功力提升（powerup）、毒伤、多目标战斗 |
| **武功系统** | ✅ | 30+ 武功、学习/升级、门派锁定、前置需求、招式技能 |
| **物品系统** | ✅ | 武器/防具/药品/材料、装备加成、使用效果、属性永久提升 |
| **NPC系统** | ✅ | 对话、战斗AI、守卫、Boss掉落、毒伤、复活点 |
| **门派系统** | ✅ | 29 个门派、独门武功、属性加成、师父要求 |
| **商店系统** | ✅ | 房间关联商店、买卖、回购率 |
| **拍卖行** | ✅ | 上架、竞拍、一口价、过期退 |
| **钱庄系统** | ✅ | 存银、存物、取银、取物 |
| **合成系统** | ✅ | 配方合成武器/防具 |
| **任务系统** | ✅ | 杀怪/收集/送达/对话任务、经验/潜能/物品奖励 |
| **聊天系统** | ✅ | 本地说话、私聊、频道聊天、邮件 |
| **交易系统** | ✅ | 玩家间物品/银两交易 |
| **帮派系统** | ✅ | 创建、加入、晋升、踢出、称号 |
| **社交系统** | ✅ | 好友、邮件、善恶值 |
| **GM管理** | ✅ | 查看在线、检查玩家、踢人、传送、生成 |

### 2.2 部署架构

- **生产环境**：AWS ECS Fargate + ALB + EFS 持久化
- **CI/CD**：GitHub Actions → Docker → ECR → ECS
- **基础即代码**：Terraform (ECS, ALB, EFS, ECR, ACM)
- **健康检查**：HTTP /health + WebSocket 连通

---

## 三、技术栈

| 层 | 技术 |
|---|---|
| **后端** | Node.js 24 + TypeScript + Express + Socket.io |
| **前端** | React 18 + Vite 8 + 琥珀复古终端 UI |
| **测试** | Vitest (unit + E2E server) + React Testing Library + Playwright (UI E2E) |
| **数据** | JSON 文件 + EFS (AWS 持久化) |
| **部署** | Docker → ECR → ECS Fargate + ALB + Terraform |

---

## 四、项目结构

```
mud_game/
├── src/                     # Frontend (React + Vite)
│   ├── App.tsx
│   ├── components/Terminal.tsx    # Terminal UI
│   └── themes.ts
├── tests/
│   ├── unit/                # Vitest unit tests
│   └── e2e/                 # Playwright E2E
├── server/
│   ├── src/
│   │   ├── index.ts         # Express + Socket.io + game loop
│   │   ├── engine/
│   │   │   ├── CommandRouter.ts     # All game commands (~1240 lines)
│   │   │   └── PersistenceManager.ts # Autosave + socket-id mapping
│   │   ├── systems/         # 19 game systems
│   │   ├── models/          # Data models
│   │   ├── data/            # JSON data files
│   │   └── time/            # SystemClock + Scheduler
│   └── vitest.config.ts
├── docs/                    # Map, guides, analysis
├── terraform/main.tf        # AWS infrastructure
├── .github/workflows/       # CI/CD
├── Dockerfile
└── README.md
```

---

## 五、测试覆盖

- **52 测试文件**，**436 测试**，全部通过
- 覆盖：45 个服务端文件（Vitest）+ 2 个前端文件（Vitest）+ 5 个 Playwright E2E
- 包含：命令路由、系统单元、数据验证、E2E 完整流程

---

## 六、下一步方向

- [ ] 更多剧情任务和 NPC 对话树
- [ ] PvP 竞技场
- [ ] 门派任务链
- [ ] 排行榜系统
- [ ] 数据持久化迁移（JSON → DynamoDB/SQLite）
- [ ] 移动端适配
