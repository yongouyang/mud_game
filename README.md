# 炎黄群侠传 — Wuxia MUD

A browser-based wuxia MUD (Multi-User Dungeon) game, inspired by classic Chinese martial arts literature and 炎黄MUD. Play in a retro amber terminal — explore the jianghu, learn martial arts, join schools, and fight other players.

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
# Install dependencies
npm install
cd server && npm install && cd ..

# Development (frontend + server concurrently)
npm run dev:all

# Or run separately
npm run dev          # Vite frontend on :5173
npm run dev:server   # Express server on :3000
```

Open `http://localhost:5173` — Vite proxies `/socket.io` and `/health` to the server.

## Game Commands

### Core
| Command | Description |
|---|---|
| `n s e w u d` | Move |
| `look` / `l` | Look around |
| `hp` / `score` | View status |
| `who` | Online players |
| `help` | Help |
| `clear` | Clear screen |

### Skills & Items
| Command | Description |
|---|---|
| `skills` | List learned skills |
| `learn <skill>` | Learn a martial art |
| `i` / `inventory` | View inventory |
| `get <item>` | Pick up item |
| `drop <item>` | Discard item |
| `use <medicine>` | Use medicine |
| `wear <equipment>` | Equip weapon/armor |
| `remove <equipment>` | Unequip |

### Combat & NPCs
| Command | Description |
|---|---|
| `kill <target>` | Attack player/NPC |
| `hit` | Strike in combat |
| `ask <npc>` | Talk to NPC |

### Schools
| Command | Description |
|---|---|
| `schools` | List all schools |
| `schools <name>` | School details |
| `join <school>` | Join a school |

### Authentication
| Command | Description |
|---|---|
| `register <user> <pass>` | Create account |
| `login <user> <pass>` | Log in |

## Game World

### Map (26 rooms)

```
                      shaolin/gate → shaolin/hall → shaolin/training
                            ↑
          huashan/peak ← huashan/path ← huashan/foot
                            ↑
gumu/chamber ← gumu/entrance → wilderness/forest2 → wilderness/forest1 → gaibang/forest1 → gaibang/hq
                            ↑                          ↓                          ↓
                      wilderness/cliff ← wilderness/forest1           gaibang/forest2
                            ↓                          ↑
                      wilderness/cave           town/gate
                                                    ↑
                                              town/mainstreet
                                                    ↑
                    town/inn ← town/inn_upstairs ← town/square → town/training
                      ↑                                  ↓
                    (inn)                           emei/foot → emei/golden
```

### Schools (门派)

| School | Location | Master | Signature Skills |
|---|---|---|---|
| **少林派** | 嵩山少林寺 | 玄慈方丈 | 罗汉拳 |
| **武当派** | 武当山紫霄宫 | 冲虚道长 | 太极拳 |
| **丐帮** | 杏子林总舵 | 洪七公 | 打狗棒法、降龙十八掌 |
| **华山派** | 华山之巅 | 岳不群 | 华山剑法、独孤九剑 |
| **峨眉派** | 峨眉金顶 | 灭绝师太 | 峨眉剑法 |
| **古墓派** | 终南山古墓 | 小龙女 | 玉女心经、黯然销魂掌 |

### Skills (武功)

| Category | Skills |
|---|---|
| Basic | 基本拳脚, 基本轻功, 基本内功 |
| Shaolin | 罗汉拳 |
| Wudang | 太极拳, 草上飞, 内功心法 |
| Gaibang | 打狗棒法, 降龙十八掌 |
| Huashan | 华山剑法, 独孤九剑 |
| Emei | 峨眉剑法 |
| Gumu | 玉女心经, 黯然销魂掌 |

## Testing

```bash
npm test                  # All tests (unit + E2E)
cd server && npx vitest   # Server tests only
npm run test:e2e          # Playwright UI E2E
npm run test:e2e:sweep    # Playwright production build sweep
```

**95 tests total:** 6 UI + 89 server (40 CommandRouter + 21 E2E + 10 SkillSystem + 11 ItemSystem + 4 CombatSystem + 4 Persistence + 4 Schools).

