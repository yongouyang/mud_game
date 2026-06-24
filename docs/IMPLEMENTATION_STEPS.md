# Phase 6: DynamoDB Migration — Implementation Steps (v2)

> **Goal**: Replace JSON file persistence with DynamoDB for production, keep JSON files for local development.
> **Status**: Ready to implement
> **Estimated effort**: 2-3 days

---

## 🔴 MANUAL STEP 1: AWS Account Setup (Do This First)

These steps **cannot be automated** and must be done manually before any code or Terraform changes.

### 1.1 Create S3 Bucket for Terraform State

> **Why manual**: Terraform can't create its own backend bucket (chicken-and-egg problem).

```bash
aws s3 mb s3://wuxia-mud-terraform-state --region ap-southeast-1
aws s3api put-bucket-versioning \
  --bucket wuxia-mud-terraform-state \
  --versioning-configuration Status=Enabled
```

- [ ] Bucket created
- [ ] Versioning enabled

### 1.2 Add GitHub OIDC Provider to AWS IAM

> **Why manual**: One-time AWS account-level setup. Terraform can create the role, but the OIDC provider itself must exist first.

**Option A: AWS CLI**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4e98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com
```

**Option B: AWS Console**
1. Go to **IAM → Identity Providers → Add Provider**
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

- [ ] OIDC provider created
- [ ] Verify: `aws iam list-open-id-connect-providers`

### 1.3 Add GitHub Secret

> **Why manual**: GitHub secrets can only be set via GitHub UI or API with a personal access token.

1. Go to GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `AWS_ACCOUNT_ID`
4. Value: your 12-digit AWS account ID (find it in AWS Console top-right, or run `aws sts get-caller-identity`)

- [ ] Secret `AWS_ACCOUNT_ID` added to GitHub

### 1.4 (Optional) Request ACM Certificate for HTTPS

> **Why manual**: Domain validation requires DNS or email confirmation.

If you want HTTPS on the ALB:
```bash
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --region ap-southeast-1
```

Then validate via DNS (add CNAME record) or email. Note the certificate ARN for Terraform `certificate_arn` variable.

- [ ] Certificate requested (optional)
- [ ] Validation completed (optional)

---

## Step 0: Pre-Flight Checklist

Before touching code, verify the current state is stable:

```bash
cd /Users/yongouyang/projects/mud_game
npm test
```

- [ ] All 436 tests pass
- [ ] `npm run dev:all` starts correctly
- [ ] Can login, move, fight, save/quit normally

---

## Step 1: Add AWS SDK Dependency

```bash
cd server
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm install -D @types/aws-sdk  # if needed for types
```

- [ ] Verify `package.json` updated
- [ ] Verify `package-lock.json` updated

---

## Step 2: Create `IStateSystem` Interface

**File**: `server/src/persistence/IStateSystem.ts`

Extract the interface that both `JsonStateSystem` and `DynamoStateSystem` will implement.

```typescript
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

- [ ] File created with all types imported correctly
- [ ] `npm run build` compiles without errors

---

## Step 3: Refactor `PersistenceSystem` → `JsonStateSystem`

**File**: `server/src/persistence/JsonStateSystem.ts`

Transform the existing `PersistenceSystem` into `JsonStateSystem` that implements `IStateSystem`:

### What to change:

1. **Rename class**: `PersistenceSystem` → `JsonStateSystem`
2. **Implement interface**: `implements IStateSystem`
3. **Add static data loading**: Load `maps.json`, `npcs.json`, `items.json`, `skills.json`, `quests.json` on construction
4. **Make methods async**: All methods return `Promise<...>`
5. **Keep file-based persistence**: `saveAll` → `savePlayer` (one player at a time), add `loadStaticData`

### Key implementation details:

