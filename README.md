# 炎黄群侠传 — Wuxia MUD

A browser-based wuxia MUD inspired by the classic 炎黄MUD. Play in a retro amber terminal — explore the jianghu, learn martial arts, join schools, master perform moves, and battle foes in turn-based combat.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite 8, amber terminal UI |
| **Backend** | Node.js 24, Express, Socket.io (WebSocket) |
| **Runtime** | tsx (dev), compiled via Vite (prod) |
| **Testing** | Vitest (unit + E2E server), React Testing Library, Playwright (UI E2E) |
| **CI/CD** | GitHub Actions → Docker → ECR → ECS Fargate |
| **Infra** | Terraform (AWS: ECS Fargate, ALB, EFS, ECR, ACM) |

## Quick Start

```bash
npm install && cd server && npm install && cd ..
npm run dev:all        # Frontend (:5173) + Server (:3000)
```

Open `http://localhost:5173` and log in with one of the pre-seeded demo accounts:

| Account | Password | Description |
|---|---|---|
| `demo` | `some-secret` | Blank slate, 10,000 pot, 5,000 silver |
| `shaolin` | `test` | 少林派 — 罗汉拳 Lv.30 |
| `wudang` | `test` | 武当派 — 太极拳、草上飞、内功心法 Lv.30 |
| `huashan` | `test` | 华山派 — 华山剑法、独孤九剑 Lv.30/20 |
| `gaibang` | `test` | 丐帮 — 打狗棒法、降龙十八掌 Lv.30 |
| `rich` | `test` | No school, 50,000 silver for economy tests |

Demo accounts are only created in non-production environments (set `ENABLE_DEMO_ACCOUNTS=true` to override).

## Game Commands (31 total)

### Movement & Info
| Command | Description |
|---|---|
| `n s e w u d` | Move directions |
| `look` / `l` | Look around (shows items on ground) |
| `hp` / `score` | View status (HP, MP, exp, pot, **level**, skills) |
| `who` | Online players |
| `help` | All commands |
| `clear` | Clear screen |

### Skills & Items
| Command | Description |
|---|---|
| `skills` | List learned martial arts |
| `learn <skill>` | Learn/upgrade a skill (costs pot, school-locked) |
| `i` / `inventory` | View inventory |
| `get <item>` | Pick up item from room |
| `drop <item>` | Discard item |
| `use <medicine>` | Use medicine (e.g. `use jinchuang-yao`) |
| `wear <equipment>` | Equip weapon/armor |
| `remove <equipment>` | Unequip |

### Economy
| Command | Description |
|---|---|
| `shop` / `list` | Show shop goods |
| `buy <item>` | Purchase from a shop (costs silver) |
| `sell <item> [qty]` | Sell items to a shop |
| `bank` / `cunku` | View banked silver and items |
| `deposit <item> [qty]` / `deposit silver <qty>` | Deposit into bank |
| `withdraw <item> [qty]` / `withdraw silver <qty>` | Withdraw from bank |
| `auction` | List auction house postings |
| `auction sell <item> <start> [buyout]` | Post an auction |
| `auction bid <id> <amount>` | Bid on an auction |
| `auction buyout <id>` | Buy an auction instantly |
| `craft` / `craft <recipe>` | Craft items from materials |

### Combat & NPCs
| Command | Description |
|---|---|
| `kill <target>` | Attack player/NPC (English ID works: `kill bandit`) |
| `hit` | Strike during combat |
| `flee` / `tao` | Flee combat |
| `perform <skill.move>` / `pfm` | Execute a special move (requires skill ≥ Lv.10, costs 20 MP) |
| `ask <npc>` | Talk to NPC (English ID works) |
| `quest` | Show active quest |
| `quest <npc>` | List/complete quests from an NPC |
| `quest <npc> <id>` | Accept a specific quest |

