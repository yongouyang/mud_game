# 武侠MUD Web版 — 可行性方案 (v2)

---

## 一、方案概览

**技术路线：Node.js + WebSocket + 复古终端前端 → AWS ECS 云端部署**

放弃传统 FluffOS/telnet 架构，用现代 Web 技术栈重建。游戏内容参考炎黄MUD的设计体系（门派、武功、地图、战斗公式），用 TypeScript 重新实现。通信层从 telnet 协议切换为 WebSocket + HTTPS，客户端改为浏览器内的复古终端风格界面。

---

## 二、系统架构

```
┌──────────────────────────────────────────────────────────┐
│                     AWS Cloud                            │
│  ┌──────────┐     ┌──────────────────────────────────┐   │
│  │   ALB    │────►│        ECS Fargate Task            │  │
│  │ (HTTPS)  │     │  ┌────────────┐ ┌─────────────┐   │  │
│  │ :443     │     │  │  Express   │ │ Socket.io   │   │  │
│  │          │     │  │  (静态资源) │ │ (WebSocket) │   │  │
│  └──────────┘     │  └────────────┘ └──────┬──────┘   │  │
│                   │                        │          │  │
│                   │  ┌─────────────────────▼────────┐  │  │
│                   │  │       Game Engine             │  │  │
│                   │  │  · Tick Loop (1s heartbeat)   │  │  │
│                   │  │  · Command Router             │  │  │
│                   │  │  · Event Bus                  │  │  │
│                   │  └────────┬─────────────────────┘  │  │
│                   │           │                        │  │
│                   │  ┌────────▼────────────────────┐   │  │
│                   │  │     Game Data (JSON/YAML)    │   │  │
│                   │  │  maps/ skills/ items/ npcs/  │   │  │
│                   │  └──────────────────────────────┘   │  │
│                   └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
         │                                        │
         │ HTTPS (静态页面)                         │ WSS (实时游戏)
         ▼                                        ▼
    ┌─────────────────────────────────────────────────┐
    │              浏览器 (复古终端 UI)                  │
    │  ┌──────────────────────────────────────────┐    │
    │  │  ████ 输出区 (绿色等宽字体, 黑底)  ████    │    │
    │  │  ...游戏文字流式输出...                     │    │
    │  │  ...滚动缓冲区...                          │    │
    │  │                                           │    │
    │  │  > 输入命令...                    [发送]   │    │
    │  └──────────────────────────────────────────┘    │
    └─────────────────────────────────────────────────┘
```

---

## 三、技术栈选型

| 层 | 技术 | 理由 |
|---|---|---|
| **后端语言** | Node.js + TypeScript | 用户已有技能栈 (v24.14.0)，类型安全 |
| **HTTP 服务** | Express | 静态资源 + REST API（注册/登录/角色列表） |
| **实时通信** | Socket.io | WebSocket 封装，自动降级，断线重连 |
| **前端** | Vanilla HTML/CSS/JS | 复古终端风格，无框架依赖，轻量 |
| **游戏数据** | JSON 文件 | 可读性好，方便编辑，无需数据库 |
| **容器化** | Docker (Node 24-alpine) | 轻量镜像，ECS 原生支持 |
| **部署** | AWS ECS Fargate + ALB | 无服务器管理，HTTPS 终结在 ALB |

---

## 四、游戏系统（参考炎黄MUD设计）

炎黄MUD原始源码约 45MB LPC 代码。v1 阶段实现核心系统 + 示例内容：

### 4.1 核心引擎

| 系统 | 说明 |
|---|---|
| **Tick Loop** | 1秒心跳：恢复气血、战斗回合结算、NPC 行动 |
| **Command Router** | 解析玩家输入 → 路由到对应 handler |
| **Event Bus** | 房间内事件广播（玩家进入/离开/说话/战斗） |
| **Session管理** | Socket.io 连接 → 玩家对象映射，断线保留状态 |

### 4.2 游戏系统（v1）

| 系统 | 参考炎黄MUD原始模块 | v1实现范围 |
|---|---|---|
| **角色系统** | `feature/attribute.c`, `feature/condition.c` | 创建角色、属性（臂力/悟性/根骨/身法）、气血/内力 |
| **地图系统** | `d/` 目录（71个区域） | 房间节点图、方向移动（n/s/e/w/u/d）、场景描述 |
| **战斗系统** | `feature/attack.c`, `feature/damage.c` | 回合制战斗、普攻 + 招式、伤害公式、死亡处理 |
| **武功系统** | `kungfu/` 目录（4类） | 基本拳脚、轻功、内功、招式、学习/修炼 |
| **物品系统** | `clone/` 目录（29类） | 武器、防具、药品、金钱、拾取/丢弃/使用 |
| **NPC系统** | `clone/npc/`, `feature/guarder.c` | 固定NPC、对话、战斗AI |
| **聊天系统** | `cmds/chat/` | 本地说话、频道聊天 |
| **任务系统** | — | 简单杀怪/送信任务 |

### 4.3 玩家命令（v1，约30+条）

