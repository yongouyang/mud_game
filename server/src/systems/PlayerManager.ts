import { Player, createPlayer, PlayerAttributes, ATTRIBUTE_NAMES, DEFAULT_ATTRIBUTES } from '../models/Player.js';
import { bar } from '../utils.js';

const CHAR_NAME_RE = /^[\u4e00-\u9fff]{2,6}$/;

export class PlayerManager {
  private players = new Map<string, Player>();

  createPlayer(id: string): void {
    this.players.set(id, {
      id,
      name: '',
      attributes: { ...DEFAULT_ATTRIBUTES },
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
      currentRoom: 'town/square',
      state: 'creating',
      targetEnemy: null,
      inventory: [],
      equipped: [],
      skills: [],
    });
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
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
    return [...this.players.values()].filter((p) => p.state !== 'creating');
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

  formatStatus(player: Player): string {
    if (player.state === 'creating') {
      return '\n  你尚未完成角色创建。\n';
    }
    const a = player.attributes;
    const hpBar = bar(player.hp, player.maxHp, 20);
    const mpBar = bar(player.mp, player.maxMp, 20);
    return [
      '',
      `  ─── ${player.name} ───`,
      '',
      `  气血  ${hpBar}  ${player.hp}/${player.maxHp}`,
      `  内力  ${mpBar}  ${player.mp}/${player.maxMp}`,
      '',
      `  臂力(str): ${a.str}    悟性(int): ${a.int}`,
      `  根骨(con): ${a.con}    身法(dex): ${a.dex}`,
      '',
    ].join('\n') + '\n';
  }

  formatCreatingPrompt(player: Player): string {
    if (!player.name) {
      return '\n  欢迎来到炎黄群侠传！\n\n  请输入你的名字（2-6个中文字）：\n';
    }
    const a = player.attributes;
    const remaining = 50 - (a.str + a.int + a.con + a.dex);
    return [
      '',
      `  你的名字：${player.name}`,
      '',
      `  请分配属性点数（剩余 ${remaining} 点）：`,
      ...Object.entries(ATTRIBUTE_NAMES).map(
        ([key, label]) => `    ${label}(${key}): ${a[key as keyof PlayerAttributes]}`,
      ),
      '',
      `  命令：set 臂力 15 | set str 15 | done 完成创建`,
      '',
    ].join('\n') + '\n';
  }
}
