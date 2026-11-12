/**
 * Attributes several owners set on one element, as two `css` bridges on one root do. Each name shows the value of
 * whichever owner wrote it last and is still there, and goes once the last owner of it lets go.
 */
const CLAIMS = new WeakMap<Element, Map<string, Map<object, string>>>();

function show(host: Element, name: string, owners: Map<object, string>, byName: Map<string, Map<object, string>>): void {
  const last = [...owners.values()].at(-1);
  if (last === undefined) {
    byName.delete(name);
    host.removeAttribute(name);
  } else host.setAttribute(name, last);
}

/** Sets `attributes` on `host` for `owner`, and drops any name `owner` set before that `attributes` leaves out. */
export function claimAttributes(host: Element, owner: object, attributes: Record<string, string>): void {
  let byName = CLAIMS.get(host);
  if (byName === undefined) CLAIMS.set(host, (byName = new Map()));
  for (const [name, owners] of byName) {
    if (owners.has(owner) && !Object.hasOwn(attributes, name)) {
      owners.delete(owner);
      show(host, name, owners, byName);
    }
  }
  for (const [name, value] of Object.entries(attributes)) {
    let owners = byName.get(name);
    if (owners === undefined) byName.set(name, (owners = new Map()));
    owners.delete(owner);
    owners.set(owner, value);
    show(host, name, owners, byName);
  }
}

/** Lets go of every attribute `owner` set on `host`. */
export function releaseAttributes(host: Element, owner: object): void {
  claimAttributes(host, owner, {});
}