移动类：`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`, `u`, `d`, `enter`, `out`
战斗类：`kill`, `hit`, `yong` (使用招式), `yun` (运功), `bei` (备武功)
信息类：`look`, `hp`, `score`, `skills`, `map`, `i` (背包), `who` (在线玩家)
交互类：`ask`, `say`, `tell`, `give`, `get`, `drop`, `use`, `wear`, `remove`

---

## 五、项目结构

```
mud_game/
├── server/                    # Node.js 后端
│   ├── src/
│   │   ├── index.ts           # 入口：Express + Socket.io 启动
│   │   ├── engine/
│   │   │   ├── GameLoop.ts    # 1秒 tick 循环
│   │   │   ├── CommandRouter.ts # 命令解析与路由
│   │   │   └── EventBus.ts    # 事件发布/订阅
│   │   ├── systems/
│   │   │   ├── PlayerManager.ts   # 玩家会话管理
│   │   │   ├── CombatSystem.ts    # 战斗系统
│   │   │   ├── SkillSystem.ts     # 武功系统
│   │   │   ├── MapSystem.ts       # 地图/移动
│   │   │   ├── ItemSystem.ts      # 物品系统
│   │   │   ├── NpcSystem.ts       # NPC AI
│   │   │   └── QuestSystem.ts     # 任务系统
│   │   ├── models/
│   │   │   ├── Player.ts      # 玩家数据模型
│   │   │   ├── Room.ts        # 房间模型
│   │   │   ├── Npc.ts         # NPC模型
│   │   │   └── Item.ts        # 物品模型
│   │   └── data/              # 游戏静态数据
│   │       ├── maps/          # 地图 JSON (参考炎黄MUD d/ 目录)
│   │       ├── skills/        # 武功定义
│   │       ├── npcs/          # NPC 模板
│   │       └── items/         # 物品模板
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── client/                    # Web 前端
│   └── index.html             # 单文件复古终端 UI
├── docker-compose.yml         # 本地开发
└── .github/
    └── workflows/
        └── deploy.yml         # CI/CD 到 AWS ECS
```

---

## 六、部署架构（AWS）

```
Route53 DNS
    │
    ▼
ALB (HTTPS :443 → HTTP :3000 转发)
    │  · ACM 证书自动续签
    │  · WebSocket 协议升级支持
    │
    ▼
ECS Fargate Service
    │  · 1-2 vCPU / 2-4 GB
    │  · Docker 镜像：Node 24-alpine
    │  · 健康检查：HTTP /health
    │
    ▼
ECR (Docker 镜像仓库)
```

关键配置：
- ALB 监听 HTTPS :443，目标组端口 :3000
- ALB 开启 sticky session（基于 cookie，确保 WebSocket 粘性）
- 空闲超时设为 3600s（WebSocket 长连接）

---

## 七、风险评估

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| Socket.io + ALB 兼容问题 | 低 | 阻塞 | ALB 原生支持 WebSocket 协议升级，已有大量案例；设置 sticky session 即可 |
| 炎黄MUD内容量太大 | 高 | 范围 | v1 只实现核心系统 + 5-8个区域的示例地图和3-4个门派，后续迭代填充 |
| AWS 费用 | 中 | 成本 | Fargate 单Task + 最小规格 ≈ $30-50/月；开发阶段可本地跑 |
| 复古终端前端体验差 | 低 | 迭代 | 纯终端是MUD核心体验，社区验证多年；后期可选项升级为混合UI |

---

## 八、开发阶段预估

| 阶段 | 内容 | 周期 |
|---|---|---|
| **Phase 1：骨架** | 项目初始化、Express+Socket.io 通信、终端前端、命令路由 | 2-3天 |
| **Phase 2：核心系统** | 角色系统、地图/移动、战斗系统 | 4-5天 |
| **Phase 3：武功物品** | 武功系统、物品系统、NPC系统 | 3-4天 |
| **Phase 4：内容填充** | 5-8个区域的武侠世界、3-4个门派、示例任务 | 3-5天 |
| **Phase 5：AWS部署** | Docker化、ECS Fargate配置、ALB+HTTPS、CI/CD | 2-3天 |

总计：**14-20天**（单人全职估算）

---

## 九、关键假设

- **游戏数据格式**：JSON 文件存储（非数据库），轻量且易编辑
- **玩家持久化**：JSON 文件（v1），后续可迁移到 SQLite/PostgreSQL
- **前端范围**：单文件 HTML 实现复古终端，使用 xterm.css 风格（绿字黑底等宽字体）
- **AWS 认证**：用户已有 AWS 账号及基本 IAM 权限（或使用 aws-cli 配置）
- **炎黄MUD内容引用**：设计参考而非直接移植（LPC → TypeScript 需要重写所有逻辑）

---

## 十、结论

**完全可行，且架构更现代化。** 放弃 FluffOS 的代价是需要重新实现游戏引擎和内容，但换来的是：
- 你已掌握的 Node.js 技术栈
- 浏览器即客户端，零安装
- 云端原生部署、HTTPS加密通信
- 完全可控的代码库，后续迭代无 legacy 包袱

核心风险可控：WebSocket + ALB 已有成熟实践，游戏内容 v1 做减法即可。
