import test from 'node:test';
import assert from 'node:assert/strict';
import { neuralCooking, neuralCue } from './neural.ts';
import type { NeuralSnapshot, NeuralWorld } from './neural.ts';

function snapshot(world: Partial<NeuralWorld>) {
  return { running: true, world: {station: 'prep', held: null, added: [], heat: .55, outcome: null, last_result: 'Waiting', pending: null, ...world} } as NeuralSnapshot;
}
const action = (name: string, from: 'prep' | 'qazan' | 'yard' = 'prep', to = from) => ({id:1, name, from, to, elapsed:1, duration:2, held:null});
test('neural rendering never invents a recipe or makes an invalid tool attempt succeed', () => {
  const invalid = snapshot({pending:action('chop')});
  assert.equal(neuralCue(invalid).action, 'watching');
  assert.deepEqual(neuralCooking(invalid, true).added, []);
  assert.equal(neuralCooking(invalid, true).elapsed, 0);
  assert.equal(neuralCue(snapshot({held:'carrot', pending:action('chop')})).action, 'chopping');
  assert.equal(neuralCue(snapshot({station:'yard', held:'carrot', pending:action('chop','yard')})).action, 'watching');
  assert.equal(neuralCue(snapshot({station:'qazan', added:['oil'], held:'carrot', pending:action('stir','qazan')})).action, 'watching');
});
test('only station transfers fly; valid stirring stays planted with empty forelegs', () => {
  const stir = neuralCue(snapshot({station:'qazan', added:['oil'], pending:action('stir','qazan')}));
  assert.equal(stir.action, 'stirring');
  assert.equal(stir.station, 'qazan');
  const travel = neuralCue(snapshot({held:'carrot', pending:action('go_qazan','prep','qazan')}));
  assert.equal(travel.action, 'flying'); assert.equal(travel.carrying, 'carrot'); assert.equal(travel.progress, .5);
  assert.equal(neuralCue(snapshot({pending:action('go_prep')})).action, 'watching');
});
test('disconnect and terminal failures never fall back to an automatic cooking timeline', () => {
  const failed = snapshot({outcome:'failed_recipe', added:['rice']});
  assert.equal(neuralCooking(failed, false).running, false);
  assert.equal(neuralCooking(failed, false).elapsed, 0);
  assert.equal(neuralCue(failed, false).active, false);
  assert.notEqual(neuralCue(failed, false).action, 'celebrating');
});
