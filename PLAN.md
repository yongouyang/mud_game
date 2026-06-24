# 武侠MUD Web版 — 项目计划 (v4)

> **实现状态：** Phase 1–5 ✅ 全部完成 — 436 个测试全绿，AWS ECS Fargate 生产部署成功。
> 已实现：角色创建、6维属性、地图探索、门派武功、回合战斗、NPC交互、商店拍卖、任务系统、聊天社交、帮派、银行、合成。
>
> **v4 更新**：静态数据（rooms, NPCs, items, skills, quests）改为 DynamoDB 直接存储，JSON 文件仅保留给本地开发。新增数据部署机制。

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

- **生产环境**：AWS ECS Fargate + ALB + DynamoDB（静态数据 + 玩家状态）
- **CI/CD**：GitHub Actions → Docker → ECR → ECS
- **基础即代码**：Terraform (ECS, ALB, DynamoDB, ECR, ACM)
- **健康检查**：HTTP /health + WebSocket 连通

---

## 三、技术栈

| 层 | 技术 |
|---|---|
| **后端** | Node.js 24 + TypeScript + Express + Socket.io |
| **前端** | React 18 + Vite 8 + 琥珀复古终端 UI |
| **测试** | Vitest (unit + E2E server) + React Testing Library + Playwright (UI E2E) |
| **数据（生产）** | DynamoDB — 静态数据 + 玩家状态 |
| **数据（本地开发）** | JSON 文件 — 静态数据 + In-memory — 玩家状态 |
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
│   │   ├── data/            # JSON data files (本地开发用)
│   │   │   ├── rooms.json
│   │   │   ├── npcs.json
│   │   │   ├── items.json
│   │   │   ├── skills.json
│   │   │   └── quests.json
│   │   ├── persistence/     # 持久化抽象层
│   │   │   ├── IStateSystem.ts      # 接口定义
│   │   │   ├── JsonStateSystem.ts   # 本地开发：JSON文件 + 内存
│   │   │   └── DynamoStateSystem.ts # 生产环境：DynamoDB
│   │   └── time/            # SystemClock + Scheduler
│   └── vitest.config.ts
├── scripts/
│   └── deploy-data.ts       # 数据部署脚本：JSON → DynamoDB
├── docs/                    # Map, guides, analysis
├── terraform/
│   ├── main.tf              # ECS, ALB, VPC
│   ├── dynamodb.tf          # DynamoDB tables
│   └── iam-dynamodb.tf      # IAM policies
├── .github/workflows/       # CI/CD
├── Dockerfile
└── README.md
```

---

## 五、数据架构（v4 修订）

### 5.1 设计原则

1. **静态数据（rooms, npcs, items, skills, quests）** → 生产环境存 DynamoDB，本地开发用 JSON 文件
2. **动态状态（players, npcInstances, roomItems, auctions, guilds, mail）** → 生产环境存 DynamoDB，本地开发用 In-memory
3. **JSON 文件保留** 用于本地开发灵活性 — 修改 JSON 后重启即生效，无需部署
4. **数据部署脚本** 用于将 JSON 变更推送到 DynamoDB

### 5.2 DynamoDB 表设计

#### 表 1: `wuxia-static-data` — 静态游戏数据

| PK | SK | Attributes | 说明 |
|---|---|---|---|
| `ROOM#<roomId>` | `META` | name, description, exits, area, tags | 房间定义 |
| `NPC#<npcId>` | `META` | name, description, dialogue, stats, drops, skills | NPC 模板 |
| `ITEM#<itemId>` | `META` | name, type, stats, effects, price, recipe | 物品定义 |
| `SKILL#<skillId>` | `META` | name, school, requirements, moves, levels | 武功定义 |
| `QUEST#<questId>` | `META` | name, type, requirements, rewards, steps | 任务定义 |
| `CONFIG` | `GAME` | version, settings, globalValues | 全局配置 |

- **访问模式**: 游戏启动时一次性加载所有静态数据到内存（数据量小，~1-2MB）
- **部署方式**: 通过 `scripts/deploy-data.ts` 从 JSON 文件批量写入

#### 表 2: `wuxia-game-state` — 动态游戏状态

| PK | SK | Attributes | 说明 |
|---|---|---|---|
| `USER#<username>` | `AUTH` | passwordHash, createdAt | 用户认证 |
| `PLAYER#<playerId>` | `DATA` | full player JSON blob | 玩家完整数据 |
| `PLAYER#<playerId>` | `META` | name, level, currentRoom, updatedAt | 玩家索引 |
| `PLAYER#<playerId>` | `MAIL#<mailId>` | from, subject, body, read, createdAt | 邮件 |
| `NPC#<instanceId>` | `STATE` | hp, maxHp, state, targetPlayerId, respawnAt | NPC 实例状态 |
| `ROOM#<roomId>` | `ITEMS` | items: [{ itemId, qty }] | 房间地面物品 |
| `AUCTION#<id>` | `LISTING` | sellerId, item, price, bidder, expiresAt | 拍卖行 |
| `AUCTION` | `META` | nextId | 拍卖 ID 计数器 |
| `GUILD#<guildId>` | `META` | name, leaderId, createdAt | 帮派信息 |
| `GUILD#<guildId>` | `MEMBERS` | memberIds: [] | 帮派成员 |

