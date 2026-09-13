import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAIN_GPU_LIMITS, supportsBrainGPU } from './browserSupport.ts';
import type { ProbeGPU } from './browserSupport.ts';

test('missing, rejected, and unavailable WebGPU adapters select the demo', async () => {
  assert.equal(await supportsBrainGPU(undefined), false);
  assert.equal(await supportsBrainGPU({requestAdapter:async()=>null}), false);
  assert.equal(await supportsBrainGPU({requestAdapter:async()=>{throw Error('Disabled');}}), false);
});

test('the full graph limits and a usable device are required', async () => {
  let requested=0,destroyed=0;
  const adapter={limits:{...BRAIN_GPU_LIMITS},requestDevice:async(options:{requiredLimits:typeof BRAIN_GPU_LIMITS})=>{
    requested++;assert.deepEqual(options.requiredLimits,BRAIN_GPU_LIMITS);return {destroy(){destroyed++;}};
  }};
  const gpu:ProbeGPU={requestAdapter:async()=>adapter};
  adapter.limits.maxStorageBufferBindingSize--;
  assert.equal(await supportsBrainGPU(gpu),false);assert.equal(requested,0);
  adapter.limits.maxStorageBufferBindingSize++;
  assert.equal(await supportsBrainGPU(gpu),true);assert.equal(destroyed,1);
  adapter.requestDevice=async()=>{throw Error('Device allocation refused');};
  assert.equal(await supportsBrainGPU(gpu),false);
});

test('a stalled device request falls back and releases a late device', async () => {
  let finish!:(device:{destroy():void})=>void,destroyed=0;
  const gpu:ProbeGPU={requestAdapter:async()=>({limits:BRAIN_GPU_LIMITS,requestDevice:()=>new Promise(resolve=>{finish=resolve;})})};
  assert.equal(await supportsBrainGPU(gpu,10),false);
  finish({destroy(){destroyed++;}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(destroyed,1);
});