### Schools
| Command | Description |
|---|---|
| `schools` | List all schools |
| `schools <name>` | School details |
| `join <school>` | Join a school (**one only**, grants attribute bonus) |

### Inner Power
| Command | Description |
|---|---|
| `exert heal` / `yun heal` | Use inner power to heal (costs 30 MP, restores 20% HP) |
| `exert powerup` | Boost combat power temporarily (costs 50 MP) |

### Authentication
| Command | Description |
|---|---|
| `register <user> <pass>` | Create account |
| `login <user> <pass>` | Log in |

### Admin / GM Commands (admin accounts only)
| Command | Description |
|---|---|
| `gm list` | List online players |
| `gm inspect <玩家>` | View a player's full status |
| `gm kick <玩家>` | Disconnect a player |
| `gm goto <roomId>` | Teleport to any room |
| `gm spawn <npcId>` | Summon an NPC clone to your room |
| `gm set <玩家> <field> <value>` | Edit hp/mp/exp/pot/shen/room/attributes |

## Core Mechanics

### Combat
Turn-based auto-combat with MUD-style chain:
1. **招架 (Parry)** — chance based on parry level vs attacker dex
2. **躲避 (Dodge)** — chance based on dodge level
3. **内力护体 (Force Absorb)** — absorbs damage, costs MP (requires force level > 0)
4. **HP Damage** — remaining damage applied

**Multi-enemy combat**: a player can fight up to **4 enemies** at once. Use `kill <target>` while already fighting to add another NPC to the melee. Each extra enemy gets its own counter-attack each round.

**Guarder aggro**: NPCs with the same `faction` and `guarder=true` will automatically defend their ally when that ally is attacked in the same room.

Critical hits: 10% chance, 1.8x damage. Speed scales with dex + dodge level.

### Skills & Progression
- **49 martial arts** across parry/dodge/force/unarmed/finger/hand/claw/strike/literate
- Basic skills learn anywhere (1 pot); school skills require **membership + location** (2+ pot)
- **Prerequisites**: e.g. 太极拳 requires 基本拳脚 ≥ Lv.10
- Max level: 100 per skill
- Skills level up by repeated `learn` calls

### Death & Rewards
- **Death penalty**: lose 10% exp, HP resets to 1
- **NPC kill rewards**: exp + pot + silver (loot from corpse)
- **NPC respawn**: call `NpcSystem.respawn(id)` to revive
- **Player regen**: 3% HP + 4% MP every 3 seconds (out of combat)

### Level System
Level = `floor(sqrt(exp / 100)) + 1`. Displayed in `score`.

### Attributes
| Attribute | Key | Role |
|---|---|---|
| 臂力 | `str` | Attack damage |
| 悟性 | `int` | MP ceiling, learning efficiency |
| 根骨 | `con` | HP ceiling, defense, force absorption |
| 身法 | `dex` | Dodge, parry, combat speed |
| 容貌 | `per` | NPC dialogue, some skill requirements |
| 福缘 | `kar` | Luck on random events |

Attributes improve as you train:
- `str` + highest `unarmed/cuff/finger/strike/hand/claw` skill level / 10
- `int` + highest `literate` skill level / 10
- `con` + highest `force` skill level / 10
- `dex` + highest `dodge` skill level / 10

### Conditions
10+ conditions across categories: `poison`, `elemental`, `illness`, `wound`, `special`.
- Tick-based damage/heal with force-level resistance.
- Cured by item category (e.g. `jiedu-wan` cures all `poison` conditions).
- Dispelled by force skill via `exert dispel <id|category>`.
- NPCs apply specific conditions on hit (wolf → fire_poison, bear → burning, bandit → poison).

### 善恶 (Shen) & Killer Tracking
Every player has a **善恶值** (`shen`) and a kill record shown in `score`.
- Killing aggressive/evil NPCs: **+10** shen.
- Killing faction members (masters/disciples): **-50** shen.
- Killing a player: base **-50** shen; killing a good player (>500) costs an extra **-100**; killing an evil player (<-500) grants **+50**.
- Being killed records the killer's name as "上次死于" in `score`.
- Alignment titles range from `一代大侠` to `武林公敌`.

