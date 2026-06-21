export interface PlayerCondition {
  id: string;
  name: string;
  level: number;
  remain: number; // ticks remaining
  source?: string;
  appliedAt: number; // timestamp from SystemClock
}

export interface ConditionDef {
  id: string;
  name: string;
  tickSeconds: number;
  baseDamage: number;
  damageType: 'hp' | 'mp';
  defaultLevel: number;
  dispelCostBase: number;
  messages: {
    apply: string;
    tick: string;
    cure: string;
    dispel: string;
  };
}
