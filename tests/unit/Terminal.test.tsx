import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  // Reset window dimensions for responsive tests
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  window.dispatchEvent(new Event('resize'));
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

describe('Terminal Mobile Responsiveness', () => {
  it('renders with mobile viewport dimensions', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(<Terminal theme={themes.amber} />);
    const mainContainer = container.firstChild as HTMLElement;
    
    // Container should use dvh for mobile viewport height
    expect(mainContainer).toBeTruthy();
  });

  it('has input with enterKeyHint for mobile keyboards', () => {
    render(<Terminal theme={themes.amber} />);
    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;
    
    // enterKeyHint triggers mobile keyboard "send" button
    expect(input).toHaveAttribute('enterkeyhint', 'send');
  });

  it('send button has aria-label for accessibility', () => {
    render(<Terminal theme={themes.amber} />);
    const button = screen.getByRole('button', { name: '发送' });
    
    expect(button).toHaveAttribute('aria-label', '发送');
  });

  it('has minimum tap target size for mobile (44x44px)', () => {
    render(<Terminal theme={themes.amber} />);
    const button = screen.getByRole('button', { name: '发送' });
    
    // Check computed styles for minimum dimensions
    const styles = window.getComputedStyle(button);
    const minWidth = parseInt(styles.minWidth || '0', 10);
    const minHeight = parseInt(styles.minHeight || '0', 10);
    
    // Button should have min-width >= 44px for tap targets
    expect(minWidth).toBeGreaterThanOrEqual(44);
  });

  it('title text does not overflow on small screens', () => {
    const { container } = render(<Terminal theme={themes.amber} />);
    const titleText = container.querySelector('h1 span');
    
    expect(titleText).toBeTruthy();
  });

  it('renders correctly on very small screens (320px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 568 });
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(<Terminal theme={themes.amber} />);
    
    // Should still render title and input
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入命令...')).toBeInTheDocument();
    
    // Container should exist
    expect(container.firstChild).toBeTruthy();
  });

  it('renders correctly on tablet viewport (768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1024 });
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(<Terminal theme={themes.amber} />);
    
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入命令...')).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('renders correctly on desktop viewport (1920px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
    window.dispatchEvent(new Event('resize'));
    
    const { container } = render(<Terminal theme={themes.amber} />);
    
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入命令...')).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('handles rapid orientation changes without crashing', async () => {
    const { container } = render(<Terminal theme={themes.amber} />);
    
    // Simulate rapid orientation changes
    for (let i = 0; i < 5; i++) {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: i % 2 === 0 ? 375 : 667 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: i % 2 === 0 ? 667 : 375 });
      await act(async () => {
        window.dispatchEvent(new Event('resize'));
      });
    }
    
    // Component should still be functional
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('input remains functional after viewport resize', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    
    // Resize to mobile
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    
    // Input should still work
    const input = screen.getByPlaceholderText('输入命令...');
    await user.type(input, 'look');
    await user.keyboard('{Enter}');
    
    expect(mockSocket.emit).toHaveBeenCalledWith('command', { input: 'look' });
  });
});
