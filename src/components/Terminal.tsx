import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Theme } from '../themes';

interface TerminalProps {
  theme: Theme;
}

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
        `  ╔════════════════════════════╗`,
        `  ║    ★ 炎黄群侠传 ★        ║`,
        `  ║    Web MUD Phase 1        ║`,
        `  ╠════════════════════════════╣`,
        `  ║  输入 help 查看可用命令    ║`,
        `  ║  #tokyo | #catppuccin | #amber  ║`,
        `  ╚════════════════════════════╝`,
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

  const s = styles(theme);
  const dotColor = connected ? theme.success : theme.error;

  return (
    <div style={s.container} onClick={handleContainerClick}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>炎黄群侠传</h1>
        <div style={s.headerRight}>
          <span style={s.themeBadge}>{theme.name}</span>
          <span style={s.status}>
            <span style={{ ...s.dot, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
            <span style={s.statusLabel}>{connected ? '在线' : '断开'}</span>
          </span>
        </div>
      </div>

      {/* Output */}
      <div ref={outputRef} style={s.output}>
        {lines.join('\n')}
      </div>

      {/* Input bar */}
      <div style={s.inputBar}>
        <span style={s.prompt}>&gt;</span>
        <input
          ref={inputRef}
          style={s.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
          autoFocus
          autoComplete="off"
        />
        <button style={s.sendBtn} onClick={sendCommand}>
          发送
        </button>
      </div>
    </div>
  );
}

function styles(t: Theme) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100vh',
      background: t.bg,
      color: t.fg,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.6,
      overflow: 'hidden',
    },
    header: {
      background: t.bgDark,
      padding: '10px 16px',
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    },
    title: {
      color: t.accent,
      fontSize: 15,
      letterSpacing: 3,
      textShadow: t.glow,
      margin: 0,
      fontWeight: 600 as const,
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    },
    themeBadge: {
      color: t.fgDim,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      opacity: 0.7,
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
      flex: 1,
      overflowY: 'auto' as const,
      padding: '14px 18px',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
      scrollBehavior: 'smooth' as const,
    },
    inputBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      background: t.bgDark,
      borderTop: `1px solid ${t.border}`,
      flexShrink: 0,
    },
    prompt: {
      color: t.prompt,
      fontWeight: 'bold' as const,
      fontSize: 15,
      flexShrink: 0,
    },
    input: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      color: t.fg,
      fontFamily: 'inherit',
      fontSize: 14,
      outline: 'none',
      caretColor: t.accent,
    },
    sendBtn: {
      background: t.bg,
      color: t.accent,
      border: `1px solid ${t.border}`,
      padding: '4px 16px',
      borderRadius: 3,
      fontFamily: 'inherit',
      fontSize: 13,
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'all 0.15s',
    },
  };
}
