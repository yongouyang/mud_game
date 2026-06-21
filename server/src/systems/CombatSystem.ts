import { bar } from '../utils.js';

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

    // ── Player attacks enemy ──
    const strikeDmg = playerSkills.bestStrike
      ? playerSkills.bestStrike.damage
      : 5 + player.attributes.str * 1.5;

    const atkResult = this.resolveAttack(
      { name: player.name, hp: player.hp, maxHp: player.maxHp },
      player.attributes,
      playerSkills,
      enemy,
      enemy.skills,
      strikeDmg,
      isPlayerExtraHit,
    );
    msg += atkResult.message;
    if (atkResult.defenderDead) {
      return { message: msg + `\n  ${enemy.name} 倒下了！\n`, defenderDead: true, attackerDead: false };
    }

    // ── Enemy counter-attacks ──
    if (!isPlayerExtraHit) {
      const enemyDmg = enemy.skills.bestStrike
        ? enemy.skills.bestStrike.damage
        : 5 + enemy.attributes.str * 1.5;

      const defResult = this.resolveAttack(
        { name: enemy.name, hp: enemy.hp, maxHp: enemy.maxHp },
        enemy.attributes,
        enemy.skills,
        player,
        playerSkills,
        enemyDmg,
        false,
      );
      msg += defResult.message;
      if (defResult.defenderDead) {
        return { message: msg + '\n  你被击败了……\n', attackerDead: true, defenderDead: false };
      }
    }

    // ── Format status ──
    msg += this.formatCombatStatus(player, player.mp, player.maxMp, enemy);
    return { message: msg, defenderDead: false, attackerDead: false };
  }

  /**
   * Single attack resolution with parry → dodge → force absorb → HP damage chain.
   * Returns whether defender died.
   */
  private resolveAttack(
    _attacker: CombatTarget,
    attackerAttr: { str: number; dex: number },
    attackerSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    defender: { name: string; hp: number; maxHp: number; mp: number; maxMp: number },
    defenderSkills: { parryLv: number; dodgeLv: number; forceLv: number; bestStrike: { name: string; damage: number } | null },
    rawDmg: number,
    isExtraHit: boolean,
  ): { message: string; defenderDead: boolean } {
    const strikeName = attackerSkills.bestStrike?.name || '普通攻击';

    // 1. 招架 (parry) check: chance = parryLv / (parryLv + attackerDodge*2)
    const parryChance = defenderSkills.parryLv / (defenderSkills.parryLv + attackerAttr.dex * 2 + 1);
    if (Math.random() < parryChance) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}你${isExtraHit ? '' : '使出' + strikeName + '，'}被 ${defender.name} 招架开了。\n`,
        defenderDead: false,
      };
    }

    // 2. 躲避 (dodge) check
    const dodgeChance = defenderSkills.dodgeLv / (defenderSkills.dodgeLv + attackerAttr.dex * 3 + 5);
    if (Math.random() < dodgeChance) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}你${isExtraHit ? '' : '使出' + strikeName + '，'}${defender.name} 身形一闪躲开了。\n`,
        defenderDead: false,
      };
    }

    // 3. 内力护体 (force absorb): absorb = min(damage, forceLv * 2 + mp*0.1)
    const forceAbsorb = Math.min(rawDmg, Math.floor(defenderSkills.forceLv * 2 + defender.mp * 0.1));
    const mpCost = Math.floor(forceAbsorb * 0.3);
    if (forceAbsorb > 0) {
      defender.mp = Math.max(0, defender.mp - mpCost);
    }
    const finalDmg = Math.max(1, rawDmg - forceAbsorb);

    // 4. Damage display
    const absorbMsg = forceAbsorb > 0 ? `（内力吸收了 ${forceAbsorb} 点）` : '';
    const crit = Math.random() < 0.1 ? ' 奋力一击！' : '';
    defender.hp = Math.max(0, defender.hp - finalDmg);

    if (defender.hp <= 0) {
      return {
        message: `\n  ${isExtraHit ? '[抢攻] ' : ''}你${isExtraHit ? '' : '一式' + strikeName + '，'}对 ${defender.name} 造成了 ${finalDmg} 点伤害${crit}${absorbMsg}。\n`,
        defenderDead: true,
      };
    }

    return {
      message: `\n  ${isExtraHit ? '[抢攻] ' : ''}你${isExtraHit ? '' : '一式' + strikeName + '，'}对 ${defender.name} 造成了 ${finalDmg} 点伤害${crit}${absorbMsg}。\n`,
      defenderDead: false,
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
    const mpLine = playerMp > 0 ? `  内力: ${bar(playerMp, playerMaxMp, 12)}  ${playerMp}/${playerMaxMp}` : '';
    return [
      '',
      '  ─── 战斗 ───',
      '',
      `  你 (${player.name})    HP: ${bar(player.hp, player.maxHp, 12)}  ${player.hp}/${player.maxHp}`,
      mpLine,
      `  敌人 (${enemy.name})   HP: ${bar(enemy.hp, enemy.maxHp, 12)}  ${enemy.hp}/${enemy.maxHp}`,
      '',
    ].filter(Boolean).join('\n') + '\n';
  }
}
