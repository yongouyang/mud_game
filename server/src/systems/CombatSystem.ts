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

export class CombatSystem {
  attack(attacker: { attributes: { str: number; dex: number } }, defender: CombatTarget & { attributes: { dex: number } }): CombatResult {
    const baseDmg = 5 + attacker.attributes.str * 1.5;
    const dodge = defender.attributes.dex * 0.8;
    const variation = 0.8 + Math.random() * 0.4;

    let damage = Math.max(1, Math.round((baseDmg - dodge) * variation));

    let critical = false;
    if (Math.random() < 0.1) {
      damage = Math.round(damage * 1.8);
      critical = true;
    }

    defender.hp = Math.max(0, defender.hp - damage);

    let msg = `\n  ${(attacker as any).name || '你'}${critical ? ' 奋力一击！' : ''} 对 ${defender.name} 造成了 ${damage} 点伤害。\n`;

    if (defender.hp <= 0) {
      msg += `\n  ${defender.name} 倒下了！\n`;
      return { message: msg, defenderDead: true };
    }

    return { message: msg, defenderDead: false };
  }

  formatCombatStatus(player: CombatTarget, enemy: CombatTarget): string {
    return [
      '',
      '  ─── 战斗 ───',
      '',
      `  你 (${player.name})    HP: ${bar(player.hp, player.maxHp, 15)}  ${player.hp}/${player.maxHp}`,
      `  敌人 (${enemy.name})   HP: ${bar(enemy.hp, enemy.maxHp, 15)}  ${enemy.hp}/${enemy.maxHp}`,
      '',
    ].join('\n') + '\n';
  }
}
