import { Player } from '../models/Player.js';
import { NpcDef } from '../models/Npc.js';
import { SkillSystem } from './SkillSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import npcsData from '../data/npcs.json' assert { type: 'json' };

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
  private roomIndex = new Map<string, Set<NpcInstance>>();

  constructor(private skillSystem: SkillSystem, private scheduler?: Scheduler) {
    for (const def of npcsData as NpcDef[]) {
      this.register(def);
    }
  }

  private addToRoomIndex(npc: NpcInstance): void {
    const roomId = npc.def.roomId;
    if (!this.roomIndex.has(roomId)) {
      this.roomIndex.set(roomId, new Set());
    }
    this.roomIndex.get(roomId)!.add(npc);
  }

  register(def: NpcDef): void {
    this.defs.set(def.id, def);
    const npc: NpcInstance = {
      def,
      hp: 80 + def.attributes.con * 10,
      maxHp: 80 + def.attributes.con * 10,
      state: 'idle',
      targetPlayerId: null,
    };
    this.npcs.set(def.id, npc);
    this.addToRoomIndex(npc);
  }

  /** Spawn a clone of an existing NPC definition in a specific room. */
  spawnClone(npcId: string, roomId: string): NpcInstance | undefined {
    const original = this.defs.get(npcId);
    if (!original) return undefined;
    const cloneId = `${npcId}-gm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const cloneDef: NpcDef = { ...original, id: cloneId, roomId };
    this.register(cloneDef);
    return this.npcs.get(cloneId);
  }

  getNpc(npcId: string): NpcInstance | undefined {
    return this.npcs.get(npcId);
  }

  getNpcsInRoom(roomId: string): NpcInstance[] {
    const set = this.roomIndex.get(roomId);
    if (!set) return [];
    return Array.from(set).filter((npc) => npc.state === 'idle' && npc.hp > 0);
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
    const maxShown = 10;
    const shown = npcs.slice(0, maxShown);
    let msg = shown.map((n) => `  ${n.def.name} - ${n.def.description}`).join('\n') + '\n';
    if (npcs.length > maxShown) {
      msg += `  ……还有 ${npcs.length - maxShown} 人在这里。\n`;
    }
    return msg;
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
      if (def && this.skillSystem.isAttackType(def.type)) {
        dmg += def.damageBase + def.damageScale * sk.level;
      }
    }
    return Math.round(dmg);
  }
  getBestNpcStrike(npc: NpcInstance): { name: string; damage: number } | null {
    let best: { name: string; damage: number } | null = null;
    for (const sk of npc.def.skills) {
      const def = this.skillSystem.getDef(sk.skillId);
      if (def && this.skillSystem.isAttackType(def.type)) {
        const dmg = def.damageBase + def.damageScale * sk.level;
        if (!best || dmg > best.damage) best = { name: def.name, damage: dmg };
      }
    }
    return best;
  }

  /** Roll drops for an NPC. Returns items and quantities. */
  rollDrops(npc: NpcInstance): { itemId: string; quantity: number }[] {
    const drops = npc.def.drops;
    if (!drops || drops.length === 0) return [];
    const result: { itemId: string; quantity: number }[] = [];
    for (const drop of drops) {
      if (Math.random() > drop.chance) continue;
      const min = drop.minQty ?? 1;
      const max = drop.maxQty ?? min;
      const qty = min + Math.floor(Math.random() * (max - min + 1));
      if (qty > 0) result.push({ itemId: drop.itemId, quantity: qty });
    }
    return result;
  }

  /** Respawn an NPC back to full health and idle state */
  respawn(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (!npc) return;
    npc.hp = npc.maxHp;
    npc.state = 'idle';
    npc.targetPlayerId = null;
  }

  /**
   * Schedule NPC respawn after death. Uses the scheduler if available, otherwise setTimeout.
   * If the NPC has no respawnSeconds configured, returns undefined.
   */
  scheduleRespawn(npcId: string, callback?: () => void): (() => void) | undefined {
    const npc = this.npcs.get(npcId);
    if (!npc) return undefined;
    const seconds = npc.def.respawnSeconds ?? 0;
    if (seconds <= 0) return undefined;
    const doRespawn = () => {
      this.respawn(npcId);
      if (callback) callback();
    };
    if (this.scheduler) {
      const id = `npc-respawn:${npcId}`;
      this.scheduler.schedule(id, seconds * 1000, doRespawn);
      return () => this.scheduler!.cancel(id);
    }
    const handle = setTimeout(doRespawn, seconds * 1000);
    return () => clearTimeout(handle);
  }
}
