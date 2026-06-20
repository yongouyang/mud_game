export interface Exit {
  direction: string;
  roomId: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  items?: string[];  // item names placed in this room
}