```typescript
export class JsonStateSystem implements IStateSystem {
  private staticData: StaticData;
  private players: Map<string, Player>;
  private users: Map<string, string>; // username -> passwordHash
  // ... other in-memory stores
  
  constructor(dataDir: string) {
    this.staticData = this.loadStaticDataSync(dataDir);
    this.players = new Map();
    this.users = this.loadUsersSync(dataDir);
    // ... load other persisted state from JSON files
  }
  
  async loadStaticData(): Promise<StaticData> {
    return this.staticData;
  }
  
  async getUserHash(username: string): Promise<string | null> {
    return this.users.get(username) || null;
  }
  
  async saveUser(username: string, passwordHash: string): Promise<void> {
    this.users.set(username, passwordHash);
    this.saveUsersSync();
  }
  
  async getPlayer(playerId: string): Promise<Player | null> {
    return this.players.get(playerId) || null;
  }
  
  async savePlayer(playerId: string, player: Player): Promise<void> {
    this.players.set(playerId, player);
    this.savePlayersSync();
  }
  
  // ... implement remaining methods
}
```

- [ ] `JsonStateSystem` implements all `IStateSystem` methods
- [ ] Static data loaded from JSON files at construction time
- [ ] Player/user data persisted to JSON files (backward compatible with existing format)
- [ ] All methods are async (return Promises)

---

## Step 4: Update `PersistenceManager` to Use `IStateSystem`

**File**: `server/src/engine/PersistenceManager.ts`

### Changes:

1. **Change type**: `private persistence: PersistenceSystem` → `private persistence: IStateSystem`
2. **Update method calls**: 
   - `this.persistence.loadAll()` → `this.persistence.loadStaticData()` + `this.persistence.getPlayer()`
   - `this.persistence.saveAll(toSave)` → iterate and call `this.persistence.savePlayer()`
   - `this.persistence.getUserHash()` → already async, add `await`
   - `this.persistence.saveUser()` → already async, add `await`

### New `loadAll` logic:

```typescript
async loadAll(): Promise<void> {
  // Static data is already loaded by the state system on construction
  const staticData = await this.persistence.loadStaticData();
  // Pass static data to game systems (MapSystem, NpcSystem, etc.)
  // ...
  
  // Load saved players
  // Since we don't have a list of all player IDs, we need to either:
  // Option A: Keep a players.json file with all player IDs
  // Option B: Scan the data directory for player files
  // Option C: Load from a single players.json (current behavior)
}
```

- [ ] `PersistenceManager` uses `IStateSystem` interface
- [ ] All persistence calls are async/await
- [ ] `loadAll()` loads static data and player data correctly
- [ ] `saveAll()` iterates players and calls `savePlayer()` for each

---

## Step 5: Update `index.ts` to Use `JsonStateSystem`

**File**: `server/src/index.ts`

### Changes:

1. **Import**: `import { JsonStateSystem } from './persistence/JsonStateSystem.js';`
2. **Replace**: `const persistence = new PersistenceSystem();` → `const persistence = new JsonStateSystem('./src/data');`
3. **Add await**: `persistenceManager.loadAll()` → `await persistenceManager.loadAll()`

```typescript
// Before:
import { PersistenceSystem } from './systems/PersistenceSystem.js';
const persistence = new PersistenceSystem();
persistenceManager.loadAll();

// After:
import { JsonStateSystem } from './persistence/JsonStateSystem.js';
const persistence = new JsonStateSystem('./src/data');
await persistenceManager.loadAll();
```

- [ ] `index.ts` imports and uses `JsonStateSystem`
- [ ] `loadAll()` is awaited
- [ ] `npm run dev:all` still works
- [ ] All tests pass

---

## Step 6: Update All Tests

### Files to update:

- `server/src/engine/PersistenceManager.test.ts`
- `server/src/systems/PersistenceSystem.test.ts` → rename to `JsonStateSystem.test.ts`
- Any test that imports `PersistenceSystem`

### Changes:

1. Replace `PersistenceSystem` imports with `JsonStateSystem`
2. Update test setup to use `JsonStateSystem`
3. Add `await` to async method calls

