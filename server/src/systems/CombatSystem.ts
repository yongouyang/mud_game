import { bar } from '../utils.js';
import { ConditionSystem } from './ConditionSystem.js';
import { Player } from '../models/Player.js';
import { NpcInstance } from './NpcSystem.js';

export interface CombatTarget {
  name: string;
  hp: number;
  maxHp: number;
}

export interface CombatResult {
  message: string;
  defenderDead: boolean;
}

export interface CombatRoundResult {
  message: string;
  defenderDead: boolean;
  attackerDead: boolean;
  enemyHitPlayer: boolean;
  playerHitEnemy: boolean;
}

/**
 * MUD-style combat resolution per round:
 *   Attacker chooses skill → Defender tries 招架(parry) →
 *     if fail → tries 躲避(dodge) →
 *       if fail → 内力护体(force absorb) reduces damage → HP loss
 */
export class CombatSystem {
  /**
   * Execute one full round: attacker strike + defender counter.
   * Both sides get parry/dodge/force checks.
   */
  executeRound(
    player: {
      name: string; hp: number; maxHp: number; mp: number; maxMp: number;
      attributes: { str: number; dex: number };
    },
    playerSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    enemy: { mp: number; maxMp: number;
      name: string; hp: number; maxHp: number;
      attributes: { str: number; dex: number };
      skills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null };
    },
    isPlayerExtraHit: boolean = false,
  ): CombatRoundResult {
    let msg = '';
    let enemyHitPlayer = false;

    // ── Player attacks enemy ──
    const strikeDmg = Math.round(playerSkills.bestStrike
      ? playerSkills.bestStrike.damage
      : 5 + player.attributes.str * 1.5);

    const atkResult = this.resolveAttack(
      player.name,
      player.attributes,
      playerSkills,
      enemy,
      enemy.skills,
      strikeDmg,
      isPlayerExtraHit,
    );
    msg += atkResult.message;
    const playerHitEnemy = atkResult.hit;
    if (atkResult.defenderDead) {
      return { message: msg + `\n  ${enemy.name} 倒下了！\n`, defenderDead: true, attackerDead: false, enemyHitPlayer: false, playerHitEnemy: true };
    }

    // ── Enemy counter-attacks ──
    if (!isPlayerExtraHit) {
      const enemyDmg = Math.round(enemy.skills.bestStrike
        ? enemy.skills.bestStrike.damage
        : 5 + enemy.attributes.str * 1.5);

      const defResult = this.resolveAttack(
        enemy.name,
        enemy.attributes,
        enemy.skills,
        player,
        playerSkills,
        enemyDmg,
        false,
      );
      enemyHitPlayer = defResult.hit;
      msg += defResult.message;
      if (defResult.defenderDead) {
        return { message: msg + '\n  你被击败了……\n', attackerDead: true, defenderDead: false, enemyHitPlayer, playerHitEnemy };
      }
    }

    // ── Format status ──
    msg += this.formatCombatStatus(player, player.mp, player.maxMp, enemy);
    return { message: msg, defenderDead: false, attackerDead: false, enemyHitPlayer, playerHitEnemy };
  }

  /**
   * Execute a round against multiple enemies.
   * The player strikes the primary target, then every active enemy counter-attacks.
   */
  executeMultiRound(
    player: {
      name: string; hp: number; maxHp: number; mp: number; maxMp: number;
      attributes: { str: number; dex: number };
    },
    playerSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    primary: {
      name: string; hp: number; maxHp: number; mp: number; maxMp: number;
      attributes: { str: number; dex: number };
      skills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null };
    },
    extras: {
      name: string; hp: number; maxHp: number; mp: number; maxMp: number;
      attributes: { str: number; dex: number };
      skills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null };
    }[],
  ): CombatRoundResult {
    let msg = '';
    let enemyHitPlayer = false;

    // Player attacks primary target.
    const strikeDmg = Math.round(playerSkills.bestStrike
      ? playerSkills.bestStrike.damage
      : 5 + player.attributes.str * 1.5);
    const primaryAtk = this.resolveAttack(
      player.name, player.attributes, playerSkills, primary, primary.skills, strikeDmg, false,
    );
    msg += primaryAtk.message;
    const playerHitEnemy = primaryAtk.hit;
    if (primaryAtk.defenderDead) {
      return { message: msg, defenderDead: true, attackerDead: false, enemyHitPlayer: false, playerHitEnemy: true };
    }

    // Primary enemy counter.
    const primaryDmg = Math.round(primary.skills.bestStrike
      ? primary.skills.bestStrike.damage
      : 5 + primary.attributes.str * 1.5);
    const primaryCounter = this.resolveAttack(
      primary.name, primary.attributes, primary.skills, player, playerSkills, primaryDmg, false,
    );
    if (primaryCounter.hit) enemyHitPlayer = true;
    msg += primaryCounter.message;
    if (primaryCounter.defenderDead) {
      return { message: msg, defenderDead: false, attackerDead: true, enemyHitPlayer, playerHitEnemy };
    }

    // Each extra enemy gets a counter-attack.
    for (const enemy of extras) {
      if (player.hp <= 0) break;
      const enemyDmg = Math.round(enemy.skills.bestStrike
        ? enemy.skills.bestStrike.damage
        : 5 + enemy.attributes.str * 1.5);
      const counter = this.resolveAttack(
        enemy.name, enemy.attributes, enemy.skills, player, playerSkills, enemyDmg, false,
      );
      if (counter.hit) enemyHitPlayer = true;
      msg += counter.message;
      if (counter.defenderDead) {
        return { message: msg, defenderDead: false, attackerDead: true, enemyHitPlayer, playerHitEnemy };
      }
    }

    // Status shows player + primary only to keep output readable.
    msg += this.formatCombatStatus(player, player.mp, player.maxMp, primary);
    return { message: msg, defenderDead: false, attackerDead: false, enemyHitPlayer, playerHitEnemy };
  }

  /**
   * Single attack resolution with parry → dodge → force absorb → HP damage chain.
   * Returns whether defender died.
   */
  private resolveAttack(
    attackerName: string,
    attackerAttr: { str: number; dex: number },
    attackerSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    defender: { name: string; hp: number; maxHp: number; mp: number; maxMp: number },
    defenderSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    rawDmg: number,
    isExtraHit: boolean,
  ): { message: string; defenderDead: boolean; hit: boolean } {
    const strikeName = attackerSkills.bestStrike?.name || '普通攻击';

    // 1. 招架 (parry) check: chance = parryLv / (parryLv + attackerDodge*2)
    const parryChance = defenderSkills.parryLv / (defenderSkills.parryLv + attackerAttr.dex * 2 + 1);
    if (Math.random() < parryChance) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}${attackerName}${isExtraHit ? '' : '一式' + strikeName + '，'}被 ${defender.name} 招架开了。\n`,
        defenderDead: false,
        hit: false,
      };
    }

    // 2. 躲避 (dodge) check
    const dodgeChance = defenderSkills.dodgeLv / (defenderSkills.dodgeLv + attackerAttr.dex * 3 + 5);
    if (Math.random() < dodgeChance) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}${attackerName}${isExtraHit ? '' : '一式' + strikeName + '，'}${defender.name} 身形一闪躲开了。\n`,
        defenderDead: false,
        hit: false,
      };
    }

    // 3. 内力护体: only active when defender has force skills
    const forceBonus = defenderSkills.forceLv > 0 ? Math.floor(defender.mp * 0.05) : 0;
    const forceAbsorb = Math.floor(Math.min(rawDmg, defenderSkills.forceLv * 2 + forceBonus));
    const mpCost = Math.floor(forceAbsorb * 0.3);
    if (forceAbsorb > 0 && defender.mp > 0) {
      defender.mp = Math.max(0, defender.mp - mpCost);
    }
    const finalDmg = Math.max(1, Math.round(rawDmg - forceAbsorb));

    // 4. Damage display
    const absorbMsg = forceAbsorb > 0 ? `（内力吸收了 ${forceAbsorb} 点）` : '';
    const crit = Math.random() < 0.1 ? ' 奋力一击！' : '';
    defender.hp = Math.max(0, defender.hp - finalDmg);

    if (defender.hp <= 0) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}${attackerName}${isExtraHit ? '' : '一式' + strikeName + '，'}对 ${defender.name} 造成了 ${finalDmg} 点伤害${crit}${absorbMsg}。\n`,
        defenderDead: true,
        hit: true,
      };
    }

    return {
      message: `\n  ${isExtraHit ? '[抢攻] ' : ''}${attackerName}${isExtraHit ? '' : '一式' + strikeName + '，'}对 ${defender.name} 造成了 ${finalDmg} 点伤害${crit}${absorbMsg}。\n`,
      defenderDead: false,
      hit: true,
    };
  }

  /** Simple attack for backward compatibility (doesn't use parry/dodge/force) */
  attack(attacker: { attributes: { str: number; dex: number } }, defender: CombatTarget & { attributes: { dex: number } }): CombatResult {
    const baseDmg = 5 + attacker.attributes.str * 1.5;
    const dodge = defender.attributes.dex * 0.8;
    const variation = 0.8 + Math.random() * 0.4;
    let damage = Math.max(1, Math.round((baseDmg - dodge) * variation));
    if (Math.random() < 0.1) { damage = Math.round(damage * 1.8); }
    defender.hp = Math.max(0, defender.hp - damage);
    const msg = `\n  ${(attacker as any).name || '你'} 对 ${defender.name} 造成了 ${damage} 点伤害。\n`;
    if (defender.hp <= 0) return { message: msg + `\n  ${defender.name} 倒下了！\n`, defenderDead: true };
    return { message: msg, defenderDead: false };
  }

  formatCombatStatus(player: CombatTarget & { mp?: number; maxMp?: number }, playerMp: number, playerMaxMp: number, enemy: CombatTarget): string {
    const mpBar = playerMp > 0 ? `  MP: ${bar(playerMp, playerMaxMp, 8)} ${playerMp}/${playerMaxMp}` : '';
    return [
      '',
      '  ─── 战斗 ───',
      '',
      `  你 (${player.name})    HP: ${bar(player.hp, player.maxHp, 8)} ${player.hp}/${player.maxHp}${mpBar}`,
      `  敌人 (${enemy.name})   HP: ${bar(enemy.hp, enemy.maxHp, 8)} ${enemy.hp}/${enemy.maxHp}`,
      '',
    ].join('\n') + '\n';
  }
}
