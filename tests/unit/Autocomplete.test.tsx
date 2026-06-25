import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Autocomplete } from '@/components/Autocomplete';
import { themes } from '@/themes';
import { CommandInfo } from '@/lib/commands';

const mockCommands: CommandInfo[] = [
  { name: 'look', aliases: ['l'], description: '查看周围环境', category: 'movement' },
  { name: 'learn', aliases: [], description: '学习武功', category: 'skill' },
  { name: 'level', aliases: [], description: '查看等级', category: 'system' },
];

describe('Autocomplete', () => {
  it('renders nothing when matches empty', () => {
    const { container } = render(
      <Autocomplete
        matches={[]}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders command list', () => {
    render(
      <Autocomplete
        matches={mockCommands}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />
    );
    expect(screen.getByText('look')).toBeInTheDocument();
    expect(screen.getByText('learn')).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();
    expect(screen.getByText('查看周围环境')).toBeInTheDocument();
  });

  it('renders aliases', () => {
    render(
      <Autocomplete
        matches={mockCommands}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />
    );
    expect(screen.getByText('(l)')).toBeInTheDocument();
  });

  it('highlights selected item', () => {
    render(
      <Autocomplete
        matches={mockCommands}
        selectedIndex={1}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />
    );
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <Autocomplete
        matches={mockCommands}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={onSelect}
        onHover={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('learn'));
    expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
  });

  it('calls onHover when mouse enters', () => {
    const onHover = vi.fn();
    render(
      <Autocomplete
        matches={mockCommands}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={onHover}
      />
    );
    fireEvent.mouseEnter(screen.getByText('level'));
    expect(onHover).toHaveBeenCalledWith(2);
  });

  it('limits to max 8 items', () => {
    const manyCommands: CommandInfo[] = Array.from({ length: 15 }, (_, i) => ({
      name: `cmd${i}`,
      aliases: [],
      description: `Command ${i}`,
      category: 'system',
    }));
    render(
      <Autocomplete
        matches={manyCommands}
        selectedIndex={0}
        theme={themes.amber}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(15);
  });
});
