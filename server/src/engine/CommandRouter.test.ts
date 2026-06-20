import { describe, it, expect } from 'vitest';
import { handleCommand } from './CommandRouter.js';

describe('CommandRouter', () => {
  describe('known commands', () => {
    it('look returns room description', () => {
      const output = handleCommand('look', 'test-player');
      expect(output).toContain('炎黄群侠传');
      expect(output).toContain('练武场');
    });

    it('l is an alias for look', () => {
      const output = handleCommand('l', 'test-player');
      expect(output).toContain('炎黄群侠传');
      expect(output).toContain('练武场');
    });

    it('hp returns status info', () => {
      const output = handleCommand('hp', 'test-player');
      expect(output).toContain('状态信息');
      expect(output).toContain('气血');
      expect(output).toContain('内力');
      expect(output).toContain('精力');
    });

    it('who returns online players', () => {
      const output = handleCommand('who', 'test-player');
      expect(output).toContain('在线玩家');
      expect(output).toContain('游客');
    });

    it('help lists available commands', () => {
      const output = handleCommand('help', 'test-player');
      expect(output).toContain('look');
      expect(output).toContain('hp');
      expect(output).toContain('who');
      expect(output).toContain('help');
      expect(output).toContain('clear');
    });

    it('clear returns special clear token', () => {
      const output = handleCommand('clear', 'test-player');
      expect(output).toBe('__CLEAR__');
    });
  });

  describe('input handling', () => {
    it('empty string returns empty string', () => {
      expect(handleCommand('', 'test-player')).toBe('');
    });

    it('whitespace-only input returns empty string', () => {
      expect(handleCommand('   ', 'test-player')).toBe('');
    });

    it('leading/trailing whitespace is trimmed', () => {
      const output = handleCommand('  look  ', 'test-player');
      expect(output).toContain('炎黄群侠传');
    });

    it('commands are case-insensitive', () => {
      expect(handleCommand('LOOK', 'test-player')).toContain('炎黄群侠传');
      expect(handleCommand('L', 'test-player')).toContain('炎黄群侠传');
      expect(handleCommand('Hp', 'test-player')).toContain('状态信息');
      expect(handleCommand('HELP', 'test-player')).toContain('look');
    });
  });

  describe('unknown commands', () => {
    it('returns confused response for gibberish', () => {
      const output = handleCommand('xyzzy', 'test-player');
      expect(output).toContain('什么');
      expect(output).toContain('help');
    });

    it('returns confused response for unknown verbs', () => {
      const output = handleCommand('fly', 'test-player');
      expect(output).toContain('什么');
    });

    it('mentions the command the user typed', () => {
      const output = handleCommand('dance', 'test-player');
      expect(output).toContain('dance');
    });
  });
});