- **访问模式**: 按需读写，玩家登录时加载，自动保存时写入

### 5.3 本地开发 vs 生产环境

| 环境 | 静态数据 | 动态状态 | 启动方式 |
|---|---|---|---|
| **本地开发** | `server/src/data/*.json` 文件 | `InMemoryStateSystem` | `npm run dev:all` |
| **单元测试** | `server/src/data/*.json` 文件 | `InMemoryStateSystem` | `npm test` |
| **生产环境** | DynamoDB `wuxia-static-data` | DynamoDB `wuxia-game-state` | ECS Fargate |

---

## 六、数据部署机制

### 6.1 部署脚本: `scripts/deploy-data.ts`

```typescript
// 将本地 JSON 数据部署到 DynamoDB
// 用法: npx tsx scripts/deploy-data.ts [--env prod|dev] [--table <name>]

// 功能：
// 1. 读取 server/src/data/*.json 文件
// 2. 对比 DynamoDB 现有数据（checksum 或版本号）
// 3. 仅更新变更的数据（增量部署）
// 4. 支持 --dry-run 预览变更
// 5. 支持 --force 全量覆盖
// 6. 自动创建备份（point-in-time recovery）
```

### 6.2 部署流程

```
开发者修改 JSON 文件
        │
        ▼
┌───────────────┐
│ 本地测试验证  │  ← npm run dev:all, 确认游戏逻辑正常
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 运行部署脚本  │  ← npx tsx scripts/deploy-data.ts
│               │
│ 1. 读取 JSON  │
│ 2. 计算 diff  │
│ 3. 预览变更   │  ← --dry-run 可选
│ 4. 写入 DynamoDB │
│ 5. 验证写入   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 重启 ECS 服务 │  ← 加载新静态数据
│ 或热重载      │
└───────────────┘
```

### 6.3 CI/CD 集成

```yaml
# .github/workflows/deploy-data.yml
# 当 server/src/data/ 目录下的 JSON 文件变更时触发

# 1. 检出代码
# 2. 运行测试确认数据合法性
# 3. 运行 deploy-data.ts 推送到 DynamoDB
# 4. 通知 ECS 服务刷新（可选：自动重启或信号通知）
```

### 6.4 数据版本控制

- JSON 文件纳入 Git 版本控制
- 每次部署记录版本号（Git commit SHA）
- DynamoDB `CONFIG#GAME` 行存储当前数据版本
- 支持回滚到历史版本

---

## 七、TypeScript 实现

### 7.1 持久化接口层

```typescript
// server/src/persistence/IStateSystem.ts

export interface IStateSystem {
  // ===== 静态数据（只读，启动时加载） =====
  loadStaticData(): Promise<StaticData>;
  
  // ===== 动态状态（读写） =====
  // Auth
  getUserHash(username: string): Promise<string | null>;
  saveUser(username: string, passwordHash: string): Promise<void>;
  
  // Players
  getPlayer(playerId: string): Promise<Player | null>;
  savePlayer(playerId: string, player: Player): Promise<void>;
  
  // NPCs
  getNpcState(npcId: string): Promise<NpcState | null>;
  saveNpcState(npcId: string, state: NpcState): Promise<void>;
  
  // Rooms
  getRoomItems(roomId: string): Promise<RoomItems | null>;
  saveRoomItems(roomId: string, items: RoomItems): Promise<void>;
  
  // Auctions
  getAuction(id: number): Promise<AuctionListing | null>;
  saveAuction(id: number, listing: AuctionListing): Promise<void>;
  deleteAuction(id: number): Promise<void>;
  getNextAuctionId(): Promise<number>;
  setNextAuctionId(id: number): Promise<void>;
  
  // Guilds
  getGuild(guildId: string): Promise<{ meta: GuildMeta; members: string[] } | null>;
  saveGuild(guildId: string, meta: GuildMeta, members: string[]): Promise<void>;
  
  // Mail
  getMail(playerId: string): Promise<PersistedMail[]>;
  saveMail(playerId: string, mail: PersistedMail): Promise<void>;
  markMailRead(playerId: string, mailId: string): Promise<void>;
  deleteMail(playerId: string, mailId: string): Promise<void>;
}

export interface StaticData {
  rooms: Room[];
  npcs: NpcTemplate[];
  items: ItemTemplate[];
  skills: SkillTemplate[];
  quests: QuestTemplate[];
  config: GameConfig;
}
```

### 7.2 本地开发实现: `JsonStateSystem`

