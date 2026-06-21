# DynamoDB Implementation Plan — mud_game

> **Date**: 2026-06-21
> **Status**: Plan — ready for implementation
> **Goal**: Replace JSON file persistence with AWS DynamoDB single-table design
> **Infra**: Terraform IaC
> **Local dev**: DynamoDB Local (Docker) + in-memory mock for E2E tests

---

## 1. Data Model — Single Table Design

### Table: `wuxia-mud-state`

**Partition Key**: `PK` (string)
**Sort Key**: `SK` (string)
**Billing Mode**: PAY_PER_REQUEST (on-demand)

### Entity Schema

```
┌──────────────────────────────────────────────────────────────────┐
│  PK                  │  SK              │  Attributes             │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  PROFILE         │  name, hp, mp, maxHp,   │
│                       │                  │  maxMp, exp, pot,       │
│                       │                  │  level, attrPoints,     │
│                       │                  │  currentRoom, state,    │
│                       │                  │  targetEnemy,           │
│                       │                  │  powerupExpiry,         │
│                       │                  │  isMeditating,          │
│                       │                  │  meditationTaskId,      │
│                       │                  │  updatedAt              │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  ATTRS           │  { str, int, con, dex,  │
│                       │                  │    per, kar }           │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  SKILLS          │  [{ skillId, level }]   │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  INVENTORY       │  [{ itemId, qty, ... }]│
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  EQUIPPED        │  ["sword", "cloth"]     │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  CONDITIONS      │  [{ id, name, level,    │
│                       │                  │    remain, source }]   │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  SCHOOL          │  { schoolId, schoolName}│
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  QUEST           │  { type, target, exp,   │
│                       │                  │    pot, itemId }       │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  BANK            │  { silver, inventory[] }│
├──────────────────────┼──────────────────┼─────────────────────────┤
│  PLAYER#<playerId>   │  KILLS           │  { players, npcs }      │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  USER#<username>     │  AUTH            │  { passwordHash }       │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  NPC#<npcId>         │  STATE           │  { hp, maxHp, state,    │
│                       │                  │    targetPlayerId,      │
│                       │                  │    poisonLevel,         │
│                       │                  │    poisonSource }       │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  ROOM#<roomId>       │  ITEMS           │  { items: [{name, qty}]}│
├──────────────────────┼──────────────────┼─────────────────────────┤
│  AUCTION#<listingId> │  LISTING         │  { sellerId, itemName,  │
│                       │                  │    price, duration,     │
│                       │                  │    createdAt }          │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  AUCTION              │  META            │  { nextId: 5 }          │
├──────────────────────┼──────────────────┼─────────────────────────┤
│  SHOP#<shopId>        │  INVENTORY       │  { items: [{name,       │
│                       │                  │    quantity, price}] }  │
└──────────────────────┴──────────────────┴─────────────────────────┘
```

### Key Design Decisions

1. **PK prefix encodes entity type** — enables single-table queries and avoids key collisions.
2. **SK encodes data segment** — one player = multiple rows, assembled on read via `Query(PK=PLAYER#alice)`.
3. **No GSI needed initially** — all access patterns are PK-based (get player by ID, get NPC by ID).
4. **USER# PK maps directly** — login does `GetItem(PK=USER#alice, SK=AUTH)`, no scan needed.
5. **Atomic counters for economy** — uses `UpdateExpression: SET balance = balance + :amount`.
6. **ConditionExpression for NPC combat** — two players can't double-kill same NPC.

---

## 2. Terraform Infrastructure

### File: `terraform/dynamodb.tf` (new file)

```hcl
# ─── DynamoDB Table ─────────────────────────────
resource "aws_dynamodb_table" "state" {
  name         = "${var.app_name}-state"
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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.app_name}-state"
  }
}
```

### File: `terraform/iam-dynamodb.tf` (new file)

```hcl
# ─── DynamoDB IAM Policy — attached to ECS task role ──
resource "aws_iam_role_policy" "ecs_task_dynamodb" {
  name = "${var.app_name}-ecs-dynamodb"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ]
        Resource = [
          aws_dynamodb_table.state.arn,
          "${aws_dynamodb_table.state.arn}/index/*",
        ]
      }
    ]
  })
}
```

### Terraform Outputs (add to `terraform/main.tf`)

```hcl
output "dynamodb_table" { value = aws_dynamodb_table.state.name }
output "dynamodb_arn"   { value = aws_dynamodb_table.state.arn }
```