- [ ] All tests updated to use `JsonStateSystem`
- [ ] All 436 tests pass

---

## Step 7: Create `DynamoStateSystem` (Multiple Tables)

**File**: `server/src/persistence/DynamoStateSystem.ts`

### Multiple Table Design:

| Table | Purpose | Key Schema |
|-------|---------|-----------|
| `wuxia-static-data` | Rooms, NPCs, items, skills, quests | `PK=TYPE#id`, `SK=META` |
| `wuxia-players` | Player data, auth, mail | `PK=PLAYER#id`, `SK=DATA\|META\|MAIL#id` |
| `wuxia-npcs` | NPC instance state (HP, respawn) | `PK=NPC#instanceId`, `SK=STATE` |
| `wuxia-rooms` | Room items, ground drops | `PK=ROOM#id`, `SK=ITEMS` |
| `wuxia-auctions` | Auction listings, bids | `PK=AUCTION#id`, `SK=LISTING` |
| `wuxia-guilds` | Guild meta, members | `PK=GUILD#id`, `SK=META\|MEMBERS` |

### Implementation:

```typescript
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { IStateSystem, StaticData, NpcState, RoomItems, AuctionListing, GuildMeta, PersistedMail } from './IStateSystem.js';
import { Player } from '../models/Player.js';

export class DynamoStateSystem implements IStateSystem {
  private client: DynamoDBDocumentClient;
  private region: string;
  private tables: {
    staticData: string;
    players: string;
    npcs: string;
    rooms: string;
    auctions: string;
    guilds: string;
  };
  private staticDataCache?: StaticData;
  
  constructor(tables: { staticData: string; players: string; npcs: string; rooms: string; auctions: string; guilds: string }, region: string) {
    this.tables = tables;
    this.region = region;
    const config: DynamoDBClientConfig = { region };
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient(config));
  }
  
  async loadStaticData(): Promise<StaticData> {
    if (this.staticDataCache) return this.staticDataCache;
    
    const result = await this.client.send(new ScanCommand({
      TableName: this.tables.staticData,
    }));
    
    const rooms: Room[] = [];
    const npcs: NpcTemplate[] = [];
    const items: ItemTemplate[] = [];
    const skills: SkillTemplate[] = [];
    const quests: QuestTemplate[] = [];
    let config: GameConfig = {};
    
    for (const item of result.Items || []) {
      const pk = item.PK as string;
      if (pk.startsWith('ROOM#')) rooms.push(item.data as Room);
      else if (pk.startsWith('NPC#')) npcs.push(item.data as NpcTemplate);
      else if (pk.startsWith('ITEM#')) items.push(item.data as ItemTemplate);
      else if (pk.startsWith('SKILL#')) skills.push(item.data as SkillTemplate);
      else if (pk.startsWith('QUEST#')) quests.push(item.data as QuestTemplate);
      else if (pk === 'CONFIG' && item.SK === 'GAME') config = item.data as GameConfig;
    }
    
    this.staticDataCache = { rooms, npcs, items, skills, quests, config };
    return this.staticDataCache;
  }
  
  // Auth → wuxia-players table
  async getUserHash(username: string): Promise<string | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.players,
      Key: { PK: `USER#${username}`, SK: 'AUTH' },
    }));
    return (result.Item?.passwordHash as string) || null;
  }
  
  async saveUser(username: string, passwordHash: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.players,
      Item: { PK: `USER#${username}`, SK: 'AUTH', passwordHash },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  }
  
  // Players → wuxia-players table
  async getPlayer(playerId: string): Promise<Player | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.players,
      Key: { PK: `PLAYER#${playerId}`, SK: 'DATA' },
    }));
    return (result.Item?.data as Player) || null;
  }
  
  async savePlayer(playerId: string, player: Player): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.players,
      Item: { PK: `PLAYER#${playerId}`, SK: 'DATA', data: player },
    }));
  }
  
  // NPCs → wuxia-npcs table
  async getNpcState(npcId: string): Promise<NpcState | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.npcs,
      Key: { PK: `NPC#${npcId}`, SK: 'STATE' },
    }));
    return (result.Item?.state as NpcState) || null;
  }
  
  async saveNpcState(npcId: string, state: NpcState): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.npcs,
      Item: { PK: `NPC#${npcId}`, SK: 'STATE', state },
    }));
  }
  
  // Rooms → wuxia-rooms table
  async getRoomItems(roomId: string): Promise<RoomItems | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.rooms,
      Key: { PK: `ROOM#${roomId}`, SK: 'ITEMS' },
    }));
    return (result.Item?.items as RoomItems) || null;
  }
  
  async saveRoomItems(roomId: string, items: RoomItems): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.rooms,
      Item: { PK: `ROOM#${roomId}`, SK: 'ITEMS', items },
    }));
  }
  
  // Auctions → wuxia-auctions table
  async getAuction(id: number): Promise<AuctionListing | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.auctions,
      Key: { PK: `AUCTION#${id}`, SK: 'LISTING' },
    }));
    return (result.Item?.listing as AuctionListing) || null;
  }
  
  async saveAuction(id: number, listing: AuctionListing): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.auctions,
      Item: { PK: `AUCTION#${id}`, SK: 'LISTING', listing },
    }));
  }
  
  async deleteAuction(id: number): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tables.auctions,
      Key: { PK: `AUCTION#${id}`, SK: 'LISTING' },
    }));
  }
  
  async getNextAuctionId(): Promise<number> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tables.auctions,
      Key: { PK: 'AUCTION', SK: 'META' },
    }));
    return (result.Item?.nextId as number) || 1;
  }
  
  async setNextAuctionId(id: number): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.auctions,
      Item: { PK: 'AUCTION', SK: 'META', nextId: id },
    }));
  }
  
  // Guilds → wuxia-guilds table
  async getGuild(guildId: string): Promise<{ meta: GuildMeta; members: string[] } | null> {
    const metaResult = await this.client.send(new GetCommand({
      TableName: this.tables.guilds,
      Key: { PK: `GUILD#${guildId}`, SK: 'META' },
    }));
    const membersResult = await this.client.send(new GetCommand({
      TableName: this.tables.guilds,
      Key: { PK: `GUILD#${guildId}`, SK: 'MEMBERS' },
    }));
    if (!metaResult.Item) return null;
    return {
      meta: metaResult.Item.meta as GuildMeta,
      members: (membersResult.Item?.memberIds as string[]) || [],
    };
  }
  
  async saveGuild(guildId: string, meta: GuildMeta, members: string[]): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.guilds,
      Item: { PK: `GUILD#${guildId}`, SK: 'META', meta },
    }));
    await this.client.send(new PutCommand({
      TableName: this.tables.guilds,
      Item: { PK: `GUILD#${guildId}`, SK: 'MEMBERS', memberIds: members },
    }));
  }
  
  // Mail → wuxia-players table (same table as players, different SK)
  async getMail(playerId: string): Promise<PersistedMail[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tables.players,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PLAYER#${playerId}`,
        ':prefix': 'MAIL#',
      },
    }));
    return (result.Items || []) as PersistedMail[];
  }
  
  async saveMail(playerId: string, mail: PersistedMail): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.players,
      Item: { PK: `PLAYER#${playerId}`, SK: `MAIL#${mail.id}`, ...mail },
    }));
  }
  
  async markMailRead(playerId: string, mailId: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tables.players,
      Item: { PK: `PLAYER#${playerId}`, SK: `MAIL#${mailId}`, read: true },
    }));
  }
  
  async deleteMail(playerId: string, mailId: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tables.players,
      Key: { PK: `PLAYER#${playerId}`, SK: `MAIL#${mailId}` },
    }));
  }
}
```

- [ ] `DynamoStateSystem` implements all `IStateSystem` methods
- [ ] Uses 6 separate DynamoDB tables (static-data, players, npcs, rooms, auctions, guilds)
- [ ] Proper PK/SK formatting for all entities
- [ ] Error handling for network/DynamoDB failures

---

## Step 8: Create Environment Factory

**File**: `server/src/persistence/index.ts`

```typescript
import { IStateSystem } from './IStateSystem.js';
import { JsonStateSystem } from './JsonStateSystem.js';
import { DynamoStateSystem } from './DynamoStateSystem.js';

