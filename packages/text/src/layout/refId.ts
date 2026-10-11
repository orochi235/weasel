let nextRefId = 1;
const refIds = new WeakMap<object, number>();

/** A stable id for an object a string key cannot serialize. */
export function refId(o: object): number {
  let id = refIds.get(o);
  if (id === undefined) {
    id = nextRefId++;
    refIds.set(o, id);
  }
  return id;
}
