import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem, NpcInstance } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { ConditionSystem } from '../systems/ConditionSystem.js';
import { BankSystem } from '../systems/BankSystem.js';
import { AuctionSystem } from '../systems/AuctionSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import { SystemClock } from '../time/SystemClock.js';
import { SchoolDef } from '../models/School.js';
import { Player, PlayerAttributes, ATTRIBUTE_NAMES, recalcPlayerStats } from '../models/Player.js';

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
    private levels: LevelSystem,
    private conditions: ConditionSystem,
    private bank: BankSystem,
    private auction: AuctionSystem,
    private shop: ShopSystem,
    private craft: CraftingSystem,
    private quests: QuestSystem,
    private scheduler: Scheduler,
    private clock: SystemClock,
  ) {}

  /** Return player attributes including equipment and skill bonuses. */
  private effectiveAttributes(player: Player): PlayerAttributes {
    const attrs = this.items.getEffectiveAttributes(player); // base + equipment
    const skill = this.skills.getAttributeBonus(player);
    return {
      str: attrs.str + skill.str,
      int: attrs.int + skill.int,
      con: attrs.con + skill.con,
      dex: attrs.dex + skill.dex,
      per: attrs.per,
      kar: attrs.kar,
    };
  }

  /** Return the player's effective strike, including str base, weapon skill, combo, and powerup. */
  private poweredBestStrike(player: Player): { name: string; damage: number } {
    const base = this.skills.getBestStrike(player);
    const name = base?.name || '普通攻击';
    // Base physical damage from attributes plus skill/weapon technique.
    let damage = Math.round(5 + player.attributes.str * 1.5);
    if (base) damage += base.damage;

    // Weapon-type synergy: equipped weapon + matching weapon skill adds damage.
    const weapon = this.getEquippedWeapon(player);
    if (weapon?.weaponType) {
      const weaponLv = this.skills.getWeaponSkillLevel(player, weapon.weaponType);
      damage += Math.floor(weaponLv * 0.5);
    }

    // Combo bonus: consecutive hits with the same skill up to +50%.
    if ((player.comboCount || 0) > 0 && player.comboSkill === name) {
      const comboBonus = Math.min(player.comboCount || 0, 10) * 0.05;
      damage = Math.round(damage * (1 + comboBonus));
    }

    if (player.powerupExpiry && player.powerupExpiry > this.clock.now()) {
      damage = Math.round(damage * 1.3);
    }
    return { name, damage };
  }

  private getEquippedWeapon(player: Player): import('../models/Item.js').ItemDef | undefined {
    for (const itemId of player.equipped || []) {
      const def = this.items.getDef(itemId);
      if (def && def.type === 'weapon') return def;
    }
    return undefined;
  }

  private updateCombo(player: Player, hit: boolean, skillName: string): void {
    if (!hit) {
      player.comboCount = 0;
      player.comboSkill = undefined;
      return;
    }
    if (player.comboSkill === skillName && (player.comboCount || 0) > 0) {
      player.comboCount = Math.min(10, (player.comboCount || 0) + 1);
    } else {
      player.comboCount = 1;
      player.comboSkill = skillName;
    }
  }

  private stopMeditation(player: Player): void {
    if (player.isMeditating && player.meditationTaskId) {
      this.scheduler.cancel(player.meditationTaskId);
      player.isMeditating = false;
      player.meditationTaskId = undefined;
    }
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
      this.stopMeditation(player);
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
      case 'hp': case 'score': return this.players.formatStatus(player, this.effectiveAttributes(player));
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
      case 'sell': return this.handleSell(player, rest);
      case 'bank': case 'cunku': return this.bank.formatBank(player);
      case 'deposit': return this.handleDeposit(player, rest);
      case 'withdraw': return this.handleWithdraw(player, rest);
      case 'auction': return this.handleAuction(player, rest);
      case 'craft': return this.handleCraft(player, rest);
      case 'perform': case 'pfm': return this.handlePerform(player, rest);
      case 'exert': case 'yun': return this.handleExert(player, rest);
      case 'ask': return this.handleAsk(player, rest);
      case 'dazuo': case 'exercise': case 'tuna': return this.handleDazuo(player, rest);
      case 'practice': case 'lian': return this.handlePractice(player, rest);
      case 'tianfu': case 'setattr': return this.handleTianfu(player, rest);
      case 'level': return this.levels.formatLevelInfo(player);
      case 'gm': return this.handleGm(player, rest);
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
      const newUsed = newAttr.str + newAttr.int + newAttr.con + newAttr.dex + newAttr.per + newAttr.kar - 60;
      if (newUsed > 10) return `\n  可用点数不足！已用 ${current.str + current.int + current.con + current.dex + current.per + current.kar - 60}/10。\n`;
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
      '  sell <物品> [数量] 出售物品', '  bank            钱庄存取',
      '  deposit <物品> [数量]      存入物品', '  deposit silver <数量>      存银子',
      '  withdraw <物品> [数量]     取出物品', '  withdraw silver <数量>     取银子',
      '  auction         拍卖行',       '  craft           制作物品',
      '  quest           查看当前任务', '  quest <NPC>     交/列任务',
      '  quest <NPC> <ID> 接取任务',      '  dazuo [秒]     打坐恢复内力',
      '  practice <武功> 练习武功',   '  tianfu <属性>   分配属性点',
      '  level           查看等级',   '  gm <命令>       管理员命令',
      '  help            显示帮助',
      '',
    ].join('\n') + '\n';
  }

  // ── Combat ──────────────────────────────────────────────
  private handleKill(player: Player, args: string[]): string {
    const targetName = args.join(' ');
    if (!targetName) return '\n  你想攻击谁？用法：kill <名字>\n';
    this.stopMeditation(player);

    // Check NPCs in room
    const roomNpcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const targetNpc = roomNpcs.find((n) => n.def.name === targetName || n.def.id === targetName);
    if (targetNpc) {
      const targetId = 'npc:' + targetNpc.def.id;
      if (player.combatTargets.includes(targetId)) {
        return '\n  你已经在和 ' + targetNpc.def.name + ' 战斗了。\n';
      }
      if (player.combatTargets.length >= 4) {
        return '\n  你同时应付的敌人太多了，无法再招惹更多。\n';
      }

      const wasFighting = player.state === 'fighting';
      player.state = 'fighting';
      if (!wasFighting) {
        player.targetEnemy = targetId;
        player.combatTargets = [targetId];
      } else {
        player.combatTargets.push(targetId);
      }
      targetNpc.state = 'fighting';
      targetNpc.targetPlayerId = player.id;

      // Guarder aggro: same-faction guarder NPCs in the room join the fight.
      const guarders = roomNpcs.filter((n) =>
        n !== targetNpc &&
        n.def.faction &&
        n.def.faction === targetNpc.def.faction &&
        n.def.guarder &&
        n.state !== 'fighting' &&
        n.hp > 0,
      );
      for (const guarder of guarders) {
        if (player.combatTargets.length >= 4) break;
        const guarderId = 'npc:' + guarder.def.id;
        if (!player.combatTargets.includes(guarderId)) {
          player.combatTargets.push(guarderId);
          guarder.state = 'fighting';
          guarder.targetPlayerId = player.id;
        }
      }

      return this.resolveCombatRound(player);
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
    if (result.defenderDead) {
      return result.message + this.recordPlayerKill(player, target);
    }
    if (result.attackerDead) {
      const killMsg = this.recordPlayerKill(target, player);
      const expLoss = Math.floor((player.exp || 0) * 0.1);
      player.exp = Math.max(0, (player.exp || 0) - expLoss);
      player.hp = 1;
      return result.message + killMsg + `\n  你损失了 ${expLoss} 点经验。\n`;
    }
    return result.message;
  }

  // ── Combat helpers ───────────────────────────────────────
  private makeNpcCombatState(npc: any) {
    return {
      mp: 0,
      maxMp: 0,
      name: npc.def.name,
      get hp() { return npc.hp; },
      set hp(v: number) { npc.hp = v; },
      maxHp: npc.maxHp,
      attributes: npc.def.attributes,
      skills: {
        parryLv: npc.def.attributes.str,
        dodgeLv: npc.def.attributes.dex,
        forceLv: npc.def.attributes.con,
        bestStrike: this.npcs.getBestNpcStrike(npc),
      },
    };
  }

  private removeFromCombat(player: Player, targetId: string): void {
    player.combatTargets = player.combatTargets.filter((id) => id !== targetId);
    if (targetId.startsWith('npc:')) {
      const npc = this.npcs.getNpc(targetId.slice(4));
      if (npc) { npc.state = 'idle'; npc.targetPlayerId = null; }
    }
    if (player.targetEnemy === targetId) {
      player.targetEnemy = player.combatTargets.length > 0 ? player.combatTargets[0] : null;
      if (!player.targetEnemy) player.state = 'playing';
    }
  }

  private clearCombat(player: Player): void {
    // Reset any standalone PvP target as well.
    if (player.targetEnemy && !player.targetEnemy.startsWith('npc:')) {
      const target = this.players.getPlayer(player.targetEnemy);
      if (target) { target.state = 'playing'; target.targetEnemy = null; }
    }
    for (const id of player.combatTargets) {
      if (id.startsWith('npc:')) {
        const npc = this.npcs.getNpc(id.slice(4));
        if (npc) { npc.state = 'idle'; npc.targetPlayerId = null; }
      } else {
        const target = this.players.getPlayer(id);
        if (target) { target.state = 'playing'; target.targetEnemy = null; }
      }
    }
    player.combatTargets = [];
    player.targetEnemy = null;
    player.state = 'playing';
    player.comboCount = 0;
    player.comboSkill = undefined;
  }

  private resolveCombatRound(player: Player): string {
    const primaryId = player.targetEnemy;
    if (!primaryId || !primaryId.startsWith('npc:')) return '';
    const primaryNpc = this.npcs.getNpc(primaryId.slice(4));
    if (!primaryNpc || primaryNpc.hp <= 0) {
      this.removeFromCombat(player, primaryId);
      return primaryNpc ? this.handleNpcDeath(player, primaryNpc) : '';
    }

    const effAttr = this.effectiveAttributes(player);
    const combatPlayer = { ...player, attributes: effAttr };
    const pSkills = {
      parryLv: this.skills.getParryLevel(player),
      dodgeLv: this.skills.getDodgeLevel(player),
      forceLv: this.skills.getForceLevel(player),
      bestStrike: this.poweredBestStrike(player),
    };

    const primaryState = this.makeNpcCombatState(primaryNpc);
    const extras: any[] = [];
    const extraNpcs: any[] = [];
    for (const id of player.combatTargets) {
      if (id === primaryId) continue;
      if (!id.startsWith('npc:')) continue;
      const npc = this.npcs.getNpc(id.slice(4));
      if (!npc || npc.hp <= 0) continue;
      extras.push(this.makeNpcCombatState(npc));
      extraNpcs.push(npc);
    }

    const result = this.combat.executeMultiRound(combatPlayer, pSkills, primaryState, extras);
    this.updateCombo(player, result.playerHitEnemy, pSkills.bestStrike.name);

    let conditionMsg = '';
    if (result.enemyHitPlayer) {
      const allNpcs = [primaryNpc, ...extraNpcs];
      for (const npc of allNpcs) {
        if (npc.def.poisonChance && Math.random() < npc.def.poisonChance) {
          const condId = npc.def.conditionId || 'poison';
          const condLevel = npc.def.conditionLevel || npc.def.poisonLevel || 1;
          const applied = this.conditions.applyCondition(player, condId, condLevel, npc.def.name);
          if (applied) conditionMsg += applied;
        }
      }
    }

    if (result.defenderDead) {
      const msg = result.message + conditionMsg + this.handleNpcDeath(player, primaryNpc);
      this.removeFromCombat(player, primaryId);
      if (player.state !== 'fighting') {
        player.comboCount = 0;
        player.comboSkill = undefined;
      }
      return msg;
    }
    if (result.attackerDead) {
      const msg = result.message + conditionMsg;
      player.kills.lastKillerName = primaryNpc.def.name;
      player.kills.lastKillerTime = this.clock.now();
      this.clearCombat(player);
      player.hp = 1;
      const expLoss = Math.floor((player.exp || 0) * 0.1);
      player.exp = Math.max(0, (player.exp || 0) - expLoss);
      return msg + `\n  你损失了 ${expLoss} 点经验。\n`;
    }
    return result.message + conditionMsg;
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

  private doCombatRound(player: Player, targetId: string, _isExtraHit = false): string {
    const effAttr = this.effectiveAttributes(player);
    const combatPlayer = { ...player, attributes: effAttr };
    if (targetId.startsWith('npc:')) {
      return this.resolveCombatRound(player);
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
      const result = this.combat.executeRound(combatPlayer, pSkills, combatTarget, false);
      this.updateCombo(player, result.playerHitEnemy, pSkills.bestStrike.name);
      if (result.defenderDead || result.attackerDead) {
        player.state = 'playing'; player.targetEnemy = null;
        target.state = 'playing'; target.targetEnemy = null;
        player.comboCount = 0;
        player.comboSkill = undefined;
      }
      if (result.defenderDead) {
        return result.message + this.recordPlayerKill(player, target);
      }
      if (result.attackerDead) {
        const killMsg = this.recordPlayerKill(target, player);
        const expLoss = Math.floor((player.exp || 0) * 0.1);
        player.exp = Math.max(0, (player.exp || 0) - expLoss);
        player.hp = 1;
        return result.message + killMsg + `\n  你损失了 ${expLoss} 点经验。\n`;
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
    const levelResult = this.levels.checkLevelUp(player);
    if (levelResult.leveledUp) {
      msg += '  ' + levelResult.messages.join('\n  ') + '\n';
    }
    const gold = 10 + Math.floor(Math.random() * 20);
    this.items.addItem(player, 'silver', gold);
    msg += `  从尸体上搜出 ${gold} 两银子。\n`;
    msg += this.recordNpcKill(player, npc);
    msg += this.quests.onNpcKill(player, npc.def.id);
    const drops = this.npcs.rollDrops(npc);
    if (drops.length > 0) {
      for (const drop of drops) {
        this.items.addItem(player, drop.itemId, drop.quantity);
      }
      msg += `  战利品：${drops.map((d) => `${this.items.getDef(d.itemId)?.name || d.itemId}×${d.quantity}`).join('、')}\n`;
    }
    // Schedule respawn if configured.
    this.npcs.scheduleRespawn(npc.def.id);
    return msg;
  }

  private recordNpcKill(player: Player, npc: any): string {
    player.kills.npcs += 1;
    let delta = 0;
    if (npc.def.aggressive) {
      delta = 10; // slaying a hostile/evil creature
    } else if (npc.def.faction) {
      delta = -50; // killing a faction member is evil
    }
    if (delta === 0) return '';
    player.shen = (player.shen || 0) + delta;
    const direction = delta > 0 ? '增加' : '减少';
    return `\n  你的善恶值${direction}了 ${Math.abs(delta)} 点（当前 ${player.shen}）。\n`;
  }

  private recordPlayerKill(killer: Player, victim: Player): string {
    killer.kills.players += 1;
    victim.kills.lastKillerName = killer.name;
    victim.kills.lastKillerTime = this.clock.now();
    let delta = -50;
    if ((victim.shen || 0) > 500) delta -= 100;
    else if ((victim.shen || 0) < -500) delta += 100;
    killer.shen = (killer.shen || 0) + delta;
    const direction = delta > 0 ? '增加' : '减少';
    return `\n  ${killer.name} 的善恶值${direction}了 ${Math.abs(delta)} 点（当前 ${killer.shen}）。\n`;
  }

  private handleCombat(player: Player, cmd: string, _args: string[]): string {
    if (cmd === 'flee' || cmd === 'tao') {
      this.clearCombat(player);
      return '\n  你转身逃走了……\n';
    }
    if (cmd === 'hp' || cmd === 'look' || cmd === 'l') {
      return this.doCombatRound(player, player.targetEnemy!, false);
    }
    if (cmd === 'hit' || (cmd === 'kill' && _args.length === 0)) {
      return this.doCombatRound(player, player.targetEnemy!, true);
    }
    if (cmd === 'kill' && _args.length > 0) {
      return this.handleKill(player, _args);
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
  private handleShop(player: Player): string {
    return this.shop.formatShop(player, player.currentRoom);
  }

  private handleBuy(player: Player, args: string[]): string {
    const name = args.join(' ');
    if (!name) return '\n  你想买什么？用法：buy <物品名>\n';
    const result = this.shop.buy(player, player.currentRoom, name);
    return `\n  ${result}\n`;
  }

  private handleSell(player: Player, args: string[]): string {
    if (args.length === 0) return '\n  你想卖什么？用法：sell <物品名> [数量]\n';
    const qty = args.length > 1 ? parseInt(args[args.length - 1], 10) : NaN;
    let name: string;
    let quantity = 1;
    if (!isNaN(qty) && qty > 0) {
      name = args.slice(0, -1).join(' ');
      quantity = qty;
    } else {
      name = args.join(' ');
    }
    if (!name) return '\n  你想卖什么？用法：sell <物品名> [数量]\n';
    const result = this.shop.sell(player, player.currentRoom, name, quantity);
    return `\n  ${result}\n`;
  }

  // ── Bank ─────────────────────────────────────────────────
  private handleDeposit(player: Player, args: string[]): string {
    if (args.length === 0) return '\n  用法：deposit <物品> [数量] / deposit silver <数量>\n';
    if (args[0].toLowerCase() === 'silver') {
      const qty = parseInt(args[1] || '', 10);
      const err = this.bank.depositSilver(player, qty);
      if (err) return `\n  ${err}\n`;
      return `\n  你存入了 ${qty} 两银子。\n`;
    }
    const qty = args.length > 1 ? parseInt(args[args.length - 1], 10) : NaN;
    let name: string;
    let quantity = 1;
    if (!isNaN(qty) && qty > 0) {
      name = args.slice(0, -1).join(' ');
      quantity = qty;
    } else {
      name = args.join(' ');
    }
    const err = this.bank.depositItem(player, name, quantity);
    if (err) return `\n  ${err}\n`;
    return `\n  你存入了 ${quantity} 个${name}。\n`;
  }

  private handleWithdraw(player: Player, args: string[]): string {
    if (args.length === 0) return '\n  用法：withdraw <物品> [数量] / withdraw silver <数量>\n';
    if (args[0].toLowerCase() === 'silver') {
      const qty = parseInt(args[1] || '', 10);
      const err = this.bank.withdrawSilver(player, qty);
      if (err) return `\n  ${err}\n`;
      return `\n  你取出了 ${qty} 两银子。\n`;
    }
    const qty = args.length > 1 ? parseInt(args[args.length - 1], 10) : NaN;
    let name: string;
    let quantity = 1;
    if (!isNaN(qty) && qty > 0) {
      name = args.slice(0, -1).join(' ');
      quantity = qty;
    } else {
      name = args.join(' ');
    }
    const err = this.bank.withdrawItem(player, name, quantity);
    if (err) return `\n  ${err}\n`;
    return `\n  你取出了 ${quantity} 个${name}。\n`;
  }

  // ── Auction ──────────────────────────────────────────────
  private handleAuction(player: Player, args: string[]): string {
    if (args.length === 0 || args[0] === 'list') {
      return this.auction.formatListings();
    }
    const sub = args[0].toLowerCase();
    if (sub === 'sell') {
      if (args.length < 3) return '\n  用法：auction sell <物品> <起拍价> [一口价]\n';
      let itemName: string;
      let start: number;
      let buyout: number | undefined;
      if (args.length === 3) {
        // auction sell <物品> <起拍价>
        itemName = args[1];
        start = parseInt(args[2], 10);
        if (isNaN(start) || start <= 0) {
          return '\n  用法：auction sell <物品> <起拍价> [一口价]\n';
        }
      } else {
        // auction sell <物品> <起拍价> <一口价>  (item name may be multiple words)
        const startPrice = parseInt(args[args.length - 2], 10);
        const maybeBuyout = parseInt(args[args.length - 1], 10);
        if (isNaN(startPrice) || startPrice <= 0 || isNaN(maybeBuyout) || maybeBuyout <= 0) {
          return '\n  用法：auction sell <物品> <起拍价> [一口价]\n';
        }
        itemName = args.slice(1, -2).join(' ');
        start = startPrice;
        buyout = maybeBuyout;
      }
      const result = this.auction.createListing(player, itemName, 1, start, buyout);
      if (result.error) return `\n  ${result.error}\n`;
      return `\n  你上架了 ${itemName}，拍卖编号 ${result.id}。\n`;
    }
    if (sub === 'bid') {
      if (args.length !== 3) return '\n  用法：auction bid <编号> <价格>\n';
      const err = this.auction.bid(player, args[1], parseInt(args[2], 10));
      if (err) return `\n  ${err}\n`;
      return `\n  你出价 ${args[2]} 两。\n`;
    }
    if (sub === 'buyout') {
      if (args.length !== 2) return '\n  用法：auction buyout <编号>\n';
      const err = this.auction.buyout(player, args[1]);
      if (err) return `\n  ${err}\n`;
      return '\n  你一口价拿下了拍卖品！\n';
    }
    return '\n  用法：auction [list|sell|bid|buyout]\n';
  }

  // ── Craft ────────────────────────────────────────────────
  private handleCraft(player: Player, args: string[]): string {
    if (args.length === 0 || args[0] === 'list') {
      return this.craft.formatRecipes();
    }
    const name = args.join(' ');
    const result = this.craft.craft(player, name);
    return `\n  ${result.message}\n`;
  }

  // ── Quest System ───────────────────────────────────────
  private handleQuest(player: Player, args: string[]): string {
    if (args.length === 0) {
      return this.quests.formatActive(player);
    }

    const roomNpcs = this.npcs.getNpcsInRoom(player.currentRoom);
    const npcName = args[0];
    const npc = roomNpcs.find((n) => n.def.name === npcName || n.def.id === npcName);
    if (!npc) return `\n  这里没有叫${npcName}的人。\n`;

    // quest <NPC> <questId> — accept a specific quest
    if (args.length >= 2) {
      const questId = args[1];
      const available = this.quests.availableQuests(npc.def.id);
      if (!available.some((q) => q.id === questId)) {
        return `\n  ${npc.def.name} 没有发布这个任务。\n`;
      }
      const result = this.quests.accept(player, questId);
      return `\n  ${result.message}\n`;
    }

    // quest <NPC> — try to complete, or list available quests
    const active = player.quest;
    if (active) {
      const result = this.quests.complete(player, npc.def.id);
      if (result.completed) {
        return `\n  ${npc.def.name}点了点头。\n  ${result.message}\n`;
      }
      return `\n  ${result.message}\n`;
    }

    const available = this.quests.availableQuests(npc.def.id);
    if (available.length === 0) {
      return `\n  ${npc.def.name} 这里没有适合你的任务。\n`;
    }
    const lines = available.map((q) => `    ${q.id} — ${q.title}（${this.describeQuestType(q)}）`).join('\n');
    return `\n  ${npc.def.name} 发布的任务：\n${lines}\n  输入 quest ${npcName} <任务ID> 接取。\n`;
  }

  private describeQuestType(q: { type: string; targetCount: number; targetId: string }): string {
    switch (q.type) {
      case 'kill': return `杀死 ${q.targetCount} 个目标`;
      case 'collect': return `收集 ${q.targetCount} 个${q.targetId}`;
      case 'delivery': return '递送物品';
      case 'talk': return '对话';
      default: return q.type;
    }
  }

  // ── GM / Admin tooling ──────────────────────────────────
  private handleGm(player: Player, args: string[]): string {
    if (!player.isAdmin) {
      return '\n  你没有权限使用管理命令。\n';
    }
    if (args.length === 0) {
      return '\n  GM 命令：list | inspect <玩家> | kick <玩家> | goto <房间ID> | spawn <npcId> | set <玩家> <字段> <值>\n';
    }
    const sub = args[0].toLowerCase();

    if (sub === 'list') {
      const online = this.players.getAllPlayers();
      if (online.length === 0) return '\n  当前没有在线玩家。\n';
      const lines = online.map((p) => `  ${p.name} (${p.id}) — ${p.currentRoom}`).join('\n');
      return `\n  在线玩家（${online.length}）：\n${lines}\n`;
    }

    if (sub === 'inspect' && args[1]) {
      const target = this.findPlayerByName(args[1]);
      if (!target) return `\n  找不到玩家 ${args[1]}。\n`;
      return this.players.formatStatus(target, this.effectiveAttributes(target));
    }

    if (sub === 'kick' && args[1]) {
      const target = this.findPlayerByName(args[1]);
      if (!target) return `\n  找不到玩家 ${args[1]}。\n`;
      this.players.removePlayer(target.id);
      return `\n  已将 ${target.name} 移出游戏。\n`;
    }

    if (sub === 'goto' && args[1]) {
      const roomId = args[1];
      if (!this.map.getRoom(roomId)) return `\n  不存在房间 ${roomId}。\n`;
      player.currentRoom = roomId;
      return `\n  你传送到了 ${roomId}。\n`;
    }

    if (sub === 'spawn' && args[1]) {
      const npcId = args[1];
      const spawned = this.npcs.spawnClone(npcId, player.currentRoom);
      if (!spawned) return `\n  无法生成 NPC ${npcId}。\n`;
      return `\n  你召唤了 ${spawned.def.name}。\n`;
    }

    if (sub === 'set' && args.length >= 4) {
      const target = this.findPlayerByName(args[1]);
      if (!target) return `\n  找不到玩家 ${args[1]}。\n`;
      const field = args[2];
      const value = args[3];
      if (['hp', 'mp', 'exp', 'pot', 'shen'].includes(field)) {
        (target as any)[field] = parseInt(value, 10);
        return `\n  已将 ${target.name} 的 ${field} 设为 ${value}。\n`;
      }
      if (field === 'room') {
        if (!this.map.getRoom(value)) return `\n  不存在房间 ${value}。\n`;
        target.currentRoom = value;
        return `\n  已将 ${target.name} 的房间设为 ${value}。\n`;
      }
      if (field in target.attributes) {
        (target.attributes as any)[field] = parseInt(value, 10);
        recalcPlayerStats(target);
        return `\n  已将 ${target.name} 的 ${field} 设为 ${value}。\n`;
      }
      return `\n  未知字段 ${field}。\n`;
    }

    return '\n  未知 GM 命令。\n';
  }

  private findPlayerByName(name: string): Player | undefined {
    return this.players.getAllPlayers().find((p) => p.name === name);
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
        const msg = npc ? this.handleNpcDeath(player, npc) : '';
        this.removeFromCombat(player, targetId);
        return msg;
      }
      npc.hp = Math.max(0, npc.hp - dmg);
      const npcTargetId = 'npc:' + npc.def.id;
      let msg = `\n  你大喝一声，使出了「${def.name}」绝招！对 ${npc.def.name} 造成 ${dmg} 点伤害。\n`;
      if (npc.hp <= 0) {
        msg += this.handleNpcDeath(player, npc);
        this.removeFromCombat(player, npcTargetId);
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
    if (!action) return '\n  用法：exert heal | yun heal（疗伤）；exert powerup；exert dispel [状态/类别]\n';
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
      player.powerupExpiry = this.clock.now() + durationMs;
      return '\n  你深吸一口气，内力充盈全身！30 秒内战斗力大幅提升。\n';
    }
    if (action === 'dispel') {
      const forceLv = this.skills.getForceLevel(player);
      const condArg = args[1]?.toLowerCase() || 'poison';
      // Treat bare 'poison' / 'illness' / 'elemental' as category dispels.
      const result = this.conditions.dispelCategory(player, condArg, forceLv)
        ?? this.conditions.dispelCondition(player, condArg, forceLv);
      if (!result) return `\n  你并没有 ${condArg} 状态。\n`;
      return `\n  ${result}\n`;
    }
    return `\n  没有"${action}"这个内功运用。可用：heal, powerup, dispel\n`;
  }

  // ── Dazuo / Meditation ───────────────────────────────────
  private handleDazuo(player: Player, args: string[]): string {
    if (player.state === 'fighting') return '\n  战斗中无法打坐。\n';
    if (player.isMeditating) return '\n  你已经在打坐了。\n';
    const forceLv = this.skills.getForceLevel(player);
    if (forceLv <= 0) return '\n  你需要先学会一门内功才能打坐。\n';

    const seconds = parseInt(args[0] || '10', 10);
    if (isNaN(seconds) || seconds <= 0 || seconds > 300) {
      return '\n  用法：dazuo <秒数>（1-300）\n';
    }

    player.isMeditating = true;
    const taskId = `meditate:${player.id}`;
    player.meditationTaskId = taskId;
    let elapsed = 0;

    this.scheduler.schedule(taskId, 1000, () => {
      elapsed++;
      if (player.hp > 5) {
        player.hp = Math.max(1, player.hp - 5);
      }
      if (player.mp < player.maxMp) {
        player.mp = Math.min(player.maxMp, player.mp + 5);
      } else if (forceLv >= 10 && Math.random() < 0.1) {
        // Small chance to raise max MP when full.
        player.maxMp += 1;
      }
      if (elapsed >= seconds || player.state === 'fighting') {
        this.scheduler.cancel(taskId);
        player.isMeditating = false;
        player.meditationTaskId = undefined;
      }
    }, 1000);

    return `\n  你盘膝坐下，开始打坐 ${seconds} 秒，将气血转化为内力。\n`;
  }

  // ── Practice / Self-train ────────────────────────────────
  private handlePractice(player: Player, args: string[]): string {
    if (player.state === 'fighting') return '\n  战斗中无法练习。\n';
    const name = args.join(' ');
    if (!name) return '\n  你想练习什么武功？用法：practice <武功名>\n';
    const def = this.skills.findDefByName(name);
    if (!def) return `\n  没有"${name}"这个武功。\n`;

    const currentLevel = this.skills.getSkillLevel(player, def.id);
    // Cap practice by player level * 10 to give leveling meaning.
    const cap = (player.level || 1) * 10;
    if (currentLevel >= cap) {
      return `\n  你的${def.name}已经练到当前境界的极限（Lv.${cap}），需要先提升等级。\n`;
    }

    const cooldownId = `practice-cd:${player.id}:${def.id}`;
    if (this.scheduler.has(cooldownId)) {
      return `\n  你刚练过${def.name}，需要休息片刻。\n`;
    }

    const err = this.skills.learnSkill(player, def.id);
    // learnSkill may spend potential; practice should not, so refund it.
    if (!err) {
      // Refund potential if learnSkill spent it.
      // Actually learnSkill costs pot for school skills. For practice we want free.
      // To keep simple, we only practice basic non-school skills that cost 1 pot.
      player.pot = (player.pot || 0) + 1;
    }
    if (err) return `\n  ${err}\n`;

    // Cooldown scales inversely with int: base 5s - int/5, min 1s.
    const cooldownMs = Math.max(1000, 5000 - player.attributes.int * 200);
    this.scheduler.schedule(cooldownId, cooldownMs, () => {}, undefined);
    return `\n  你专心致志地练习${def.name}，有所进步！当前等级：Lv.${this.skills.getSkillLevel(player, def.id)}\n`;
  }

  // ── Tianfu / Attribute points ────────────────────────────
  private handleTianfu(player: Player, args: string[]): string {
    if (args.length === 0) return '\n  用法：tianfu <属性> [数量]  例如：tianfu str 2 / tianfu 臂力\n';
    const attr = args[0];
    const amount = args[1] ? parseInt(args[1], 10) : 1;
    if (isNaN(amount) || amount <= 0) return '\n  数量必须是正整数。\n';
    const err = this.levels.spendAttributePoint(player, attr, amount);
    if (err) return `\n  ${err}\n`;
    return `\n  你分配了 ${amount} 点属性点到 ${attr}。\n`;
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
    p.schoolName = school.name;
    this.schools.applyBonus(player, school);
    let msg = `\n  你拜入了${school.name}！\n  掌门${school.masterName}收你为弟子。\n`;
    if (school.bonusDescription) {
      msg += `  你感到体内气息变化：${school.bonusDescription}。\n`;
    }
    return msg;
  }
}
