export interface CommandInfo {
  name: string;
  aliases: string[];
  description: string;
  usage?: string;
  category: 'movement' | 'combat' | 'inventory' | 'social' | 'system' | 'skill' | 'quest' | 'guild';
}

export const COMMANDS: CommandInfo[] = [
  { name: 'look', aliases: ['l'], description: '查看周围环境或目标', usage: 'look [目标]', category: 'movement' },
  { name: 'north', aliases: ['n'], description: '向北移动', category: 'movement' },
  { name: 'south', aliases: ['s'], description: '向南移动', category: 'movement' },
  { name: 'east', aliases: ['e'], description: '向东移动', category: 'movement' },
  { name: 'west', aliases: ['w'], description: '向西移动', category: 'movement' },
  { name: 'up', aliases: ['u'], description: '向上移动', category: 'movement' },
  { name: 'down', aliases: ['d'], description: '向下移动', category: 'movement' },
  { name: 'hp', aliases: ['score'], description: '查看状态', category: 'system' },
  { name: 'skills', aliases: [], description: '查看武功技能', category: 'skill' },
  { name: 'inventory', aliases: ['i'], description: '查看背包', category: 'inventory' },
  { name: 'get', aliases: [], description: '捡起物品', usage: 'get <物品>', category: 'inventory' },
  { name: 'drop', aliases: [], description: '丢弃物品', usage: 'drop <物品>', category: 'inventory' },
  { name: 'wear', aliases: [], description: '装备物品', usage: 'wear <物品>', category: 'inventory' },
  { name: 'remove', aliases: [], description: '卸下物品', usage: 'remove <物品>', category: 'inventory' },
  { name: 'use', aliases: [], description: '使用物品', usage: 'use <物品>', category: 'inventory' },
  { name: 'kill', aliases: ['hit'], description: '攻击目标', usage: 'kill <目标>', category: 'combat' },
  { name: 'flee', aliases: [], description: '逃跑', category: 'combat' },
  { name: 'learn', aliases: [], description: '学习武功', usage: 'learn <武功名>', category: 'skill' },
  { name: 'practice', aliases: ['lian'], description: '练习武功', usage: 'practice <武功名>', category: 'skill' },
  { name: 'perform', aliases: ['pfm'], description: '施展招式', usage: 'perform <招式>', category: 'skill' },
  { name: 'exert', aliases: ['yun'], description: '运功', usage: 'exert <功法>', category: 'skill' },
  { name: 'dazuo', aliases: ['exercise', 'tuna'], description: '打坐练功', category: 'skill' },
  { name: 'ask', aliases: [], description: '向NPC询问', usage: 'ask <NPC>', category: 'quest' },
  { name: 'quest', aliases: [], description: '任务相关', category: 'quest' },
  { name: 'buy', aliases: [], description: '购买物品', usage: 'buy <物品>', category: 'inventory' },
  { name: 'sell', aliases: [], description: '出售物品', usage: 'sell <物品>', category: 'inventory' },
  { name: 'shop', aliases: ['list'], description: '查看商店', category: 'inventory' },
  { name: 'bank', aliases: ['cunkuan'], description: '查看存款', category: 'system' },
  { name: 'deposit', aliases: [], description: '存钱', usage: 'deposit <数量>', category: 'system' },
  { name: 'withdraw', aliases: [], description: '取钱', usage: 'withdraw <数量>', category: 'system' },
  { name: 'auction', aliases: [], description: '拍卖行', category: 'system' },
  { name: 'craft', aliases: [], description: '合成物品', usage: 'craft <配方>', category: 'inventory' },
  { name: 'schools', aliases: [], description: '查看门派', category: 'skill' },
  { name: 'join', aliases: [], description: '加入门派', usage: 'join <门派>', category: 'skill' },
  { name: 'level', aliases: [], description: '查看等级信息', category: 'system' },
  { name: 'who', aliases: [], description: '查看在线玩家', category: 'social' },
  { name: 'say', aliases: [], description: '说话', usage: 'say <内容>', category: 'social' },
  { name: 'tell', aliases: [], description: '私聊', usage: 'tell <玩家> <内容>', category: 'social' },
  { name: 'shout', aliases: [], description: '大喊', usage: 'shout <内容>', category: 'social' },
  { name: 'chat', aliases: [], description: '频道聊天', usage: 'chat <内容>', category: 'social' },
  { name: 'whisper', aliases: [], description: '耳语', usage: 'whisper <玩家> <内容>', category: 'social' },
  { name: 'give', aliases: [], description: '给予物品', usage: 'give <玩家> <物品>', category: 'inventory' },
  { name: 'mail', aliases: [], description: '发送邮件', usage: 'mail <玩家> <内容>', category: 'social' },
  { name: 'checkmail', aliases: [], description: '查看邮件', category: 'social' },
  { name: 'readmail', aliases: [], description: '阅读邮件', usage: 'readmail <ID>', category: 'social' },
  { name: 'friend', aliases: [], description: '好友管理', usage: 'friend <add/remove> <玩家>', category: 'social' },
  { name: 'guild', aliases: [], description: '帮派管理', category: 'guild' },
  { name: 'help', aliases: [], description: '查看帮助', category: 'system' },
  { name: 'clear', aliases: [], description: '清屏', category: 'system' },
  { name: 'tianfu', aliases: ['setattr'], description: '设置天赋', usage: 'tianfu <属性> <值>', category: 'system' },
  { name: 'gm', aliases: [], description: 'GM命令', category: 'system' },
];

// Build lookup maps for O(1) access
const byName = new Map<string, CommandInfo>();
const byAlias = new Map<string, CommandInfo>();

for (const cmd of COMMANDS) {
  byName.set(cmd.name, cmd);
  for (const alias of cmd.aliases) {
    byAlias.set(alias, cmd);
  }
}

export function findCommand(input: string): CommandInfo | undefined {
  const [first] = input.trim().toLowerCase().split(/\s+/);
  return byName.get(first) || byAlias.get(first);
}

export function matchCommands(prefix: string): CommandInfo[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];

  return COMMANDS.filter(cmd =>
    cmd.name.startsWith(p) ||
    cmd.aliases.some(a => a.startsWith(p))
  ).sort((a, b) => {
    // Exact match first, then name match, then alias match
    const aExact = a.name === p;
    const bExact = b.name === p;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const aName = a.name.startsWith(p);
    const bName = b.name.startsWith(p);
    if (aName !== bName) return aName ? -1 : 1;

    return a.name.localeCompare(b.name);
  });
}
