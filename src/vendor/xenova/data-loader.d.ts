import type { Graph } from './types';
export const GRAPH_CACHE: string;
export function configureAssetBase(base:string):void;
export function loadGraph(progress?:(value:number)=>void,notice?:(message:string)=>void):Promise<Graph>;
