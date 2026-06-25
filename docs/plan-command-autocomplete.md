# Command Autocomplete — Implementation Plan

## Overview
Add inline command autocomplete to the Terminal component. As the user types, a dropdown shows matching commands with descriptions. Supports keyboard navigation (Tab/↑/↓/Enter) and click selection.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/commands.ts` | **Create** | Static command registry: aliases, descriptions, usage hints |
| `src/components/Autocomplete.tsx` | **Create** | Dropdown UI component |
| `src/components/Terminal.tsx` | **Modify** | Wire autocomplete into input handling |
| `tests/unit/Autocomplete.test.tsx` | **Create** | Unit tests for matching logic |
| `tests/unit/Terminal.autocomplete.test.tsx` | **Create** | Integration tests for Terminal + Autocomplete |

---

## 1. Command Registry (`src/lib/commands.ts`)

```typescript
export interface CommandInfo {
  name: string;           // primary command name
  aliases: string[];      // e.g., ['l'] for 'look'
  description: string;    // short help text
  usage?: string;         // example: 'look [target]'
  category: 'movement' | 'combat' | 'inventory' | 'social' | 'system' | 'skill' | 'quest' | 'guild';
}

export const COMMANDS: CommandInfo[] = [
  { name: 'look', aliases: ['l'], description: '查看周围环境或目标', usage: 'look [目标]', category: 'movement' },
  { name: 'north', aliases: ['n'], description: '向北移动', category: 'movement' },
  { name: 'south', aliases: ['s'], description: '向南移动', category: 'movement' },
  { name: 'east', aliases: ['e'], description: '向东移动', category: 'movement' },
  { name: 'west', aliases: ['w'], description: '向西移动', category: 'movement' },
  { name: 'up', aliases: ['u'], description: '向上移动', category: 'movement' },
  { name: 'down', aliases: ['d'], description: '向下移动', category: 'movement' },
  { name: 'hp', aliases: ['score'], description: '查看状态', category: 'system' },
  { name: 'skills', aliases: [], description: '查看武功技能', category: 'skill' },
  { name: 'inventory', aliases: ['i'], description: '查看背包', category: 'inventory' },
  { name: 'get', aliases: [], description: '捡起物品', usage: 'get <物品>', category: 'inventory' },
  { name: 'drop', aliases: [], description: '丢弃物品', usage: 'drop <物品>', category: 'inventory' },
  { name: 'wear', aliases: [], description: '装备物品', usage: 'wear <物品>', category: 'inventory' },
  { name: 'remove', aliases: [], description: '卸下物品', usage: 'remove <物品>', category: 'inventory' },
  { name: 'use', aliases: [], description: '使用物品', usage: 'use <物品>', category: 'inventory' },
  { name: 'kill', aliases: ['hit'], description: '攻击目标', usage: 'kill <目标>', category: 'combat' },
  { name: 'flee', aliases: [], description: '逃跑', category: 'combat' },
  { name: 'learn', aliases: [], description: '学习武功', usage: 'learn <武功名>', category: 'skill' },
  { name: 'practice', aliases: ['lian'], description: '练习武功', usage: 'practice <武功名>', category: 'skill' },
  { name: 'perform', aliases: ['pfm'], description: '施展招式', usage: 'perform <招式>', category: 'skill' },
  { name: 'exert', aliases: ['yun'], description: '运功', usage: 'exert <功法>', category: 'skill' },
  { name: 'dazuo', aliases: ['exercise', 'tuna'], description: '打坐练功', category: 'skill' },
  { name: 'ask', aliases: [], description: '向NPC询问', usage: 'ask <NPC>', category: 'quest' },
  { name: 'quest', aliases: [], description: '任务相关', category: 'quest' },
  { name: 'buy', aliases: [], description: '购买物品', usage: 'buy <物品>', category: 'inventory' },
  { name: 'sell', aliases: [], description: '出售物品', usage: 'sell <物品>', category: 'inventory' },
  { name: 'shop', aliases: ['list'], description: '查看商店', category: 'inventory' },
  { name: 'bank', aliases: ['cunkuan'], description: '查看存款', category: 'system' },
  { name: 'deposit', aliases: [], description: '存钱', usage: 'deposit <数量>', category: 'system' },
  { name: 'withdraw', aliases: [], description: '取钱', usage: 'withdraw <数量>', category: 'system' },
  { name: 'auction', aliases: [], description: '拍卖行', category: 'system' },
  { name: 'craft', aliases: [], description: '合成物品', usage: 'craft <配方>', category: 'inventory' },
  { name: 'schools', aliases: [], description: '查看门派', category: 'skill' },
  { name: 'join', aliases: [], description: '加入门派', usage: 'join <门派>', category: 'skill' },
  { name: 'level', aliases: [], description: '查看等级信息', category: 'system' },
  { name: 'who', aliases: [], description: '查看在线玩家', category: 'social' },
  { name: 'say', aliases: [], description: '说话', usage: 'say <内容>', category: 'social' },
  { name: 'tell', aliases: [], description: '私聊', usage: 'tell <玩家> <内容>', category: 'social' },
  { name: 'shout', aliases: [], description: '大喊', usage: 'shout <内容>', category: 'social' },
  { name: 'chat', aliases: [], description: '频道聊天', usage: 'chat <内容>', category: 'social' },
  { name: 'whisper', aliases: [], description: '耳语', usage: 'whisper <玩家> <内容>', category: 'social' },
  { name: 'give', aliases: [], description: '给予物品', usage: 'give <玩家> <物品>', category: 'inventory' },
  { name: 'mail', aliases: [], description: '发送邮件', usage: 'mail <玩家> <内容>', category: 'social' },
  { name: 'checkmail', aliases: [], description: '查看邮件', category: 'social' },
  { name: 'readmail', aliases: [], description: '阅读邮件', usage: 'readmail <ID>', category: 'social' },
  { name: 'friend', aliases: [], description: '好友管理', usage: 'friend <add/remove> <玩家>', category: 'social' },
  { name: 'guild', aliases: [], description: '帮派管理', category: 'guild' },
  { name: 'help', aliases: [], description: '查看帮助', category: 'system' },
  { name: 'clear', aliases: [], description: '清屏', category: 'system' },
  { name: 'tianfu', aliases: ['setattr'], description: '设置天赋', usage: 'tianfu <属性> <值>', category: 'system' },
  { name: 'gm', aliases: [], description: 'GM命令', category: 'system' },
];

