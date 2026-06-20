import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

describe('Terminal UI', () => {
  it('renders the game title', () => {
    render(<App />);
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
  });

  it('renders the input bar with prompt', () => {
    render(<App />);
    expect(screen.getByText('>')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入命令...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument();
  });

  it('shows disconnected status initially', () => {
    render(<App />);
    expect(screen.getByText('断开')).toBeInTheDocument();
  });

  it('has an auto-focused input', () => {
    render(<App />);
    const input = screen.getByPlaceholderText('输入命令...');
    expect(input).toHaveFocus();
  });

  it('send button is present', () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: '发送' });
    expect(btn).toBeInTheDocument();
  });

  it('input accepts text', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByPlaceholderText('输入命令...');
    await user.type(input, 'look');
    expect(input).toHaveValue('look');
  });
});