export function createStateSystem(): IStateSystem {
  if (process.env.NODE_ENV === 'production') {
    const region = process.env.AWS_REGION || 'us-east-1';
    return new DynamoStateSystem({
      staticData: process.env.DYNAMODB_STATIC_TABLE || 'wuxia-static-data',
      players: process.env.DYNAMODB_PLAYERS_TABLE || 'wuxia-players',
      npcs: process.env.DYNAMODB_NPCS_TABLE || 'wuxia-npcs',
      rooms: process.env.DYNAMODB_ROOMS_TABLE || 'wuxia-rooms',
      auctions: process.env.DYNAMODB_AUCTIONS_TABLE || 'wuxia-auctions',
      guilds: process.env.DYNAMODB_GUILDS_TABLE || 'wuxia-guilds',
    }, region);
  }
  return new JsonStateSystem('./src/data');
}
```

- [ ] Factory function created
- [ ] Reads 6 table names from environment variables
- [ ] Defaults to `JsonStateSystem` for non-production

---

## Step 9: Update `index.ts` for Environment-Aware State System

**File**: `server/src/index.ts`

```typescript
// Replace:
import { PersistenceSystem } from './systems/PersistenceSystem.js';
const persistence = new PersistenceSystem();

// With:
import { createStateSystem } from './persistence/index.js';
const persistence = createStateSystem();
```

- [ ] `index.ts` uses `createStateSystem()` factory
- [ ] Local dev still uses `JsonStateSystem`
- [ ] Tests pass

---

## Step 10: Create Terraform for Multiple DynamoDB Tables

### File: `terraform/dynamodb.tf`

```hcl
# ─── Static Data Table ────────────────────────────
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
  tags = { Name = "${var.app_name}-static-data" }
}

