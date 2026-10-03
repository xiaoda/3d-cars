export type Workspace='studio'|'calibration'|'bmw';
export function workspaceFromHash(hash:string):Workspace{return hash==='#bmw'?'bmw':hash==='#calibration'?'calibration':'studio';}
