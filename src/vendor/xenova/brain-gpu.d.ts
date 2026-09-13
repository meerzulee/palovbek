import type { Graph, Batch } from './types';
export class BrainGPU {static create(graph:Graph,options?:{seed:number}):Promise<BrainGPU>;seed:number;tick:number;reset():Promise<void>;batch(steps:number,rates:Float32Array,silenced?:boolean):Promise<Batch>;destroy():void;}