# ─── Players Table ────────────────────────────────
resource "aws_dynamodb_table" "players" {
  name         = "${var.app_name}-players"
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
  tags = { Name = "${var.app_name}-players" }
}

# ─── NPCs Table ─────────────────────────────────
resource "aws_dynamodb_table" "npcs" {
  name         = "${var.app_name}-npcs"
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
  tags = { Name = "${var.app_name}-npcs" }
}

# ─── Rooms Table ────────────────────────────────
resource "aws_dynamodb_table" "rooms" {
  name         = "${var.app_name}-rooms"
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
  tags = { Name = "${var.app_name}-rooms" }
}

# ─── Auctions Table ─────────────────────────────
resource "aws_dynamodb_table" "auctions" {
  name         = "${var.app_name}-auctions"
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
  tags = { Name = "${var.app_name}-auctions" }
}

# ─── Guilds Table ───────────────────────────────
resource "aws_dynamodb_table" "guilds" {
  name         = "${var.app_name}-guilds"
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
  tags = { Name = "${var.app_name}-guilds" }
}
```

### File: `terraform/iam-dynamodb.tf`

```hcl
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
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ]
        Resource = [
          aws_dynamodb_table.static_data.arn,
          aws_dynamodb_table.players.arn,
          aws_dynamodb_table.npcs.arn,
          aws_dynamodb_table.rooms.arn,
          aws_dynamodb_table.auctions.arn,
          aws_dynamodb_table.guilds.arn,
          "${aws_dynamodb_table.static_data.arn}/index/*",
          "${aws_dynamodb_table.players.arn}/index/*",
          "${aws_dynamodb_table.npcs.arn}/index/*",
          "${aws_dynamodb_table.rooms.arn}/index/*",
          "${aws_dynamodb_table.auctions.arn}/index/*",
          "${aws_dynamodb_table.guilds.arn}/index/*",
        ]
      }
    ]
  })
}
```

### Modify `terraform/main.tf`:

1. Remove EFS resources (file system, mount targets, security group, IAM policy, volume blocks)
2. Add environment variables to ECS task definition:

```hcl
environment = [
  { name = "NODE_ENV",                 value = "production" },
  { name = "PORT",                     value = tostring(var.container_port) },
  { name = "DYNAMODB_STATIC_TABLE",    value = aws_dynamodb_table.static_data.name },
  { name = "DYNAMODB_PLAYERS_TABLE",   value = aws_dynamodb_table.players.name },
  { name = "DYNAMODB_NPCS_TABLE",      value = aws_dynamodb_table.npcs.name },
  { name = "DYNAMODB_ROOMS_TABLE",     value = aws_dynamodb_table.rooms.name },
  { name = "DYNAMODB_AUCTIONS_TABLE",  value = aws_dynamodb_table.auctions.name },
  { name = "DYNAMODB_GUILDS_TABLE",    value = aws_dynamodb_table.guilds.name },
  { name = "AWS_REGION",               value = var.region },
]
```

3. Add outputs:

```hcl
output "dynamodb_static_table" { value = aws_dynamodb_table.static_data.name }
output "dynamodb_players_table" { value = aws_dynamodb_table.players.name }
output "dynamodb_npcs_table" { value = aws_dynamodb_table.npcs.name }
output "dynamodb_rooms_table" { value = aws_dynamodb_table.rooms.name }
output "dynamodb_auctions_table" { value = aws_dynamodb_table.auctions.name }
output "dynamodb_guilds_table" { value = aws_dynamodb_table.guilds.name }
```

- [ ] `terraform/dynamodb.tf` created with 6 tables
- [ ] `terraform/iam-dynamodb.tf` created with all table ARNs
- [ ] `terraform/main.tf` updated (remove EFS, add env vars)
- [ ] `terraform plan` shows expected changes

---

## Step 11: Create Data Deployment Script

**File**: `scripts/deploy-data.ts`

### Features:

1. Read JSON files from `server/src/data/`
2. Transform to DynamoDB item format (PK, SK, data)
3. Compare with existing DynamoDB data (checksum or version)
4. Write changed items using `BatchWriteItem`
5. Update `CONFIG#GAME` with version info

