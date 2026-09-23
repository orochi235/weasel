import type { SVGProps } from 'react';
import type { IconProps } from '../../../../icons/types';
import { ACTION_GLYPHS } from './actionGlyphs';

/**
 * @experimental
 * Props for the undo, redo and delete glyphs — the same shape as
 * `@weasel-js/ui`'s `IconProps`, which re-exports these components.
 */
export interface ActionGlyphProps extends IconProps {
  /** Accessible name. Omit inside a button that already labels itself; the
   *  glyph is then `aria-hidden`. */
  label?: string;
  /** Accepted for parity with the rest of the ui icon set; none of these
   *  glyphs encloses a region, so it draws nothing. */
  filled?: boolean;
  fillOpacity?: number;
}

const SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// One object per glyph for the module's life: React 19 rewrites innerHTML when
// this identity changes, and a rewrite mid-press loses the click.
const MARKUP = {
  delete: { __html: ACTION_GLYPHS.delete },
  undo: { __html: ACTION_GLYPHS.undo },
  redo: { __html: ACTION_GLYPHS.redo },
};

function renderGlyph(name: keyof typeof MARKUP, { className, size = 20, label }: ActionGlyphProps) {
  return (
    <svg
      {...SVG_BASE}
      className={className}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={MARKUP[name]}
    />
  );
}

/** @experimental Undo: a straight run returning in a half circle, arrowhead on the run. */
export function UndoIcon(p: ActionGlyphProps) {
  return renderGlyph('undo', p);
}

/** @experimental Redo: the undo glyph mirrored. */
export function RedoIcon(p: ActionGlyphProps) {
  return renderGlyph('redo', p);
}

/** @experimental Delete: a lidded trash can. */
export function DeleteIcon(p: ActionGlyphProps) {
  return renderGlyph('delete', p);
}
