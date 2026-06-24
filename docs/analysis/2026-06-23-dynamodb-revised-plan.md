# DynamoDB Revised Implementation Plan — mud_game

> **Date**: 2026-06-23  
> **Status**: Plan — ready for implementation  
> **Goal**: Replace JSON file persistence with AWS DynamoDB, keep ALB/HTTPS for future payment integration, and simplify the data model  
> **Assumption**: AWS CLI is configured with root/AdministratorAccess credentials. Deployment commands use direct CLI/API access.

---

## 1. Executive Summary

This is a revised version of `2026-06-21-dynamodb-implementation-plan.md`. The original plan proposed exposing ECS directly via a public IP and dropping the ALB to save ~$18/month. This plan **keeps the ALB and HTTPS** because the payment monetization plan requires HTTPS callbacks from WeChat/Alipay.

Key differences from the original plan:

| Area | Original Plan | This Revised Plan |
|---|---|---|
| ALB | Removed | **Kept** (HTTPS + payment callbacks) |
| Player storage | 8-10 decomposed rows per player | **1 JSON blob row per player** |
| Save atomicity | `BatchWriteItem` (non-atomic) | **`PutItem` (atomic)** |
| Social features | Not covered | **Included** (friends, guilds, mail) |
| Local dev | DynamoDB Local recommended | **In-memory mock by default**, DynamoDB Local optional |
| CI/CD auth | OIDC role | **AWS access keys** (root access assumed) |
| EFS | Removed | **Removed** (DynamoDB replaces it) |

**Expected cost**: ~$35-45/month for a single-task Fargate service with ALB and DynamoDB.

---

## 2. Architecture Overview

```
                         Internet
                            │
                            ▼
                    ┌───────────────┐
                    │  Route 53     │  (optional — for stable domain)
                    │  ACM Cert     │  (optional — for HTTPS)
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  ALB :443/:80 │  <- always on for HTTPS stability
                    │  (ACM HTTPS)  │
                    └───────┬───────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  ECS Fargate (1 task)       │
              │  Node.js + Socket.io        │
              │  ─────────────────────────  │
              │  PersistenceFacade          │
              │  ├─ DynamoStateSystem (prod)│
              │  └─ InMemoryStateSystem(dev)│
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  DynamoDB                   │
              │  Table: wuxia-mud-state     │
              │  Single-table design        │
              └─────────────────────────────┘
```

**Design principles**:

1. **DynamoDB is persistence only**. `PlayerManager` keeps active players in memory.
2. **One row per player** simplifies code and reduces write cost.
3. **ALB stays** so HTTPS/payment callbacks work out of the box.
4. **In-memory mock** is the default for local dev and CI tests.
5. **DynamoDB Local** is available for manual integration testing.

---

## 3. Data Model — Single Table

### Table: `wuxia-mud-state`

- **Partition Key**: `PK` (string)
- **Sort Key**: `SK` (string)
- **Billing Mode**: `PAY_PER_REQUEST` (on-demand)

### Entity Schema

```text
┌─────────────────────────┬─────────────────┬─────────────────────────────────────────┐
│ PK                      │ SK              │ Attributes                              │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ USER#<username>         │ AUTH            │ passwordHash, createdAt                 │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ PLAYER#<playerId>       │ DATA            │ full player JSON blob                   │
│                         │                 │ (skills, inventory, equipped, attrs,    │
│                         │                 │  conditions, school, quest, bank,       │
│                         │                 │  kills, friends, guildId, etc.)         │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ PLAYER#<playerId>       │ META            │ name, level, currentRoom, updatedAt     │
│                         │                 │ (optional lightweight index row)        │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ PLAYER#<playerId>       │ MAIL#<mailId>   │ from, subject, body, read, createdAt    │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ NPC#<npcId>             │ STATE           │ hp, maxHp, state, targetPlayerId,       │
│                         │                 │ respawnAt, conditionState               │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ ROOM#<roomId>           │ ITEMS           │ items: [{ itemId, qty, ... }]           │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ AUCTION#<listingId>     │ LISTING         │ sellerId, item, startPrice, buyout,     │
│                         │                 │ currentBid, bidderId, expiresAt         │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ AUCTION                 │ META            │ nextId                                  │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ GUILD#<guildId>         │ META            │ name, leaderId, createdAt               │
├─────────────────────────┼─────────────────┼─────────────────────────────────────────┤
│ GUILD#<guildId>         │ MEMBERS         │ memberIds: []                           │
└─────────────────────────┴─────────────────┴─────────────────────────────────────────┘
```

