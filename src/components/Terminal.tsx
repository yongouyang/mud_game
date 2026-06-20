import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function Terminal() {
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
        '  ╔════════════════════════════╗',
        '  ║    ★ 炎黄群侠传 ★        ║',
        '  ║    Web MUD Phase 1        ║',
        '  ╠════════════════════════════╣',
        '  ║  输入 help 查看可用命令    ║',
        '  ╚════════════════════════════╝',
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

  return (
    <div style={styles.container} onClick={handleContainerClick}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>炎黄群侠传</h1>
        <span style={styles.status}>
          <span
            style={{
              ...styles.dot,
              background: connected ? '#0f0' : '#f33',
              boxShadow: `0 0 6px ${connected ? '#0f0' : '#f33'}`,
            }}
          />
          <span style={styles.statusLabel}>
            {connected ? '在线' : '断开'}
          </span>
        </span>
      </div>

      {/* Output */}
      <div ref={outputRef} style={styles.output}>
        {lines.join('\n')}
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <span style={styles.prompt}>&gt;</span>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
          autoFocus
          autoComplete="off"
        />
        <button style={styles.sendBtn} onClick={sendCommand}>
          发送
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0a0a0a',
    color: '#33ff33',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', 'Fira Code', monospace",
    fontSize: 14,
    lineHeight: 1.55,
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    padding: '10px 16px',
    borderBottom: '1px solid #0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    color: '#0f0',
    fontSize: 15,
    letterSpacing: 2,
    textShadow: '0 0 8px rgba(0,255,0,0.4)',
    margin: 0,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#888',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusLabel: {
    color: '#888',
  },
  output: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    scrollBehavior: 'smooth',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#111',
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  prompt: {
    color: '#0f0',
    fontWeight: 'bold',
    fontSize: 14,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#33ff33',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    caretColor: '#0f0',
  },
  sendBtn: {
    background: '#1a1a1a',
    color: '#0f0',
    border: '1px solid #0f0',
    padding: '4px 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
