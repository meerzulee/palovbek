import { demoTransferMultiplier } from './playback.ts';
export type IngredientId = 'oil' | 'onion' | 'lamb' | 'carrot' | 'spice' | 'garlic' | 'rice' | 'quince' | 'chickpea' | 'raisin' | 'egg' | 'qazi' | 'quail';
export const INGREDIENTS: { id: IngredientId; name: string; amount: string; color: string; note: string }[] = [
  { id: 'oil', name: 'Oil', amount: '150 ml', color: '#dfb450', note: 'The beginning of a beautiful zirvak.' },
  { id: 'onion', name: 'Onion', amount: '2 onions', color: '#bb87a8', note: 'A little sweetness, a lot of character.' },
  { id: 'lamb', name: 'Lamb', amount: '500 g', color: '#c88370', note: 'Browned edges. Oshpaz-approved.' },
  { id: 'carrot', name: 'Carrot', amount: '500 g', color: '#df8a40', note: 'Cut into matchsticks, never grated.' },
  { id: 'spice', name: 'Cumin', amount: '2 tsp', color: '#a8895a', note: 'That unmistakable plov aroma.' },
  { id: 'garlic', name: 'Garlic', amount: '2 bulbs', color: '#d0bba0', note: 'Whole bulbs. Trust the process.' },
  { id: 'rice', name: 'Rice', amount: '500 g', color: '#e0cfa4', note: 'The grand finale: a fluffy layer of rice.' },
];
export const STAGES: { name: string; short: string; duration: number; ingredients: IngredientId[]; action: string; thought: string; description: string }[] = [
  { name: 'Heat the qazan', short: 'Heat', duration: 10, ingredients: ['oil'], action: 'Warming up the qazan', thought: 'First, we make it cozy.', description: 'Light the wood fire and let the oil shimmer.' },
  { name: 'Build the zirvak', short: 'Sizzle', duration: 18, ingredients: ['onion', 'lamb'], action: 'Browning the lamb & onions', thought: 'Smells like a good decision.', description: 'Brown the onions and lamb for a rich, golden base.' },
  { name: 'Carrots & cumin', short: 'Season', duration: 15, ingredients: ['carrot', 'spice'], action: 'Adding carrots & a little magic', thought: 'My six legs were made for this.', description: 'Soften the carrot matchsticks and wake up the cumin.' },
  { name: 'Let it simmer', short: 'Simmer', duration: 15, ingredients: ['garlic'], action: 'Simmering the fragrant zirvak', thought: 'Patience is an ingredient.', description: 'Add water and whole garlic bulbs. Let the flavors mingle.' },
  { name: 'Layer the rice', short: 'Rice', duration: 15, ingredients: ['rice'], action: 'Gently layering the rice', thought: 'No stirring. I am a professional.', description: 'Spread the rinsed rice on top and let it absorb the broth.' },
  { name: 'Steam & serve', short: 'Feast', duration: 17, ingredients: [], action: 'Steaming the final masterpiece', thought: 'A tiny chef. A very big moment.', description: 'Lower the fire, cover, and steam. Then gather your friends.' },
];
export const TOTAL_DURATION = STAGES.reduce((sum, stage) => sum + stage.duration, 0);
export type CookingState = { running: boolean; elapsed: number; heat: number; speed: number; added: IngredientId[]; started: boolean };
export const INITIAL_STATE: CookingState = { running: false, elapsed: 0, heat: 65, speed: 1, added: [], started: false };
export function stageAt(elapsed: number) {
  let boundary = 0;
  for (let i = 0; i < STAGES.length; i++) {
    boundary += STAGES[i].duration;
    if (elapsed < boundary) return i;
  }
  return STAGES.length - 1;
}
export function stageProgress(elapsed: number) {
  const index = stageAt(elapsed);
  const before = STAGES.slice(0, index).reduce((sum, s) => sum + s.duration, 0);
  return Math.min(1, (elapsed - before) / STAGES[index].duration);
}
export function tick(state: CookingState, seconds: number): CookingState {
  if (!state.running || seconds <= 0 || !Number.isFinite(seconds)) return state;
  const elapsed = Math.min(TOTAL_DURATION, state.elapsed + seconds * state.speed * demoTransferMultiplier(state.elapsed) * (0.35 + state.heat / 100));
  const stage = stageAt(elapsed);
  const autoAdded = STAGES.slice(0, stage + 1).flatMap(s => s.ingredients);
  return { ...state, elapsed, added: [...new Set([...state.added, ...autoAdded])], running: elapsed < TOTAL_DURATION };
}
