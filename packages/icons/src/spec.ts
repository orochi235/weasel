import { toIconRef, type IconRef } from './names';

/**
 * The icon a definition names: one glyph, or a subject with a mark set in its corner. Every field that
 * names an icon in data takes one, so a definition can say "a layer, with a plus" without a glyph drawn
 * for the pair.
 */
export type IconSpec = IconRef | IconComposite;

/** A subject glyph and the mark set in its corner. */
export interface IconComposite {
  readonly name: IconRef;
  /** A `ui:mark*` glyph saying what a press does to `name`: `ui:markAdd` on what it adds. */
  readonly mark?: IconRef;
}

/** A spec as its parts, or `undefined` for none. */
export function iconParts(spec: IconSpec | undefined): IconComposite | undefined {
  if (spec === undefined) return undefined;
  return typeof spec === 'string' ? { name: spec } : spec;
}

/** Every ref a spec names, subject first. */
export function iconSpecRefs(spec: IconSpec | undefined): IconRef[] {
  const parts = iconParts(spec);
  if (!parts) return [];
  return parts.mark ? [parts.name, parts.mark] : [parts.name];
}

/**
 * A value read at run time (a schema loaded as JSON) as a spec: a qualified name, or
 * `{ name, mark? }` holding them. Anything else, including a part that is not qualified, reads as none.
 */
export function toIconSpec(value: unknown): IconSpec | undefined {
  if (typeof value === 'string') return toIconRef(value);
  if (typeof value !== 'object' || value === null) return undefined;
  const { name, mark } = value as { name?: unknown; mark?: unknown };
  const subject = typeof name === 'string' ? toIconRef(name) : undefined;
  if (!subject) return undefined;
  if (mark === undefined) return { name: subject };
  const badge = typeof mark === 'string' ? toIconRef(mark) : undefined;
  return badge ? { name: subject, mark: badge } : undefined;
}