## Production Build

```bash
npm run build             # Vite builds to dist/
npm run start:server      # Express serves dist/ + WebSocket
```

The server detects `dist/` and serves it as static files. WebSocket runs on the same port.

## Deployment (AWS)

### Architecture

```
Browser (HTTPS) → ALB (port 443) → ECS Fargate (port 3000) → EFS (/data)
                   ACM cert          0.25 vCPU / 512 MB       players.json
                                                              users.json
```

### Prerequisites

1. AWS account with admin access
2. Domain name in Route 53 (or any registrar)
3. ACM certificate for the domain
4. S3 bucket for Terraform state: `wuxia-mud-terraform-state`
5. GitHub OIDC provider in IAM (for GitHub Actions)

### Deploy via Terraform

```bash
cd terraform

# Create state bucket (once)
aws s3 mb s3://wuxia-mud-terraform-state --region ap-southeast-1

# Deploy
terraform init
terraform plan -var="domain_name=mud.example.com"
terraform apply -var="domain_name=mud.example.com"
```

### CI/CD (GitHub Actions)

Push to `main` triggers:
1. `test` — install → build → test (frontend + server)
2. `build-and-deploy` — Docker build → push ECR → update ECS
3. `smoke-test` — health check via ALB DNS

Required GitHub Secrets:
- `AWS_ACCOUNT_ID` — your AWS account ID

### Estimated Cost: ~$35/month

| Resource | ~/month |
|---|---|
| ECS Fargate (0.25 vCPU, 512 MB) | $12 |
| ALB | $18 |
| EFS (1 GB) | $3 |
| ECR (50 MB) | $1 |
| Route 53 + ACM | $0.50 |

## Project Structure

```
mud_game/
├── src/                    # Frontend (React + Vite)
│   ├── App.tsx             # Theme switching
│   ├── components/
│   │   └── Terminal.tsx    # Terminal UI component
│   └── themes.ts           # 3 color schemes (Tokyo Night, Catppuccin, Amber)
├── tests/
│   ├── unit/
│   │   └── Terminal.test.tsx
│   └── e2e/
│       └── game.spec.ts    # Playwright E2E
├── server/
│   ├── src/
│   │   ├── index.ts        # Express + Socket.io server
│   │   ├── engine/
│   │   │   ├── CommandRouter.ts          # Command routing + game logic
│   │   │   ├── CommandRouter.test.ts     # 41 unit tests
│   │   │   └── CommandRouter.phase4.test.ts
│   │   ├── systems/
│   │   │   ├── PlayerManager.ts
│   │   │   ├── MapSystem.ts
│   │   │   ├── CombatSystem.ts (+ test)
│   │   │   ├── SkillSystem.ts (+ test)
│   │   │   ├── ItemSystem.ts (+ test)
│   │   │   ├── NpcSystem.ts
│   │   │   ├── SchoolSystem.ts
│   │   │   ├── PersistenceSystem.ts (+ test)
│   │   │   └── CombatSystem.ts
│   │   ├── models/
│   │   │   ├── Player.ts    # Player, attributes
│   │   │   ├── Room.ts      # Room, exits
│   │   │   ├── Skill.ts     # Skill defs
│   │   │   ├── Item.ts      # Item defs
│   │   │   ├── Npc.ts       # NPC defs
│   │   │   └── School.ts    # School defs
│   │   ├── data/
│   │   │   ├── maps.json      # 26 rooms
│   │   │   ├── skills.json    # 14 skills
│   │   │   ├── items.json     # 7 items
│   │   │   └── schools.json   # 6 schools
│   │   └── utils.ts         # Shared helpers (bar, etc.)
│   └── vitest.config.ts
├── terraform/
│   └── main.tf             # AWS IaC (VPC, ECS, ALB, EFS, ECR, IAM)
├── .github/workflows/
│   └── deploy.yml          # CI/CD pipeline
├── Dockerfile              # Multi-stage Docker build
├── .dockerignore
├── PLAN.md                 # Architecture feasibility plan
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## License

MIT
