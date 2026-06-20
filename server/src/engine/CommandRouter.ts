import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { Player, PlayerAttributes, ATTRIBUTE_NAMES } from '../models/Player.js';

const ATTR_KEY_BY_NAME: Record<string, keyof PlayerAttributes> = {};
for (const [key, name] of Object.entries(ATTRIBUTE_NAMES)) {
  ATTR_KEY_BY_NAME[name] = key as keyof PlayerAttributes;
  ATTR_KEY_BY_NAME[key] = key as keyof PlayerAttributes;
  ATTR_KEY_BY_NAME[key.toUpperCase()] = key as keyof PlayerAttributes;
}

export class CommandRouter {
  constructor(
    private players: PlayerManager,
    private map: MapSystem,
    private combat: CombatSystem,
    private skills: SkillSystem,
    private items: ItemSystem,
    private npcs: NpcSystem,
  ) {}

  handle(input: string, playerId: string): string {
    const trimmed = input.trim();

    const player = this.players.getPlayer(playerId);
    if (!player) return '\n  系统错误：找不到玩家数据。\n';

    if (player.state === 'creating') {
      return this.handleCreating(player, trimmed);
    }

    if (!trimmed) return '';

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const cmdLower = cmd?.toLowerCase() || '';

    // Movement
    const moveResult = this.map.movePlayer(player.currentRoom, cmdLower);
    if (moveResult.success && moveResult.newRoomId) {
      player.currentRoom = moveResult.newRoomId;
      const others = this.players.getPlayersInRoom(moveResult.newRoomId).filter((p) => p.id !== playerId);
      let msg = moveResult.message;
      msg += this.npcs.formatNpcsInRoom(moveResult.newRoomId);
      if (others.length > 0) msg += `  这里还有：${others.map((p) => p.name).join('、')}\n`;
      // Aggressive NPC check
      const aggressive = this.npcs.getNpcsInRoom(moveResult.newRoomId).filter((n) => n.def.aggressive);
      if (aggressive.length > 0) {
        msg += `\n  ${aggressive[0].def.name} 向你扑了过来！\n  输入 hit 应战！\n`;
      }
      return msg;
    }
    if (this.map.resolveDirection(cmdLower) && moveResult.message) {
      return moveResult.message;
    }

    // Combat
    if (player.state === 'fighting') {
      return this.handleCombat(player, cmdLower, rest);
    }

    // Standard commands
    switch (cmdLower) {
      case 'look': case 'l': return this.handleLook(player);
      case 'hp': case 'score': return this.players.formatStatus(player);
      case 'skills': return this.skills.formatSkills(player);
      case 'i': case 'inventory': return this.items.formatInventory(player);
      case 'who': return this.handleWho(player);
      case 'help': return this.handleHelp();
      case 'clear': return '__CLEAR__';
      case 'kill': case 'hit': return this.handleKill(player, rest);
      case 'get': return this.handleGet(player, rest);
      case 'drop': return this.handleDrop(player, rest);
      case 'use': return this.handleUse(player, rest);
      case 'wear': return this.handleWear(player, rest);
      case 'remove': return this.handleRemove(player, rest);
      case 'learn': return this.handleLearn(player, rest);
      case 'ask': return this.handleAsk(player, rest);
      default:
        return `\n  什么？"${trimmed}"——你自言自语道。\n  （输入 help 查看可用命令）\n`;
    }
  }

  // ── Character Creation ──────────────────────────────────
  private handleCreating(player: Player, trimmed: string): string {
    const [cmd, ...args] = trimmed.split(/\s+/);
    const cmdLower = cmd?.toLowerCase() || '';
    if (!cmdLower) return this.players.formatCreatingPrompt(player);
    if (cmdLower === 'help') return '\n  创建角色流程：\n  1. 输入你的名字（2-6个中文字）\n  2. 分配属性点数\n  3. 输入 done 完成创建\n';
    if (cmdLower === 'done') {
      const err = this.players.finalizePlayer(player.id);
      if (err) return `\n  ${err}\n`;
      const p = this.players.getPlayer(player.id)!;
      const room = this.map.getRoom(p.currentRoom);
      return `\n  角色创建成功！\n\n  你踏入了武侠世界……\n${room ? this.map.formatRoom(room) : ''}`;
    }
    if (cmdLower === 'set' && args.length >= 2) {
      const attrKey = ATTR_KEY_BY_NAME[args[0]];
      const value = parseInt(args[1] || '', 10);
      if (!attrKey) return `\n  没有"${args[0]}"这个属性。\n`;
      if (isNaN(value) || value < 5 || value > 20) return '\n  属性值须为 5-20 的整数。\n';
      const current = player.attributes;
      const newAttr = { ...current, [attrKey]: value };
      const newUsed = newAttr.str + newAttr.int + newAttr.con + newAttr.dex - 40;
      if (newUsed > 10) return `\n  可用点数不足！已用 ${current.str + current.int + current.con + current.dex - 40}/10。\n`;
      player.attributes = newAttr;
      return this.players.formatCreatingPrompt(player);
    }
    if (!player.name) {
      const err = this.players.setPlayerName(player.id, trimmed);
      if (err) return `\n  ${err}\n`;
      return this.players.formatCreatingPrompt(player);
    }
    return `\n  未知命令。可用：set <属性> <值> | done | help\n${this.players.formatCreatingPrompt(player)}`;
  }

