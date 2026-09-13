import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chefCue } from './chefPerformance.ts';
import { INITIAL_STATE, TOTAL_DURATION } from './simulation.ts';

test('manual tool practice uses a stationary work station without advancing the recipe', () => {
  for (const [manual, action, station] of [['chop', 'chopping', 'prep'], ['stir', 'stirring', 'qazan']] as const) {
    const cue = chefCue(INITIAL_STATE, manual);
    assert.equal(cue.action, action);
    assert.equal(cue.station, station);
    assert.equal(cue.active, true);
    assert.equal(cue.carrying, null);
    assert.ok(cue.signals[2] > cue.signals[0]);
  }
  assert.equal(INITIAL_STATE.elapsed, 0);
});

test('transfers connect cooking stations and finish before a tool action starts', () => {
  const state = { ...INITIAL_STATE, running: true, started: true };
  const departing = chefCue(state, 'auto', 28);
  const arriving = chefCue(state, 'auto', 29.999);
  assert.equal(departing.action, 'flying');
  assert.equal(departing.from, 'qazan');
  assert.equal(departing.station, 'prep');
  assert.equal(departing.progress, 0);
  assert.ok(arriving.progress > .99);
  assert.equal(chefCue(state, 'auto', 30).action, 'chopping');
  assert.equal(chefCue(state, 'auto', 36).carrying, 'carrot');
  assert.equal(chefCue(state, 'auto', 38).action, 'stirring');
});

test('pausing preserves the pose and activity identity; reset returns to idle', () => {
  const state = { ...INITIAL_STATE, running: true, started: true, elapsed: 40 };
  const playing = chefCue(state, 'auto');
  const paused = chefCue({ ...state, running: false }, 'auto');
  assert.equal(paused.action, playing.action);
  assert.deepEqual(paused.signals, playing.signals);
  assert.equal(paused.active, false);
  assert.equal(chefCue(INITIAL_STATE, 'auto').action, 'idle');
});

test('rice is carried then poured, with no automatic stirring after rice layering', () => {
  const state = { ...INITIAL_STATE, running: true, started: true };
  assert.equal(chefCue(state, 'auto', 62).carrying, 'rice');
  assert.equal(chefCue(state, 'auto', 65).action, 'pouring');
  for (let elapsed = 58; elapsed < TOTAL_DURATION; elapsed += .25) assert.notEqual(chefCue(state, 'auto', elapsed).action, 'stirring');
  assert.equal(chefCue(state, 'auto', TOTAL_DURATION).action, 'celebrating');
});
