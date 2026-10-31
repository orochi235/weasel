/**
 * C4's element kinds, as the macro naming each and the shape it reads into:
 * its outline, theme role, and the `<<kind>>` row that names it again on write.
 */
import type { Outline, Row, RowTextStyle } from '@weasel-js/diagram';

/** An element: what it is, whether it is a store or a queue of that, and whether it is outside the system. */
export interface C4Kind {
  base: 'person' | 'system' | 'container' | 'component';
  variant?: 'db' | 'queue';
  external: boolean;
}

/** The element macros: `Person`, `SystemDb_Ext`, `ContainerQueue`, … */
const ELEMENT = /^(Person|System|Container|Component)(Db|Queue)?(_Ext)?$/;

/** The kind an element macro names, or null for a macro that is not an element. */
export function kindOfMacro(macro: string): C4Kind | null {
  const m = ELEMENT.exec(macro);
  if (m === null || (m[1] === 'Person' && m[2] !== undefined)) return null;
  return {
    base: m[1]!.toLowerCase() as C4Kind['base'], external: m[3] !== undefined,
    ...(m[2] !== undefined ? { variant: m[2].toLowerCase() as 'db' | 'queue' } : {}),
  };
}

/** The macro naming `kind`. */
export function macroOf(kind: C4Kind): string {
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  return `${cap(kind.base)}${kind.variant !== undefined ? cap(kind.variant) : ''}${kind.external ? '_Ext' : ''}`;
}

/** Whether an element of `kind` carries a technology: containers and components do. */
export const hasTechnology = (kind: C4Kind): boolean => kind.base === 'container' || kind.base === 'component';

/** The text of the row naming `kind`: `external_system_db`. */
export const stereotypeOf = (kind: C4Kind): string =>
  `${kind.external ? 'external_' : ''}${kind.base}${kind.variant !== undefined ? `_${kind.variant}` : ''}`;

/** The kind a `<<…>>` row names, or null. */
export function kindOfStereotype(text: string): C4Kind | null {
  const m = /^<<(external_)?(person|system|container|component)(?:_(db|queue))?>>$/.exec(text);
  if (m === null) return null;
  return { base: m[2] as C4Kind['base'], external: m[1] !== undefined, ...(m[3] !== undefined ? { variant: m[3] as 'db' | 'queue' } : {}) };
}

/** The outline an element of `kind` is drawn in. */
export const outlineOf = (kind: C4Kind): Outline =>
  (kind.base === 'person' ? 'person' : kind.variant === 'db' ? 'cylinder' : kind.variant === 'queue' ? 'queue' : 'roundRect');

/** The theme role an element is drawn in: `muted` outside the system, else `accent`. */
export const roleOf = (kind: C4Kind): string => (kind.external ? 'muted' : 'accent');

/** An element's box is at least this wide, so a description wraps rather than stretching it. */
export const ELEMENT_WIDTH = 200;
/** A description's rows wrap at this many characters. */
const WRAP = 32;

const SMALL: RowTextStyle = { fontSize: 10 };

/** `text` broken at spaces into lines of at most {@link WRAP} characters, a longer word on a line of its own. */
export function wrapped(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const last = out.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= WRAP) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

/** An element's rows: its `<<kind>>`, its name in bold, its `[technology]`, and its description, wrapped. */
export function elementRows(kind: C4Kind, name: string, technology: string | undefined, description: string | undefined): Row[] {
  return [
    { kind: 'label', text: `<<${stereotypeOf(kind)}>>`, style: SMALL },
    { kind: 'label', text: name, style: { bold: true } },
    ...(technology !== undefined && technology !== '' ? [{ kind: 'label' as const, text: `[${technology}]`, style: SMALL }] : []),
    ...wrapped(description ?? '').map((text): Row => ({ kind: 'label', text })),
  ];
}

/** An element's parts again from its rows; a box with no `<<kind>>` row is a system, or a person, store, or queue by its outline. */
export function elementParts(lines: readonly string[], outline: Outline | undefined, role: string | undefined) {
  const named = kindOfStereotype(lines[0] ?? '');
  const rest = named !== null ? lines.slice(1) : lines;
  const kind: C4Kind = named ?? {
    base: outline === 'person' || outline === 'actor' ? 'person' : 'system', external: role === 'muted',
    ...(outline === 'cylinder' ? { variant: 'db' as const } : outline === 'queue' ? { variant: 'queue' as const } : {}),
  };
  const tech = /^\[(.*)\]$/.exec(rest[1] ?? '');
  return {
    kind, name: rest[0] ?? '', technology: tech?.[1],
    description: rest.slice(tech !== null ? 2 : 1).join(' '),
  };
}