### Changes to `terraform/main.tf`

No deletions needed. EFS can remain as an option for future use, but the ECS task
no longer mounts it for player data. The task definition's `mount_points` for EFS
can be removed once DynamoDB is verified.

---

## 3. TypeScript Implementation

### File: `server/src/systems/DynamoStateSystem.ts` (new — ~200 lines)

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// ── In-memory mock interface (for E2E tests) ──
export interface IDynamoState {
  getPlayer(playerId: string): Promise<Player | null>;
  savePlayer(playerId: string, player: Player): Promise<void>;
  getUserHash(username: string): Promise<string | null>;
  saveUser(username: string, passwordHash: string): Promise<void>;
  getNpcState(npcId: string): Promise<NpcState | null>;
  saveNpcState(npcId: string, state: NpcState): Promise<void>;
  getRoomItems(roomId: string): Promise<RoomItems>;
  saveRoomItems(roomId: string, items: RoomItems): Promise<void>;
  // ... economy methods
  saveAllPlayers(players: Player[]): Promise<void>;  // bulk save for migration
}

// ── Real DynamoDB implementation ──
export class DynamoStateSystem implements IDynamoState {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, region: string) {
    this.tableName = tableName;
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region })
    );
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `PLAYER#${playerId}` },
    }));
    if (!result.Items || result.Items.length === 0) return null;
    return this.assemblePlayer(result.Items);
  }

  async savePlayer(playerId: string, player: Player): Promise<void> {
    const writes = this.decomposePlayer(playerId, player).map(item => ({
      PutRequest: { Item: item },
    }));
    // BatchWrite in chunks of 25
    for (let i = 0; i < writes.length; i += 25) {
      await this.client.send(new BatchWriteCommand({
        RequestItems: { [this.tableName]: writes.slice(i, i + 25) },
      }));
    }
  }

  // ... assemble/decompose helpers, NPC, Room, Economy methods
}

// ── In-memory mock (for E2E tests) ──
export class InMemoryStateSystem implements IDynamoState {
  private store = new Map<string, Map<string, any>>();

  private key(pk: string, sk: string): string { return `${pk}::${sk}`; }

  async getPlayer(playerId: string): Promise<Player | null> {
    // Reassemble from multiple rows
    // ... uses store.get(pk, sk) pattern
    return null;
  }
  // ... same interface, in-memory implementation
}
```

### File: `server/src/systems/PersistenceFacade.ts` (new — ~50 lines)

```typescript
import { IDynamoState } from './DynamoStateSystem.js';

/**
 * PersistenceFacade provides unified persistence interface.
 * In production: uses DynamoDB via DynamoStateSystem.
 * In dev/test: uses InMemoryStateSystem or file-based fallback.
 *
 * Static game data (maps, skills, npc templates, items, schools, conditions,
 * recipes, shops) remain as JSON files loaded at startup — they are templates,
 * not mutable state.
 */
export class PersistenceFacade {
  constructor(private state: IDynamoState) {}

  // delegates to this.state.*
}
```

### File: `server/src/index.ts` — changes

```typescript
// ── Replace ──
// const persistence = new PersistenceSystem();
// const savedPlayers = persistence.loadAll();

// ── With ──
import { DynamoStateSystem, InMemoryStateSystem } from './systems/DynamoStateSystem.js';
import { PersistenceFacade } from './systems/PersistenceFacade.js';

const useDynamo = process.env['DYNAMODB_TABLE'] != null;
const stateSystem = useDynamo
  ? new DynamoStateSystem(process.env['DYNAMODB_TABLE']!, process.env['AWS_REGION'] || 'ap-southeast-1')
  : new InMemoryStateSystem();

const persistence = new PersistenceFacade(stateSystem);

// On startup: load saved players from DynamoDB (or in-memory for dev)
// The InMemoryStateSystem can optionally seed from players.json for local dev
```

### NPM Dependencies (add to `server/package.json`)

```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0"
  }
}
```

---

## 4. Local Development Strategy

### Option A: DynamoDB Local (Docker) — for manual testing

```bash
# docker-compose.yml (add to project root)
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -sharedDb"
```

```typescript
// When DYNAMODB_ENDPOINT=http://localhost:8000 is set:
const client = new DynamoDBClient({
  region: 'local',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
});
```

**Use case**: Manual QA testing with real DynamoDB API behavior.

### Option B: In-Memory Mock — for E2E tests (RECOMMENDED)

The `InMemoryStateSystem` class implements the same `IDynamoState` interface
using a `Map<string, Map<string, any>>`. This is used in all server-side E2E
tests (`index.e2e.test.ts` and any future server integration tests).

```typescript
// server/src/index.e2e.test.ts
import { InMemoryStateSystem } from './systems/DynamoStateSystem.js';

