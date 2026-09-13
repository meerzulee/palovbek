import type { Graph } from './types';
import type { BrainGPU } from './brain-gpu';
export function checkGPU(create:(graph:Graph)=>Promise<BrainGPU>):Promise<{neurons:number;steps:number;totalSpikes:number;maxVoltageError:number;maxSynapticError:number}>;
