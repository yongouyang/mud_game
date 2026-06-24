# Enhancements Compatible with DynamoDB Migration

> **Status**: Review complete — all listed enhancements are safe to implement alongside or after the DynamoDB migration.  
> **Principle**: These changes either (a) don't touch persistence at all, (b) work through the `IStateSystem` abstraction, or (c) only affect the frontend/JSON static data layer.

---

## Category A: Frontend-Only (Zero Backend Impact)

These are pure React/Vite changes. They don't touch the server, persistence, or data layer at all.

| # | Enhancement | Effort | Why Safe |
|---|-------------|--------|----------|
| 1 | **Mobile-responsive terminal UI** | Medium | CSS/media queries only; no server changes |
| 2 | **Sound effects (combat, chat, ambience)** | Small | Browser Audio API; server just emits existing events |
| 3 | **Color themes (dark/light/sepia)** | Small | CSS variables; no data changes |
| 4 | **Inline help / command autocomplete** | Medium | Frontend state only; no server API changes |
| 5 | **Player profile cards / character sheet UI** | Medium | New React component; reads existing player data from socket events |
| 6 | **Map minimap / visual room navigator** | Medium | Renders from `maps.json` (static data); no backend changes |
| 7 | **Combat log / scrollback buffer** | Small | Frontend state; data already sent via socket |
| 8 | **Notification toasts for trades/mail** | Small | React UI layer; events already broadcast |

**Recommended priority**: #1 (mobile) and #4 (autocomplete) have the biggest UX impact.

---

## Category B: Game Systems (Work Through IStateSystem)

These add new game mechanics that persist state. They work with both `JsonStateSystem` (local) and `DynamoStateSystem` (production) because they use the `IStateSystem` interface.

| # | Enhancement | Effort | DynamoDB Impact |
|---|-------------|--------|-----------------|
| 9 | **PvP Arena system** | Large | New `wuxia-arenas` table OR reuse `wuxia-players` (store match history in player blob) |
| 10 | **Leaderboard / ranking system** | Medium | New `wuxia-leaderboards` table OR compute on-demand from `wuxia-players` scan |
| 11 | **Housing / player rooms** | Medium | New `wuxia-rooms` entries with `PK=PLAYER_HOUSE#playerId` OR separate `wuxia-housing` table |
| 12 | **Crafting recipes expansion** | Small | Update `recipes.json` → deploy via `deploy-data.ts` |
| 13 | **More NPC dialogue trees** | Small | Update `npcs.json` → deploy via `deploy-data.ts` |
| 14 | **Daily quests / rotating events** | Medium | Add `eventSchedule` to `CONFIG#GAME` in static data; event state in `wuxia-players` |
| 15 | **Achievement system** | Medium | Add `achievements: string[]` to player blob in `wuxia-players` |
| 16 | **Reputation / faction system** | Medium | Add `reputation: Record<factionId, number>` to player blob |
| 17 | **Pet / companion system** | Medium | Add `pet: PetState` to player blob |
| 18 | **Marriage / duo cultivation** | Small | Add `spouseId: string` to player blob; new `duo` commands in `CommandRouter` |
| 19 | **Poison crafting / alchemy expansion** | Small | New items in `items.json`; new recipes in `recipes.json` |
| 20 | **Weather / time-of-day effects** | Small | Add to `Scheduler` ticks; affects room descriptions (no persistence) |
| 21 | **Random encounters / wandering bosses** | Medium | `NpcSystem` spawns with `respawnAt` timers; state in `wuxia-npcs` |
| 22 | **Player titles / honorifics** | Small | Add `titles: string[]` to player blob |
| 23 | **Mentor / apprentice system** | Small | Add `mentorId`, `apprentices: string[]` to player blob |

**Recommended priority**: #15 (achievements), #14 (daily quests), #21 (wandering bosses) add replayability without heavy engineering.

---

## Category C: Static Data Only (JSON → DynamoDB Deploy)

These just need new/modified JSON files in `server/src/data/`. They deploy through the existing `deploy-data.ts` pipeline.

