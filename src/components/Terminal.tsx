import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Theme } from '../themes';

interface TerminalProps {
  theme: Theme;
}

/** Tiny embedded SVG noise for parchment grain — ~200 bytes */
const NOISE_SVG =
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

export function Terminal({ theme }: TerminalProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      appendLines([
        '',
        '  ╔══════════════════════════╗',
        '  ║   ★  炎 黄 群 侠 传  ★  ║',
        '  ╚══════════════════════════╝',
        '',
        '  输入 help 查看可用命令',
        '',
      ]);
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
    setInput('');
  }, [input]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        sendCommand();
      }
    },
    [sendCommand],
  );

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const st = s(theme);
  const dotColor = connected ? theme.success : theme.error;

  return (
    <div style={st.container} onClick={handleContainerClick}>
      {/* Parchment grain overlay */}
      <div style={st.grainOverlay} />

      {/* Header */}
      <div style={st.header}>
        <h1 style={st.title}>
          <span style={st.titleOrnament}>━</span>
          炎黄群侠传
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

      {/* Input bar — scroll-like double border */}
      <div style={st.inputBar}>
        <span style={st.prompt}>&gt;</span>
        <input
          ref={inputRef}
          style={st.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
          autoFocus
          autoComplete="off"
        />
        <button
          style={st.sendBtn}
          onClick={sendCommand}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.accent;
            e.currentTarget.style.color = theme.bg;
            e.currentTarget.style.borderColor = theme.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.bg;
            e.currentTarget.style.color = theme.accent;
            e.currentTarget.style.borderColor = theme.border;
          }}
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────
function s(t: Theme) {
  return {
    container: {
      position: 'relative' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100vh',
      background: t.bg,
      color: t.fg,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.65,
      overflow: 'hidden',
      isolation: 'isolate' as const,
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
      padding: '12px 20px',
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      boxShadow: `0 1px 8px ${t.bg}88`,
    },
    title: {
      color: t.accent,
      fontSize: 16,
      letterSpacing: 4,
      textShadow: t.glow,
      margin: 0,
      fontWeight: 600 as const,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    titleOrnament: {
      color: t.accentAlt,
      opacity: 0.6,
      fontWeight: 300 as const,
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    },
    status: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
    },
    dot: {
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      transition: 'background 0.3s',
    },
    statusLabel: {
      color: t.fgDim,
    },
    output: {
      position: 'relative' as const,
      zIndex: 2,
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 20px',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
      scrollBehavior: 'smooth' as const,
      boxShadow: `inset 0 8px 12px -12px ${t.bgDark}`,
    },
    inputBar: {
      position: 'relative' as const,
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 20px',
      background: t.bgDark,
      borderTop: `1px solid ${t.accentAlt}33`,
      borderBottom: `2px solid ${t.border}`,
      flexShrink: 0,
      boxShadow: `0 -1px 8px ${t.bgDark}88`,
    },
    prompt: {
      color: t.accentWarm,
      fontWeight: 700 as const,
      fontSize: 15,
      flexShrink: 0,
      textShadow: `0 0 6px ${t.accentWarm}44`,
    },
    input: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      color: t.fg,
      fontFamily: 'inherit',
      fontSize: 14,
      outline: 'none',
      caretColor: t.accentWarm,
      lineHeight: '1.65',
    },
    sendBtn: {
      background: t.bg,
      color: t.accent,
      border: `1px solid ${t.border}`,
      padding: '5px 18px',
      borderRadius: 2,
      fontFamily: 'inherit',
      fontSize: 13,
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'all 0.15s',
      letterSpacing: 1,
    },
  };
}
