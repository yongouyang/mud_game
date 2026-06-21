import { Player, createPlayer, PlayerAttributes, ATTRIBUTE_NAMES, DEFAULT_ATTRIBUTES } from '../models/Player.js';
import { bar } from '../utils.js';
import { SystemClock } from '../time/SystemClock.js';

const CHAR_NAME_RE = /^[\u4e00-\u9fff]{2,6}$/;

export class PlayerManager {
  private players = new Map<string, Player>();

  constructor(private clock: SystemClock) {}

  createPlayer(id: string): void {
    this.players.set(id, {
      id,
      name: '',
      attributes: { ...DEFAULT_ATTRIBUTES },
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
      exp: 0,
      pot: 0,
      level: 1,
      attrPoints: 0,
      currentRoom: 'town/square',
      state: 'creating',
      targetEnemy: null,
      combatTargets: [],
      conditions: [],
      schoolId: undefined,
      quest: null,
      inventory: [],
      equipped: [],
      skills: [],
      powerupExpiry: undefined,
      isMeditating: false,
      bankSilver: 0,
      bankInventory: [],
      shen: 0,
      kills: { players: 0, npcs: 0 },
    });
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  /** Insert a fully-formed Player (e.g. loaded from save file) */
  setPlayer(p: Player): void {
    this.players.set(p.id, p);
  }

  getPlayersInRoom(roomId: string): Player[] {
    const result: Player[] = [];
    for (const p of this.players.values()) {
      if (p.state !== 'creating' && p.currentRoom === roomId) {
        result.push(p);
      }
    }
    return result;
  }

  getAllPlayers(): Player[] {
    const seen = new Set<string>();
    const result: Player[] = [];
    for (const p of this.players.values()) {
      if (p.state !== 'creating' && !seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    return result;
  }

  setPlayerName(id: string, name: string): string | null {
    const player = this.players.get(id);
    if (!player) return '系统错误。';
    if (!CHAR_NAME_RE.test(name)) {
      return '名字须为2-6个中文字。';
    }
    player.name = name;
    return null;
  }

  finalizePlayer(id: string): string | null {
    const player = this.players.get(id);
    if (!player) return '系统错误。';
    if (!player.name) return '请先取一个名字。';

    const p = createPlayer(id, player.name, player.attributes);
    this.players.set(id, p);
    return null;
  }

  formatStatus(player: Player, effectiveAttrs?: PlayerAttributes): string {
    if (player.state === 'creating') {
      return '\n  你尚未完成角色创建。\n';
    }
    const a = effectiveAttrs || player.attributes;
    const hpBar = bar(player.hp, player.maxHp, 10);
    const mpBar = bar(player.mp, player.maxMp, 10);
    const now = this.clock.now();
    const powerupLeft = player.powerupExpiry && player.powerupExpiry > now
      ? Math.ceil((player.powerupExpiry - now) / 1000)
      : 0;
    const extras: string[] = [];
    if (powerupLeft > 0) extras.push(`战力提升（剩余 ${powerupLeft} 秒）`);
    if (player.isMeditating) extras.push('正在打坐');
    if (player.conditions && player.conditions.length > 0) {
      extras.push(`状态：${player.conditions.map((c) => `${c.name}Lv.${c.level}(${c.remain}tick)`).join('、')}`);
    }
    const schoolLine = player.schoolName ? `  门派: ${player.schoolName}` : '';
    const shenTitle = this.shenTitle(player.shen || 0);
    const kills = player.kills || { players: 0, npcs: 0 };
    const killLine = `  击杀: 玩家 ${kills.players}  NPC ${kills.npcs}`;
    const lastKillerLine = (kills.lastKillerName)
      ? `  上次死于: ${kills.lastKillerName}`
      : '';
    return [
      '',
      `  ─── ${player.name} ───`,
      '',
      `  气血 ${hpBar} ${player.hp}/${player.maxHp}  内力 ${mpBar} ${player.mp}/${player.maxMp}`,
      '',
      `  等级: Lv.${player.level || 1}`,
      '',
      `  臂力(str): ${a.str}    悟性(int): ${a.int}    容貌(per): ${a.per}`,
      `  根骨(con): ${a.con}    身法(dex): ${a.dex}    福缘(kar): ${a.kar}`,
      '',
      `  经验: ${player.exp || 0}    潜能: ${player.pot || 0}    属性点: ${player.attrPoints || 0}`,
      `  善恶值: ${player.shen || 0}（${shenTitle}）`,
      killLine,
      lastKillerLine,
      schoolLine,
      extras.length > 0 ? `  ${extras.join('    ')}` : '',
      '',
    ].join('\n') + '\n';
  }

  private shenTitle(shen: number): string {
    if (shen >= 1000) return '一代大侠';
    if (shen >= 500) return '侠义之士';
    if (shen >= 100) return '正道人士';
    if (shen > -100) return '亦正亦邪';
    if (shen > -500) return '邪道人士';
    if (shen > -1000) return '恶名昭彰';
    return '武林公敌';
  }

  formatCreatingPrompt(player: Player): string {
    if (!player.name) {
      return '\n  欢迎来到炎黄群侠传！\n\n  请输入你的名字（2-6个中文字）：\n';
    }
    const a = player.attributes;
    const remaining = 70 - (a.str + a.int + a.con + a.dex + a.per + a.kar);
    return [
      '',
      `  你的名字：${player.name}`,
      '',
      `  请分配属性点数（剩余 ${remaining} 点）：`,
      ...Object.entries(ATTRIBUTE_NAMES).map(
        ([key, label]) => `    ${label}(${key}): ${a[key as keyof PlayerAttributes]}`,
      ),
      '',
      `  命令：set 臂力 15 | set str 15 | set 容貌 12 | done 完成创建`,
      '',
    ].join('\n') + '\n';
  }
}
