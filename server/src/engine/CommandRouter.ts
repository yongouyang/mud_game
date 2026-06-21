import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';
import { SchoolDef } from '../models/School.js';
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
    private schools: SchoolSystem,
  ) {}

  /** Return player attributes including equipment bonuses. */
  private effectiveAttributes(player: Player): { str: number; int: number; con: number; dex: number } {
    return this.items.getEffectiveAttributes(player);
  }

  /** Return the player's best strike, boosted if powerup is active. */
  private poweredBestStrike(player: Player): { name: string; damage: number } | null {
    const strike = this.skills.getBestStrike(player);
    if (!strike) return null;
    if (player.powerupExpiry && player.powerupExpiry > Date.now()) {
      return { name: strike.name, damage: Math.round(strike.damage * 1.3) };
    }
    return strike;
  }

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
      case 'schools': return this.handleSchools(player, rest);
      case 'join': return this.handleJoin(player, rest);
      case 'quest': return this.handleQuest(player, rest);
      case 'buy': return this.handleBuy(player, rest);
      case 'shop': case 'list': return this.handleShop(player);
      case 'perform': case 'pfm': return this.handlePerform(player, rest);
      case 'exert': case 'yun': return this.handleExert(player, rest);
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
      '  n s e w u d    移动',       '  look            查看四周',
      '  hp / score     查看状态',   '  skills          查看武功',
      '  i / inventory  查看背包',   '  get <物品>      捡起物品',
      '  drop <物品>     丢弃物品',   '  use <药品>      使用药品',
      '  wear <装备>     穿戴装备',   '  remove <装备>    脱下装备',
      '  learn <武功>    学习武功',   '  kill <目标>     发起战斗',
      '  hit             攻击',       '  flee / tao      逃跑',
      '  schools         门派列表',   '  join <门派>     加入门派',
      '  ask <NPC>       向NPC打听',  '  who             在线玩家',
      '  perform / pfm   施展绝招',   '  exert / yun    内功运用',
      '  buy <物品>      购买物品',   '  shop / list     商店货物',
      '  quest <NPC>     接取/完成任务', '  help            显示帮助',
      '',
    ].join('\n') + '\n';
  }

  // ── Combat ──────────────────────────────────────────────
  private handleKill(player: Player, args: string[]): string {
    const targetName = args.join(' ');
    if (!targetName) return '\n  你想攻击谁？用法：kill <名字>\n';

    // Check NPCs in room
    const roomNpcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const targetNpc = roomNpcs.find((n) => n.def.name === targetName || n.def.id === targetName);
    if (targetNpc) {
      player.state = 'fighting';
      player.targetEnemy = 'npc:' + targetNpc.def.id;
      targetNpc.state = 'fighting';
      targetNpc.targetPlayerId = player.id;
      // First attack is performed by auto-tick; just show combat start
      const effAttr = this.effectiveAttributes(player);
      const pSkills = {
        parryLv: this.skills.getParryLevel(player),
        dodgeLv: this.skills.getDodgeLevel(player),
        forceLv: this.skills.getForceLevel(player),
        bestStrike: this.poweredBestStrike(player),
      };
      const npcSkills = {
        parryLv: targetNpc.def.attributes.str,
        dodgeLv: targetNpc.def.attributes.dex,
        forceLv: targetNpc.def.attributes.con,
        bestStrike: this.npcs.getBestNpcStrike(targetNpc),
      };
      const enemyState = {
        mp: 0,
        maxMp: 0,
        name: targetNpc.def.name,
        get hp() { return targetNpc.hp; }, set hp(v: number) { targetNpc.hp = v; },
        maxHp: targetNpc.maxHp,
        attributes: targetNpc.def.attributes,
        skills: npcSkills,
      };
      const combatPlayer = { ...player, attributes: effAttr };
      const result = this.combat.executeRound(combatPlayer, pSkills, enemyState, false);
      if (result.defenderDead) {
        player.state = 'playing'; player.targetEnemy = null;
        targetNpc.state = 'idle'; targetNpc.targetPlayerId = null;
        return result.message + this.handleNpcDeath(player, targetNpc);
      }
      if (result.attackerDead) {
        player.state = 'playing'; player.targetEnemy = null;
        targetNpc.state = 'idle'; targetNpc.targetPlayerId = null;
        player.hp = 1;
        return result.message;
      }
      return result.message;
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
    const effAttr = this.effectiveAttributes(player);
    const targetEffAttr = this.effectiveAttributes(target);
    const pSkills = {
      parryLv: this.skills.getParryLevel(player),
      dodgeLv: this.skills.getDodgeLevel(player),
      forceLv: this.skills.getForceLevel(player),
      bestStrike: this.poweredBestStrike(player),
    };
    const tSkills = {
      parryLv: this.skills.getParryLevel(target),
      dodgeLv: this.skills.getDodgeLevel(target),
      forceLv: this.skills.getForceLevel(target),
      bestStrike: this.poweredBestStrike(target),
    };
    const combatPlayer = { ...player, attributes: effAttr };
    const combatTarget = {
      ...target,
      attributes: targetEffAttr,
      skills: tSkills,
      get hp() { return target.hp; },
      set hp(v: number) { target.hp = v; },
    };
    const result = this.combat.executeRound(combatPlayer, pSkills, combatTarget, false);
    if (result.defenderDead || result.attackerDead) {
      player.state = 'playing'; player.targetEnemy = null;
      target.state = 'playing'; target.targetEnemy = null;
    }
    if (result.attackerDead) player.hp = 1;
    return result.message;
  }

  // ── Combat Round (called by auto-tick and manual hit) ──────
  /** Public: execute one combat round. Called by server tick and manual hit. */
  executeCombatRound(playerId: string): string {
    const player = this.players.getPlayer(playerId);
    if (!player || player.state !== 'fighting' || !player.targetEnemy) return '';
    return this.doCombatRound(player, player.targetEnemy);
  }

  /** Calculate combat round interval in ms based on player attributes and skills */
  getCombatSpeed(playerId: string): number {
    const player = this.players.getPlayer(playerId);
    if (!player) return 1500;
    const dex = player.attributes.dex;
    const dodgeLevel = this.skills.getDodgeLevel(player);
    // Base 2000ms, minus dex bonus, minus dodge bonus. Floor at 600ms.
    return Math.max(600, 2000 - dex * 45 - dodgeLevel * 8);
  }

  private doCombatRound(player: Player, targetId: string, isExtraHit = false): string {
    const effAttr = this.effectiveAttributes(player);
    const combatPlayer = { ...player, attributes: effAttr };
    if (targetId.startsWith('npc:')) {
      const npc = this.npcs.getNpc(targetId.slice(4));
      if (!npc || npc.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        if (npc) { npc.state = 'idle'; npc.targetPlayerId = null; }
        return this.handleNpcDeath(player, npc);
      }
      const pSkills = {
        parryLv: this.skills.getParryLevel(player),
        dodgeLv: this.skills.getDodgeLevel(player),
        forceLv: this.skills.getForceLevel(player),
        bestStrike: this.poweredBestStrike(player),
      };
      const npcSkills = {
        parryLv: npc.def.attributes.str,
        dodgeLv: npc.def.attributes.dex,
        forceLv: npc.def.attributes.con,
        bestStrike: this.npcs.getBestNpcStrike(npc),
      };
      const enemyState = {
        mp: 0,
        maxMp: 0,
        name: npc.def.name,
        get hp() { return npc.hp; }, set hp(v: number) { npc.hp = v; },
        maxHp: npc.maxHp,
        attributes: npc.def.attributes,
        skills: npcSkills,
      };
      const result = this.combat.executeRound(combatPlayer, pSkills, enemyState, isExtraHit);
      if (result.defenderDead) {
        player.state = 'playing'; player.targetEnemy = null;
        npc.state = 'idle'; npc.targetPlayerId = null;
        return result.message + this.handleNpcDeath(player, npc);
      }
      if (result.attackerDead) {
        player.state = 'playing'; player.targetEnemy = null;
        npc.state = 'idle'; npc.targetPlayerId = null;
        player.hp = 1;
        const expLoss = Math.floor((player.exp || 0) * 0.1);
        player.exp = Math.max(0, (player.exp || 0) - expLoss);
        return result.message + `\n  你损失了 ${expLoss} 点经验。\n`;
      }
      return result.message;
    } else {
      const target = this.players.getPlayer(targetId);
      if (!target || target.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        if (target) { target.state = 'playing'; target.targetEnemy = null; }
        return '\n  敌人已倒下，战斗结束。\n';
      }
      const targetEffAttr = this.effectiveAttributes(target);
      const pSkills = {
        parryLv: this.skills.getParryLevel(player),
        dodgeLv: this.skills.getDodgeLevel(player),
        forceLv: this.skills.getForceLevel(player),
        bestStrike: this.poweredBestStrike(player),
      };
      const tSkills = {
        parryLv: this.skills.getParryLevel(target),
        dodgeLv: this.skills.getDodgeLevel(target),
        forceLv: this.skills.getForceLevel(target),
        bestStrike: this.poweredBestStrike(target),
      };
      const combatTarget = {
        ...target,
        attributes: targetEffAttr,
        skills: tSkills,
        get hp() { return target.hp; },
        set hp(v: number) { target.hp = v; },
      };
      const result = this.combat.executeRound(combatPlayer, pSkills, combatTarget, isExtraHit);
      if (result.defenderDead || result.attackerDead) {
        player.state = 'playing'; player.targetEnemy = null;
        target.state = 'playing'; target.targetEnemy = null;
      }
      if (result.attackerDead) {
        player.hp = 1;
        const expLoss = Math.floor((player.exp || 0) * 0.1);
        player.exp = Math.max(0, (player.exp || 0) - expLoss);
        return result.message + `\n  你损失了 ${expLoss} 点经验。\n`;
      }
      return result.message;
    }
  }

  private handleNpcDeath(player: Player, npc: any): string {
    if (!npc) return '';
    const expGain = 10 + npc.def.attributes.str * 2 + npc.def.attributes.con;
    const potGain = 5 + Math.floor(npc.def.attributes.int * 0.5);
    player.exp += expGain;
    player.pot += potGain;
    let msg = `\n  你获得了 ${expGain} 点经验，${potGain} 点潜能。\n`;
    const gold = 10 + Math.floor(Math.random() * 20);
    this.items.addItem(player, 'silver', gold);
    msg += `  从尸体上搜出 ${gold} 两银子。\n`;
    // Schedule respawn if configured.
    this.npcs.scheduleRespawn(npc.def.id);
    return msg;
  }

  private handleCombat(player: Player, cmd: string, _args: string[]): string {
    if (cmd === 'flee' || cmd === 'tao') {
      const targetId = player.targetEnemy;
      player.state = 'playing'; player.targetEnemy = null;
      if (targetId?.startsWith('npc:')) {
        const npc = this.npcs.getNpc(targetId.slice(4));
        if (npc) { npc.state = 'idle'; npc.targetPlayerId = null; }
      } else if (targetId) {
        const target = this.players.getPlayer(targetId);
        if (target) { target.state = 'playing'; target.targetEnemy = null; }
      }
      return '\n  你转身逃走了……\n';
    }
    if (cmd === 'hp' || cmd === 'look' || cmd === 'l') {
      return this.doCombatRound(player, player.targetEnemy!, false);
    }
    if (cmd === 'hit' || cmd === 'kill') {
      return this.doCombatRound(player, player.targetEnemy!, true);
    }
    if (cmd === 'perform' || cmd === 'pfm') {
      return this.handlePerform(player, _args);
    }
    if (cmd === 'exert' || cmd === 'yun') {
      return this.handleExert(player, _args);
    }
    return '\n  战斗中可使用：hit（抢攻）、flee（逃跑）、hp（查看状态）、perform（绝招）、exert（运功）\n';
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
        const removed = this.map.removeItemFromRoom(player.currentRoom, name);
        if (removed) {
          this.items.addItem(player, def.id);
          this.map.scheduleItemRespawn(player.currentRoom, name);
          return `\n  你捡起了${name}。\n`;
        }
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
      if (!def || def.name !== name) continue;
      if (def.type !== 'medicine' && def.type !== 'misc') continue;
      const result = this.items.applyConsumable(player, def);
      if (result) {
        this.items.removeItem(player, inv.itemId);
        return `\n  ${result}\n`;
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
      const err = this.skills.learnSkill(player, def.id, { currentRoom: player.currentRoom });
      if (err) return `\n  ${err}\n`;
      const level = this.skills.getSkillLevel(player, def.id);
      return `\n  你学会了${name}！当前等级：Lv.${level}\n`;
    }
    return `\n  没有"${name}"这个武功。\n`;
  }

  // ── Shop ─────────────────────────────────────────────────
  private handleShop(_player: Player): string {
    return [
      '',
      '  ─── 商店 ───',
      '',
      '  金疮药(jinchuang-yao)  — 20 两 (恢复 50 HP)',
      '  人参丸(renshen-wan)     — 50 两 (恢复 100 HP)',
      '  内力丹(neili-dan)       — 30 两 (恢复 50 MP)',
      '  铁剑(iron-sword)        — 80 两 (臂力+8)',
      '  皮甲(leather-armor)     — 60 两 (根骨+5)',
      '  木剑(wooden-sword)      — 30 两 (臂力+3)',
      '',
      '  用法：buy <物品名>',
      '',
    ].join('\n') + '\n';
  }

  // ── Quest System ───────────────────────────────────────
  private handleQuest(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  用法：quest <NPC名> — 向NPC接取或完成任务\n';
    const roomNpcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const npc = roomNpcs.find((n) => n.def.name === name || n.def.id === name);
    if (!npc) return `\n  这里没有叫${name}的人。\n`;

    // Special delivery quest: 说书人 in town/square -> 王掌柜 in town/inn
    if (npc.def.id === 'storyteller') {
      if (player.quest) {
        return `\n  你还有一个任务未完成（${player.quest.type}）。\n`;
      }
      const exp = 20 + Math.floor(Math.random() * 10) + Math.floor((player.exp || 0) / 10000);
      const pot = 10 + Math.floor(Math.random() * 5);
      player.quest = { type: 'letter', target: '王掌柜', exp, pot, itemId: 'letter' };
      this.items.addItem(player, 'letter');
      return `\n  ${npc.def.name}低声道：「少侠，请将这封信交给客栈的王掌柜，切记不可让旁人看见。」\n  你获得了一封信件。\n`;
    }

    // Complete special delivery quest at 王掌柜
    if (player.quest && player.quest.type === 'letter' && npc.def.id === 'wang') {
      if (!this.items.hasItem(player, 'letter')) {
        return `\n  ${npc.def.name}疑惑地看着你：「信呢？说书人没把信交给你吗？」\n`;
      }
      this.items.removeItem(player, 'letter');
      const exp = player.quest.exp;
      const pot = player.quest.pot;
      player.exp = (player.exp || 0) + exp;
      player.pot = (player.pot || 0) + pot;
      player.quest = null;
      return `\n  ${npc.def.name}接过信件，脸色微变，随即收起。\n  任务完成！你获得了 ${exp} 点经验和 ${pot} 点潜能。\n`;
    }

    // Generic self-completing quest for any other NPC (backward-compatible behavior)
    if (player.quest) {
      // If the active quest was given by this same NPC, complete it.
      if (player.quest.target === npc.def.name) {
        const exp = player.quest.exp;
        const pot = player.quest.pot;
        player.exp = (player.exp || 0) + exp;
        player.pot = (player.pot || 0) + pot;
        player.quest = null;
        return `\n  ${npc.def.name}点了点头：「做得很好！」\n  任务完成！你获得了 ${exp} 点经验和 ${pot} 点潜能。\n`;
      }
      return `\n  你还有一个任务未完成（${player.quest.type}）。\n`;
    }

    // Accept a generic quest from this NPC.
    const exp = 10 + Math.floor(Math.random() * 10) + Math.floor((player.exp || 0) / 10000);
    const pot = 5 + Math.floor(Math.random() * 5);
    player.quest = { type: 'task', target: npc.def.name, exp, pot };
    return `\n  ${npc.def.name}对你说：「少侠，请帮我跑个腿，完事后再来找我。」\n`;
  }

  // ── Perform (绝招) ──────────────────────────────────────
  private handlePerform(player: Player, args: string[]): string {
    if (args.length === 0) return '\n  用法：perform <技能.绝招>\n';
    const [skillPerform] = args;
    const [skillName] = skillPerform?.split('.') || [''];
    const def = this.skills.findDefByName(skillName || '');
    if (!def) return `\n  你还没有学会${skillName || '该技能'}。\n`;
    const level = this.skills.getSkillLevel(player, def.id);
    if (level < 10) return `\n  你的${def.name}等级不够施展绝招（需Lv.10）。\n`;
    if (player.state !== 'fighting' || !player.targetEnemy) {
      return '\n  你必须在战斗中才能施展绝招。\n';
    }
    if ((player.mp || 0) < 20) return '\n  内力不足！施展绝招需要 20 点内力。\n';
    player.mp -= 20;
    const powerupMult = player.powerupExpiry && player.powerupExpiry > Date.now() ? 1.3 : 1;
    const baseDmg = def.damageBase * 3 + def.damageScale * level * 2;
    const dmg = Math.round(baseDmg * powerupMult);

    const targetId = player.targetEnemy;
    if (targetId.startsWith('npc:')) {
      const npc = this.npcs.getNpc(targetId.slice(4));
      if (!npc || npc.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        if (npc) { npc.state = 'idle'; npc.targetPlayerId = null; }
        return this.handleNpcDeath(player, npc);
      }
      npc.hp = Math.max(0, npc.hp - dmg);
      let msg = `\n  你大喝一声，使出了「${def.name}」绝招！对 ${npc.def.name} 造成 ${dmg} 点伤害。\n`;
      if (npc.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        npc.state = 'idle'; npc.targetPlayerId = null;
        msg += this.handleNpcDeath(player, npc);
      }
      return msg;
    } else {
      const target = this.players.getPlayer(targetId);
      if (!target || target.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        if (target) { target.state = 'playing'; target.targetEnemy = null; }
        return '\n  敌人已倒下，战斗结束。\n';
      }
      target.hp = Math.max(0, target.hp - dmg);
      let msg = `\n  你大喝一声，使出了「${def.name}」绝招！对 ${target.name} 造成 ${dmg} 点伤害。\n`;
      if (target.hp <= 0) {
        player.state = 'playing'; player.targetEnemy = null;
        target.state = 'playing'; target.targetEnemy = null;
      }
      return msg;
    }
  }

  // ── Exert (内功运用) ─────────────────────────────────────
  private handleExert(player: Player, args: string[]): string {
    const action = args[0]?.toLowerCase();
    if (!action) return '\n  用法：exert heal | yun heal（疗伤）\n';
    if (action === 'heal') {
      if ((player.mp || 0) < 30) return '\n  内力不足！疗伤需要 30 点内力。\n';
      player.mp -= 30;
      player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.2));
      return `\n  你盘膝坐下，运功疗伤……气血恢复至 ${player.hp}/${player.maxHp}。\n`;
    }
    if (action === 'powerup') {
      if ((player.mp || 0) < 50) return '\n  内力不足！需要 50 点内力。\n';
      player.mp -= 50;
      const durationMs = 30000;
      player.powerupExpiry = Date.now() + durationMs;
      return '\n  你深吸一口气，内力充盈全身！30 秒内战斗力大幅提升。\n';
    }
    return `\n  没有"${action}"这个内功运用。可用：heal, powerup\n`;
  }

  // ── Shop ─────────────────────────────────────────────────
  private handleBuy(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想买什么？用法：buy <物品名>\n';
    const def = this.items.findDefByName(name);
    if (!def) return `\n  没有"${name}"这个物品。\n`;
    const price = this.getShopPrice(def.id);
    const silver = this.items.hasItem(player, 'silver', price);
    if (!silver) return `\n  银两不足！${def.name} 售价 ${price} 两。\n`;
    this.items.removeItem(player, 'silver', price);
    this.items.addItem(player, def.id);
    return `\n  你花 ${price} 两银子买了${def.name}。\n`;
  }

  private getShopPrice(itemId: string): number {
    switch (itemId) {
      case 'jinchuang-yao': return 20;
      case 'renshen-wan': return 50;
      case 'neili-dan': return 30;
      case 'wooden-sword': return 30;
      case 'iron-sword': return 80;
      case 'leather-armor': return 60;
      case 'cloth-armor': return 20;
      default: return 50;
    }
  }

  // ── NPC Interaction ──────────────────────────────────────
  private handleAsk(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想向谁打听？用法：ask <NPC名>\n';
    const npcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const npc = npcs.find((n) => n.def.name === name || n.def.id === name);
    if (!npc) return `\n  这里没有"${name}"。\n`;
    return `\n  ${npc.def.name}说道：「${this.npcs.getDialogue(npc.def.id)}」\n`;
  }
  // ── Schools ─────────────────────────────────────────────

  private handleSchools(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (name) {
      const school = this.schools.findSchoolByName(name);
      if (!school) return `\n  没有"${name}"这个门派。\n`;
      return this.schools.formatSchoolDetail(school);
    }
    return this.schools.listSchools();
  }

  private handleJoin(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想加入哪个门派？用法：join <门派名>\n';
    const school = this.schools.findSchoolByName(name);
    if (!school) return `\n  没有"${name}"这个门派。\n`;
    if (player.currentRoom !== school.joinRoomId) {
      return `\n  这里不是${school.name}的山门。请到${school.name}所在地加入。\n`;
    }
    const p = player as any;
    if (p.schoolId) return '\n  你已经加入了门派。\n';
    p.schoolId = school.id;
    return `\n  你拜入了${school.name}！\n  掌门${school.masterName}收你为弟子。\n`;
  }
}
