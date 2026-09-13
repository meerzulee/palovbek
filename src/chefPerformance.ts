import type { CookingState, IngredientId } from './simulation.ts';
import { TOTAL_DURATION } from './simulation.ts';
import { chefHumor } from './chefHumor.ts';

export type ChefAction = 'auto' | 'chop' | 'stir';
export type Station = 'prep' | 'qazan' | 'yard';
export type Activity = 'idle' | 'flying' | 'chopping' | 'stirring' | 'watching' | 'pouring' | 'celebrating';
export type ChefCue = {
  task?: string;
  action: Activity;
  label: string;
  thought: string;
  station: Station;
  from: Station;
  progress: number;
  active: boolean;
  carrying: IngredientId | null;
  // Artistic activity channels, not measurements or biological region assignments.
  signals: [number, number, number];
};

export function chefCue(cooking: CookingState, manual: ChefAction, elapsed = cooking.elapsed): ChefCue {
  const cue: ChefCue = { action: 'idle', label: 'Ready at the prep table', thought: 'Do‘ppi on. Feet planted. Let’s cook.', station: 'prep', from: 'prep', progress: 0, active: cooking.running || manual !== 'auto', carrying: null, signals: [.18, .12, .1] };
  const chop = () => Object.assign(cue, { action: 'chopping', label: 'Chopping carrot matchsticks', thought: chefHumor('chop', Math.floor(elapsed / 8) * 3), station: 'prep', signals: [.5, .38, .95] });
  const stir = () => Object.assign(cue, { action: 'stirring', label: 'Stirring the qazan', thought: chefHumor('stir', Math.floor(elapsed / 8) * 3), station: 'qazan', signals: [.45, .3, .85] });
  const travel = (from: Station, to: Station, start: number, end: number, carrying: ChefCue['carrying'] = null) => Object.assign(cue, { action: 'flying', label: carrying === 'carrot' ? 'Bringing over the carrots' : carrying === 'rice' ? 'Bringing over the rice' : to === 'prep' ? 'Heading to the prep table' : 'Heading to the qazan', thought: 'Precious cargo. Coming through!', station: to, from, progress: Math.max(0, Math.min(1, (elapsed - start) / (end - start))), carrying, signals: [.65, .95, .7] });
  if (manual === 'chop') chop();
  else if (manual === 'stir') stir();
  else if (!cooking.started) return cue;
  else if (elapsed >= TOTAL_DURATION) Object.assign(cue, { action: 'celebrating', label: 'Osh tayyor! A proud little chef.', thought: 'I would like to thank all six legs.', station: 'qazan', signals: [.65, .35, .5] });
  else if (elapsed < 2) travel('prep', 'qazan', 0, 2);
  else if (elapsed < 10) Object.assign(cue, { action: 'watching', label: 'Checking the hot oil', thought: 'Wait for the shimmer…', station: 'qazan', signals: [.8, .65, .25] });
  else if (elapsed < 28) stir();
  else if (elapsed < 30) travel('qazan', 'prep', 28, 30);
  else if (elapsed < 36) chop();
  else if (elapsed < 38) travel('prep', 'qazan', 36, 38, 'carrot');
  else if (elapsed < 49) stir();
  else if (elapsed < 58) Object.assign(cue, { action: 'watching', label: 'Watching the zirvak simmer', thought: 'Patience is an ingredient.', station: 'qazan', signals: [.75, .4, .2] });
  else if (elapsed < 60) travel('qazan', 'prep', 58, 60);
  else if (elapsed < 62) Object.assign(cue, { action: 'watching', label: 'Picking up the rice bowl', thought: 'A generous layer. Gently now.', station: 'prep', carrying: 'rice', signals: [.7, .55, .5] });
  else if (elapsed < 64) travel('prep', 'qazan', 62, 64, 'rice');
  else if (elapsed < 70) Object.assign(cue, { action: 'pouring', label: 'Pouring a layer of rice', thought: 'Rice on top. No stirring now.', station: 'qazan', progress: (elapsed - 64) / 6, carrying: 'rice', signals: [.65, .45, .9] });
  else Object.assign(cue, { action: 'watching', label: elapsed < 73 ? 'Letting the rice absorb the broth' : 'Letting the plov steam', thought: 'A tiny chef. A very big moment.', station: 'qazan', signals: [.5, .3, .15] });
  return cue;
}

export type MotionClock = { time: number; elapsed: number };