### Key Design Decisions

1. **One `DATA` row per player** keeps saves atomic (`PutItem`) and minimizes write cost. The whole player object is serialized as JSON.
2. **Separate `META` row** is optional. It stores small, frequently read fields without deserializing the full blob. It can be omitted in the first iteration.
3. **Mail stored separately** so offline players can receive mail and read it on next login (`Query(PLAYER#id, SK begins_with MAIL#)`).
4. **Guilds stored separately** so guild info persists across member logins.
5. **NPC `STATE` only for instances that deviate from templates** (e.g. bosses with respawn timers, damaged guards).
6. **No GSI required initially**. All reads are by known PK/SK.
7. **Username sanitization**: DynamoDB keys must be UTF-8 strings. Usernames are already constrained by the game, but we validate no `#` or control characters.

---

## 4. Terraform Infrastructure

### New File: `terraform/dynamodb.tf`

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

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "${var.app_name}-state"
  }
}
```

### New File: `terraform/iam-dynamodb.tf`

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

### Modified: `terraform/main.tf`

Changes:

1. **Remove EFS resources**:
   - `aws_efs_file_system.data`
   - `aws_efs_mount_target.data`
   - `aws_security_group.efs`
   - `aws_iam_role_policy.ecs_task_efs`
   - `mount_points` and `volume` blocks in `aws_ecs_task_definition.app`
   - `efs_id` output

2. **Add environment variables to ECS task**:

```hcl
environment = [
  { name = "NODE_ENV",       value = "production" },
  { name = "PORT",           value = tostring(var.container_port) },
  { name = "DYNAMODB_TABLE", value = aws_dynamodb_table.state.name },
  { name = "AWS_REGION",     value = var.region },
]
```

3. **Add start/stop toggle** (optional but recommended):

```hcl
variable "enabled" {
  description = "Set to false to stop ECS tasks while keeping ALB + DynamoDB"
  type        = bool
  default     = true
}

resource "aws_ecs_service" "app" {
  count           = var.enabled ? 1 : 0
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.enabled ? var.desired_count : 0
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
}
```

> **Note**: When `enabled = false`, the ECS service is destroyed but the ALB and DynamoDB remain. This saves compute cost (~$15/month) while preserving HTTPS endpoint stability (~$18/month ALB cost remains).

4. **Add outputs**:

```hcl
output "dynamodb_table" { value = aws_dynamodb_table.state.name }
output "dynamodb_arn"   { value = aws_dynamodb_table.state.arn }
```

5. **Optional GitHub Actions IAM user** (see §8):

```hcl
resource "aws_iam_user" "github_actions" {
  name = "github-actions-${var.app_name}"
}

resource "aws_iam_user_policy" "github_actions" {
  name = "${var.app_name}-github-actions"
  user = aws_iam_user.github_actions.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "elasticloadbalancing:DescribeLoadBalancers",
        ]
        Resource = "*"
      }
    ]
  })
}
```

---

## 5. TypeScript Implementation

### New File: `server/src/systems/DynamoStateSystem.ts`

```typescript
import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Player } from '../models/Player.js';

export interface NpcState {
  hp: number;
  maxHp: number;
  state: string;
  targetPlayerId?: string;
  respawnAt?: number;
  conditionState?: Record<string, unknown>;
}

export interface RoomItems {
  items: Array<{ itemId: string; quantity: number }>;
}

export interface AuctionListing {
  sellerId: string;
  itemId: string;
  itemName: string;
  startPrice: number;
  buyout?: number;
  currentBid?: number;
  bidderId?: string;
  expiresAt: number;
  createdAt: number;
}

export interface GuildMeta {
  name: string;
  leaderId: string;
  createdAt: number;
}

export interface PersistedMail {
  id: string;
  fromId: string;
  fromName: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface IStateSystem {
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

export class DynamoStateSystem implements IStateSystem {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, region: string, endpoint?: string) {
    this.tableName = tableName;
    const config: DynamoDBClientConfig = { region };
    if (endpoint) config.endpoint = endpoint;
    if (endpoint?.startsWith('http://localhost')) {
      config.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
    }
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient(config));
  }

  private key(pk: string, sk: string) {
    return { PK: pk, SK: sk };
  }

