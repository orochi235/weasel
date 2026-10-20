export const graphError = (msg: string): Error => new Error(`@weasel-js/audio: ${msg}`);

export const owns = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);

export const noNode = (id: string): Error => graphError(`no node "${id}"`);
export const duplicateNode = (id: string): Error => graphError(`a node "${id}" already exists`);
export const noPort = (id: string, port: string): Error =>
  graphError(`node "${id}" has no input port "${port}"`);
export const noParam = (id: string, param: string): Error =>
  graphError(`node "${id}" has no param "${param}"`);
export const closesCycle = (from: string, to: string): Error =>
  graphError(`connecting "${from}" to "${to}" would close a cycle`);