// Build lookup maps for O(1) access
const byName = new Map<string, CommandInfo>();
const byAlias = new Map<string, CommandInfo>();

for (const cmd of COMMANDS) {
  byName.set(cmd.name, cmd);
  for (const alias of cmd.aliases) {
    byAlias.set(alias, cmd);
  }
}

export function findCommand(input: string): CommandInfo | undefined {
  const [first] = input.trim().toLowerCase().split(/\s+/);
  return byName.get(first) || byAlias.get(first);
}

export function matchCommands(prefix: string): CommandInfo[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  
  return COMMANDS.filter(cmd => 
    cmd.name.startsWith(p) || 
    cmd.aliases.some(a => a.startsWith(p))
  ).sort((a, b) => {
    // Exact match first, then name match, then alias match
    const aExact = a.name === p;
    const bExact = b.name === p;
    if (aExact !== bExact) return aExact ? -1 : 1;
    
    const aName = a.name.startsWith(p);
    const bName = b.name.startsWith(p);
    if (aName !== bName) return aName ? -1 : 1;
    
    return a.name.localeCompare(b.name);
  });
}
```

---

## 2. Autocomplete Component (`src/components/Autocomplete.tsx`)

```typescript
import { CommandInfo } from '../lib/commands';
import { Theme } from '../themes';

interface AutocompleteProps {
  matches: CommandInfo[];
  selectedIndex: number;
  theme: Theme;
  onSelect: (cmd: CommandInfo) => void;
  onHover: (index: number) => void;
}