### CLI Interface:

```bash
# Preview changes
npx tsx scripts/deploy-data.ts --dry-run

# Deploy to production
npx tsx scripts/deploy-data.ts --env production

# Force full overwrite
npx tsx scripts/deploy-data.ts --force

# Deploy specific files only
npx tsx scripts/deploy-data.ts --files rooms,npcs
```

### Implementation sketch:

```typescript
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface DeployOptions {
  dryRun: boolean;
  env: string;
  force: boolean;
  files?: string[];
  region: string;
  table: string;
}

async function deployData(options: DeployOptions) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: options.region }));
  const dataDir = path.resolve('server/src/data');
  
  // Read JSON files
  const files = ['maps.json', 'npcs.json', 'items.json', 'skills.json', 'quests.json'];
  const items = [];
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
    const type = file.replace('.json', '');
    
    for (const entry of data) {
      const pk = `${type.toUpperCase()}#${entry.id}`;
      items.push({
        PK: pk,
        SK: 'META',
        data: entry,
        _checksum: crypto.createHash('md5').update(JSON.stringify(entry)).digest('hex'),
      });
    }
  }
  
  // Compare with existing data
  const existing = await client.send(new ScanCommand({ TableName: options.table }));
  const existingMap = new Map(existing.Items?.map(i => [`${i.PK}#${i.SK}`, i]) || []);
  
  const toUpdate = [];
  for (const item of items) {
    const key = `${item.PK}#${item.SK}`;
    const old = existingMap.get(key);
    if (!old || old._checksum !== item._checksum || options.force) {
      toUpdate.push(item);
    }
  }
  
  if (options.dryRun) {
    console.log(`Would update ${toUpdate.length} items`);
    for (const item of toUpdate) {
      console.log(`  ${item.PK}`);
    }
    return;
  }
  
  // Batch write (25 items per batch)
  for (let i = 0; i < toUpdate.length; i += 25) {
    const batch = toUpdate.slice(i, i + 25);
    await client.send(new BatchWriteCommand({
      RequestItems: {
        [options.table]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    }));
  }
  
  // Update version
  await client.send(new PutCommand({
    TableName: options.table,
    Item: {
      PK: 'CONFIG',
      SK: 'GAME',
      version: new Date().toISOString(),
      gitSha: process.env.GIT_SHA || 'unknown',
    }
  }));
  
  console.log(`Deployed ${toUpdate.length} items to ${options.table}`);
}