  async getUserHash(username: string): Promise<string | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key(`USER#${username}`, 'AUTH'),
    }));
    return (result.Item?.passwordHash as string) ?? null;
  }

  async saveUser(username: string, passwordHash: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key(`USER#${username}`, 'AUTH'), passwordHash },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key(`PLAYER#${playerId}`, 'DATA'),
    }));
    return (result.Item?.data as Player) ?? null;
  }

  async savePlayer(playerId: string, player: Player): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key(`PLAYER#${playerId}`, 'DATA'), data: player },
    }));
  }

  async getNpcState(npcId: string): Promise<NpcState | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key(`NPC#${npcId}`, 'STATE'),
    }));
    return (result.Item?.state as NpcState) ?? null;
  }

  async saveNpcState(npcId: string, state: NpcState): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key(`NPC#${npcId}`, 'STATE'), state },
    }));
  }

  async getRoomItems(roomId: string): Promise<RoomItems | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key(`ROOM#${roomId}`, 'ITEMS'),
    }));
    return (result.Item?.items as RoomItems) ?? null;
  }

  async saveRoomItems(roomId: string, items: RoomItems): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key(`ROOM#${roomId}`, 'ITEMS'), items },
    }));
  }

  async getAuction(id: number): Promise<AuctionListing | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key(`AUCTION#${id}`, 'LISTING'),
    }));
    return (result.Item?.listing as AuctionListing) ?? null;
  }

  async saveAuction(id: number, listing: AuctionListing): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key(`AUCTION#${id}`, 'LISTING'), listing },
    }));
  }

  async deleteAuction(id: number): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: this.key(`AUCTION#${id}`, 'LISTING'),
    }));
  }

  async getNextAuctionId(): Promise<number> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: this.key('AUCTION', 'META'),
    }));
    return (result.Item?.nextId as number) ?? 1;
  }

  async setNextAuctionId(id: number): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...this.key('AUCTION', 'META'), nextId: id },
    }));
  }

  async getGuild(guildId: string): Promise<{ meta: GuildMeta; members: string[] } | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `GUILD#${guildId}` },
    }));
    if (!result.Items || result.Items.length === 0) return null;
    const meta = result.Items.find((i) => i.SK === 'META')?.meta as GuildMeta;
    const members = result.Items.find((i) => i.SK === 'MEMBERS')?.memberIds as string[] ?? [];
    return meta ? { meta, members } : null;
  }

  async saveGuild(guildId: string, meta: GuildMeta, members: string[]): Promise<void> {
    await this.client.send(new BatchWriteCommand({
      RequestItems: {
        [this.tableName]: [
          { PutRequest: { Item: { ...this.key(`GUILD#${guildId}`, 'META'), meta } } },
          { PutRequest: { Item: { ...this.key(`GUILD#${guildId}`, 'MEMBERS'), memberIds: members } } },
        ],
      },
    }));
  }

  async getMail(playerId: string): Promise<PersistedMail[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `PLAYER#${playerId}`, ':prefix': 'MAIL#' },
    }));
    return (result.Items ?? []).map((i) => ({
      id: i.SK.replace('MAIL#', ''),
      fromId: i.fromId,
      fromName: i.fromName,
      subject: i.subject,
      body: i.body,
      read: i.read,
      createdAt: i.createdAt,
    })) as PersistedMail[];
  }

  async saveMail(playerId: string, mail: PersistedMail): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...this.key(`PLAYER#${playerId}`, `MAIL#${mail.id}`),
        fromId: mail.fromId,
        fromName: mail.fromName,
        subject: mail.subject,
        body: mail.body,
        read: mail.read,
        createdAt: mail.createdAt,
      },
    }));
  }

  async markMailRead(playerId: string, mailId: string): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this.key(`PLAYER#${playerId}`, `MAIL#${mailId}`),
      UpdateExpression: 'SET #read = :true',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: { ':true': true },
    }));
  }

  async deleteMail(playerId: string, mailId: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: this.key(`PLAYER#${playerId}`, `MAIL#${mailId}`),
    }));
  }
}
```

### New File: `server/src/systems/InMemoryStateSystem.ts`

A `Map<string, Map<string, any>>` implementation of `IStateSystem`. Used for local dev and tests.

```typescript
export class InMemoryStateSystem implements IStateSystem {
  private store = new Map<string, Map<string, any>>();

  private pkSk(pk: string, sk: string): string {
    return `${pk}::${sk}`;
  }

  private getRow(pk: string, sk: string): any {
    return this.store.get(pk)?.get(sk);
  }

  private setRow(pk: string, sk: string, value: any): void {
    if (!this.store.has(pk)) this.store.set(pk, new Map());
    this.store.get(pk)!.set(sk, value);
  }

