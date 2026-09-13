import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserKitchen } from './browserKitchen.ts';
import { neuralPortion } from './neuralChoice.ts';
for(const recipe of ['classic','quince','wedding','bedana'])for(const factor of [.8,1,1.2])test(`${recipe} completes with ${factor}× measured portions and correct technique`,()=>{
  const kitchen=new BrowserKitchen(recipe);kitchen.nextPortionFactor=factor;const w=kitchen.world;let chops=0;
  for(let i=0;i<1681&&!w.outcome;i++){
    if(!w.pending){const decision=kitchen.choose();assert.equal(decision.blocked,false);if(decision.action==='chop')chops++;if(decision.action==='stir')assert(!w.added.includes('rice'));if(decision.action==='add'&&w.held==='carrot')assert(w.browning>=.62);if(decision.action==='cover')assert(w.heat<=.400001);if(decision.action==='serve')assert(w.hydration>=.9&&w.heat===0&&!w.covered);kitchen.begin(decision.action);}
    kitchen.advance();
  }
  assert.equal(w.outcome,'served');assert.deepEqual(w.added,w.required_ingredients);assert.equal(w.mistakes,0);assert.equal(chops,3);assert.equal(kitchen.progress().progress,100);assert.equal(w.quantities?.rice?.value,500*factor);assert.equal(w.quantities?.garlic?.value,2);
});
test('actual left/right output counts change portions and output rates change hesitation',()=>{
  assert.equal(neuralPortion(15,0,100).factor,1.2);assert.equal(neuralPortion(15,100,0).factor,.8);
  assert.equal(neuralPortion(1,20,20).hesitation,2);assert.equal(neuralPortion(20,20,20).hesitation,0);
  assert.deepEqual(neuralPortion(0,0,0),{output_hz:0,factor:1,hesitation:2,fallback:true});
});
test('a missing portion blocks instead of forging a completed dish',()=>{const kitchen=new BrowserKitchen();kitchen.world.available=[];assert(kitchen.choose().blocked);assert.equal(kitchen.world.outcome,null);});