export function Autocomplete({ matches, selectedIndex, theme, onSelect, onHover }: AutocompleteProps) {
  if (matches.length === 0) return null;
  
  const t = theme;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      zIndex: 10,
      background: t.bgDark,
      border: `1px solid ${t.border}`,
      borderBottom: 'none',
      borderRadius: '4px 4px 0 0',
      maxHeight: 'clamp(120px, 30vh, 240px)',
      overflowY: 'auto',
      boxShadow: `0 -4px 12px ${t.bgDark}88`,
    }}>
      {matches.map((cmd, i) => (
        <div
          key={cmd.name}
          role="option"
          aria-selected={i === selectedIndex}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => onHover(i)}
          style={{
            padding: 'clamp(6px, 2vw, 10px) clamp(12px, 4vw, 20px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: i === selectedIndex ? `${t.accent}22` : 'transparent',
            borderLeft: `3px solid ${i === selectedIndex ? t.accent : 'transparent'}`,
            transition: 'background 0.1s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ 
              color: t.accent, 
              fontWeight: 600,
              fontSize: 'clamp(12px, 3.5vw, 14px)',
              whiteSpace: 'nowrap',
            }}>
              {cmd.name}
            </span>
            {cmd.aliases.length > 0 && (
              <span style={{ 
                color: t.fgDim, 
                fontSize: 'clamp(10px, 3vw, 12px)',
                whiteSpace: 'nowrap',
              }}>
                ({cmd.aliases.join(', ')})
              </span>
            )}
          </div>
          <span style={{ 
            color: t.fgDim, 
            fontSize: 'clamp(10px, 3vw, 12px)',
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {cmd.description}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## 3. Terminal Integration

Modify `src/components/Terminal.tsx`:

### State additions:
```typescript
import { matchCommands, CommandInfo, findCommand } from '../lib/commands';
import { Autocomplete } from './Autocomplete';

// Add to Terminal component state:
const [suggestions, setSuggestions] = useState<CommandInfo[]>([]);
const [selectedIndex, setSelectedIndex] = useState(0);
const [showSuggestions, setShowSuggestions] = useState(false);
```

### Input change handler:
```typescript
const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setInput(value);
  setHistoryIdx(-1);
  
  // Only show suggestions for first word
  const trimmed = value.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const prefix = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  
  if (prefix && spaceIndex === -1) {
    const matches = matchCommands(prefix);
    setSuggestions(matches.slice(0, 8)); // max 8 suggestions
    setSelectedIndex(0);
    setShowSuggestions(matches.length > 0);
  } else {
    setShowSuggestions(false);
  }
}, []);
```

### Keyboard handler additions:
```typescript
// In handleKeyDown, add before existing handlers:
if (e.key === 'Tab') {
  e.preventDefault();
  if (suggestions.length > 0) {
    const cmd = suggestions[selectedIndex];
    setInput(cmd.name + ' ');
    setShowSuggestions(false);
  }
  return;
}

if (e.key === 'ArrowDown' && showSuggestions) {
  e.preventDefault();
  setSelectedIndex((prev) => (prev + 1) % suggestions.length);
  return;
}

if (e.key === 'ArrowUp') {
  if (showSuggestions) {
    e.preventDefault();
    setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    return;
  }
  // existing history navigation...
}

// On Enter, if suggestions visible and item selected, use it
if (e.key === 'Enter') {
  if (showSuggestions && suggestions.length > 0) {
    const cmd = suggestions[selectedIndex];
    setInput(cmd.name + ' ');
    setShowSuggestions(false);
    return;
  }
  // existing sendCommand...
}

// Escape to close suggestions
if (e.key === 'Escape') {
  setShowSuggestions(false);
  return;
}
```

### Render additions:
```typescript
{/* Input bar with autocomplete */}
<div style={{ position: 'relative', zIndex: 2 }}>
  {showSuggestions && (
    <Autocomplete
      matches={suggestions}
      selectedIndex={selectedIndex}
      theme={t}
      onSelect={(cmd) => {
        setInput(cmd.name + ' ');
        setShowSuggestions(false);
        inputRef.current?.focus();
      }}
      onHover={(i) => setSelectedIndex(i)}
    />
  )}
  <div style={st.inputBar}>
    {/* existing input... */}
  </div>
</div>
```

---

## 4. Testing Plan

### Unit Tests (`tests/unit/Autocomplete.test.tsx`)

| Test | What it checks |
|------|---------------|
| `renders nothing when matches empty` | `matches=[]` → no DOM output |
| `renders command list` | Shows name, aliases, description |
| `highlights selected item` | `selectedIndex=1` has correct styles |
| `calls onSelect when clicked` | Click fires with correct CommandInfo |
| `calls onHover when mouse enters` | Hover fires with correct index |
| `respects theme colors` | Background, border, text colors applied |

### Integration Tests (`tests/unit/Terminal.autocomplete.test.tsx`)

| Test | What it checks |
|------|---------------|
| `shows suggestions when typing 'l'` | Matches `look`, `level`, `learn`, `lian` |
| `shows suggestions for aliases` | Typing `s` matches `south`, `say`, `sell`, `shout`, `skills`, `shop` |
| `hides suggestions after space` | `look ` → no suggestions |
| `hides suggestions on Escape` | Escape key clears dropdown |
| `Tab completes selected command` | Tab inserts command name + space |
| `Enter completes selected command` | Enter inserts command name + space |
| `ArrowDown cycles through suggestions` | Down arrow moves selection |
| `ArrowUp cycles through suggestions` | Up arrow moves selection (wraps) |
| `click selects command` | Clicking suggestion inserts it |
| `suggestions capped at 8 items` | Many matches → only 8 shown |
| `suggestions sorted by relevance` | Exact match first, then prefix, then alias |
| `no suggestions for unknown prefix` | `xyz` → no dropdown |
| `suggestions work with command history` | ArrowUp for history doesn't conflict with suggestions |
| `mobile: suggestions render correctly` | Small viewport → dropdown fits |

### Edge Cases to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| Type `l` then backspace to `` | Suggestions disappear |
| Type `look` then space | Suggestions disappear |
| Type `look` then Enter | Sends `look` command (not autocomplete) |
| Rapid typing | Debounced: only last input triggers match |
| Command with no aliases | No alias text shown |
| Very long description | Truncated with ellipsis |
| Theme switch while open | New theme colors applied |

---

## 5. Implementation Steps (Order)

1. **Create `src/lib/commands.ts`** — static registry with `findCommand` and `matchCommands`
2. **Write unit tests for `commands.ts`** — verify matching logic, sorting, edge cases
3. **Create `src/components/Autocomplete.tsx`** — pure presentational component
4. **Write unit tests for `Autocomplete.tsx`** — render, selection, click, hover
5. **Modify `src/components/Terminal.tsx`** — integrate autocomplete state and handlers
6. **Write integration tests** — Terminal + Autocomplete working together
7. **Run full test suite** — ensure no regressions
8. **Manual QA** — test in browser with various inputs

---

## 6. Estimated Effort

| Task | Time |
|------|------|
| Command registry + unit tests | 1 hour |
| Autocomplete component + unit tests | 1 hour |
| Terminal integration | 1 hour |
| Integration tests | 1 hour |
| Manual QA / polish | 1 hour |
| **Total** | **~5 hours** |

---

## 7. Acceptance Criteria

- [ ] Typing any command prefix shows matching suggestions within 100ms
- [ ] Tab/Enter/Click selects a suggestion and inserts command name + space
- [ ] Arrow keys navigate suggestions without interfering with command history
- [ ] Escape closes suggestions
- [ ] Suggestions disappear after typing a space (entering arguments)
- [ ] Works on mobile (touch targets ≥ 44px, readable font sizes)
- [ ] All new tests pass
- [ ] All existing tests still pass (no regressions)
- [ ] Code follows existing project patterns (inline styles, no external CSS)