```typescript
// server/src/persistence/JsonStateSystem.ts
// - 静态数据：从 JSON 文件读取，启动时加载到内存
// - 动态状态：In-memory Map，自动保存时写回 JSON（可选）

export class JsonStateSystem implements IStateSystem {
  private staticData: StaticData;
  private players: Map<string, Player>;
  private npcStates: Map<string, NpcState>;
  private roomItems: Map<string, RoomItems>;
  // ... 其他内存存储
  
  constructor(dataDir: string) {
    // 读取 server/src/data/*.json
    this.staticData = this.loadJsonFiles(dataDir);
    // 初始化内存存储
    this.players = new Map();
    // ...
  }
  
  async loadStaticData(): Promise<StaticData> {
    return this.staticData; // 已预加载
  }
  
  // ... 其他方法操作内存 Map
}
```

### 7.3 生产环境实现: `DynamoStateSystem`

```typescript
// server/src/persistence/DynamoStateSystem.ts
// - 静态数据：从 DynamoDB wuxia-static-data 读取，启动时加载到内存
// - 动态状态：读写 DynamoDB wuxia-game-state

export class DynamoStateSystem implements IStateSystem {
  private staticClient: DynamoDBDocumentClient;  // wuxia-static-data
  private stateClient: DynamoDBDocumentClient;     // wuxia-game-state
  private staticData?: StaticData;
  
  constructor(staticTable: string, stateTable: string, region: string) {
    // 初始化两个 DynamoDB 客户端
  }
  
  async loadStaticData(): Promise<StaticData> {
    if (this.staticData) return this.staticData;
    // Scan wuxia-static-data 表，按 PK 前缀分类组装
    this.staticData = await this.fetchAllStaticData();
    return this.staticData;
  }
  
  // ... 其他方法使用 wuxia-game-state 表
}
```

### 7.4 环境切换

```typescript
// server/src/persistence/index.ts

export function createStateSystem(): IStateSystem {
  if (process.env.NODE_ENV === 'production') {
    return new DynamoStateSystem(
      process.env.DYNAMODB_STATIC_TABLE!,
      process.env.DYNAMODB_STATE_TABLE!,
      process.env.AWS_REGION!
    );
  }
  return new JsonStateSystem('./src/data');
}
```

---

## 八、Terraform 基础设施

### 8.1 DynamoDB 表

```hcl
# terraform/dynamodb.tf

# 静态数据表
resource "aws_dynamodb_table" "static_data" {
  name         = "${var.app_name}-static-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }

  lifecycle { prevent_destroy = true }
}

# 游戏状态表
resource "aws_dynamodb_table" "game_state" {
  name         = "${var.app_name}-game-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }

  lifecycle { prevent_destroy = true }
}
```

### 8.2 ECS 任务环境变量

```hcl
environment = [
  { name = "NODE_ENV",                value = "production" },
  { name = "PORT",                    value = tostring(var.container_port) },
  { name = "DYNAMODB_STATIC_TABLE",   value = aws_dynamodb_table.static_data.name },
  { name = "DYNAMODB_STATE_TABLE",    value = aws_dynamodb_table.game_state.name },
  { name = "AWS_REGION",              value = var.region },
]
```

---

## 九、测试覆盖

- **52 测试文件**，**436 测试**，全部通过
- 覆盖：45 个服务端文件（Vitest）+ 2 个前端文件（Vitest）+ 5 个 Playwright E2E
- 包含：命令路由、系统单元、数据验证、E2E 完整流程

### 测试环境数据策略

| 测试类型 | 静态数据 | 动态状态 |
|---|---|---|
| 单元测试 | `JsonStateSystem` 加载测试 JSON | `InMemoryStateSystem` |
| Server E2E | `JsonStateSystem` 加载测试 JSON | `InMemoryStateSystem` |
| Playwright E2E | 前端连接测试服务器 | 测试服务器使用 `JsonStateSystem` |

---

## 十、下一步方向

### Phase 6: DynamoDB 迁移与数据部署

- [ ] 创建 `wuxia-static-data` 和 `wuxia-game-state` DynamoDB 表
- [ ] 实现 `IStateSystem` 接口
- [ ] 实现 `JsonStateSystem`（本地开发）
- [ ] 实现 `DynamoStateSystem`（生产环境）
- [ ] 实现 `scripts/deploy-data.ts` 数据部署脚本
- [ ] 修改启动流程：加载静态数据 → 启动游戏循环
- [ ] 更新 Terraform 配置
- [ ] 更新 CI/CD 工作流（数据部署 + 服务部署）
- [ ] 测试：本地开发、单元测试、生产环境

### Phase 7+: 功能扩展

- [ ] 更多剧情任务和 NPC 对话树
- [ ] PvP 竞技场
- [ ] 门派任务链
- [ ] 排行榜系统
- [ ] 移动端适配
- [ ] 支付集成（WeChat/Alipay）
