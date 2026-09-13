import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, STAGES, TOTAL_DURATION, stageAt, stageProgress, tick } from './simulation.ts';

test('a paused kitchen does not advance or add ingredients', () => {
  assert.equal(tick(INITIAL_STATE, 30), INITIAL_STATE);
});
test('a full cooking run visits every stage and adds all seven ingredients once', () => {
  let state = { ...INITIAL_STATE, running: true, started: true };
  const visited = new Set<number>();
  for (let i = 0; i < 100; i++) { visited.add(stageAt(state.elapsed)); state = tick(state, 1); }
  assert.equal(visited.size, STAGES.length);
  assert.equal(state.elapsed, TOTAL_DURATION);
  assert.equal(state.running, false);
  assert.equal(state.added.length, 7);
  assert.equal(new Set(state.added).size, 7);
  assert.equal(stageProgress(state.elapsed), 1);
});
test('speed and fire change how quickly cooking advances', () => {
  const regular = tick({ ...INITIAL_STATE, running: true }, 5);
  const faster = tick({ ...INITIAL_STATE, running: true, speed: 2 }, 5);
  const cooler = tick({ ...INITIAL_STATE, running: true, heat: 10 }, 5);
  assert.equal(faster.elapsed, regular.elapsed * 2);
  assert.ok(cooler.elapsed < regular.elapsed);
});
test('large time steps add all skipped ingredients and stop at completion', () => {
  const result = tick({ ...INITIAL_STATE, running: true, added: ['rice'] }, 1000);
  assert.equal(result.added.length, 7);
  assert.equal(result.elapsed, TOTAL_DURATION);
  assert.equal(result.running, false);
});
test('stage boundaries and invalid deltas are handled consistently', () => {
  assert.equal(stageAt(9.99), 0);
  assert.equal(stageAt(10), 1);
  assert.equal(stageProgress(10), 0);
  const running = { ...INITIAL_STATE, running: true };
  assert.equal(tick(running, NaN), running);
  assert.equal(tick(running, -1), running);
});