  // ── Look / Who / Help ────────────────────────────────────
  private handleLook(player: Player): string {
    const room = this.map.getRoom(player.currentRoom);
    if (!room) return '\n  你在一片虚无之中……\n';
    const others = this.players.getPlayersInRoom(player.currentRoom).filter((p: Player) => p.id !== player.id);
    let msg = this.map.formatRoom(room);
    msg += this.npcs.formatNpcsInRoom(player.currentRoom);
    if (others.length > 0) msg += `  这里还有：${others.map((p: Player) => p.name).join('、')}\n`;
    return msg;
  }

  private handleWho(_player: Player): string {
    const online = this.players.getAllPlayers();
    if (online.length === 0) return '\n  当前没有在线玩家。\n';
    const names = online.map((p) => `  ${p.name}`).join('\n');
    return `\n  当前在线玩家（${online.length}人）：\n  ───────────────\n${names}\n`;
  }

  private handleHelp(): string {
    return [
      '', '  ─── 可用命令 ───', '',
      '  n s e w u d    移动', '  look            查看四周',
      '  hp              查看状态', '  skills          查看武功',
      '  i               查看背包', '  get <物品>      捡起物品',
      '  drop <物品>     丢弃物品', '  use <药品>      使用药品',
      '  wear <装备>     穿戴装备', '  remove <装备>    脱下装备',
      '  learn <武功>    学习武功', '  ask <NPC>       向NPC打听',
      '  kill <目标>     发起战斗', '  who             在线玩家',
      '  help            显示帮助', '  clear           清屏',
      '',
    ].join('\n') + '\n';
  }

  // ── Combat ──────────────────────────────────────────────
  private handleKill(player: Player, args: string[]): string {
    const targetName = args.join(' ');
    if (!targetName) return '\n  你想攻击谁？用法：kill <名字>\n';

    // Check NPCs in room
    const roomNpcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const targetNpc = roomNpcs.find((n) => n.def.name === targetName);
    if (targetNpc) {
      player.state = 'fighting';
      player.targetEnemy = 'npc:' + targetNpc.def.id;
      targetNpc.state = 'fighting';
      targetNpc.targetPlayerId = player.id;
      return `\n  你向 ${targetNpc.def.name} 发起了攻击！\n` +
        this.combat.formatCombatStatus(player, { name: targetNpc.def.name, hp: targetNpc.hp, maxHp: targetNpc.maxHp });
    }

    // Check players in room
    const roomPlayers = this.players.getPlayersInRoom(player.currentRoom);
    const target = roomPlayers.find((p) => p.name === targetName && p.id !== player.id);
    if (!target) return `\n  这里没有叫"${targetName}"的人。\n`;
    if (target.state === 'fighting') return '\n  这个人正在战斗中。\n';

    player.state = 'fighting';
    player.targetEnemy = target.id;
    target.state = 'fighting';
    target.targetEnemy = player.id;
    return `\n  你向 ${target.name} 发起了攻击！\n` + this.combat.formatCombatStatus(player, target);
  }

  private handleCombat(player: Player, cmd: string, _args: string[]): string {
    const targetId = player.targetEnemy;
    if (!targetId) { player.state = 'playing'; return '\n  战斗已结束。\n'; }

    let enemyHp = 0, enemyMaxHp = 0, enemyName = '';

    if (targetId.startsWith('npc:')) {
      const npc = this.npcs.getNpc(targetId.slice(4));
      if (!npc || npc.hp <= 0) { player.state = 'playing'; player.targetEnemy = null; return '\n  敌人已倒下，战斗结束。\n'; }
      enemyHp = npc.hp; enemyMaxHp = npc.maxHp; enemyName = npc.def.name;
    } else {
      const target = this.players.getPlayer(targetId);
      if (!target || target.hp <= 0) { player.state = 'playing'; player.targetEnemy = null; return '\n  敌人已倒下，战斗结束。\n'; }
      enemyHp = target.hp; enemyMaxHp = target.maxHp; enemyName = target.name;
    }

    if (cmd === 'hit' || cmd === 'kill') {
      let msg = '';

      if (targetId.startsWith('npc:')) {
        const npc = this.npcs.getNpc(targetId.slice(4))!;
        const npcTarget = {
          name: npc.def.name,
          get hp() { return npc.hp; },
          set hp(v: number) { npc.hp = v; },
          maxHp: npc.maxHp,
          attributes: npc.def.attributes,
        };
        const result = this.combat.attack(player, npcTarget);
        msg = result.message;
        if (result.defenderDead) {
          player.state = 'playing'; player.targetEnemy = null;
          npc.state = 'idle'; npc.targetPlayerId = null;
          return msg;
        }
        // NPC counter-attacks
        const counter = this.combat.attack({ attributes: npc.def.attributes, name: npc.def.name }, player);
        msg += counter.message;
        if (counter.defenderDead) {
          player.state = 'playing'; player.targetEnemy = null;
          npc.state = 'idle'; npc.targetPlayerId = null;
          player.hp = 1;
          return msg + '\n  你被击败了……但挣扎着站了起来（HP 恢复至 1）。\n';
        }
        return msg + this.combat.formatCombatStatus(player, npcTarget);
      } else {
        const target = this.players.getPlayer(targetId)!;
        const result = this.combat.attack(player, target);
        msg = result.message;
        if (result.defenderDead) {
          player.state = 'playing'; player.targetEnemy = null;
          target.state = 'playing'; target.targetEnemy = null;
          return msg;
        }
        const counter = this.combat.attack(target, player);
        msg += counter.message;
        if (counter.defenderDead) {
          player.state = 'playing'; player.targetEnemy = null;
          target.state = 'playing'; target.targetEnemy = null;
          player.hp = 1;
          return msg + '\n  你被击败了……但挣扎着站了起来（HP 恢复至 1）。\n';
        }
        return msg + this.combat.formatCombatStatus(player, target);
      }
    }
    if (cmd === 'hp' || cmd === 'look' || cmd === 'l') {
      return this.combat.formatCombatStatus(player, { name: enemyName, hp: enemyHp, maxHp: enemyMaxHp });
    }
    return '\n  战斗中只能使用 hit、hp、look。\n';
  }

