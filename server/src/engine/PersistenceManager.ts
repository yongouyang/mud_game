import { PlayerManager } from '../systems/PlayerManager.js';
import { PersistenceSystem } from '../systems/PersistenceSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import { SystemClock } from '../time/SystemClock.js';

export const AUTOSAVE_INTERVAL_MS = 60_000;

/**
 * Orchestrates loading, saving, and cleanup of player data.
 * - Loads saved players on startup.
 * - Autosaves all online players on a timer.
 * - On disconnect: re-key the transient socket-id player back to their username,
 *   save, and remove the stale socket-id entry.
 * - Shutdown: final save.
 */
export class PersistenceManager {
  constructor(
    private players: PlayerManager,
    private persistence: PersistenceSystem,
    private scheduler: Scheduler,
    private clock: SystemClock,
  ) {}

  /** Load all saved players into the PlayerManager. */
  loadAll(): void {
    const saved = this.persistence.loadAll();
    for (const p of saved) {
      this.players.setPlayer(p);
    }
  }

  /** Persist all currently known players immediately (only if any are dirty). */
  saveAll(): void {
    if (!this.players.hasDirty()) return;
    this.persistence.saveAll(this.players.getAllPlayers());
    this.players.clearDirty();
  }

  /** Start periodic autosave. */
  startAutosave(intervalMs: number = AUTOSAVE_INTERVAL_MS): void {
    this.scheduler.schedule('autosave', intervalMs, () => {
      this.saveAll();
    }, intervalMs);
  }

  /** Handle a socket disconnect: save and remove the transient socket-id mapping. */
  onDisconnect(socketId: string, username?: string): void {
    const player = this.players.getPlayer(socketId);
    if (player && username) {
      player.id = username;
      this.players.setPlayer(player);
      this.saveAll();
      this.players.removePlayer(socketId);
    }
  }

  /** Final save for graceful shutdown. */
  shutdown(): void {
    this.saveAll();
  }
}