beforeAll(() => {
  // Seed in-memory state for tests
  const state = new InMemoryStateSystem();
  state.seedFromFile('data/players.json');  // optional seed
  app.useTestState(state);  // inject mock
});

afterEach(() => {
  state.reset();  // clean state between tests
});
```

**Advantages over dynamodb-local for tests**:
- No Docker dependency (critical for GitHub Actions CI)
- Instant reset between tests (no table recreation)
- Zero network overhead (tests run in same process)
- Same interface = same code path validation

### Environment Variable Contract

| Variable | Prod (ECS) | Local Docker | Local In-Memory (dev/test) |
|---|---|---|---|
| `DYNAMODB_TABLE` | `wuxia-mud-state` | `wuxia-mud-state` | (unset — triggers InMemoryStateSystem) |
| `DYNAMODB_ENDPOINT` | (unset — uses AWS default) | `http://localhost:8000` | (unset) |
| `AWS_REGION` | `ap-southeast-1` | `local` | (unset) |

---

## 5. Migration Strategy

### Phase 1: Dual-Write (safe rollout)

```
1. Deploy DynamoDB table via Terraform
2. Deploy new code with DynamoStateSystem
3. Code writes to BOTH DynamoDB + JSON files (dual-write)
4. Reads from DynamoDB first, fall back to JSON
5. Monitor CloudWatch metrics for errors
6. Run for 1 week to confirm stability
```

### Phase 2: Cut Over

```
7. Remove JSON file writes
8. Remove EFS mount from ECS task definition
9. Optionally remove EFS from Terraform (keep for 30 days as safety net)
```

### Migration Script (run once, one-time)

```typescript
// scripts/migrate-json-to-dynamodb.ts
// Reads players.json, writes each player to DynamoDB
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import fs from 'fs';

const players = JSON.parse(fs.readFileSync('server/src/data/players.json', 'utf-8'));
// ... batch write each player
```

---

## 6. ECS Task Environment Variables

Add to `terraform/main.tf` task definition `container_definitions`:

```json
{
  "environment": [
    { "name": "DYNAMODB_TABLE", "value": "${aws_dynamodb_table.state.name}" },
    { "name": "AWS_REGION", "value": "${var.region}" }
  ]
}
```

---

## 7. File Change Summary

### New files (7)

| File | Purpose |
|---|---|
| `terraform/dynamodb.tf` | DynamoDB table resource |
| `terraform/iam-dynamodb.tf` | IAM policy for DynamoDB access |
| `server/src/systems/DynamoStateSystem.ts` | DynamoDB + InMemory implementations |
| `server/src/systems/PersistenceFacade.ts` | Unified persistence interface |
| `docker-compose.yml` | DynamoDB Local container (dev) |
| `scripts/migrate-json-to-dynamodb.ts` | One-shot migration script |
| `scripts/create-dynamodb-table.sh` | Local dev helper |

### Modified files (3)

| File | Change |
|---|---|
| `terraform/main.tf` | Add DynamoDB table ARN to IAM + env vars to ECS task + outputs |
| `server/src/index.ts` | Replace PersistenceSystem → PersistenceFacade + env-based switch |
| `server/package.json` | Add `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` |

### Deprecated files (kept for reference, removed later)

| File | Reason |
|---|---|
| `server/src/systems/PersistenceSystem.ts` | Replaced by DynamoStateSystem + PersistenceFacade |
| `server/src/data/players.json` | Migrated to DynamoDB (keep as seed for InMemoryStateSystem) |
| `server/src/data/users.json` | Migrated to DynamoDB |

---

## 8. API Reference — DynamoDB Access Patterns

