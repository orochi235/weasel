export const graphError = (msg: string): Error => new Error(`@weasel-js/audio: ${msg}`);

export const noNode = (id: string): Error => graphError(`no node "${id}"`);
export const duplicateNode = (id: string): Error => graphError(`a node "${id}" already exists`);
export const noPort = (id: string, port: string): Error =>
  graphError(`node "${id}" has no input port "${port}"`);
export const noParam = (id: string, param: string): Error =>
  graphError(`node "${id}" has no param "${param}"`);
export const defInUse = (id: string): Error =>
  graphError(`the def given for "${id}" is already in the graph; each node takes a def of its own`);
export const closesCycle = (from: string, to: string): Error =>
  graphError(`connecting "${from}" to "${to}" would close a cycle`);
