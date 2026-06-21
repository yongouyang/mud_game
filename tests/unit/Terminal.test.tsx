import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { io } from 'socket.io-client';
import { Terminal } from '@/components/Terminal';
import { themes } from '@/themes';

let mockHandlers: Record<string, Function> = {};
let mockSocket: any;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

beforeEach(() => {
  mockHandlers = {};
  mockSocket = {
    on: vi.fn((event: string, cb: Function) => { mockHandlers[event] = cb; }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    off: vi.fn(),
  };
  sessionStorage.clear();
});

function trigger(event: string, data?: any) {
  mockHandlers[event]?.(data);
}

describe('Terminal UI', () => {
  it('renders the game title and status', () => {
    render(<Terminal theme={themes.amber} />);
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    expect(screen.getByText('断开')).toBeInTheDocument();
  });

  it('shows connected status after connect event', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => {
      expect(screen.getByText('在线')).toBeInTheDocument();
    });
  });

  it('emits command when pressing Enter', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...');
    await user.type(input, 'look');
    await user.keyboard('{Enter}');
    expect(mockSocket.emit).toHaveBeenCalledWith('command', { input: 'look' });
    expect(input).toHaveValue('');
    expect(screen.getByText('> look')).toBeInTheDocument();
  });

  it('does not emit empty commands', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...');
    await user.keyboard('{Enter}');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('emits command when clicking send button', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...');
    await user.type(input, 'help');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('command', { input: 'help' });
  });

  it('displays server output', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('output', { text: '你好，侠客。' });
    await waitFor(() => {
      expect(screen.getByText('你好，侠客。')).toBeInTheDocument();
    });
  });

  it('clears output on __CLEAR__ message', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('output', { text: 'line one' });
    await waitFor(() => expect(screen.getByText('line one')).toBeInTheDocument());
    trigger('output', { text: '__CLEAR__' });
    await waitFor(() => {
      expect(screen.queryByText('line one')).not.toBeInTheDocument();
    });
  });

  it('navigates command history with arrow keys', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;
    await user.type(input, 'first');
    await user.keyboard('{Enter}');
    await user.type(input, 'second');
    await user.keyboard('{Enter}');

    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('second');
    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('first');
    await user.keyboard('{ArrowDown}');
    expect(input.value).toBe('second');
    await user.keyboard('{ArrowDown}');
    expect(input.value).toBe('');
  });

  it('persists command history in sessionStorage', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...');
    await user.type(input, 'saveme');
    await user.keyboard('{Enter}');
    expect(sessionStorage.getItem('wuxia-cmd-history')).toContain('saveme');
  });
});