  async getUserHash(username: string): Promise<string | null> {
    return this.getRow(`USER#${username}`, 'AUTH')?.passwordHash ?? null;
  }

  async saveUser(username: string, passwordHash: string): Promise<void> {
    if (this.getRow(`USER#${username}`, 'AUTH')) {
      throw new Error('User already exists');
    }
    this.setRow(`USER#${username}`, 'AUTH', { passwordHash });
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    const row = this.getRow(`PLAYER#${playerId}`, 'DATA');
    return row ? structuredClone(row.data) : null;
  }

  async savePlayer(playerId: string, player: Player): Promise<void> {
    this.setRow(`PLAYER#${playerId}`, 'DATA', { data: structuredClone(player) });
  }

  // ... implement remaining IStateSystem methods similarly

  reset(): void {
    this.store.clear();
  }
}
```

### New File: `server/src/systems/PersistenceFacade.ts`

Thin wrapper that exposes the same interface as the old `PersistenceSystem` so existing code can migrate incrementally.

```typescript
import { IStateSystem } from './DynamoStateSystem.js';
import { Player } from '../models/Player.js';

export class PersistenceFacade {
  constructor(private state: IStateSystem) {}

  async getUserHash(username: string): Promise<string | null> {
    return this.state.getUserHash(username);
  }

  async saveUser(username: string, passwordHash: string): Promise<void> {
    return this.state.saveUser(username, passwordHash);
  }

  async loadAll(): Promise<Player[]> {
    // DynamoDB does not have a cheap "scan all players" for this design.
    // For migration/backup, use a separate script.
    // At runtime, PlayerManager loads players on demand during login.
    return [];
  }

  async savePlayer(playerId: string, player: Player): Promise<void> {
    return this.state.savePlayer(playerId, player);
  }
}
```

> **Important**: With DynamoDB, we no longer load all players on startup. Players are loaded on login. This is more scalable and matches how real MUDs work.

### Modified: `server/src/index.ts`

Replace:

```typescript
const persistence = new PersistenceSystem();
const savedPlayers = persistence.loadAll();
```

With:

```typescript
import { DynamoStateSystem } from './systems/DynamoStateSystem.js';
import { InMemoryStateSystem } from './systems/InMemoryStateSystem.js';
import { PersistenceFacade } from './systems/PersistenceFacade.js';

const dynamoTable = process.env['DYNAMODB_TABLE'];
const dynamoEndpoint = process.env['DYNAMODB_ENDPOINT'];
const awsRegion = process.env['AWS_REGION'] || 'ap-southeast-1';

const stateSystem = dynamoTable
  ? new DynamoStateSystem(dynamoTable, awsRegion, dynamoEndpoint)
  : new InMemoryStateSystem();

const persistence = new PersistenceFacade(stateSystem);
```

### Modified: `server/package.json`

Add dependencies:

```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0",
    "tsx": "^4.20.0"
  }
}
```

> `tsx` is moved from `devDependencies` to `dependencies` so the production Docker image can run TypeScript directly.

---

## 6. Local Development Strategy

### Default: In-Memory State System

No extra setup. Running `npm run dev:all` uses `InMemoryStateSystem` automatically because `DYNAMODB_TABLE` is unset.

### Optional: DynamoDB Local (Docker)

Add `docker-compose.yml`:

```yaml
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -sharedDb"
  
  game:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DYNAMODB_TABLE=wuxia-mud-state
      - DYNAMODB_ENDPOINT=http://dynamodb-local:8000
      - AWS_REGION=local
    depends_on:
      - dynamodb-local
```

Create table locally:

```bash
aws dynamodb create-table \
  --table-name wuxia-mud-state \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region local
```

### Environment Variable Contract

| Variable | Production | DynamoDB Local | In-Memory Dev/Test |
|---|---|---|---|
| `DYNAMODB_TABLE` | `wuxia-mud-state` | `wuxia-mud-state` | (unset) |
| `DYNAMODB_ENDPOINT` | (unset) | `http://localhost:8000` | (unset) |
| `AWS_REGION` | `ap-southeast-1` | `local` | (unset) |
| `AWS_ACCESS_KEY_ID` | (IAM role) | `fake` | (not needed) |
| `AWS_SECRET_ACCESS_KEY` | (IAM role) | `fake` | (not needed) |

---

## 7. Migration Strategy

### Phase 1: Dual-Write (1-2 weeks)

1. Deploy DynamoDB table via Terraform.
2. Deploy new code with `PersistenceFacade`.
3. Configure the server to **write to both DynamoDB and JSON files**.
4. **Read from DynamoDB first**, fall back to JSON.
5. Run locally and in staging to verify.