| Operation | DynamoDB API | Pattern |
|---|---|---|
| Load player on login | `Query(PK=PLAYER#id)` | Returns all rows for player; assemble into Player object |
| Save player on disconnect | `BatchWriteItem` | Decompose player into 8-10 rows; write all atomically |
| Authenticate user | `GetItem(PK=USER#name, SK=AUTH)` | Single row read |
| Register user | `PutItem(PK=USER#name, SK=AUTH)` | Condition: attribute_not_exists(PK) |
| NPC takes damage | `UpdateItem(PK=NPC#bandit, SK=STATE)` | `SET hp = hp - :dmg` with `ConditionExpression: hp > :dmg` |
| Player picks up item | `UpdateItem(PK=ROOM#town-square, SK=ITEMS)` | `REMOVE items[0]` + `SET #cnt = #cnt - :1` |
| Deposit silver | `UpdateItem(PK=PLAYER#id, SK=BANK)` | `SET silver = silver + :amount` (atomic increment) |
| List all online players | Not needed (keep in-memory via PlayerManager) | DynamoDB is source of truth, PlayerManager is runtime cache |
| Bulk save all players (15-min heartbeat) | `BatchWriteItem` (loop by 25) | Same as single save, batched |

### Important: PlayerManager remains in-memory

DynamoDB is the **persistence layer**, not the runtime layer.
`PlayerManager` continues to hold active player objects in memory.
DynamoDB reads happen on login; writes happen on save/disconnect/crash.
This matches oiuv_mud's architecture exactly.

---

## 9. Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| DynamoDB unavailable | Retry 3x with exponential backoff; queue write for later; emit warning to admin |
| Player save fails | Log error; player data remains in memory; retry on next save cycle |
| ConditionExpression fails (NPC already dead) | Return "敌人已被击败" to second attacker; no error |
| User already exists (register) | ConditionExpression `attribute_not_exists(PK)` → return "用户名已被注册" |
| BatchWrite partial failure | `UnprocessedItems` in response → retry only those items |

---

## 10. Cost Estimate

| Resource | Monthly Cost (100 players) |
|---|---|
| DynamoDB storage (~10KB/player × 100) = 1 MB | $0.00 |
| DynamoDB writes (100 players × ~10 saves/hr × 10 rows) = 10,000 writes/hr = 7.2M/month | $9.00 |
| DynamoDB reads (100 players × ~2 logins/hr × 10 rows) = 2,000 reads/hr = 1.44M/month | $0.36 |
| **Total DynamoDB** | **~$9.36/month** |
| ECS Fargate (existing) | $33/month |
| **Grand total** | **~$42/month** |

> Note: The write cost can be reduced by saving less frequently (every 5 min
> instead of every command) and by combining segments into fewer rows (e.g.,
> skills+inventory+equipped as a single JSON blob instead of separate rows).
> With optimizations: **~$4/month**.

---

## 11. Implementation Order

```
Day 1-2: Terraform + DynamoDB table
  ├── terraform/dynamodb.tf
  ├── terraform/iam-dynamodb.tf
  ├── terraform/main.tf (add IAM + env vars + outputs)
  └── terraform apply

Day 2-3: DynamoStateSystem + PersistenceFacade
  ├── server/src/systems/DynamoStateSystem.ts (DynamoDB + InMemory classes)
  ├── server/src/systems/PersistenceFacade.ts
  └── server/package.json (add AWS SDK deps)

Day 3-4: Server integration
  ├── server/src/index.ts (wire up PersistenceFacade)
  ├── docker-compose.yml (add dynamodb-local)
  └── Local dev testing

Day 4-5: E2E tests + InMemoryStateSystem
  ├── Update server/src/index.e2e.test.ts
  └── Verify all 187 tests pass

Day 5-6: Migration + deployment
  ├── scripts/migrate-json-to-dynamodb.ts
  └── Deploy to ECS, verify, monitor
```

---

> This plan is ready for implementation. Start from §2 (Terraform) and work
> top-to-bottom through §11.

---

## 12. Start/Stop Strategy — Terraform `enabled` Toggle (No ALB)

### Design Goal

One command to tear down compute, one command to bring it back — **DynamoDB data
survives both operations untouched**. No ALB in the architecture to save ~$18/month.
ECS Fargate task gets a public IP directly — sufficient for an early-stage MUD
where a single task handles all WebSocket connections.

### Terraform Variable

```hcl
# terraform/variables.tf (new file — or add to main.tf)
variable "enabled" {
  description = "Set to false to destroy ECS service, keeping DynamoDB + VPC + ECR"
  type        = bool
  default     = true
}
```

### Architecture — enabled vs disabled