### Persistence
Player data is persisted to `server/data/players.json`:
- Loaded on server startup.
- Saved after character creation, after each command while playing, when combat ends, and on disconnect.
- Autosaved every **60 seconds**.
- Graceful shutdown saves on `SIGINT` / `SIGTERM`.

### Quests
Quests are defined in `server/data/quests.json` and support multiple types:
- **Kill**: slay a number of specific NPCs (progress updates automatically).
- **Collect**: gather a number of specific items and return them.
- **Delivery**: carry an item to another NPC.
- **Talk**: simply speak to the target NPC.

Rewards include exp, pot, shen, and items. Use `quest` to check progress and `quest <npc>` / `quest <npc> <id>` to interact with quest givers.

### Advanced Combat
- **Base damage**: every strike now starts from `5 + str * 1.5` and adds skill/weapon technique on top.
- **Weapon synergy**: wielding a weapon and knowing the matching weapon skill (e.g. `铁剑` + `基本剑法`) adds extra damage.
- **Combos**: consecutive successful hits with the same skill build up to +50% damage; missing, being parried, or fleeing resets the combo.

### Bosses & Rare Loot
Boss NPCs (marked with `boss: true`) are tougher, have longer respawn timers, and carry guaranteed or chance-based **drop tables**.
- Example: **黑风寨主** in `wilderness/cave` drops the rare weapon **黑风刀** and **寨主令**.
- Drops are rolled on death and added to the killer's inventory automatically.

## Game World (63 rooms, 1,638 NPCs, 734 skills, 139 items)

```
                      shaolin/gate → shaolin/hall → shaolin/training
                            ↑
          huashan/peak ← huashan/path ← huashan/foot
                                          ↑
gumu/chamber ← gumu/entrance → wilderness/forest2 → wilderness/forest1 → gaibang/forest1 → gaibang/hq
                            ↑   ↑                       ↓  ↑   ↓             ↓
                      cave  cliff         ←←←←  gate →  forest1
                           ↓  ↑  ↓  ↑
                        wudang  emei  shaolin

town/inn ← town/inn_upstairs ← town/square → town/mainstreet → town/gate
                 ↓                                  ↓
            (inn rooms)                         (above)
```

Full interactive map: `docs/map.html`  
Player guide: `docs/newbie-guide.html`  
Original MUD reference: `docs/oiuv_reference.md`

### Schools & Class Bonuses

| School | Location | Master | Bonus | Signature Skills |
|---|---|---|---|---|
| 少林派 | 嵩山少林寺 | 玄慈方丈 | +3 根骨 | 罗汉拳 |
| 武当派 | 武当山紫霄宫 | 冲虚道长 | +3 身法 | 太极拳、草上飞、内功心法 |
| 丐帮 | 杏子林总舵 | 洪七公 | +3 臂力 | 打狗棒法、降龙十八掌 |
| 华山派 | 华山之巅 | 岳不群 | +2 身法 +1 臂力 | 华山剑法、独孤九剑、破玉拳 |
| 峨眉派 | 峨眉金顶 | 灭绝师太 | +3 悟性 | 峨眉剑法 |
| 古墓派 | 终南山古墓 | 小龙女 | +3 身法 | 玉女心经、黯然销魂掌 |
| 昆仑派 | 昆仑三清殿 | 何太冲 | +2 身法 +1 臂力 | 松风剑法 |
| 明教 | 光明顶 | 张无忌 | +2 根骨 +1 臂力 | 乾坤大挪移 |
| 全真教 | 重阳宫 | 王重阳 | +2 悟性 +1 根骨 | 无相神功 |
| 星宿派 | 星宿海 | 丁春秋 | +2 悟性 +1 身法 | 化功大法 |

### Skills (49 total)