// CLI parsing
const args = process.argv.slice(2);
const options: DeployOptions = {
  dryRun: args.includes('--dry-run'),
  env: 'development',
  force: args.includes('--force'),
  region: process.env.AWS_REGION || 'us-east-1',
  table: process.env.DYNAMODB_STATIC_TABLE || 'wuxia-static-data',
};

// ... parse --env, --files, etc.

deployData(options).catch(console.error);
```

- [ ] `scripts/deploy-data.ts` created
- [ ] Supports `--dry-run`, `--force`, `--env`
- [ ] Batch writes in chunks of 25
- [ ] Checksum-based diff for incremental deployment
- [ ] Version tracking in `CONFIG#GAME`

---

## Step 12: Apply Terraform and Create Tables

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

- [ ] `terraform apply` succeeds
- [ ] 6 DynamoDB tables created: `wuxia-static-data`, `wuxia-players`, `wuxia-npcs`, `wuxia-rooms`, `wuxia-auctions`, `wuxia-guilds`
- [ ] ECS task role has DynamoDB permissions on all 6 tables
- [ ] EFS resources removed

---

## Step 13: Deploy Initial Static Data

```bash
cd /Users/yongouyang/projects/mud_game
export AWS_REGION=ap-southeast-1  # or your region
export DYNAMODB_STATIC_TABLE=wuxia-static-data
npx tsx scripts/deploy-data.ts --env production
```

- [ ] All static data deployed to DynamoDB
- [ ] Verify with AWS Console or CLI:
  ```bash
  aws dynamodb scan --table-name wuxia-static-data --limit 5
  ```

---

## Step 14: Update CI/CD Workflows

### File: `.github/workflows/deploy-data.yml` (new)

```yaml
name: Deploy Data

on:
  push:
    branches: [main]
    paths:
      - 'server/src/data/**'

jobs:
  deploy-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          
      - name: Install dependencies
        run: cd server && npm ci
        
      - name: Validate data
        run: cd server && npm run test:data
        
      - name: Deploy to DynamoDB
        run: npx tsx scripts/deploy-data.ts --env production
        env:
          AWS_REGION: ${{ secrets.AWS_REGION }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DYNAMODB_STATIC_TABLE: wuxia-static-data
```

### Update `.github/workflows/deploy.yml`:

1. Remove `if: false` from `build-and-deploy` and `smoke-test` jobs
2. Remove EFS volume mounts from ECS task (already done in Terraform)
3. Add DynamoDB environment variables

- [ ] Data deployment workflow created
- [ ] Service deployment workflow updated
- [ ] `if: false` removed from deploy jobs

---

## Step 15: Deploy to Production

```bash
# Build and push Docker image
docker build -t wuxia-mud:latest .
docker tag wuxia-mud:latest $ECR_REPO/wuxia-mud:latest
docker push $ECR_REPO/wuxia-mud:latest

# Update ECS service
aws ecs update-service --cluster wuxia-mud --service wuxia-mud-service --force-new-deployment
```

