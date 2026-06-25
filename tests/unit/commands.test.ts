import { describe, it, expect } from 'vitest';
import { findCommand, matchCommands, COMMANDS } from '@/lib/commands';

describe('Command Registry', () => {
  describe('findCommand', () => {
    it('finds by primary name', () => {
      const cmd = findCommand('look');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('look');
    });

    it('finds by alias', () => {
      const cmd = findCommand('l');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('look');
    });

    it('finds with arguments', () => {
      const cmd = findCommand('look north');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('look');
    });

    it('is case-insensitive', () => {
      const cmd = findCommand('LOOK');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('look');
    });

    it('returns undefined for unknown command', () => {
      expect(findCommand('xyz')).toBeUndefined();
    });

    it('finds cunkuan alias for bank', () => {
      const cmd = findCommand('cunkuan');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('bank');
    });
  });

  describe('matchCommands', () => {
    it('returns empty array for empty prefix', () => {
      expect(matchCommands('')).toEqual([]);
    });

    it('returns empty array for whitespace-only prefix', () => {
      expect(matchCommands('   ')).toEqual([]);
    });

    it('matches by name prefix', () => {
      const matches = matchCommands('l');
      const names = matches.map(c => c.name);
      expect(names).toContain('look');
      expect(names).toContain('learn');
      expect(names).toContain('level');
    });

    it('matches by alias prefix', () => {
      const matches = matchCommands('s');
      const names = matches.map(c => c.name);
      expect(names).toContain('south');
      expect(names).toContain('say');
      expect(names).toContain('sell');
      expect(names).toContain('shout');
      expect(names).toContain('skills');
      expect(names).toContain('shop');
    });

    it('sorts exact match first', () => {
      const matches = matchCommands('look');
      expect(matches[0].name).toBe('look');
    });

    it('sorts name matches before alias matches', () => {
      const matches = matchCommands('l');
      const lookIndex = matches.findIndex(c => c.name === 'look');
      const lianIndex = matches.findIndex(c => c.name === 'practice');
      expect(lookIndex).toBeLessThan(lianIndex);
    });

    it('is case-insensitive', () => {
      const lower = matchCommands('l');
      const upper = matchCommands('L');
      expect(upper.map(c => c.name)).toEqual(lower.map(c => c.name));
    });

    it('returns empty for unknown prefix', () => {
      expect(matchCommands('xyz')).toEqual([]);
    });

    it('includes all matching commands', () => {
      const matches = matchCommands('sh');
      const names = matches.map(c => c.name);
      expect(names).toContain('shop');
      expect(names).toContain('shout');
    });
  });

  describe('COMMANDS array', () => {
    it('has no duplicate primary names', () => {
      const names = COMMANDS.map(c => c.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    it('has no duplicate aliases', () => {
      const allAliases = COMMANDS.flatMap(c => c.aliases);
      const unique = new Set(allAliases);
      expect(unique.size).toBe(allAliases.length);
    });

    it('has no alias that matches a primary name', () => {
      const names = new Set(COMMANDS.map(c => c.name));
      for (const cmd of COMMANDS) {
        for (const alias of cmd.aliases) {
          expect(names.has(alias)).toBe(false);
        }
      }
    });
  });
});
