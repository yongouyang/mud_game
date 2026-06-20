import { Player } from '../models/Player.js';
import { NpcDef } from '../models/Npc.js';
import { SkillSystem } from './SkillSystem.js';

export interface NpcInstance {
  def: NpcDef;
  hp: number;
  maxHp: number;
  state: 'idle' | 'fighting';
  targetPlayerId: string | null;
}

export class NpcSystem {
  private npcs = new Map<string, NpcInstance>();
  private defs = new Map<string, NpcDef>();

  constructor(private skillSystem: SkillSystem) {}

  register(def: NpcDef): void {
    this.defs.set(def.id, def);
    this.npcs.set(def.id, {
      def,
      hp: 80 + def.attributes.con * 10,
      maxHp: 80 + def.attributes.con * 10,
      state: 'idle',
      targetPlayerId: null,
    });
  }

  getNpc(npcId: string): NpcInstance | undefined {
    return this.npcs.get(npcId);
  }

  getNpcsInRoom(roomId: string): NpcInstance[] {
    const result: NpcInstance[] = [];
    for (const npc of this.npcs.values()) {
      if (npc.def.roomId === roomId && npc.state === 'idle') {
        result.push(npc);
      }
    }
    return result;
  }

  getCombatNpc(targetPlayerId: string): NpcInstance | undefined {
    for (const npc of this.npcs.values()) {
      if (npc.state === 'fighting' && npc.targetPlayerId === targetPlayerId) {
        return npc;
      }
    }
    return undefined;
  }

  formatNpcsInRoom(roomId: string): string {
    const npcs = this.getNpcsInRoom(roomId);
    if (npcs.length === 0) return '';
    return npcs.map((n) => `  ${n.def.name} - ${n.def.description}`).join('\n') + '\n';
  }

  getDialogue(npcId: string): string {
    const npc = this.npcs.get(npcId);
    if (!npc || npc.def.dialogue.length === 0) return '……（沉默不语）';
    const idx = Math.floor(Math.random() * npc.def.dialogue.length);
    return npc.def.dialogue[idx];
  }

  /** NPC attacks use skill-based damage */
  getNpcDamage(npc: NpcInstance): number {
    let dmg = 5 + npc.def.attributes.str * 1.5;
    for (const sk of npc.def.skills) {
      const def = this.skillSystem.getDef(sk.skillId);
      if (def && def.type === 'strike') {
        dmg += def.damageBase + def.damageScale * sk.level;
      }
    }
    return Math.round(dmg);
  }
}
