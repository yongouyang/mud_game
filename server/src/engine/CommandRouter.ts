import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { PlayerAttributes, ATTRIBUTE_NAMES } from '../models/Player.js';

const ATTR_KEY_BY_NAME: Record<string, keyof PlayerAttributes> = {};
for (const [key, name] of Object.entries(ATTRIBUTE_NAMES)) {
  ATTR_KEY_BY_NAME[name] = key as keyof PlayerAttributes;
  ATTR_KEY_BY_NAME[key] = key as keyof PlayerAttributes; // English alias
  ATTR_KEY_BY_NAME[key.toUpperCase()] = key as keyof PlayerAttributes; // uppercase
}

export class CommandRouter {
  constructor(
    private players: PlayerManager,
    private map: MapSystem,
    private combat: CombatSystem,
  ) {}

  handle(input: string, playerId: string): string {
    const trimmed = input.trim();

    const player = this.players.getPlayer(playerId);
    if (!player) return '\n  系统错误：找不到玩家数据。\n';

    // Character creation flow — intercept everything until done
    if (player.state === 'creating') {
      return this.handleCreating(player, trimmed);
    }

    if (!trimmed) return '';

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const cmdLower = cmd?.toLowerCase() || '';

    // Movement commands (direction words → try to move)
    const moveResult = this.map.movePlayer(player.currentRoom, cmdLower);
    if (moveResult.success && moveResult.newRoomId) {
      player.currentRoom = moveResult.newRoomId;
      const others = this.players.getPlayersInRoom(moveResult.newRoomId).filter((p) => p.id !== playerId);
      let msg = moveResult.message;
      if (others.length > 0) {
        msg += `\n  这里还有：${others.map((p) => p.name).join('、')}\n`;
      }
      return msg;
    }
    // If it was a recognized direction word but no exit, return the error
    if (this.map.resolveDirection(cmdLower) && moveResult.message) {
      return moveResult.message;
    }

    // Combat commands (during fighting, only allow hit/kill and status)
    if (player.state === 'fighting') {
      return this.handleCombat(player, cmdLower, rest);
    }

    // Standard commands
    switch (cmdLower) {
      case 'look':
      case 'l':
        return this.handleLook(player);
      case 'hp':
        return this.players.formatStatus(player);
      case 'score':
        return this.players.formatStatus(player);
      case 'who':
        return this.handleWho(player);
      case 'help':
        return this.handleHelp();
      case 'clear':
        return '__CLEAR__';
      case 'kill':
      case 'hit':
        return this.handleKill(player, rest[0] || '');
      default:
        return `\n  什么？"${trimmed}"——你自言自语道。\n  （输入 help 查看可用命令）\n`;
    }
  }

  // ── Character Creation ──────────────────────────────────

  private handleCreating(player: import('../models/Player.js').Player, trimmed: string): string {
    const [cmd, ...args] = trimmed.split(/\s+/);
    const cmdLower = cmd?.toLowerCase() || '';

    // Empty input → show current state
    if (!cmdLower) {
      return this.players.formatCreatingPrompt(player);
    }

    if (cmdLower === 'help') {
      return '\n  创建角色流程：\n  1. 输入你的名字（2-6个中文字）\n  2. 分配属性点数（剩余10点）\n     set 臂力 15\n  3. 输入 done 完成创建\n';
    }
    if (cmdLower === 'done') {
      const err = this.players.finalizePlayer(player.id);
      if (err) return `\n  ${err}\n`;
      const p = this.players.getPlayer(player.id)!;
      const room = this.map.getRoom(p.currentRoom);
      return `\n  角色创建成功！\n\n  你踏入了武侠世界……\n${room ? this.map.formatRoom(room) : ''}`;
    }
    if (cmdLower === 'set' && args.length >= 2) {
      const chineseName = args[0];
      const attrKey = ATTR_KEY_BY_NAME[chineseName];
      const value = parseInt(args[1] || '', 10);
      if (!attrKey) {
        return `\n  没有"${chineseName}"这个属性。可选：臂力、悟性、根骨、身法\n`;
      }
      if (isNaN(value) || value < 5 || value > 20) {
        return '\n  属性值须为 5-20 的整数。\n';
      }
      // Calculate remaining points
      const current = player.attributes;
      const used = current.str + current.int + current.con + current.dex - 40; // 40 = 4*10 default
      const newAttr = { ...current, [attrKey]: value };
      const newUsed = newAttr.str + newAttr.int + newAttr.con + newAttr.dex - 40;
      if (newUsed > 10) {
        return `\n  可用点数不足！已用 ${used}/10，调整后 ${newUsed}/10。\n`;
      }
      player.attributes = newAttr;
      return this.players.formatCreatingPrompt(player);
    }
    // If no name set yet, treat input as name
    if (!player.name) {
      const err = this.players.setPlayerName(player.id, trimmed);
      if (err) return `\n  ${err}\n`;
      return this.players.formatCreatingPrompt(player);
    }
    // Has name but unknown command
    return `\n  未知命令。可用：set <属性> <值> | done | help\n${this.players.formatCreatingPrompt(player)}`;
  }

