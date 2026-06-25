import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Theme } from '../themes';
import { CommandInfo, matchCommands } from '../lib/commands';
import { Autocomplete } from './Autocomplete';

interface TerminalProps {
  theme: Theme;
}

const NOISE_SVG =
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

export function Terminal({ theme }: TerminalProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Command history (persisted in sessionStorage)
  const HISTORY_KEY = 'wuxia-cmd-history';
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);
  const historyRef = useRef(history);
  historyRef.current = history;

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<CommandInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('output', (data: { text: string }) => {
      if (data.text === '__CLEAR__') {
        setLines([]);
      } else {
        appendLines(data.text.split('\n'));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const appendLines = useCallback((newLines: string[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  const sendCommand = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !socketRef.current) return;

    setLines((prev) => [...prev, `  > ${trimmed}`]);
    socketRef.current.emit('command', { input: trimmed });

    // Save to history (deduplicate consecutive, cap at 100)
    setHistory((prev) => {
      const next = prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed].slice(-100);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    setHistoryIdx(-1);
    setInput('');
    setShowSuggestions(false);
  }, [input]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setHistoryIdx(-1);

    // Only show suggestions for first word (no space typed yet)
    const trimmed = value.trimStart();
    const spaceIndex = trimmed.indexOf(' ');
    const prefix = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);

    if (prefix && spaceIndex === -1) {
      const matches = matchCommands(prefix).slice(0, 8);
      setSuggestions(matches);
      setSelectedIndex(0);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, []);

  const selectSuggestion = useCallback((cmd: CommandInfo) => {
    setInput(cmd.name + ' ');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab: autocomplete selected suggestion
      if (e.key === 'Tab') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        return;
      }

      // Escape: close suggestions
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }

      // ArrowDown: navigate suggestions or history
      if (e.key === 'ArrowDown') {
        if (showSuggestions) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          return;
        }
        // History navigation (existing behavior)
        e.preventDefault();
        setHistoryIdx((prev) => {
          const next = prev > 0 ? prev - 1 : -1;
          setInput(next >= 0 ? historyRef.current[historyRef.current.length - 1 - next] : '');
          return next;
        });
        return;
      }

      // ArrowUp: navigate suggestions (reverse) or history
      if (e.key === 'ArrowUp') {
        if (showSuggestions) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return;
        }
        // History navigation (existing behavior)
        e.preventDefault();
        setHistoryIdx((prev) => {
          const next = prev < historyRef.current.length - 1 ? prev + 1 : prev;
          setInput(historyRef.current[historyRef.current.length - 1 - next] || '');
          return next;
        });
        return;
      }

      // Enter: send command (or select suggestion if visible)
      if (e.key === 'Enter') {
        if (showSuggestions && suggestions.length > 0) {
          selectSuggestion(suggestions[selectedIndex]);
          return;
        }
        sendCommand();
        return;
      }
    },
    [sendCommand, showSuggestions, suggestions, selectedIndex, selectSuggestion],
  );

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const t = theme;
  const dotColor = connected ? t.success : t.error;
  const st = styles(t);

  return (
    <div style={st.container} onClick={handleContainerClick}>
      <div style={st.grainOverlay} />

      {/* Header */}
      <div style={st.header}>
        <h1 style={st.title}>
          <span style={st.titleOrnament}>━</span>
          <span style={st.titleText}>炎黄群侠传</span>
          <span style={st.titleOrnament}>━</span>
        </h1>
        <div style={st.headerRight}>
          <span style={st.status}>
            <span style={{ ...st.dot, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
            <span style={st.statusLabel}>{connected ? '在线' : '断开'}</span>
          </span>
        </div>
      </div>

      {/* Output */}
      <div ref={outputRef} style={st.output}>
        {lines.join('\n')}
      </div>

      {/* Input bar with autocomplete */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {showSuggestions && (
          <Autocomplete
            matches={suggestions}
            selectedIndex={selectedIndex}
            theme={t}
            onSelect={selectSuggestion}
            onHover={(i) => setSelectedIndex(i)}
          />
        )}
        <div style={st.inputBar}>
          <span style={st.prompt}>&gt;</span>
          <input
            ref={inputRef}
            style={st.input}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            autoFocus
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            style={st.sendBtn}
            onClick={sendCommand}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.accent;
              e.currentTarget.style.color = t.bg;
              e.currentTarget.style.borderColor = t.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.bg;
              e.currentTarget.style.color = t.accent;
              e.currentTarget.style.borderColor = t.border;
            }}
            aria-label="发送"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

function styles(t: Theme) {
  return {
    container: {
      position: 'relative' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100dvh',
      background: t.bg,
      color: t.fg,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.65,
      overflow: 'hidden',
      isolation: 'isolate' as const,
      WebkitTextSizeAdjust: '100%' as const,
    },
    grainOverlay: {
      position: 'absolute' as const,
      inset: 0,
      backgroundImage: NOISE_SVG,
      pointerEvents: 'none' as const,
      zIndex: 1,
    },
    header: {
      position: 'relative' as const,
      zIndex: 2,
      background: `linear-gradient(180deg, ${t.bgDark} 0%, ${t.bg} 100%)`,
      padding: 'clamp(8px, 2vw, 12px) clamp(12px, 4vw, 20px)',
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      boxShadow: `0 1px 8px ${t.bg}88`,
      minHeight: 44,
    },
    title: {
      color: t.accent,
      fontSize: 'clamp(13px, 4vw, 16px)',
      letterSpacing: 'clamp(2px, 1vw, 4px)',
      textShadow: t.glow,
      margin: 0,
      fontWeight: 600 as const,
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(4px, 2vw, 10px)',
      minWidth: 0,
    },
    titleText: {
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },
    titleOrnament: {
      color: t.accentAlt,
      opacity: 0.6,
      fontWeight: 300 as const,
      display: 'inline-block',
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(8px, 2vw, 14px)',
      flexShrink: 0,
    },
    status: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 'clamp(9px, 2.5vw, 11px)',
    },
    dot: {
      display: 'inline-block',
      width: 'clamp(5px, 1.5vw, 7px)',
      height: 'clamp(5px, 1.5vw, 7px)',
      borderRadius: '50%',
      transition: 'background 0.3s',
      flexShrink: 0,
    },
    statusLabel: {
      color: t.fgDim,
      '@media (max-width: 360px)': {
        display: 'none',
      },
    },
    output: {
      position: 'relative' as const,
      zIndex: 2,
      flex: 1,
      overflowY: 'auto' as const,
      padding: 'clamp(8px, 3vw, 20px)',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
      scrollBehavior: 'smooth' as const,
      boxShadow: `inset 0 8px 12px -12px ${t.bgDark}`,
      WebkitOverflowScrolling: 'touch' as const,
      fontSize: 'clamp(12px, 3.5vw, 14px)',
      lineHeight: 'clamp(1.5, 4vw, 1.65)',
    },
    inputBar: {
      position: 'relative' as const,
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(4px, 2vw, 8px)',
      padding: 'clamp(8px, 3vw, 12px) clamp(12px, 4vw, 20px)',
      background: t.bgDark,
      borderTop: `1px solid ${t.accentAlt}33`,
      borderBottom: `2px solid ${t.border}`,
      flexShrink: 0,
      boxShadow: `0 -1px 8px ${t.bgDark}88`,
      minHeight: 44,
      paddingBottom: 'calc(clamp(8px, 3vw, 12px) + env(safe-area-inset-bottom, 0px))',
    },
    prompt: {
      color: t.accentWarm,
      fontWeight: 700 as const,
      fontSize: 'clamp(13px, 3.5vw, 15px)',
      flexShrink: 0,
      textShadow: `0 0 6px ${t.accentWarm}44`,
    },
    input: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      color: t.fg,
      fontFamily: 'inherit',
      fontSize: 16,
      outline: 'none',
      caretColor: t.accentWarm,
      lineHeight: '1.65',
      transform: 'scale(0.875)',
      transformOrigin: 'left center',
      width: 'calc(114.286%)',
      marginRight: 'calc(-14.286%)',
    },
    sendBtn: {
      background: t.bg,
      color: t.accent,
      border: `1px solid ${t.border}`,
      padding: 'clamp(4px, 1.5vw, 5px) clamp(10px, 3vw, 18px)',
      borderRadius: 2,
      fontFamily: 'inherit',
      fontSize: 'clamp(11px, 3vw, 13px)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'all 0.15s',
      letterSpacing: 1,
      minWidth: 44,
      minHeight: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
}