- [ ] Docker image builds successfully
- [ ] ECS service deploys without errors
- [ ] Health check passes
- [ ] Can login and play

---

## Step 16: Verify and Monitor

### Verification checklist:

- [ ] Player registration works
- [ ] Player login works (existing and new players)
- [ ] Player data persists after logout/login
- [ ] Static data loads correctly (rooms, NPCs, items, skills, quests)
- [ ] Game commands work (move, look, fight, chat, etc.)
- [ ] Autosave works
- [ ] Data deployment script works (`--dry-run` and actual deploy)

### Monitoring:

```bash
# Check DynamoDB metrics for each table
for table in wuxia-static-data wuxia-players wuxia-npcs wuxia-rooms wuxia-auctions wuxia-guilds; do
  echo "=== $table ==="
  aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name ConsumedReadCapacityUnits \
    --dimensions Name=TableName,Value=$table \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 3600 \
    --statistics Sum
done
```

- [ ] CloudWatch metrics show normal read/write patterns for all tables
- [ ] No throttling errors
- [ ] Cost within expected range (~$5-15/month for all DynamoDB tables)

---

## Step 17: Cleanup

- [ ] Remove old `PersistenceSystem.ts` from `server/src/systems/`
- [ ] Update imports in any remaining files
- [ ] Remove EFS-related code from `index.ts` (if any)
- [ ] Update README.md with new architecture
- [ ] Update PLAN.md to mark Phase 6 as complete

---

## Rollback Plan

If production issues occur:

1. **Revert to previous Docker image**:
   ```bash
   aws ecs update-service --cluster wuxia-mud --service wuxia-mud-service --force-new-deployment
   ```

2. **Restore player data from DynamoDB backup**:
   ```bash
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name wuxia-players \
     --target-table-name wuxia-players-recovery \
     --use-latest-restorable-time
   ```

3. **Switch back to JSON persistence** (emergency):
   - Set `NODE_ENV=development` temporarily
   - Copy player data from DynamoDB to JSON files
   - Redeploy with `JsonStateSystem`

---

## Estimated Timeline

| Step | Task | Estimated Time |
|------|------|-------------|
| 🔴 1 | Manual AWS setup (S3, OIDC, secrets) | 30 min |
| 0 | Pre-flight check | 15 min |
| 1 | Add AWS SDK | 10 min |
| 2 | Create `IStateSystem` | 30 min |
| 3 | Refactor to `JsonStateSystem` | 2-3 hours |
| 4 | Update `PersistenceManager` | 1 hour |
| 5 | Update `index.ts` | 30 min |
| 6 | Update tests | 1-2 hours |
| 7 | Create `DynamoStateSystem` (6 tables) | 3-4 hours |
| 8-9 | Environment factory | 30 min |
| 10 | Terraform (6 tables) | 1 hour |
| 11 | Deploy script | 2 hours |
| 12 | Apply Terraform | 30 min |
| 13 | Deploy initial data | 15 min |
| 14 | CI/CD | 1 hour |
| 15 | Production deploy | 30 min |
| 16 | Verify | 1 hour |
| 17 | Cleanup | 30 min |
| **Total** | | **~18-24 hours** |

---

## Key Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **6 DynamoDB tables** | Independent management, clearer IAM policies, per-table monitoring, easier backup/restore |
| **JSON files for local dev** | Flexibility — edit and restart, no AWS credentials needed |
| `BatchWriteItem` for deploy | Efficient bulk loading, but limited to 25 items per batch |
| Checksum diff | Minimizes writes and deployment time for small changes |
| Point-in-time recovery | Protects against accidental data corruption during deploys |
| No GSI initially | All access patterns use known PK/SK; add GSI later if needed for queries like "all players in room" |
| Players table stores mail | Mail is player-scoped; querying by `PK=PLAYER#id AND SK begins_with MAIL#` is efficient |
| Separate auctions table | Auctions are global, not player-scoped; independent lifecycle |
| Separate guilds table | Guilds persist across member logins; independent of player data |