| # | Enhancement | Effort | Files to Change |
|---|-------------|--------|-----------------|
| 24 | **Expand maps (more rooms, areas)** | Medium | `maps.json` |
| 25 | **More NPCs (villagers, merchants, quest givers)** | Small | `npcs.json` |
| 26 | **More items (weapons, armor, consumables)** | Small | `items.json`, `recipes.json` |
| 27 | **More skills / martial arts** | Medium | `skills.json` |
| 28 | **More quests (storylines, chains)** | Medium | `quests.json` |
| 29 | **More schools / sects** | Small | `schools.json`, `skills.json` |
| 30 | **Seasonal events (Chinese New Year, Mid-Autumn)** | Small | `quests.json`, `items.json` (limited-time items) |

**Recommended priority**: #24 (more rooms) and #28 (quest chains) have the biggest content impact.

---

## Category D: DevOps / Observability (No Game Logic)

| # | Enhancement | Effort | Why Safe |
|---|-------------|--------|----------|
| 31 | **Structured logging (JSON format)** | Small | `console.log` → `pino` or `winston`; no game logic change |
| 32 | **Application metrics (Prometheus/OpenTelemetry)** | Small | Instrument `CommandRouter`, `CombatSystem`; data goes to CloudWatch |
| 33 | **Player analytics (funnel, retention)** | Medium | Fire events to CloudWatch or separate analytics table; no game logic change |
| 34 | **Rate limiting / DDoS protection** | Small | ALB WAF or API Gateway; no code change |
| 35 | **Graceful degradation (read-only mode)** | Small | Health check flag; `CommandRouter` rejects mutating commands |

**Recommended priority**: #31 (structured logging) makes debugging production issues much easier.

---

## Category E: Payment Integration (Post-DynamoDB Required)

| # | Enhancement | Effort | Why Wait for DynamoDB |
|---|-------------|--------|----------------------|
| 36 | **WeChat Pay / Alipay integration** | Large | Requires HTTPS (ALB + ACM), player identity persistence, transaction audit trail in DynamoDB |
| 37 | **Premium currency / VIP system** | Medium | New `premiumCurrency`, `vipExpiry` fields in player blob; transaction table |
| 38 | **Item mall / cash shop** | Medium | New `wuxia-shop` table or static data; purchase history in player blob |

**Recommendation**: Implement after Phase 6 (DynamoDB migration) is complete and stable. The ALB + HTTPS foundation is already in the Terraform.

---

## What NOT to Do During DynamoDB Migration

| # | Avoid | Reason |
|---|-------|--------|
| 1 | Changing the player data model (adding/removing fields) | Complicates the `JsonStateSystem` → `DynamoStateSystem` parity; do after migration |
| 2 | Adding new persistence systems that bypass `IStateSystem` | Breaks the abstraction; all persistence must go through the interface |
| 3 | Major `CommandRouter` refactoring | Already ~1240 lines; high risk of merge conflicts with persistence changes |
| 4 | Database schema changes mid-migration | Wait until all tables are created and stable |
| 5 | Removing JSON files before `DynamoStateSystem` is tested | Local dev still needs them |

---

## Recommended Parallel Work (Safe to Start Now)

While you set up AWS and work on the DynamoDB migration, these can be done in parallel:

### Immediate (this week)
1. **Mobile-responsive UI** (#1) — pure CSS, no backend
2. **Command autocomplete** (#4) — frontend-only
3. **More static content** (#24–30) — new JSON files, deploys via `deploy-data.ts` once ready
4. **Structured logging** (#31) — dev-only change

### After `IStateSystem` interface is defined (Step 2)
5. **Achievement system** (#15) — adds `achievements` to player blob; works through `IStateSystem`
6. **Daily quests** (#14) — scheduler + static data; player progress in player blob
7. **Weather effects** (#20) — scheduler-only, no persistence

### After DynamoDB migration is complete (Phase 6 done)
8. **PvP Arena** (#9) — new table or player blob fields
9. **Leaderboard** (#10) — scan `wuxia-players` or dedicated table
10. **Payment integration** (#36–38) — requires HTTPS + transaction audit trail

---

## Summary Table: All 38 Enhancements

| # | Enhancement | Category | Effort | Safe Now? | DynamoDB Impact |
|---|-------------|----------|--------|-----------|-----------------|
| 1 | Mobile-responsive UI | A | Medium | ✅ Yes | None |
| 2 | Sound effects | A | Small | ✅ Yes | None |
| 3 | Color themes | A | Small | ✅ Yes | None |
| 4 | Command autocomplete | A | Medium | ✅ Yes | None |
| 5 | Player profile cards | A | Medium | ✅ Yes | None |
| 6 | Map minimap | A | Medium | ✅ Yes | None |
| 7 | Combat log | A | Small | ✅ Yes | None |
| 8 | Notification toasts | A | Small | ✅ Yes | None |
| 9 | PvP Arena | B | Large | ⚠️ After IStateSystem | New table or player blob |
| 10 | Leaderboard | B | Medium | ⚠️ After IStateSystem | Scan or new table |
| 11 | Housing | B | Medium | ⚠️ After IStateSystem | New table or room entries |
| 12 | Crafting expansion | C | Small | ✅ Yes | Static data deploy |
| 13 | NPC dialogue trees | C | Small | ✅ Yes | Static data deploy |
| 14 | Daily quests | B | Medium | ⚠️ After IStateSystem | Player blob + static data |
| 15 | Achievement system | B | Medium | ⚠️ After IStateSystem | Player blob |
| 16 | Reputation system | B | Medium | ⚠️ After IStateSystem | Player blob |
| 17 | Pet system | B | Medium | ⚠️ After IStateSystem | Player blob |
| 18 | Marriage/duo | B | Small | ⚠️ After IStateSystem | Player blob |
| 19 | Alchemy expansion | C | Small | ✅ Yes | Static data deploy |
| 20 | Weather effects | B | Small | ✅ Yes | None (scheduler-only) |
| 21 | Wandering bosses | B | Medium | ⚠️ After IStateSystem | `wuxia-npcs` table |
| 22 | Player titles | B | Small | ⚠️ After IStateSystem | Player blob |
| 23 | Mentor system | B | Small | ⚠️ After IStateSystem | Player blob |
| 24 | Expand maps | C | Medium | ✅ Yes | Static data deploy |
| 25 | More NPCs | C | Small | ✅ Yes | Static data deploy |
| 26 | More items | C | Small | ✅ Yes | Static data deploy |
| 27 | More skills | C | Medium | ✅ Yes | Static data deploy |
| 28 | More quests | C | Medium | ✅ Yes | Static data deploy |
| 29 | More schools | C | Small | ✅ Yes | Static data deploy |
| 30 | Seasonal events | C | Small | ✅ Yes | Static data deploy |
| 31 | Structured logging | D | Small | ✅ Yes | None |
| 32 | App metrics | D | Small | ✅ Yes | CloudWatch |
| 33 | Player analytics | D | Medium | ⚠️ After IStateSystem | New table or CloudWatch |
| 34 | Rate limiting | D | Small | ✅ Yes | ALB WAF |
| 35 | Read-only mode | D | Small | ✅ Yes | None |
| 36 | WeChat/Alipay | E | Large | ❌ After Phase 6 | Transaction table |
| 37 | Premium currency | E | Medium | ❌ After Phase 6 | Player blob + transactions |
| 38 | Item mall | E | Medium | ❌ After Phase 6 | New table or static data |

---

## Next Actions

1. **Pick 2–3 from Category A** to implement while doing AWS setup
2. **Queue Category B items** for after `IStateSystem` is defined (Step 2 of migration)
3. **Content creators can work on Category C** (JSON files) in parallel — they'll deploy via `deploy-data.ts` once the pipeline is ready
4. **Save Category E** for after Phase 6 is complete and production-stable