| Type | Skills |
|---|---|
| Basic | 招架(parry), 基本内功(force), 基本轻功(dodge), 读书识字(literate) |
| Unarmed | 基本拳脚(unarmed), 基本拳法(cuff), 基本指法(finger), 基本掌法(hand), 基本爪法(claw) |
| Weapons | 基本剑法(sword), 基本刀法(blade), 基本杖法(staff), 基本暗器(throwing), 基本鞭法(whip) |
| Shaolin | 罗汉拳(luohan-quan) |
| Wudang | 太极拳(taiji-quan), 草上飞(qinggong), 内功心法(neigong-xinfa) |
| Gaibang | 打狗棒法(dagou-bang), 降龙十八掌(xianglong-zhang) |
| Huashan | 华山剑法(huashan-jian), 独孤九剑(dugu-jiujian), 破玉拳(poyu-quan) |
| Emei | 峨眉剑法(emei-jian) |
| Gumu | 玉女心经(yunu-xinjing), 黯然销魂掌(anran-xiaohun) |
| Kunlun | 松风剑法(songfeng-jian) |
| Mingjiao | 乾坤大挪移(qiankun-danuoyi) |
| Quanzhen | 无相神功(wuzhi-shengong) |
| Xingxiu | 化功大法(huagong-dafa) |

## Testing (270+ tests)

```bash
npm test                    # All tests (Vitest unit + server + Playwright E2E)
cd server && npx vitest     # Server only
npm run test:e2e            # Playwright UI E2E (48 tests)
```

### Test Coverage