```
enabled = true:
  Internet ──▶ ECS Fargate (public IP, Node.js + Socket.io)
                    │
                    ▼
              DynamoDB (wuxia-mud-state) — NEVER destroyed

enabled = false:
  Internet ──▶ (nothing listening)
              DynamoDB — data preserved, zero requests, cost $0
              ECR — Docker image preserved, cost ~$0.10/month
```

### Commands

```bash
# ⏹ Stop — destroys ECS service, DynamoDB data untouched
terraform apply -var="enabled=false" -auto-approve

# ▶️  Start — recreates ECS service, reconnects to existing DynamoDB
terraform apply -var="enabled=true" -auto-approve
```

### What Gets Destroyed vs Preserved

| Resource | enabled=false | enabled=true | Data Lost? |
|---|---|---|---|
| ECS Service | Destroyed | Recreated | No (stateless) |
| DynamoDB | **Preserved** | Reconnected | **Never** |
| VPC + Subnets | Preserved | Preserved | — |
| ECR | Preserved | Preserved | — |
| IAM Roles + SG | Preserved | Preserved | — |
| Public IP | Released | New IP assigned | — |

### Cost When Stopped (enabled=false)

| Resource | Monthly Cost |
|---|---|
| DynamoDB (table exists, zero requests) | $0.00 |
| VPC + Subnets + IGW | $0.00 |
| ECR (Docker image stored) | ~$0.10 |
| Security Groups | $0.00 |
| IAM Roles | $0.00 |
| **Total** | **~$0.10/month** |

### Cost When Running (enabled=true)

| Resource | Monthly Cost |
|---|---|
| ECS Fargate (0.25 vCPU, 512 MB) | ~$33.00 |
| DynamoDB (reads + writes, see §10) | ~$4.00 |
| ECR | ~$0.10 |
| **Total** | **~$37.00/month** |

### Key Terraform Resource Changes

**ECS Service — conditional, public IP, no ALB:**

```hcl
resource "aws_ecs_service" "app" {
  count          = var.enabled ? 1 : 0
  name           = "${var.app_name}-service"
  cluster        = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.enabled ? var.desired_count : 0
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true   # Direct public access, no ALB
  }
  # No load_balancer block — ALB removed entirely
}
```

**Security Group — open game port to internet:**

```hcl
resource "aws_security_group" "ecs" {
  name   = "${var.app_name}-ecs-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = var.container_port   # 3000
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0; to_port = 0; protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

**DynamoDB — ALWAYS provisioned, protected from destroy:**

```hcl
resource "aws_dynamodb_table" "state" {
  name         = "${var.app_name}-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"; range_key = "SK"

  attribute { name = "PK"; type = "S" }
  attribute { name = "SK"; type = "S" }

  point_in_time_recovery { enabled = true }
  server_side_encryption  { enabled = true }

  lifecycle { prevent_destroy = true }
  tags = { Name = "${var.app_name}-state" }
}
```

### Resources REMOVED from original terraform/main.tf

| Resource | Reason |
|---|---|
| `aws_lb` / `aws_lb_target_group` / `aws_lb_listener` | No ALB (ECS gets public IP) |
| `aws_security_group.alb` | No ALB |
| `aws_efs_file_system` / `aws_efs_mount_target` | DynamoDB replaces file persistence |
| `aws_security_group.efs` | No EFS |
| `aws_iam_role_policy.ecs_task_efs` | No EFS |
| `aws_acm_certificate` data source | No HTTPS/ALB |
| `load_balancer` block in `aws_ecs_service` | No ALB |
| `mount_points` for EFS in task definition | No EFS |

### Public IP Discovery After Restart

Save as `scripts/get-game-url.sh`:

```bash
TASK_ARN=$(aws ecs list-tasks \
  --cluster wuxia-mud-cluster --service-name wuxia-mud-service \
  --region ap-southeast-1 --query 'taskArns[0]' --output text)

ENI_ID=$(aws ecs describe-tasks \
  --cluster wuxia-mud-cluster --tasks $TASK_ARN \
  --region ap-southeast-1 \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

PUBLIC_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids $ENI_ID \
  --region ap-southeast-1 \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo "Game: http://$PUBLIC_IP:3000"
```

> **Note:** Public IP changes on every `terraform apply`. For a stable domain,
> add Route53 later and update via a post-deploy GitHub Action.
