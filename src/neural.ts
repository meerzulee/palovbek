import type { ChefCue, Station } from './chefPerformance.ts';
import type { CookingState, IngredientId } from './simulation.ts';
import { chefHumor } from './chefHumor.ts';

export type Portion = {value:number;unit:string;factor:number};
export type NeuralWorld = {
  quantities?:Partial<Record<IngredientId,Portion>>; held_quantity?:Portion|null;
  time_limit: number; required_ingredients: IngredientId[];
  station: Station; held: IngredientId | null; available: IngredientId[]; added: IngredientId[];
  carrot_chops: number; temperature: number; heat: number; water: number; browning: number; hydration: number;
  burn: number; covered: boolean; elapsed: number; outcome: string | null;
  pending: { id: number; name: string; from: Station; to: Station; elapsed: number; duration: number; held: IngredientId | null } | null;
  last_action: string; last_result: string; action_serial: number; reward: number; mistakes: number;
  events: { time: number; action: string; result: string; success: boolean; reward: number }[];
};
export type CookingLogEntry = {
  id: number; time: number; action: string; result: string; success: boolean; instruction: string;
  temperature: number; heat: number; hydration: number; browning: number; burn: number;
  covered: boolean; ingredients: IngredientId[]; neural_choice?: {output_hz:number;factor:number;hesitation:number;fallback:boolean}; quantities?:Partial<Record<IngredientId,Portion>>; neural_seconds: number; spikes: number;
};
export type RecipeProgress = { recipe_id: string; name: string; stage: number; stages: string[]; step: number; total_steps: number; progress: number; label: string; blocked: string | null; done: boolean };
export type NeuralSnapshot = {
  type: 'snapshot'; protocol: 1; run_id: string; sequence: number; model_version: string; seed: number;
  running: boolean; sensory_enabled: boolean; output_silenced: boolean; checkpoint_available: boolean;
  controller: 'neural' | 'recipe'; recipe: RecipeProgress | null; continuous: boolean; completed_episodes: number;
  cooking_log: CookingLogEntry[]; log_count: number;
  world: NeuralWorld;
  neural: { simulated_seconds: number; window_seconds: number; total_spikes: number; window_spikes: number; active_neurons: number; population_hz: number[]; sample_counts: number[]; active_cells?: {body_id:string;type:string;count:number;hz:number}[] };
  decision: { action: string; reason: string; scores?: number[]; probabilities?: number[]; source?: string; blocked?: boolean; neural_choice?: {output_hz:number;factor:number;hesitation:number;fallback:boolean} } | null;
  performance: { frame_seconds?: number; playback_speed?: number; window_wall_seconds: number; simulation_speed: number; rss_bytes: number; backend?:string; memory_estimated?:boolean };
};
export type NeuralMetadata = {
  type: 'metadata'; protocol: 1; model_version: string; dataset: string; neurons: number; connections: number;
  synapse_weight_sum: number; decoder: string; actions: string[]; notice: string;
  sample_cells: { body_id: string; type: string; superclass: string; position: [number, number, number]; source_soma_voxels: number[]; region: number }[];
  brain_window_seconds: number; world_window_seconds: number;
};
export type NeuralCommand = 'start' | 'pause' | 'reset' | 'sensory' | 'silence_outputs' | 'checkpoint' | 'restore' | 'cook_recipe' | 'export_log';
export const actionLabel = (action: string) => action.replaceAll('_', ' ');

export function neuralCooking(snapshot: NeuralSnapshot | null, connected: boolean): CookingState {
  return { started: true, running: connected && !!snapshot?.running, elapsed: snapshot?.world.outcome === 'served' ? 90 : 0,
    heat: (snapshot?.world.heat ?? .55) * 100, speed: 1, added: snapshot?.world.added ?? [] };
}

// Translate physical actions into poses, never into recipe progression or new decisions.
export function neuralCue(snapshot: NeuralSnapshot | null, connected = true): ChefCue {
  const world = snapshot?.world, pending = world?.pending;
  const cue: ChefCue = { action: 'idle', label: 'Waiting for the local brain', thought: 'Do‘ppi on. What happens next?', station: world?.station ?? 'prep', from: world?.station ?? 'prep', progress: 0,
    active: connected && !!snapshot?.running, carrying: world?.held ?? null, signals: [0, 0, 0] };
  if (!world) return cue;
  cue.label = world.outcome ? `Attempt ended · ${actionLabel(world.outcome)}` : pending ? `Trying to ${actionLabel(pending.name)}` : world.last_result;
  cue.thought = world.outcome ? world.outcome === 'served' ? 'Osh tayyor!' : 'Well… that was an experiment.' : pending ? `Let’s try: ${actionLabel(pending.name)}.` : world.held ? `I have ${world.held}. Now what?` : 'Sensing the kitchen…';
  if (snapshot?.controller === 'recipe' && snapshot.recipe && !world.outcome) {
    cue.label = snapshot.recipe.label;
    const amount=world.held_quantity?`${world.held_quantity.value} ${world.held_quantity.unit} `:'';
    cue.thought=pending?.name==='stir'?'Feet planted. Spoon in. That’s the way.':pending?.name==='chop'?'Matchsticks, not confetti. Concentrate, Palovbek.':pending?.name==='add'&&world.held?`${amount}${world.held}. Into the qazan you go!`:world.held?`Precious cargo: ${amount}${world.held}. Coming through!`:world.covered?'A good oshpaz knows when to leave the lid alone.':snapshot.decision?.neural_choice&&pending?.name==='wait'?'A tiny pause. Let me judge this portion.':world.added.includes('rice')?'No stirring now. The rice has important work to do.':world.browning>0&&world.browning<.62?'Golden edges take patience. I have six legs and time.':snapshot.recipe.label+'.';
  }
  if (world.outcome === 'served') cue.action = 'celebrating';
  if (snapshot.controller === 'recipe' && !world.outcome) cue.thought = chefHumor(pending?.name ?? snapshot.decision?.action ?? '', pending?.id ?? world.action_serial, snapshot.recipe?.recipe_id, world.covered, world.added.includes('rice')) ?? cue.thought;
  if (!pending) return cue;
  cue.task = pending.name;
  cue.progress = Math.min(1, pending.elapsed / pending.duration);
  if (pending.name.startsWith('go_') && pending.from !== pending.to) {
    cue.action = 'flying'; cue.station = pending.to; cue.from = pending.from;
  } else if (pending.name === 'chop' && world.station === 'prep' && world.held === 'carrot') {
    cue.action = 'chopping'; cue.carrying = null; // The forelegs grip the knife and the carrot on the board.
  } else if (pending.name === 'stir' && world.station === 'qazan' && world.added.length > 0 && !world.covered && !world.held) {
    cue.action = 'stirring';
  } else if (pending.name === 'add' && world.station === 'qazan' && world.held && !world.covered) {
    cue.action = 'pouring';
  } else cue.action = 'watching';
  return cue;
}