| Suite | Tests | Area |
|---|---|---|
| **Core Command Router** | | |
| `CommandRouter.test.ts` | 52 | Commands, creation, movement, combat, skills |
| `CommandRouter.classic.test.ts` | 6 | Perform, exert, class bonuses |
| `CommandRouter.conditions.test.ts` | 6 | Conditions, antidote, dispel |
| `CommandRouter.progression.test.ts` | 8 | Leveling, attribute points, practice, dazuo |
| `CommandRouter.gap2.test.ts` | 4 | NPC respawn, shop buy |
| `CommandRouter.schools.test.ts` | 6 | School join, bonuses, skill restrictions |
| `CommandRouter.economy.test.ts` | 15 | Bank, shop, auction, crafting |
| `CommandRouter.multi.test.ts` | 4 | Multi-enemy combat + guarder aggro |
| `CommandRouter.shen.test.ts` | 5 | Shen alignment + killer tracking |
| `CommandRouter.quest.test.ts` | 3 | Quest accept/complete flow |
| `CommandRouter.quests.test.ts` | 3 | Kill/collect quest progress and rewards |
| `CommandRouter.combat.test.ts` | 2 | Weapon synergy + combo damage |
| `CommandRouter.boss.test.ts` | 1 | Boss kill + guaranteed loot |
| `CommandRouter.admin.test.ts` | 7 | GM list/inspect/kick/goto/spawn/set |
| `CommandRouter.edge.test.ts` | 8 | Meditation, dazuo/maxMP, respawn edge cases |
| `CommandRouter.full.test.ts` | 4 | Attributes, poison tick, perform moves |
| `CommandRouter.phase4.test.ts` | 4 | School skills, weapon equip, combat rounds |
| `CommandRouter.polish.test.ts` | 12 | Equipment, perform, powerup, medicine, delivery |
| `CommandRouter.batch2.test.ts` | 4 | Shop alias, poison conditions |
| **Game Systems** | | |
| `SkillSystem.test.ts` | 17 | Learning, prerequisites, school lock, attribute bonus |
| `CombatSystem.test.ts` | 9 | Combat rounds, damage formula, status formatting |
| `ConditionSystem.test.ts` | 14 | Condition apply/tick/dispel/cure/category |
| `LevelSystem.test.ts` | 8 | Level formula and attribute point spending |
| `NpcSystem.test.ts` | 9 | NPC coverage, boss drops, respawn, dialogue |
| `ItemSystem.test.ts` | 22 | Weapons, armor, consumables, medicine effects |
| `MapSystem.test.ts` | 10 | Rooms, exits, item pickups, topology |
| `AuctionSystem.test.ts` | 8 | Create listing, bid, buyout, expiry |
| `BankSystem.test.ts` | 5 | Deposit, withdraw, silver, formatting |
| `ChatSystem.test.ts` | 9 | Say, tell, channels, social commands |
| `CraftingSystem.test.ts` | 6 | Recipe lookup, material check, crafting |
| `GuildSystem.test.ts` | 19 | Create, join, promote, rank, dismiss |
| `ShopSystem.test.ts` | 6 | Buy, sell, room-based shops, pricing |
| `TradeSystem.test.ts` | 16 | Offer, accept, reject, item exchange |
| `PlayerManager.test.ts` | 9 | Create, name validation, name conflicts |
| **Persistence** | | |
| `Persistence.test.ts` | 4 | Save/load player JSON |
| `PersistenceSystem.test.ts` | 5 | File I/O, read/write integrity |
| `PersistenceManager.test.ts` | 5 | Autosave, disconnect cleanup, socket-id mapping |
| **Data Validation** | | |
| `skills.test.ts` | 6 | JSON skill data integrity |
| `items.test.ts` | 6 | JSON item data integrity |
| `npcs.test.ts` | 7 | JSON NPC data + guarder chains |
| `quests.test.ts` | 6 | JSON quest data integrity |
| `maps.test.ts` | 6 | Map topology, routes, dead ends |
| **E2E Server** | | |
| `index.e2e.test.ts` | 18 | Full user journeys (auth, map, schools, combat) |
| **Utilities** | | |
| `time.test.ts` | 8 | SystemClock + Scheduler |
| `demo-seed.test.ts` | 6 | Demo account seeding + corruption repair |
| **Frontend (Vitest)** | | |
| `Terminal.test.tsx` | 9 | UI rendering, input, history |
| `App.test.tsx` | 2 | App mount + online counter |
| **Browser E2E (Playwright)** | | |
| `game.spec.ts` | 6 | Page load, auth, battle, school skills |
| `leveling.spec.ts` | 3 | Leveling + attribute points |
| `conditions.spec.ts` | 3 | Wolf poison + antidote |
| `schools.spec.ts` | 3 | Joining a school + signature skill |
| `economy.spec.ts` | 12 | Bank, shop, auction, crafting flows |
| **Total** | **436** | **52 test files (45 server + 2 frontend + 5 Playwright)** |

## Production

```bash
npm run build             # Vite → dist/
npm run start:server      # Express serves dist/ + WebSocket on :3000
```

See [Deployment](#deployment-aws) section above for AWS setup (~$35/month).

## Project Structure

```
mud_game/
├── src/                     # Frontend (React + Vite)
│   ├── App.tsx
│   ├── components/Terminal.tsx    # Terminal UI with history
│   └── themes.ts
├── tests/
│   ├── unit/Terminal.test.tsx
│   └── e2e/game.spec.ts      # Playwright E2E
├── docs/
│   ├── map.html               # Interactive world map (auto-generated)
│   ├── newbie-guide.html      # Player guide
│   └── oiuv_reference.md      # Original oiuv_mud reference
├── server/
│   ├── src/
│   │   ├── index.ts           # Express + Socket.io + game loop
│   │   ├── engine/CommandRouter.ts   # All game logic + commands
│   │   ├── systems/           # Game systems (skills, combat, items, NPCs, levels, conditions, etc.)
│   │   ├── models/            # Data models
│   │   ├── data/              # JSON data files
│   │   └── utils.ts
│   └── vitest.config.ts
├── terraform/main.tf
├── .github/workflows/deploy.yml
├── Dockerfile
└── PLAN.md
```

## License

MIT
