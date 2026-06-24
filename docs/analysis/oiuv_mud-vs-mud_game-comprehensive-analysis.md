# Comprehensive Analysis: oiuv_mud vs mud_game

## Executive Summary

| Dimension | oiuv_mud (Original) | mud_game (Modern) |
|-----------|---------------------|-------------------|
| **Game** | 炎黄群侠传 (Chinese Wuxia MUD) | 炎黄群侠传 (Web-based Wuxia MUD) |
| **Status** | Production-ready, online at mud.ren:8888 | In development, not yet deployed |
| **Code Size** | ~360K lines LPC | ~11K lines TypeScript |
| **Files** | ~12K files | ~11K files (mostly node_modules) |
| **Content** | Massive (70+ areas, 440+ skills, 7K rooms) | Moderate (63 rooms, 813 skills, 191 NPCs) |

---

## 1. Architecture & Tech Stack

### oiuv_mud (Original)
- **Driver**: FluffOS v2019+ (C-based MUD driver)
- **Framework**: mudcore v1.6+ (git submodule)
- **Language**: LPC (LPmud C - domain-specific language for MUDs)
- **Runtime**: Native compiled binary, single-process event loop
- **Network**: Telnet (UTF-8: 6666, GBK: 5566) + WebSocket (8888)
- **Architecture**: Object-oriented inheritance-based (objects inherit behavior via `inherit`)
- **State Management**: In-memory object database with periodic save to filesystem
- **Concurrency**: Single-threaded with heartbeat-based scheduling

### mud_game (Modern)
- **Frontend**: React 18 + TypeScript + Vite 8
- **Backend**: Node.js 24 + Express + Socket.io (WebSocket)
- **Language**: TypeScript (compiled via tsx in dev, bundled via Vite in prod)
- **Runtime**: Node.js server process
- **Network**: HTTP/WebSocket only (no telnet)
- **Architecture**: Modular class-based systems with dependency injection
- **State Management**: In-memory with JSON file persistence
- **Concurrency**: Node.js event loop, scheduler-based game ticks (100ms resolution)

### Key Difference
The original runs on a specialized MUD driver (FluffOS) that understands LPC natively. The modern version is a from-scratch rewrite in mainstream web technologies, trading the specialized MUD runtime for modern deployability.

---

## 2. Language & Runtime

### LPC (oiuv_mud)
- Domain-specific language designed for MUDs
- C-like syntax but with MUD-specific primitives: `object`, `mapping`, `mixed`
- All variables must be declared at function start (C89 style)
- No pointers; objects are referenced directly
- Arrays use `({...})`, mappings use `([...])`
- `inherit` for code reuse (not class inheritance)
- Compiled to bytecode by FluffOS driver

### TypeScript (mud_game)
- Mainstream typed JavaScript
- Modern ES2020+ features
- Class-based OOP with interfaces
- Async/await for I/O
- JSON for data, TypeScript for logic
- Compiled by Vite/Node.js

---

## 3. Game Features & Systems

### oiuv_mud — Comprehensive MUD Systems
| System | Status | Notes |
|--------|--------|-------|
| Combat | ✅ Full | Complex parry/dodge/force mechanics, PvP/PvE |
| Skills | ✅ 440+ directories | Individual .c files per skill with perform moves |
| Schools (门派) | ✅ 40+ | Full school system with masters, quests |
| NPCs | ✅ Rich | Dynamic name generation, AI behaviors, chat routines |
| Items | ✅ 1000+ | Weapons, armor, food, medicine, money, quest items |
| Quests | ✅ Full | Multiple quest types, daily tasks, ultra quests |
| Economy | ✅ Full | Shops, banks, auction, trading, crafting |
| Guilds | ✅ | Full guild system |
| Chat | ✅ | Multiple channels, emotes |
| Player Housing | ✅ | Buildable rooms |
| Weather/Time | ✅ | Nature daemon |
| Mail | ✅ | In-game mail system |
| Conditions | ✅ | Poison, illness, buffs/debuffs |
| Transport | ✅ | Horses, boats |
| Fishing/Hunting | ✅ | Mini-games |
| AI Service | ✅ | Python-based AI integration |
| Web Client | ✅ | Built-in WebSocket client |

