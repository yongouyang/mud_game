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
});

function trigger(event: string, data?: any) {
  if (mockHandlers[event]) mockHandlers[event](data);
}

describe('Terminal Autocomplete', () => {
  it('shows suggestions when typing a command prefix', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 'l');
    });

    await waitFor(() => {
      expect(screen.getByText('look')).toBeInTheDocument();
      expect(screen.getByText('learn')).toBeInTheDocument();
      expect(screen.getByText('level')).toBeInTheDocument();
    });
  });

  it('hides suggestions after typing a space', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 'look');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    await act(async () => {
      await userEvent.type(input, ' ');
    });
    await waitFor(() => {
      expect(screen.queryByText('learn')).not.toBeInTheDocument();
    });
  });

  it('selects suggestion with Tab key', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;
    await act(async () => {
      await userEvent.type(input, 'l');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    await act(async () => {
      await userEvent.keyboard('{Tab}');
    });

    expect(input.value).toBe('learn ');
  });

  it('selects suggestion with Enter when suggestions visible', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;
    await act(async () => {
      await userEvent.type(input, 'l');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    await act(async () => {
      await userEvent.keyboard('{Enter}');
    });

    expect(input.value).toBe('learn ');
  });

  it('navigates suggestions with arrow keys', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 'l');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      await userEvent.keyboard('{ArrowDown}');
    });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      await userEvent.keyboard('{ArrowUp}');
    });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes suggestions with Escape key', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 'l');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    await act(async () => {
      await userEvent.keyboard('{Escape}');
    });

    await waitFor(() => {
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });

  it('shows alias in suggestions', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 'look');
    });

    await waitFor(() => {
      expect(screen.getByText('(l)')).toBeInTheDocument();
    });
  });

  it('limits suggestions to 8 items', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...');
    await act(async () => {
      await userEvent.type(input, 's');
    });

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.length).toBeLessThanOrEqual(8);
    });
  });

  it('clicking suggestion selects it', async () => {
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;
    await act(async () => {
      await userEvent.type(input, 'l');
    });
    await waitFor(() => expect(screen.getByText('look')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByText('learn'));
    });

    expect(input.value).toBe('learn ');
  });

  it('history navigation still works when no suggestions', async () => {
    const user = userEvent.setup();
    render(<Terminal theme={themes.amber} />);
    trigger('connect');
    await waitFor(() => expect(screen.getByText('在线')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('输入命令...') as HTMLInputElement;

    // Send a command to add to history
    await user.type(input, 'look ');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockSocket.emit).toHaveBeenCalled());

    // Clear input
    await user.clear(input);

    // ArrowUp should recall history when no suggestions
    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('look');
  });
});
