# oiuv_mud Color Scheme & Layout Analysis

> **Date**: 2026-06-21
> **Source**: oiuv_mud source code (ansi.c, set_del_color.h, color_to_html)
> **Purpose**: Reference for mud_game theme expansion and future UI layout ideas

---

## 1. Complete ANSI Color Palette (oiuv_mud)

Extracted from `adm/single/simul_efun/ansi.c:color_to_html()` — the definitive
color-to-HTML mapping used by oiuv_mud itself for its WebSocket client.

### Foreground Colors (16 total)

| Token | ANSI | Hex | Visual | Typical Usage |
|---|---|---|---|---|
| `$BLK$` | 30 | `#000000` | ██████ | Rare (invisible on black bg) |
| `$RED$` | 31 | `#990000` | ██████ | Damage numbers, danger warnings |
| `$GRN$` | 32 | `#009900` | ██████ | HP bars, healing, nature descriptions |
| `$YEL$` | 33 | `#999900` | ██████ | Item names, gold, treasure |
| `$BLU$` | 34 | `#000099` | ██████ | Water, sky, MP/spirit |
| `$MAG$` | 35 | `#990099` | ██████ | Poison, curses, evil |
| `$CYN$` | 36 | `#669999` | ██████ | System messages, info |
| `$WHT$` | 37 | `#EEEEEE` | ██████ | Default body text |
| `$HIR$` | 91 | `#FF0000` | ██████ | **CRITICAL warnings, death, enemy alerts** |
| `$HIG$` | 92 | `#00FF00` | ██████ | **Success, level-up, positive events** |
| `$HIY$` | 93 | `#FFFF00` | ██████ | **Headers, gold text, NPC names** |
| `$HIB$` | 94 | `#0000FF` | ██████ | **MP, skill names, special items** |
| `$HIM$` | 95 | `#FF00FF` | ██████ | **Magic, rare items, special effects** |
| `$HIC$` | 96 | `#00FFFF` | ██████ | **System notifications, prompts** |
| `$HIW$` | 97 | `#FFFFFF` | ██████ | **Emphasis, player names, highlights** |
| `$HIK$` | 90 | `#BBBBBB` | ██████ | Dimmed text, secondary info |

### Background Colors (8 normal + 8 bright)

| Token | Hex | Visual |
|---|---|---|
| `$BBLK$` | `#FFFF00` | Yellow highlight bg |
| `$BRED$` | `#990000` | Dark red bg |
| `$BGRN$` | `#009900` | Dark green bg |
| `$BYEL$` | `#999900` | Olive bg |
| `$BBLU$` | `#000099` | Dark blue bg |
| `$BMAG$` | `#990099` | Dark magenta bg |
| `$BCYN$` | `#669999` | Teal bg |
| `$BWHT$` | `#EEEEEE` | Light gray bg |
| `$HBRED$` | Bright red bg | Error blocks |
| `$HBGRN$` | Bright green bg | Success blocks |
| `$HBYEL$` | Bright yellow bg | Warning blocks |
| `$HBBLU$` | Bright blue bg | Info blocks |
| `$HBMAG$` | Bright magenta bg | Special blocks |
| `$HBCYN$` | Bright cyan bg | System blocks |

### Special Effects

| Token | Meaning |
|---|---|
| `$NOR$` | Reset all colors |
| `$BOLD$` | Bold text |
| `$BLINK$` / `$SPARK$` | Blinking text |
| `$REV$` | Reverse video (swap fg/bg) |
| `$HIREV$` | Highlight reverse |
| `$U$` | Underline |

---

## 2. Color Semantic Mapping (Conventional MUD Usage)

Based on oiuv_mud conventions and standard Chinese MUD color semantics:

| Context | Colors Used |
|---|---|
| **Room names** | `$HIY$` (bright yellow) — draws attention |
| **Room descriptions** | `$WHT$` or `$GRN$` — atmospheric |
| **NPC names** | `$HIY$` — important entities |
| **Player names** | `$HIW$` — identity emphasis |
| **Item names** | `$YEL$` or `$HIM$` — treasure/magic |
| **Damage taken** | `$HIR$` (bright red) — urgency |
| **Damage dealt** | `$HIY$` or `$HIG$` — positive feedback |
| **Healing** | `$HIG$` (bright green) — recovery |
| **Skill names** | `$HIB$` or `$HIC$` — martial arts |
| **System help** | `$HIC$` — informative |
| **Error messages** | `$HIR$` — stop/read |
| **Success messages** | `$HIG$` — confirmation |
| **Death** | `$HIR$` + `$BLINK$` — maximum urgency |
| **HP bars** | `$GRN$` / `$YEL$` / `$RED$` — gradient by percentage |
| **MP bars** | `$HIB$` / `$CYN$` — spiritual energy |
| **Combat messages** | `$HIR$` / `$HIY$` — action emphasis |
| **Chat (say)** | `$WHT$` — normal conversation |
| **Chat (tell)** | `$HIM$` — private messages |
| **Chat (channel)** | `$HIC$` — broadcast |

