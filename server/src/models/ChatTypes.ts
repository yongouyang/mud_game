/** Broadcast target for chat and social commands. */
export interface BroadcastTarget {
  type: 'room' | 'player' | 'world' | 'school';
  /** For 'room': the roomId; for 'player': the player socket id; for 'school': the schoolId */
  targetId?: string;
  /** Exclude this player from the broadcast (typically the sender). */
  excludePlayerId?: string;
  text: string;
}
