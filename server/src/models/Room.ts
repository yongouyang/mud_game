export interface Exit {
  direction: string;
  roomId: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  items?: string[];                 // item names currently present in this room
  initialItems?: string[];          // item names that respawn here
  itemRespawnSeconds?: number;      // respawn interval for initialItems; default 60
}