### Phase 2: Cut Over

1. Run migration script to backfill existing `players.json` and `users.json` into DynamoDB.
2. Switch reads to DynamoDB only.
3. Remove JSON writes.
4. Remove EFS mount from ECS.

### Migration Script: `scripts/migrate-json-to-dynamodb.ts`

```typescript
import { DynamoStateSystem } from '../server/src/systems/DynamoStateSystem.js';
import fs from 'fs';

const tableName = process.env['DYNAMODB_TABLE']!;
const region = process.env['AWS_REGION'] || 'ap-southeast-1';
const endpoint = process.env['DYNAMODB_ENDPOINT'];

const state = new DynamoStateSystem(tableName, region, endpoint);

async function main() {
  const users = JSON.parse(fs.readFileSync('server/src/data/users.json', 'utf-8'));
  for (const [username, hash] of Object.entries(users)) {
    await state.saveUser(username, hash as string).catch(() => {}); // skip existing
  }

  const players = JSON.parse(fs.readFileSync('server/src/data/players.json', 'utf-8'));
  for (const player of players) {
    await state.savePlayer(player.id, player);
  }
  console.log(`Migrated ${Object.keys(users).length} users and ${players.length} players.`);
}

main().catch(console.error);
```

Run:

```bash
npx tsx scripts/migrate-json-to-dynamodb.ts
```

---

## 8. CI/CD & Deployment Commands

Since you have root AWS access, the simplest path is to use an **IAM user access key** in GitHub Secrets rather than OIDC.

### Step 1: Create Deployment Credentials

```bash
# Create a dedicated CI/CD user (recommended even with root access)
aws iam create-user --user-name github-actions-wuxia-mud

# Attach a policy allowing ECR push, ECS update, and ELB describe
aws iam put-user-policy \
  --user-name github-actions-wuxia-mud \
  --policy-name wuxia-mud-deploy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "elasticloadbalancing:DescribeLoadBalancers"
        ],
        "Resource": "*"
      }
    ]
  }'

# Create access key
aws iam create-access-key --user-name github-actions-wuxia-mud
```

Store the resulting `AccessKeyId` and `SecretAccessKey` in GitHub Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` = `ap-southeast-1`

### Step 2: Revised `.github/workflows/deploy.yml`

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: ap-southeast-1
  ECR_REPO: wuxia-mud
  ECS_CLUSTER: wuxia-mud-cluster
  ECS_SERVICE: wuxia-mud-service

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: cd server && npm ci
      - run: npm run build
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        run: |
          IMAGE="${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.${{ env.AWS_REGION }}.amazonaws.com/${{ env.ECR_REPO }}"
          docker build -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service ${{ env.ECS_SERVICE }} \
            --force-new-deployment \
            --region ${{ env.AWS_REGION }}

  smoke-test:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - run: |
          ALB_DNS=$(aws elbv2 describe-load-balancers --names wuxia-mud-alb --query 'LoadBalancers[0].DNSName' --output text --region ${{ env.AWS_REGION }})
          for i in $(seq 1 12); do
            STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$ALB_DNS/health")
            if [ "$STATUS" = "200" ]; then echo "Health check passed!"; exit 0; fi
            echo "Attempt $i: HTTP $STATUS, retrying..."
            sleep 10
          done
          echo "Health check failed"; exit 1
```

### Step 3: Manual Deployment Commands

```bash
# 1. Configure AWS CLI (one-time)
aws configure

# 2. Initialize Terraform
terraform -chdir=terraform init

# 3. Deploy infrastructure
terraform -chdir=terraform apply -auto-approve

# 4. Build and push Docker image
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-southeast-1
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wuxia-mud:latest .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wuxia-mud:latest

# 5. Force ECS redeploy
aws ecs update-service --cluster wuxia-mud-cluster --service wuxia-mud-service --force-new-deployment --region $AWS_REGION

# 6. Get game URL
aws elbv2 describe-load-balancers --names wuxia-mud-alb --query 'LoadBalancers[0].DNSName' --output text --region $AWS_REGION
```

### Start / Stop Compute (Keep ALB + DynamoDB)

```bash
# Stop ECS tasks but keep ALB and DynamoDB
terraform -chdir=terraform apply -var="enabled=false" -auto-approve

# Start ECS tasks
terraform -chdir=terraform apply -var="enabled=true" -auto-approve
```

---

## 9. Cost Estimate