  // ── Standard Commands ───────────────────────────────────

  private handleLook(player: import('../models/Player.js').Player): string {
    const room = this.map.getRoom(player.currentRoom);
    if (!room) return '\n  你在一片虚无之中……\n';
    const others = this.players.getPlayersInRoom(player.currentRoom).filter((p) => p.id !== player.id);
    let msg = this.map.formatRoom(room);
    if (others.length > 0) {
      msg += `  这里还有：${others.map((p) => p.name).join('、')}\n`;
    }
    return msg;
  }

  private handleWho(_player: import('../models/Player.js').Player): string {
    const online = this.players.getAllPlayers();
    if (online.length === 0) return '\n  当前没有在线玩家。\n';
    const names = online.map((p) => `  ${p.name}`).join('\n');
    return `\n  当前在线玩家（${online.length}人）：\n  ───────────────\n${names}\n`;
  }

  private handleHelp(): string {
    return [
      '',
      '  ─── 可用命令 ───',
      '',
      '  n s e w u d    移动（北南东西上下）',
      '  look            查看四周',
      '  hp              查看状态',
      '  score           查看属性',
      '  kill <目标>     发起战斗',
      '  who             在线玩家',
      '  help            显示帮助',
      '  clear           清屏',
      '',
    ].join('\n') + '\n';
  }

  private handleKill(player: import('../models/Player.js').Player, targetName: string): string {
    if (!targetName) {
      return '\n  你想攻击谁？用法：kill <名字>\n';
    }
    const roomPlayers = this.players.getPlayersInRoom(player.currentRoom);
    const target = roomPlayers.find((p) => p.name === targetName && p.id !== player.id);
    if (!target) {
      return `\n  这里没有叫"${targetName}"的人。\n`;
    }
    if (target.state === 'fighting') {
      return '\n  这个人正在战斗中。\n';
    }

    player.state = 'fighting';
    player.targetEnemy = target.id;
    target.state = 'fighting';
    target.targetEnemy = player.id;

    return (
      `\n  你向 ${target.name} 发起了攻击！\n` +
      this.combat.formatCombatStatus(player, target)
    );
  }

  // ── Combat ──────────────────────────────────────────────

  private handleCombat(player: import('../models/Player.js').Player, cmd: string, _args: string[]): string {
    const targetId = player.targetEnemy;
    if (!targetId) {
      player.state = 'playing';
      return '\n  战斗已结束。\n';
    }
    const target = this.players.getPlayer(targetId);
    if (!target || target.hp <= 0) {
      player.state = 'playing';
      player.targetEnemy = null;
      return '\n  敌人已倒下，战斗结束。\n';
    }

    switch (cmd) {
      case 'hit':
      case 'kill': {
        const result = this.combat.attack(player, target);
        let msg = result.message;
        if (result.defenderDead) {
          player.state = 'playing';
          player.targetEnemy = null;
          target.state = 'playing';
          target.targetEnemy = null;
        } else {
          // Enemy counter-attacks
          const counter = this.combat.attack(target, player);
          msg += counter.message;
          if (counter.defenderDead) {
            player.state = 'playing';
            player.targetEnemy = null;
            target.state = 'playing';
            target.targetEnemy = null;
            player.hp = 1; // Revive with 1 HP
            return msg + `\n  你被击败了……但你挣扎着站了起来（HP 恢复至 1）。\n`;
          }
          msg += this.combat.formatCombatStatus(player, target);
        }
        return msg;
      }
      case 'hp':
        return this.combat.formatCombatStatus(player, target);
      case 'look':
      case 'l':
        return this.combat.formatCombatStatus(player, target);
      default:
        return '\n  战斗中只能使用 hit、hp、look。\n';
    }
  }
}