### mud_game — Modern Rewrite Systems
| System | Status | Notes |
|--------|--------|-------|
| Combat | ✅ Core | Turn-based with parry/dodge/force, combo system |
| Skills | ✅ 813 JSON | Data-driven, perform moves with MP cost |
| Schools (门派) | ✅ 39 | Data-driven with attribute bonuses |
| NPCs | ✅ 191 JSON | Aggressive/passive, drops, respawn |
| Items | ✅ 149 JSON | Weapons, armor, consumables |
| Quests | ✅ 26 JSON | Kill/fetch/delivery types |
| Economy | ✅ Partial | Shops, bank, auction, crafting, trade |
| Guilds | ✅ Basic | Membership system |
| Chat | ✅ | World, room, school, private |
| Conditions | ✅ | Poison, regen |
| Leveling | ✅ | Experience-based with pot usage |
| Multi-enemy combat | ✅ | Target multiple enemies |
| Power-ups | ✅ | Temporary damage boosts |
| Meditate/Heal | ✅ | Recovery mechanics |
| Mail | ✅ | In-game mail with attachments |
| Crafting | ✅ | Recipe-based system |

### What the Modern Version Lacks vs Original
1. **Dynamic NPC behavior** — Original NPCs have complex AI, wander, chat, react to player actions
2. **Player housing/building** — Original has full room construction system
3. **Weather and day/night cycle** — Original has nature daemon
4. **Transportation** — Horses, boats, rivers in original
5. **Fishing/hunting mini-games**
6. **Complex PvP system** — Original has detailed PK tracking, kill limits, alignment (shen/邪正)
7. **Web of social commands** — Emote system, complex social interactions
8. **Board/mail system depth**
9. **Ultra quests and story system**
10. **AI integration** — Original has Python AI service

### What the Modern Version Has That Original Lacks
1. **Modern web UI** — Terminal aesthetic with React, themes, responsive design
2. **Browser-based play** — No telnet client needed
3. **Test suite** — 56 test files with Vitest + Playwright E2E
4. **CI/CD pipeline** — GitHub Actions with Docker
5. **Infrastructure as Code** — Terraform for AWS ECS
6. **Health checks** — `/health` endpoint
7. **Graceful shutdown** — SIGTERM handling with save
8. **Autosave** — Periodic persistence
9. **Combo system** — Consecutive hit bonuses
10. **Power-up mechanics** — Temporary buffs
11. **Multi-enemy combat** — Fight multiple foes simultaneously

---

## 4. Content Volume

