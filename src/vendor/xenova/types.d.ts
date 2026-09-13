export type Neuron = [number, string, string, string, string, number, [number,number,number] | null];
export type Graph = {n:number;neurons:Neuron[];sign:Int32Array;offsets:Uint32Array;sources:Uint32Array;counts:Uint32Array;manifest:{neurons:number;edges:number;synapses:number;dataset:string;selection:string}};
export type Batch = {counts:Uint32Array;tick:number;total:number;rates?:Float32Array};
