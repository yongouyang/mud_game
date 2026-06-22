import { PlayerManager } from './systems/PlayerManager.js';
import { MapSystem } from './systems/MapSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { ItemSystem } from './systems/ItemSystem.js';
import { NpcSystem } from './systems/NpcSystem.js';
import { SchoolSystem } from './systems/SchoolSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { ConditionSystem } from './systems/ConditionSystem.js';
import { BankSystem } from './systems/BankSystem.js';
import { AuctionSystem } from './systems/AuctionSystem.js';
import { ShopSystem } from './systems/ShopSystem.js';
import { CraftingSystem } from './systems/CraftingSystem.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { ChatSystem } from './systems/ChatSystem.js';
import { TradeSystem } from './systems/TradeSystem.js';
import { GuildSystem } from './systems/GuildSystem.js';
import { CommandRouter } from './engine/CommandRouter.js';
import { TestSystemClock } from './time/SystemClock.js';
import { Scheduler } from './time/Scheduler.js';

export interface TestGameContext {
  clock: TestSystemClock;
  scheduler: Scheduler;
  players: PlayerManager;
  map: MapSystem;
  combat: CombatSystem;
  skills: SkillSystem;
  items: ItemSystem;
  npcs: NpcSystem;
  schools: SchoolSystem;
  levels: LevelSystem;
  conditions: ConditionSystem;
  bank: BankSystem;
  auction: AuctionSystem;
  shop: ShopSystem;
  craft: CraftingSystem;
  quests: QuestSystem;
  router: CommandRouter;
}

export function createTestContext(initialTime: number = 0, existingPlayers?: PlayerManager): TestGameContext {
  const clock = new TestSystemClock(initialTime);
  const scheduler = new Scheduler(clock);
  const players = existingPlayers || new PlayerManager(clock);
  const map = new MapSystem(scheduler);
  const combat = new CombatSystem();
  const schools = new SchoolSystem();
  const skills = new SkillSystem(schools);
  const conditions = new ConditionSystem(clock);
  const items = new ItemSystem(conditions);
  const npcs = new NpcSystem(skills, scheduler);
  const levels = new LevelSystem();
  const bank = new BankSystem(items);
  const auction = new AuctionSystem(items, scheduler);
  const shop = new ShopSystem(items);
  const craft = new CraftingSystem(items, skills);
  const quests = new QuestSystem(items, levels);
  const chat = new ChatSystem(players);
  const trade = new TradeSystem(players, items);
  const guilds = new GuildSystem(players);
  const router = new CommandRouter(
    players, map, combat, skills, items, npcs, schools,
    levels, conditions, bank, auction, shop, craft, quests, chat, trade, guilds, scheduler, clock,
  );
  return { clock, scheduler, players, map, combat, skills, items, npcs, schools, levels, conditions, bank, auction, shop, craft, quests, router };
}