---

## 3. Typical MUD Screen Layout (oiuv_mud)

Based on the oiuv_mud screenshots and standard FluffOS MUD layout:

```
┌─────────────────────────────────────────────────────┐
│  ╔══════════════════ TOP BAR ═══════════════════╗   │
│  ║  炎黄群侠传 · 华山之巅 · 在线玩家: 12       ║   │
│  ╚══════════════════════════════════════════════╝   │
│                                                      │
│  ╔═══════════════ STATUS PANEL ═══════════════╗      │
│  ║  【气血】████████░░ 120/150                ║      │
│  ║  【内力】██████░░░░  80/120                ║      │
│  ║  【经验】1250  【潜能】320  【等级】8       ║      │
│  ╚══════════════════════════════════════════════╝     │
│                                                      │
│  ╔══════════════ MAIN OUTPUT ═════════════════╗      │
│  ║  华山之巅                                    ║     │
│  ║  云雾缭绕的华山最高峰，寒风凛冽。            ║     │
│  ║  北边通向华山派山门。                        ║     │
│  ║                                              ║     │
│  ║  这里站着 岳不群 - 华山派掌门                ║     │
│  ║                                              ║     │
│  ║  玩家A 一式独孤九剑，对你造成了 45 点伤害！  ║     │
│  ╚══════════════════════════════════════════════╝     │
│                                                      │
│  > 输入命令...                          [发送]      │
└─────────────────────────────────────────────────────┘
```

### Key Layout Features

1. **Top Bar** — Server name, current room, online player count. Persists across scroll.
2. **Status Panel** — HP/MP bars, EXP, pot, level. Always visible or togglable.
3. **Main Output** — Scrollable game text (room descriptions, combat, chat).
4. **Prompt Line** — Input field with prompt symbol `>`.

### Help Screen Layout (help.png)

The help screen uses categorized command listings with colored headers:
```
┌──────────────────────────────────────────┐
│  ╔══════════ HELP TOPICS ═══════════╗    │
│  ║                                   ║    │
│  ║  $HIY$【移动命令】                ║    │
│  ║  n s e w u d — 方向移动          ║    │
│  ║                                   ║    │
│  ║  $HIY$【战斗命令】                ║    │
│  ║  kill, hit, perform, exert...     ║    │
│  ║                                   ║    │
│  ║  $HIY$【武功命令】                ║    │
│  ║  skills, learn, practice...       ║    │
│  ║                                   ║    │
│  ╚═══════════════════════════════════╝    │
└──────────────────────────────────────────┘
```

---

## 4. mud_game Current Theme vs oiuv_mud Colors

### Current mud_game amber theme
```
bg:       '#18120c'  — dark parchment (vs oiuv black #000000)
fg:       '#d4c4a8'  — warm amber text (vs oiuv white #EEEEEE)
accent:   '#c97e5a'  — copper/terracotta
accentAlt:'#b8934a'  — gold
accentWarm:'#e8c44a' — bright gold (≈ oiuv HIY #FFFF00)
success:  '#7a8e5a'  — muted green (≈ oiuv GRN #009900)
error:    '#b84a40'  — muted red (≈ oiuv RED #990000)
```

### Gap Analysis

| oiuv_mud Color Role | mud_game Support | Gap |
|---|---|---|
| White text on black bg | Amber theme (different aesthetic) | Style choice |
| Bright red for danger | `error` color | ✅ |
| Bright green for success | `success` color | ✅ |
| Bright yellow for headers | `accentWarm` | ✅ |
| Blue for skills/magic | None | 🔴 Missing |
| Cyan for system info | None | 🔴 Missing |
| Magenta for rare/special | None | 🔴 Missing |
| Dimmed secondary text | `fgDim` | ✅ |
| Background color blocks | None | 🔴 Missing |
| Bold/blink effects | None (CSS can do) | 🔴 Missing |

---

## 5. Future UI Expansion Ideas

### 5.1 Color Expansion — Semantic Color Tokens in Output

Currently, mud_game emits plain text via `socket.emit('output', { text })`. 
To support colors, the server could emit ANSI-style tokens that the frontend 
Terminal component parses into colored `<span>` elements:

```typescript
// Server emits:
socket.emit('output', { 
  text: '$HIY$华山之巅$NOR$\n$WHT$云雾缭绕...$NOR$' 
});

// Terminal component renders:
<span style="color: #e8c44a">华山之巅</span>
<span style="color: #d4c4a8">云雾缭绕...</span>
```

