/** The page-input channels on each surface, so a key or a paste the one holding the keys declines reaches the others there. */

/** Offer a keystroke to a channel with the keys held, as though its dispatcher held them. */
export type TakeKey = (e: KeyboardEvent) => void;
/** Offer a paste the same way. */
export type TakePaste = (e: ClipboardEvent) => void;

/** One dispatcher's channels on a surface; either may be off. */
export interface SurfacePeer {
  key?: TakeKey | undefined;
  paste?: TakePaste | undefined;
}

interface PeerInput { key: KeyboardEvent; paste: ClipboardEvent }

const PEERS = new WeakMap<Element, SurfacePeer[]>();

/** List `peer` on `surface` until the returned release runs. */
export function joinSurface(surface: Element, peer: SurfacePeer): () => void {
  const peers = PEERS.get(surface) ?? [];
  peers.push(peer);
  PEERS.set(surface, peers);
  let joined = true;
  return () => {
    if (!joined) return;
    joined = false;
    peers.splice(peers.indexOf(peer), 1);
    if (peers.length === 0 && PEERS.get(surface) === peers) PEERS.delete(surface);
  };
}

/** Offer `e`, which `from` declined, to each other `kind` channel on `surface` in the order they joined, until one takes it. */
export function passOn<K extends keyof PeerInput>(
  surface: Element, kind: K, from: (e: PeerInput[K]) => void, e: PeerInput[K],
): void {
  for (const peer of [...(PEERS.get(surface) ?? [])]) {
    if (e.defaultPrevented) return;
    const take = peer[kind] as ((e: PeerInput[K]) => void) | undefined;
    if (take && take !== from) take(e);
  }
}
