import test from 'node:test';
import assert from 'node:assert/strict';
import { qazanActivity } from './qazanActivity.ts';
import { browserFrameDelay, cookingPlaybackSpeed, DEFAULT_PLAYBACK_SPEED, cookingFrameSeconds, taskFrameDelay } from './playback.ts';
const conditions = { added: ['oil', 'onion', 'lamb', 'carrot'], temperature: 98, water: .4, covered: false, hydration: 0, browning: .7, burn: 0 };

test('an empty qazan and cold broth do not pretend to boil', () => {
  for (const state of [{ ...conditions, added: [] }, { ...conditions, temperature: 22 }]) {
    assert.equal(qazanActivity(state).bubbles, 0);
    assert.equal(qazanActivity(state).steam, 0);
  }
  assert.equal(qazanActivity({ ...conditions, added: ['oil'], water: 0, temperature: 130 }).phase, 'shimmering');
  assert.equal(qazanActivity({ ...conditions, water: 0, temperature: 130 }).phase, 'sizzling');
});

test('hot broth boils, covered broth vents steam, and absorbed rice has fewer bubbles', () => {
  const boiling = qazanActivity(conditions), simmer = qazanActivity({ ...conditions, temperature: 91 });
  assert.equal(boiling.phase, 'boiling');
  assert.equal(simmer.phase, 'simmering');
  assert(boiling.bubbles > simmer.bubbles && boiling.steam > simmer.steam);
  const covered = qazanActivity({ ...conditions, covered: true });
  assert.equal(covered.phase, 'steaming'); assert.equal(covered.bubbles, 0); assert(covered.steam > 0);
  const rice = { ...conditions, added: [...conditions.added, 'rice'] };
  assert(qazanActivity({ ...rice, hydration: .95 }).bubbles < qazanActivity(rice).bubbles);
  assert.equal(qazanActivity({ ...rice, water: 0 }).bubbles, 0);
});

test('only early transfers slow down, including compute time in the playback cadence', () => {
  for (const action of ['pick_oil', 'go_qazan', 'go_prep', 'add']) {
    assert.equal(cookingPlaybackSpeed(action, 0), DEFAULT_PLAYBACK_SPEED / 2);
    assert.equal(cookingPlaybackSpeed(action, 4), DEFAULT_PLAYBACK_SPEED);
    for (const compute of [.01, .15, .6]) {
      const slow = compute * 1000 + browserFrameDelay(compute, cookingPlaybackSpeed(action, 0));
      const normal = compute * 1000 + browserFrameDelay(compute);
      assert(Math.abs(slow - normal * 2) < 1e-8);
    }
  }
  for (const action of ['chop', 'stir', 'wait', 'heat_up']) assert.equal(cookingPlaybackSpeed(action, 1), DEFAULT_PLAYBACK_SPEED);
});


test('each browser action gets 1–2 seconds without changing fixed simulation steps', () => {
  for (const [action, duration] of [['pick_oil',1],['go_qazan',3],['add',1.5],['chop',2],['stir',2],['cover',1],['uncover',1],['wait',1],['serve',1]] as const) {
    const frame=cookingFrameSeconds(action,duration), total=frame*Math.ceil(duration/.25);
    assert(total>=1 && total<=2, action);
    assert.equal(taskFrameDelay(frame+.1,frame),0);
    assert(Math.abs((.01+taskFrameDelay(.01,frame)/1000)*Math.ceil(duration/.25)-total)<1e-8);
  }
});