**Theme mapping:** Each theme would define its own interpretation of the 16 
ANSI color tokens, allowing the amber theme to render `$HIR$` as warm red 
and Tokyo Night to render it as `#f7768e`.

### 5.2 Layout Expansion — Split Panels

Current mud_game has a single scrollable output area. Future could add:

```
┌──────────────────────────────────────────────────┐
│  ╔══════════════ HEADER ══════════════════════╗  │
│  ║ 炎黄群侠传 · 华山之巅 · 在线: 12        ║  │
│  ╚══════════════════════════════════════════════╝  │
│ ┌──────────────────┬──────────────────────────┐  │
│ │   STATUS PANEL    │    MAIN OUTPUT            │  │
│ │                   │                            │  │
│ │  HP ██████░ 120/150│  华山之巅                 │  │
│ │  MP ████░░░  80/120│  云雾缭绕的华山最高峰...   │  │
│ │                   │                            │  │
│ │  EXP: 1,250       │  这里站着 岳不群           │  │
│ │  POT: 320         │                            │  │
│ │  LV: 8            │  玩家A 一式独孤九剑...      │  │
│ │                   │                            │  │
│ │  ⚔ 战斗中         │                            │  │
│ │  🏫 少林派         │                            │  │
│ │                   │                            │  │
│ └──────────────────┴──────────────────────────┘  │
│  > 输入命令...                         [发送]   │
└──────────────────────────────────────────────────┘
```

**Key additions:**
- **Status panel (left sidebar):** Always-visible HP/MP bars, EXP, level, 
  school badge, combat status icon, active conditions
- **Main output (right):** Scrollable game text as before
- **Both panels:** Collapsible on mobile (toggle via tap)

### 5.3 Mobile/Tablet Optimization

```
┌─────────────────┐     ┌──────────────────────┐
│  (Mobile)        │     │  (iPad)              │
│                  │     │                      │
│  ┌─STATUS BAR─┐  │     │  ┌─STATUS─┬─OUTPUT─┐│
│  │ HP ██░ LV8 │  │     │  │ HP ██░  │ 华山.. ││
│  └────────────┘  │     │  │ MP ██░  │ 这里.. ││
│                  │     │  │ EXP 1250│        ││
│  ┌─OUTPUT──────┐ │     │  └────────┴────────┘│
│  │ 华山之巅     │ │     │                      │
│  │ 云雾缭绕...  │ │     │  > 输入命令...      │
│  │              │ │     └──────────────────────┘
│  └─────────────┘ │
│                  │
│  > 输入命令...    │
└─────────────────┘
```

### 5.4 Rich Text Elements

Beyond colors, the terminal output could include inline elements:

| Element | Markup | Render |
|---|---|---|
| HP bar | `$BAR(hp,10)$` | `████████░░` gradient bar |
| Item icon | `$ITEM(sword)$` | ⚔️ icon + colored name |
| NPC mention | `$NPC(岳不群)$` | Clickable (opens info popup) |
| Location link | `$ROOM(shaolin/hall)$` | Clickable (auto-navigate) |
| Chat bubble | `$SAY(张三, 你好)$` | Styled chat message |

### 5.5 Command Autocomplete & Suggestions

```
> lea[TAB]
┌─────────────────────┐
│ learn 基本拳脚       │
│ learn 基本轻功       │
│ learn 基本内功       │
│ learn 太极拳         │
└─────────────────────┘
```

### 5.6 Minimap / Compass

A small compass widget showing available exits from current room:
```
     [北]
      ↑
[西] ← ⊕ → [东]
      ↓
     [南]
```

---

## 6. Implementation Roadmap for UI Expansion

### Phase 1: Color Tokens (Low effort, high impact)
1. Add ANSI color token parser to `Terminal.tsx`
2. Map 16 colors per theme in `themes.ts`
3. Emit colored text from `CommandRouter.ts` for room names, damage, etc.

### Phase 2: Status Panel (Medium effort)
1. Add always-visible HP/MP/EXP bar above output area
2. Subscribe to Socket.io events for real-time stat updates
3. Collapse on mobile below 600px width

### Phase 3: Split Layout (Medium effort)
1. CSS Grid layout with status sidebar + output area
2. Responsive breakpoints for mobile/tablet/desktop
3. Toggle sidebar visibility

### Phase 4: Rich Elements (High effort)
1. Define markup syntax (`$BAR()`, `$NPC()`, etc.)
2. Parse and render as React components
3. Add click handlers for navigation

---

> This analysis serves as reference for future UI/UX improvements to mud_game.
