import { isPrefLeaf, type PrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { deepEqual, isPlainObject } from '@weasel-js/registry';

/** A leaf's fields that say only how it is drawn and when, never what a value at it reads as or may be. */
const LOOKS = new Set([
  'name', 'description', 'icon', 'short', 'pair', 'block', 'heading', 'hidden', 'showIf', 'enableIf', 'activeIf',
  'disabledReason', 'placeholder', 'control', 'readout', 'tags', 'meta', 'access',
]);
/** An option's, likewise. */
const OPTION_LOOKS = new Set(['label', 'description', 'icon', 'short']);

const strip = (o: Record<string, unknown>, looks: ReadonlySet<string>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([key]) => !looks.has(key)));

function membersMeaning(members: PrefSection['members']): Record<string, unknown> {
  return Object.fromEntries(Object.entries(members).map(([key, member]) =>
    [key, isPrefLeaf(member) ? leafMeaning(member) : membersMeaning(member.members)]));
}

function leafMeaning(leaf: PrefLeaf): Record<string, unknown> {
  const out = strip(leaf as unknown as Record<string, unknown>, LOOKS);
  const { children, item, options } = out;
  if (isPlainObject(children)) out.children = membersMeaning(children as PrefSection['members']);
  if (isPlainObject(item)) out.item = leafMeaning(item as unknown as PrefLeaf);
  if (Array.isArray(options)) out.options = options.map((o) => (isPlainObject(o) ? strip(o, OPTION_LOOKS) : o));
  return out;
}

/** Whether a value at `a` and one at `b` read, bound, and reset alike: the two differ at most in how they are drawn. */
export const sameMeaning = (a: PrefLeaf, b: PrefLeaf): boolean =>
  a === b || deepEqual(leafMeaning(a), leafMeaning(b), { undefinedAsAbsent: true });
