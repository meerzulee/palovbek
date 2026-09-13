import type { Graph, Batch } from './types';
export class BrainCPU {constructor(graph:Graph, options?:{seed:number});seed:number;tick:number;v:Float32Array;g:Float32Array;until:Uint32Array;counts:Uint32Array;history:number[][];active:Uint32Array;present:Uint8Array;activeCount:number;reset():void;batch(steps:number,rates:Float32Array,silenced?:boolean):Batch;}
