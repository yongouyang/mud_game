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