Assumptions:

- 100 active players
- Save frequency: every 30 seconds while active + on disconnect/level-up
- ~1,200 player-saves/day per active player = 120,000 saves/day = 3.6M saves/month
- Each save is 1 write request unit (WRU) because it's a single `PutItem`

| Resource | Monthly Cost |
|---|---|
| ALB | ~$18.00 |
| ECS Fargate (0.25 vCPU, 512 MB, 1 task) | ~$15.00 |
| DynamoDB writes (3.6M) | ~$4.50 |
| DynamoDB reads (logins) | ~$0.50 |
| DynamoDB storage (10KB × 100 players) | ~$0.00 |
| ECR storage | ~$0.10 |
| Data transfer | ~$1.00 |
| **Total** | **~$39.00/month** |

If you stop ECS tasks (`enabled=false`), you save ~$15/month but still pay ~$24/month for ALB + ECR + DynamoDB table.

---

## 10. Implementation Order

| Day | Task | Deliverables |
|---|---|---|
| 1 | Fix production runtime | Move `tsx` to `server/package.json` dependencies; fix `SkillType` import and TS errors |
| 2 | Add AWS SDK + state interfaces | `server/src/systems/DynamoStateSystem.ts` + `InMemoryStateSystem.ts` interfaces |
| 3 | Implement DynamoDB + in-memory backends | Full `IStateSystem` implementation |
| 4 | Add `PersistenceFacade` + wire `index.ts` | Environment-based switch; default to in-memory |
| 5 | Extend social persistence | Guild + mail storage in state system |
| 6 | Terraform: DynamoDB + IAM | `terraform/dynamodb.tf`, `terraform/iam-dynamodb.tf`, remove EFS |
| 7 | Terraform: ECS integration | Add env vars, optional `enabled` toggle, outputs |
| 8 | Migration script | `scripts/migrate-json-to-dynamodb.ts` |
| 9 | CI/CD + deployment | Updated `.github/workflows/deploy.yml`, IAM user creation |
| 10 | Testing + cutover | Dual-write validation, migrate data, remove JSON fallback |

**Total: ~10 days** for a careful, production-ready migration.

---

## 11. File Change Summary

### New Files

| File | Purpose |
|---|---|
| `server/src/systems/DynamoStateSystem.ts` | DynamoDB implementation of `IStateSystem` |
| `server/src/systems/InMemoryStateSystem.ts` | In-memory implementation for dev/tests |
| `server/src/systems/PersistenceFacade.ts` | Unified persistence interface |
| `terraform/dynamodb.tf` | DynamoDB table resource |
| `terraform/iam-dynamodb.tf` | ECS task DynamoDB IAM policy |
| `scripts/migrate-json-to-dynamodb.ts` | One-time data migration |
| `docker-compose.yml` | Optional DynamoDB Local setup |

### Modified Files

| File | Change |
|---|---|
| `server/package.json` | Add AWS SDK, move `tsx` to dependencies |
| `server/src/index.ts` | Wire `PersistenceFacade` + env switch |
| `server/src/systems/ChatSystem.ts` / `GuildSystem.ts` / `TradeSystem.ts` | Persist social data via state system |
| `terraform/main.tf` | Remove EFS, add DynamoDB env vars, optional `enabled` toggle |
| `.github/workflows/deploy.yml` | Enable deploy, use AWS access keys |
| `Dockerfile` | Ensure production runtime works (tsx or compiled) |

### Deprecated Files

| File | Reason |
|---|---|
| `server/src/systems/PersistenceSystem.ts` | Replaced by `PersistenceFacade` + state systems |
| `server/src/data/users.json` | Migrated to DynamoDB |
| `server/src/data/players.json` | Migrated to DynamoDB (keep as local seed) |

---

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| DynamoDB throttling under high write volume | Low | Medium | Use single-row player saves; monitor consumed capacity |
| Data loss during migration | Low | High | Dual-write phase; `prevent_destroy` on table; backup before cutover |
| ALB cost higher than expected | Medium | Low | Optional `enabled=false` stops compute; ALB is fixed cost |
| AWS SDK bundle size | Low | Low | Only import `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` |
| Local dev divergence from prod | Medium | Medium | In-memory mock mirrors same interface; periodic DynamoDB Local testing |

---

> **Recommendation**: Start with Day 1-2 (runtime fixes + state interface), then implement `InMemoryStateSystem` and switch local dev to it. This immediately removes the file-persistence dependency and makes the DynamoDB migration a backend swap rather than a refactor.
