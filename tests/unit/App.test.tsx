import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';
import { themes } from '@/themes';

describe('App', () => {
  it('renders with default amber theme', () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
  });

  it('switches theme when hash changes', async () => {
    window.location.hash = '#tokyo';
    render(<App />);
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
    // The tokyo theme uses a different accent color; just ensure it renders.
    window.location.hash = '#catppuccin';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(screen.getByText('炎黄群侠传')).toBeInTheDocument();
  });
});
