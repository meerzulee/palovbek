export type QazanConditions = {
  added: readonly string[];
  temperature: number;
  water: number;
  covered: boolean;
  hydration: number;
  browning: number;
  burn: number;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function qazanActivity(state: QazanConditions) {
  const hasFood = state.added.length > 0;
  const rice = state.added.includes('rice');
  const wet = state.water > .015;
  const simmer = hasFood && wet ? clamp((state.temperature - 85) / 14) : 0;
  const sizzle = hasFood && !wet && !rice && state.added.some(id => id !== 'oil') ? clamp((state.temperature - 90) / 50) : 0;
  const shimmer = hasFood && !wet && !rice ? clamp((state.temperature - 45) / 90) : 0;
  const absorption = rice ? 1 - clamp(state.hydration) * .8 : 1;
  const bubbles = state.covered ? 0 : Math.max(simmer * absorption, sizzle * .35);
  const steam = hasFood ? Math.max(simmer * (rice ? .7 : 1), sizzle * .15) : 0;
  const phase = !hasFood ? 'empty' : state.covered ? steam > 0 ? 'steaming' : 'covered' : simmer > 0 ? state.temperature >= 96 ? 'boiling' : 'simmering' : sizzle > 0 ? 'sizzling' : shimmer > 0 ? 'shimmering' : 'warming';
  return { phase, rice, wet, simmer, sizzle, shimmer, bubbles, steam };
}
