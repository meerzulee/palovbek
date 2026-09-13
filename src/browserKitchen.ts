import catalog from '../shared/recipes.json' with { type: 'json' };
import type { IngredientId } from './simulation.ts';
import type { NeuralWorld, RecipeProgress } from './neural.ts';
import type { Station } from './chefPerformance.ts';
export const RECIPE_VERSION = 'authored-plov-recipe-v1';
export const RECIPE_STAGES = ['Heat the oil','Brown onion & lamb','Chop & fry carrots','Make the zirvak','Layer the rice','Steam gently','Rest & serve'];
type Step = {stage:number;label:string;kind:'ingredient'|'temperature'|'browning'|'action'|'simmer'|'hydration'|'heat'|'rest';target:string|number};
const step=(stage:number,label:string,kind:Step['kind'],target:Step['target']):Step=>({stage,label,kind,target});
export class BrowserKitchen {
  world:NeuralWorld;
  steps:Step[];
  recipe:typeof catalog.recipes[number];
  nextPortionFactor=1;
  index=0; enteredAt=0; enteredSerial=0; blocked:string|null=null;
  constructor(recipeId='classic') {
    const recipe=catalog.recipes.find(item=>item.id===recipeId);
    if(!recipe) throw Error('Unknown recipe');
    this.recipe=recipe;
    this.steps=[
      step(0,'Bring the oil to the qazan','ingredient','oil'),step(0,'Let the oil heat up','temperature',115),
      step(1,'Add the onion to the hot oil','ingredient','onion'),step(1,'Fry the onion','action','stir'),
      step(1,'Add the lamb','ingredient','lamb'),step(1,'Brown the lamb before adding vegetables','browning',.62),
      step(2,'Chop the carrots, then bring them over','ingredient','carrot'),step(2,'Fold the carrots into the lamb','action','stir'),
      step(3,'Add the cumin','ingredient','spice'),step(3,'Add the garlic','ingredient','garlic'),
      ...recipe.extras.map(id=>step(3,`Add ${id} to the zirvak`,'ingredient',id)),
      step(3,'Add water for the zirvak','action','add_water'),step(3,'Let the zirvak simmer','simmer',recipe.simmer_seconds),
      step(4,'Layer the rice gently','ingredient','rice'),step(4,'Let the rice absorb broth without stirring','hydration',.25),
      step(5,'Lower the flame','heat',.4),step(5,'Cover the qazan','action','cover'),step(5,'Steam until the rice is cooked','hydration',.92),
      step(6,'Turn off the fire','heat',0),step(6,'Let the plov rest','rest',3),step(6,'Lift the lid','action','uncover'),
      ...recipe.garnishes.map(id=>step(6,`Finish with ${id}`,'ingredient',id)),step(6,'Osh tayyor! Serve the plov','action','serve'),
    ];
    const ingredients=this.steps.filter(item=>item.kind==='ingredient').map(item=>item.target as IngredientId);
    this.world={quantities:{},held_quantity:null,time_limit:420,required_ingredients:ingredients,station:'prep',held:null,available:[...ingredients],added:[],carrot_chops:0,temperature:22,heat:.55,water:0,browning:0,hydration:0,burn:0,covered:false,elapsed:0,outcome:null,pending:null,last_action:'wait',last_result:'The ingredients are prepared. Palovbek has a recipe to follow.',action_serial:0,reward:0,mistakes:0,events:[]};
  }
  record(result:string,success=true,reward=0) {
    const w=this.world;w.last_result=result;w.reward+=success?reward:-.1;w.mistakes+=Number(!success);
    w.events.push({time:w.elapsed,action:w.last_action,result,success,reward:success?reward:-.1});w.events=w.events.slice(-100);
  }
  begin(action:string) {
    const w=this.world;if(w.pending||w.outcome)throw Error('Action requires an idle, unfinished kitchen');
    const durations:Record<string,number>={go_prep:3,go_qazan:3,go_yard:3,chop:2,stir:2,add:1.5};
    w.pending={id:++w.action_serial,name:action,from:w.station,to:action.startsWith('go_')?action.slice(3) as Station:w.station,elapsed:0,duration:durations[action]??1,held:w.held};
  }
  advance(seconds=.25) {
    const w=this.world;if(w.outcome)return;
    if(!(seconds>0&&seconds<=1))throw Error('Invalid kitchen timestep');
    w.elapsed+=seconds;w.temperature+=(22+w.heat*235-w.temperature)*seconds/25;
    if(w.water>0&&w.temperature>99){w.temperature=99+(w.temperature-99)*.6;w.water=Math.max(0,w.water-seconds*(w.covered?.0015:.0035));}
    if(w.added.includes('lamb')&&w.temperature>115&&w.water<.05)w.browning=Math.min(1,w.browning+seconds*.012/(w.quantities?.lamb?.factor??1));
    if(w.added.includes('rice')&&w.water>0&&w.temperature>85)w.hydration=Math.min(1,w.hydration+seconds*(w.covered?.014:.008)/(w.quantities?.rice?.factor??1));
    if(w.added.length&&w.temperature>155&&w.water<.03)w.burn=Math.min(1,w.burn+seconds*(w.temperature-155)/1800);
    if(w.burn>=1){w.outcome='burned';this.record('The food burned. This attempt has ended.',false);w.pending=null;}
    else if(w.elapsed>=w.time_limit){w.outcome='timed_out';this.record('The experiment timed out with an unfinished dish.',false);w.pending=null;}
    else if(w.pending){w.pending.elapsed=Math.min(w.pending.duration,w.pending.elapsed+seconds);if(w.pending.elapsed>=w.pending.duration){const action=w.pending.name;w.pending=null;this.resolve(action);}}
    this.sync();
  }
  resolve(action:string) {
    const w=this.world;w.last_action=action;
    if(action.startsWith('go_')){w.station=action.slice(3) as Station;this.record(`Arrived at ${w.station}.`);}
    else if(action.startsWith('pick_')){const id=action.slice(5) as IngredientId;if(w.station!=='prep'||w.held||!w.available.includes(id))this.record(`Could not pick up ${id}: it must be nearby, with free forelegs.`,false);else{w.available=w.available.filter(item=>item!==id);w.held=id;const base=catalog.quantities[id];const whole=['bulbs','pieces','eggs','birds'].includes(base.unit);const value=whole?base.value:Math.round(base.value*this.nextPortionFactor*(base.unit==='tsp'?10:1))/(base.unit==='tsp'?10:1);w.held_quantity={value,unit:base.unit,factor:value/base.value};this.record(`Picked up ${value} ${base.unit} ${id}.`);}}
    else if(action==='chop'){if(w.station!=='prep'||w.held!=='carrot')this.record('The knife has no held carrot to chop at the prep table.',false);else{const before=w.carrot_chops;w.carrot_chops=Math.min(3,before+1);this.record('Chopped the carrot into matchsticks.',true,before<3?.1:0);}}
    else if(action==='wait')this.record('Waited and sensed the kitchen.');
    else if(w.station!=='qazan')this.record(`Cannot ${action.replaceAll('_',' ')} away from the qazan.`,false);
    else if(action==='add'){if(!w.held||w.covered)this.record('Could not add an ingredient: hands are empty or the lid is closed.',false);else{const id=w.held,quantity=w.held_quantity!;w.held=null;w.added.push(id);w.quantities![id]=quantity;w.held_quantity=null;this.record(`Added ${quantity.value} ${quantity.unit} ${id} to the qazan.`,true,.1);}}
    else if(action==='add_water'){if(w.covered)this.record('The lid blocks the water.',false);else{w.water=Math.min(1,w.water+.45);this.record('Added water.');}}
    else if(action==='stir'){if(w.covered||!w.added.length||w.held)this.record('Cannot stir a covered or empty qazan, or with occupied forelegs.',false);else{w.burn=Math.max(0,w.burn-.01);this.record('Stirred the food.');}}
    else if(action==='heat_up'||action==='heat_down'){w.heat=Math.max(0,Math.min(1,w.heat+(action==='heat_up'?.15:-.15)));this.record(`Fire adjusted to ${Math.round(w.heat*100)}%.`);}
    else if(action==='cover'||action==='uncover'){w.covered=action==='cover';this.record(w.covered?'Lid closed.':'Lid opened.');}
    else if(action==='serve'){const ready=this.ready();w.outcome=ready?'served':'failed_recipe';this.record(ready?"Osh tayyor! The dish met the toy kitchen's serving criteria.":'Served an unfinished or damaged dish. This attempt failed.',ready,ready?5:0);}
    else throw Error('Unknown cooking action: '+action);
  }
  ready(){const w=this.world;return w.added.join(',')===w.required_ingredients.join(',')&&w.carrot_chops===3&&w.browning>=.6&&w.hydration>=.9&&w.burn<.25;}
  completed(s:Step){const w=this.world;switch(s.kind){case'ingredient':return w.added.includes(s.target as IngredientId);case'action':return w.action_serial>this.enteredSerial&&w.last_action===s.target&&!!w.events.at(-1)?.success;case'temperature':return w.temperature>=Number(s.target);case'browning':return w.browning>=Number(s.target);case'hydration':return w.hydration>=Number(s.target);case'heat':return w.heat<=Number(s.target)+1e-9;case'simmer':return w.temperature>=95&&w.elapsed-this.enteredAt>=Number(s.target);case'rest':return w.elapsed-this.enteredAt>=Number(s.target);}}
  sync(){if(this.world.pending)return;while(this.index<this.steps.length&&this.completed(this.steps[this.index])){this.index++;this.enteredAt=this.world.elapsed;this.enteredSerial=this.world.action_serial;}}
  choose(){
    const w=this.world;if(w.pending||w.outcome)throw Error('Recipe can decide only at an idle action boundary');this.sync();
    const s=this.steps[Math.min(this.index,this.steps.length-1)];
    if(w.added.join(',')!==w.required_ingredients.slice(0,w.added.length).join(','))this.blocked='The ingredient order was changed. Reset for a fresh recipe.';
    if(s.kind==='ingredient'){const id=s.target as IngredientId;if(!w.available.includes(id)&&w.held!==id&&!w.added.includes(id))this.blocked=`The ${id} portion is missing. Reset for a fresh recipe.`;if(w.held&&w.held!==id)this.blocked=`The forelegs hold ${w.held}, but this step needs ${id}. Reset the recipe.`;}
    let action='wait';
    if(s.kind==='ingredient'){if(!w.held)action=w.station!=='prep'?'go_prep':`pick_${s.target}`;else if(s.target==='carrot'&&w.carrot_chops<3)action=w.station!=='prep'?'go_prep':'chop';else if(w.station!=='qazan')action='go_qazan';else action=w.covered?'uncover':'add';}
    else if(w.station!=='qazan')action='go_qazan';else if(s.kind==='action')action=String(s.target);else if(s.kind==='heat')action='heat_down';
    else if(s.kind==='temperature'||s.kind==='browning')action=w.heat<.5?'heat_up':w.heat>.6?'heat_down':s.kind==='browning'?'stir':'wait';
    else if(s.kind==='hydration'||s.kind==='simmer')action=w.temperature<90&&w.heat<.4?'heat_up':'wait';
    if(action==='serve'&&!this.ready())this.blocked='The dish does not meet the serving checks. Reset for a fresh recipe.';
    return {action:this.blocked?'wait':action,source:RECIPE_VERSION,reason:this.blocked??s.label,blocked:!!this.blocked};
  }
  progress():RecipeProgress{const s=this.steps[Math.min(this.index,this.steps.length-1)],done=this.world.outcome==='served';return {recipe_id:this.recipe.id,name:this.recipe.name,stage:s.stage,stages:RECIPE_STAGES,step:this.index,total_steps:this.steps.length,progress:done?100:Math.round(this.index/this.steps.length*100),label:done?'Osh tayyor! Plov is served.':this.blocked??s.label,blocked:this.blocked,done};}
  observe():Record<string,number>{const w=this.world;const cues:Record<string,number>={};for(const id of ['oil','onion','lamb','carrot','spice','garlic','rice'] as IngredientId[])cues[`odor_${id}`]=(w.available.includes(id)?1:.1)*(w.station==='prep'?1:.25);return {...cues,heat:w.temperature/260,contact:Number(!!w.held),prep_view:w.station==='prep'?1:.2,qazan_view:w.station==='qazan'?1:.2,moisture:w.water,smoke:w.burn};}
}
