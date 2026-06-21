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

Open `http://localhost:5173` — `login demo some-secret` to jump straight in (preloaded with 10,000 pot).

## Game Commands (22 total)

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
| `buy <item>` | Purchase from a shop (costs silver) |

### Combat & NPCs
| Command | Description |
|---|---|
| `kill <target>` | Attack player/NPC (English ID works: `kill bandit`) |
| `hit` | Strike during combat |
| `flee` / `tao` | Flee combat |
| `perform <skill.move>` / `pfm` | Execute a special move (requires skill ≥ Lv.10, costs 20 MP) |
| `ask <npc>` | Talk to NPC (English ID works) |

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

## Core Mechanics

### Combat
Turn-based auto-combat with MUD-style chain:
1. **招架 (Parry)** — chance based on parry level vs attacker dex
2. **躲避 (Dodge)** — chance based on dodge level
3. **内力护体 (Force Absorb)** — absorbs damage, costs MP (requires force level > 0)
4. **HP Damage** — remaining damage applied

Critical hits: 10% chance, 1.8x damage. Speed scales with dex + dodge level.

### Skills & Progression
- **35 martial arts** across parry/dodge/force/weapons/strikes
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

### Conditions
Architecture ready for poison, bleeding, drunk, etc. (`player.conditions[]`).

## Game World (40 rooms, 18 NPCs)

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

Full interactive map: `server/src/data/map.html`

### Schools & Class Bonuses

| School | Location | Master | Bonus | Signature Skills |
|---|---|---|---|---|
| 少林派 | 嵩山少林寺 | 玄慈方丈 | +3 根骨 | 罗汉拳 |
| 武当派 | 武当山紫霄宫 | 冲虚道长 | +3 身法 | 太极拳 |
| 丐帮 | 杏子林总舵 | 洪七公 | +3 臂力 | 打狗棒法, 降龙十八掌 |
| 华山派 | 华山之巅 | 岳不群 | +2 身法 +1 臂力 | 华山剑法, 独孤九剑 |
| 峨眉派 | 峨眉金顶 | 灭绝师太 | +3 悟性 | 峨眉剑法 |
| 古墓派 | 终南山古墓 | 小龙女 | +3 身法 +1 悟性 | 玉女心经, 黯然销魂掌 |

### Skills (20 total)

| Type | Skills |
|---|---|
| Basic | 招架(parry), 基本拳脚(cuff), 基本轻功(dodge), 基本内功(force) |
| Weapons | 基本剑法(sword), 基本刀法(blade), 基本杖法(staff), 基本暗器(throwing), 基本鞭法(whip) |
| Shaolin | 罗汉拳(luohan-quan) |
| Wudang | 太极拳(taiji-quan), 草上飞(qinggong), 内功心法(neigong-xinfa) |
| Gaibang | 打狗棒法(dagou-bang), 降龙十八掌(xianglong-zhang) |
| Huashan | 华山剑法(huashan-jian), 独孤九剑(dugu-jiujian) |
| Emei | 峨眉剑法(emei-jian) |
| Gumu | 玉女心经(yunu-xinjing), 黯然销魂掌(anran-xiaohun) |

## Testing (130 tests)

```bash
npm test                    # All 130 tests (6 UI + 124 server)
cd server && npx vitest     # Server only
npm run test:e2e            # Playwright UI E2E (6 tests)
```

### Test Coverage

| Suite | Tests | Area |
|---|---|---|
| `Terminal.test.tsx` | 6 | UI rendering + input |
| `CommandRouter.test.ts` | 51 | Commands, creation, movement, combat, skills |
| `CommandRouter.classic.test.ts` | 6 | Perform, exert, conditions, class bonuses |
| `CommandRouter.gap.test.ts` | 0 | (cleaned) |
| `CommandRouter.gap2.test.ts` | 4 | NPC respawn, shop buy |
| `SkillSystem.test.ts` | 15 | Learning, prerequisites, school lock |
| `CombatSystem.test.ts` | 4 | Combat rounds, status formatting |
| `index.e2e.test.ts` | 20 | Full user journeys (auth, map, schools, combat) |
| `game.spec.ts` (Playwright) | 6 | Browser E2E (page load, auth, battle, school skills) |

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
├── server/
│   ├── src/
│   │   ├── index.ts           # Express + Socket.io + NPC registration
│   │   ├── engine/CommandRouter.ts   # All game logic + commands
│   │   ├── systems/           # 7 systems (skills, combat, items, NPCs, etc.)
│   │   ├── models/            # 6 data models
│   │   ├── data/              # JSON data + map.html
│   │   └── utils.ts
│   └── vitest.config.ts
├── terraform/main.tf
├── .github/workflows/deploy.yml
├── Dockerfile
└── PLAN.md
```

## License

MIT
