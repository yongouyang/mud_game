/**
 * Parses raw player input and returns the output text.
 * Returns '__CLEAR__' when the screen should be cleared.
 */
export function handleCommand(input: string, _playerId: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const [cmd] = trimmed.split(/\s+/);

  switch (cmd?.toLowerCase()) {
    case 'look':
    case 'l':
      return '\n  ☆ 炎黄群侠传 ☆\n\n  你站在一片空旷的练武场中。\n  地面铺着青石板，四周立着木人桩。\n  北边通向山门，南边是无名小镇。\n\n  这里没有任何明显的出口方向。\n';

    case 'hp':
      return '\n  ─── 状态信息 ───\n\n  气血   ████████████████████  100%\n  内力   ████████████          60%\n  精力   ██████████████        70%\n';

    case 'who':
      return '\n  当前在线玩家：\n  ───────────────\n  你（游客）\n';

    case 'help':
      return '\n  ─── 可用命令 ───\n\n  look    查看四周\n  hp      查看状态\n  who     在线玩家\n  help    显示帮助\n  clear   清屏\n';

    case 'clear':
      return '__CLEAR__';

    default:
      return `\n  什么？"${trimmed}"——你自言自语道。\n  （输入 help 查看可用命令）\n`;
  }
}
