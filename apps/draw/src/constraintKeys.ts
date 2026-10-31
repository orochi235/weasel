import type { ActionTunings, PathConstraintKind } from '@weasel-js/core';

// Alt+Shift, which no major browser takes for these letters; `code` too, since with Alt held on a Mac the key
// reads as another glyph.
const altShift = (letter: string) =>
  ({ kind: 'key', key: letter, code: `Key${letter.toUpperCase()}`, mods: { alt: true, shift: true } }) as const;

/** The constraint kinds with a key of their own; the rest are in the Constraints menu. */
const KIND_KEYS: Readonly<Partial<Record<PathConstraintKind, string>>> = {
  horizontal: 'h',
  vertical: 'v',
  parallel: 'l',
  perpendicular: 'p',
  coincident: 'c',
  fixed: 'f',
};

/** WeaselDraw's keys for path-tools' constraint actions, which bind none of their own. */
export const DRAW_TUNE: ActionTunings = {
  constrainAnchors: {
    bindings: Object.entries(KIND_KEYS).map(([kind, letter]) => ({
      spec: altShift(letter!),
      opts: { id: `draw.constrainAnchors.${kind}`, params: { kind: kind as PathConstraintKind } },
    })),
  },
  unconstrainAnchors: { bindings: [{ spec: altShift('u'), opts: { id: 'draw.unconstrainAnchors' } }] },
};
