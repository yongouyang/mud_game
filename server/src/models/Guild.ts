export type GuildRank = 'leader' | 'elder' | 'member';

export interface GuildMember {
  playerName: string;
  rank: GuildRank;
  joinedAt: number;
}

export interface Guild {
  id: string;
  name: string;
  leaderId: string;
  members: GuildMember[];
  created: number;
}