### oiuv_mud (Original)
| Content Type | Count |
|--------------|-------|
| Areas (d/) | 71 distinct areas |
| Rooms | 6,998 files |
| Clonable objects | 1,012 files |
| NPCs | 10 files in clone/npc + many in d/*/npc/ |
| Skills (directories) | 440 directories |
| Skill .c files | 1,448 files |
| Kungfu classes | 470 files |
| Conditions | 70 files |
| Special abilities | 33 files |
| Commands | 364 files |
| Inherits | 88 files |
| Daemons | 161 files |
| Features | 49 files |
| Headers | 138 files |
| Help files | 186 files |
| Documentation | 47 files |
| **Total LPC lines** | ~360,000 |

### mud_game (Modern)
| Content Type | Count |
|--------------|-------|
| Rooms | 63 |
| NPCs | 191 |
| Items | 149 |
| Skills | 813 |
| Schools | 39 |
| Quests | 26 |
| Conditions | ~10 |
| Recipes | ~10 |
| Shops | 5 |
| **Server TS lines** | ~10,500 |
| **Client TSX lines** | ~400 |
| **Test lines** | ~1,000 |

### Content Gap
The original has roughly **100x more rooms**, **2x more skills** (though many are stubs in modern), and vastly more interconnected world content. The modern version's data was partially extracted from the original using scripts (see `scripts/extract-oiuv.cjs`).

---

## 5. Development Workflow & Testing

### oiuv_mud
- **No formal test suite** — Testing is done in-game via `eval` command and test commands in `/cmds/test/`
- **Build**: Compile FluffOS driver, then run `driver config.ini`
- **Hot reload**: LPC files are compiled on-demand; no restart needed for most changes
- **Debugging**: Debug logs in `/log/`, error handler in master object
- **Version control**: Git with submodules (mudcore)
- **No CI/CD** — Manual deployment
- **No Docker** — Direct binary execution

### mud_game
- **56 test files** — Vitest unit tests for every system, Playwright E2E tests
- **Build**: `npm run build` (Vite bundles frontend)
- **Dev**: `npm run dev:all` (concurrent frontend + server)
- **Hot reload**: Vite HMR for frontend, tsx watch for server
- **Debugging**: Console logs, health endpoint
- **Version control**: Git
- **CI/CD**: GitHub Actions (tests on push, deploy disabled)
- **Docker**: Multi-stage Dockerfile (Node 24 Alpine)
- **Coverage**: Vitest coverage-v8

---

## 6. Deployment & Infrastructure

### oiuv_mud
- **Deployment**: Manual — run binary on server
- **Hosting**: Dedicated server (mud.ren:8888)
- **Persistence**: Filesystem saves in `/data/`
- **No containerization**
- **No orchestration**
- **Ports**: 5566 (GBK telnet), 6666 (UTF-8 telnet), 8888 (WebSocket)

### mud_game
- **Deployment**: Docker → AWS ECR → ECS Fargate (planned)
- **Infrastructure**: Terraform (AWS VPC, ALB, ECS, EFS, ECR)
- **CI/CD**: GitHub Actions with OIDC to AWS
- **Health checks**: `/health` endpoint
- **Persistence**: EFS mount for JSON player data
- **Container**: Node 24 Alpine, multi-stage build
- **Port**: 3000 (HTTP + WebSocket)
- **Domain**: Configurable with ACM certificate

---

## 7. Code Quality & Organization

### oiuv_mud
- **Strengths**: Mature, battle-tested codebase; rich feature set; deep game mechanics
- **Weaknesses**: Monolithic; no tests; LPC is niche (hard to hire for); mixed coding styles; large files (combatd.c is 2,295 lines)
- **Organization**: Traditional MUD layout (adm/, cmds/, clone/, d/, inherit/, kungfu/)
- **Documentation**: CLAUDE.md for AI assistants, extensive in-game help

### mud_game
- **Strengths**: Modern tooling; comprehensive tests; type safety; modular architecture; data-driven content; containerized; IaC
- **Weaknesses**: Much less content; some systems are simplified; still in development
- **Organization**: Clean separation (src/, server/src/, data/, tests/, terraform/)
- **Documentation**: README, docs/, inline code comments

---

## 8. Key Files Comparison

| Purpose | oiuv_mud | mud_game |
|---------|----------|----------|
| Config | `config.ini` (FluffOS) | `package.json`, `vite.config.ts` |
| Entry point | `adm/single/master.c` | `server/src/index.ts` |
| Main loop | FluffOS driver heartbeat | `setInterval(() => scheduler.tick(), 100)` |
| Combat | `adm/daemons/combatd.c` (2,295 lines) | `server/src/systems/CombatSystem.ts` (258 lines) |
| Commands | `cmds/std/*.c` (364 files) | `server/src/engine/CommandRouter.ts` (1,401 lines) |
| Player | `inherit/char/char.c` (376 lines) | `server/src/models/Player.ts` |
| World data | `d/*/*.c` (6,998 files) | `server/src/data/maps.json` (63 rooms) |
| Skills | `kungfu/skill/*/*.c` (1,448 files) | `server/src/data/skills.json` (813 entries) |
| NPCs | `clone/npc/*.c` + `d/*/npc/*.c` | `server/src/data/npcs.json` (191 entries) |

---

## 9. Summary of Gaps

### What mud_game is missing from oiuv_mud:
1. **Massive world** — 6,998 rooms vs 63; 71 areas vs ~10 connected
2. **Deep NPC AI** — Original NPCs wander, chat, have routines, generate names dynamically
3. **Social systems** — Emotes, complex player interactions, marriage, master-apprentice
4. **Advanced combat** — Original has much more nuanced combat with many special moves
5. **PvP system** — PK tracking, alignment, revenge, kill limits
6. **Economy depth** — Stock market, complex trading, player shops
7. **Building system** — Player-constructed rooms and housing
8. **Weather/time** — Day/night, seasons affect gameplay
9. **Mini-games** — Fishing, hunting, gambling
10. **Quest depth** — Story-driven quests, ultra quests, chain quests
11. **AI integration** — Python AI service for NPC intelligence
12. **Web client** — Original has built-in web client at :8888

### What oiuv_mud is missing that mud_game has:
1. **Modern development workflow** — Tests, CI/CD, type safety
2. **Browser-native UI** — No telnet client needed
3. **Containerization** — Docker, orchestration-ready
4. **Cloud deployment** — Terraform, AWS ECS
5. **Data-driven content** — Easy to modify JSON vs LPC code
6. **Rapid iteration** — Modern tooling enables faster development

---

## Conclusion

The **oiuv_mud** project is a mature, feature-rich Chinese MUD with decades of accumulated content and game systems. It represents a complete, playable game with deep mechanics but uses legacy technology (LPC/FluffOS) that limits modern development practices.

The **mud_game** project is a modern rewrite that prioritizes developer experience, testability, and cloud deployment. It has a solid architectural foundation but currently contains only a fraction of the original's content and game depth. The modern version is better suited for iterative development and scaling, while the original offers a vastly richer player experience.

**Recommendation**: The modern project should continue extracting and porting content from the original using its existing scripts (`scripts/extract-oiuv.cjs`, etc.), while preserving the modern architecture advantages. The original's content (rooms, NPCs, quests, skills) is its biggest asset and should be systematically migrated to the JSON data format.
