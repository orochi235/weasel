import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';

/** Where a drop would land in a form: beside the leaf or the rail entry at `path`, or into the group there. `''` is the root. */
export interface PrefDropMark {
  path: string;
  where: 'before' | 'after' | 'into';
  /** The pointer is over the group's rail entry, not over what the pane draws for it. */
  rail?: boolean;
}

/**
 * A drag over a form: where it would drop, and what. The form lays itself out as it would after the drop, with
 * `nodes` drawn at the mark as placeholders and nothing drawn where they sit now.
 */
export interface PrefDrop extends Omit<PrefDropMark, 'where'> {
  /** `'home'` is nowhere: each node of `from` is drawn as a placeholder where it sits, and `path` is not read. */
  where: PrefDropMark['where'] | 'home';
  nodes: ReadonlyArray<PrefLeaf | PrefGroup>;
  /** Dotted path of each node that is already in the form's schema, in the order of `nodes`. None for new nodes. */
  from?: readonly string[];
}

/** Starts the key a placeholder is drawn under. No schema key holds a NUL, so no path collides with one. */
const DROP_KEY = '\u0000drop';

const join = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

/** Whether `path` is a placeholder's, or lies inside one. */
export function isDropPath(path: string): boolean {
  return path.includes(DROP_KEY);
}

/** For a placeholder's own path, and not that of something inside one, the index of its node in the drop's `nodes`. */
export function dropSlot(path: string): string | undefined {
  const at = path.indexOf(DROP_KEY);
  return at >= 0 && !path.includes('.', at) ? path.slice(at + DROP_KEY.length) : undefined;
}

/** Where `drop` draws its `index`th node. */
export function dropPlacedPath(drop: Pick<PrefDrop, 'path' | 'where' | 'from'>, index: number): string {
  const beside = drop.where === 'home' ? drop.from?.[index] ?? '' : drop.path;
  const parent = drop.where === 'into' ? beside : beside.split('.').slice(0, -1).join('.');
  return join(parent, `${DROP_KEY}${index}`);
}

/** The path a row reads its value at: its own, or for a placeholder the path its node was dragged from. */
export function dropValuePath(drop: PrefDrop | null | undefined, path: string): string {
  const at = path.indexOf(DROP_KEY);
  if (at < 0 || !drop?.from) return path;
  const [slot, ...rest] = path.slice(at + DROP_KEY.length).split('.');
  const from = drop.from[Number(slot)];
  return from === undefined ? path : [from, ...rest].join('.');
}

/** Where a form draws what `path` named before `drop`: the placeholder's path for a node being dragged, else `path`. */
export function dropDrawnPath(drop: PrefDrop | null, path: string): string {
  const from = drop?.from ?? [];
  for (let i = 0; i < from.length; i++) {
    if (path === from[i]) return dropPlacedPath(drop!, i);
    if (path.startsWith(`${from[i]}.`)) return dropPlacedPath(drop!, i) + path.slice(from[i]!.length);
  }
  return path;
}

/** `root` as it would be after `drop`: its nodes at the mark under placeholder keys, and gone from where they were. */
export function withDrop(root: PrefGroup, drop: PrefDrop): PrefGroup {
  const from = drop.from ?? [];
  const lifted = new Set(from);
  const placed = drop.nodes.map((node, i): [string, PrefLeaf | PrefGroup] => [`${DROP_KEY}${i}`, node]);
  const walk = (group: PrefGroup, path: string): PrefGroup => {
    const out: Array<[string, PrefLeaf | PrefGroup]> = [];
    for (const [key, child] of Object.entries(group.children)) {
      const p = join(path, key);
      const here = drop.path === p;
      if (here && drop.where === 'before') out.push(...placed);
      if (!lifted.has(p)) out.push([key, isPrefLeaf(child) ? child : walk(child, p)]);
      else if (drop.where === 'home' && placed[from.indexOf(p)]) out.push(placed[from.indexOf(p)]!);
      if (here && drop.where === 'after') out.push(...placed);
    }
    if (drop.where === 'into' && drop.path === path) out.push(...placed);
    return { ...group, children: Object.fromEntries(out) };
  };
  return walk(root, '');
}