  // ── Items ────────────────────────────────────────────────
  private handleGet(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想捡什么？用法：get <物品名>\n';

    // Check room for items
    const room = this.map.getRoom(player.currentRoom);
    const roomItems = room?.items;
    if (roomItems && roomItems.includes(name)) {
      const def = this.items.findDefByName(name);
      if (def) {
        this.items.addItem(player, def.id);
        return `\n  你捡起了${name}。\n`;
      }
    }

    // Legacy: silver is always available
    if (name === '银子') { this.items.addItem(player, 'silver', 5); return '\n  你捡起了 5 两银子。\n'; }
    return `\n  这里没有"${name}"。\n`;
  }

  private handleDrop(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想丢弃什么？\n';
    const def = this.items.findDefByName(name);
    if (!def || !this.items.hasItem(player, def.id)) return `\n  你没有"${name}"。\n`;
    this.items.removeItem(player, def.id);
    return `\n  你丢掉了${name}。\n`;
  }

  private handleUse(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想使用什么？\n';
    // Find item by Chinese name
    for (const inv of player.inventory || []) {
      const def = this.items.getDef(inv.itemId);
      if (def && def.name === name && def.type === 'medicine' && def.hpRestore) {
        this.items.removeItem(player, inv.itemId);
        player.hp = Math.min(player.maxHp, player.hp + def.hpRestore);
        return `\n  你服下了${name}，恢复了 ${def.hpRestore} 点气血。\n  当前气血：${player.hp}/${player.maxHp}\n`;
      }
    }
    return `\n  你没有可以使用的"${name}"。\n`;
  }

  private handleWear(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想穿戴什么？\n';
    for (const inv of player.inventory || []) {
      const def = this.items.getDef(inv.itemId);
      if (def && def.name === name && (def.type === 'weapon' || def.type === 'armor')) {
        if (player.equipped.includes(inv.itemId)) return `\n  你已经装备了${name}。\n`;
        this.items.removeItem(player, inv.itemId);
        player.equipped.push(inv.itemId);
        return `\n  你装备了${name}。\n`;
      }
    }
    return `\n  你没有可以穿戴的"${name}"。\n`;
  }

  private handleRemove(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想脱下什么？\n';
    const idx = player.equipped.findIndex((id: string) => this.items.getDef(id)?.name === name);
    if (idx === -1) return `\n  你没有装备"${name}"。\n`;
    const itemId = player.equipped[idx];
    player.equipped.splice(idx, 1);
    this.items.addItem(player, itemId);
    return `\n  你脱下了${name}。\n`;
  }

  // ── Skills ───────────────────────────────────────────────
  private handleLearn(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想学什么武功？用法：learn <武功名>\n';
    const def = this.skills.findDefByName(name);
    if (def) {
      const err = this.skills.learnSkill(player, def.id);
      if (err) return `\n  ${err}\n`;
      const level = this.skills.getSkillLevel(player, def.id);
      return `\n  你学会了${name}！当前等级：Lv.${level}\n`;
    }
    return `\n  没有"${name}"这个武功。\n`;
  }

  // ── NPC Interaction ──────────────────────────────────────
  private handleAsk(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想向谁打听？用法：ask <NPC名>\n';
    const npcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const npc = npcs.find((n) => n.def.name === name);
    if (!npc) return `\n  这里没有"${name}"。\n`;
    return `\n  ${npc.def.name}说道：「${this.npcs.getDialogue(npc.def.id)}」\n`;
  }
}
