/**
 * Writing a stroke marker as a `<marker>` def.
 *
 * SVG draws a marker on the path's end, pointing along the path there. A kit
 * head the line stops short of sits on the line's cut end instead, so where
 * the export cuts the shaft back by the inset ({@link ./seatedHeads}) it
 * references the head's seated def: the same drawing with its reference point
 * moved back by the inset, so the head's back lands on the cut end. Where it
 * cannot cut, and for a mid marker, it references the unseated def.
 */

import { getMarker, resolveMarkerSize } from '@weasel-js/core';
import type { MarkerEntry, MarkerPaint, MarkerRef, ScreenLength } from '@weasel-js/core';
import { RAD_TO_DEG, pathToD } from '@weasel-js/geom';
import { trimNumber } from './transform';
import { escapeAttr } from './xmlEscape';

/** The private namespace prefix; `gradients.ts` owns the namespace itself. */
const WZL = 'wzl';

/** One registered def: the marker it draws, at what size, and whether it is seated. */
export interface MarkerDef {
  key: string;
  size?: ScreenLength;
  seated: boolean;
}

/** Whether `entry`'s def carries `wzl:inset`: SVG has no way to say how far
 *  a line stops short of its marker, so the parser needs it spelled out. */
export function writesInset(entry: MarkerEntry | undefined): boolean {
  return entry !== undefined && !entry.toSvg && (entry.inset ?? 0) !== 0;
}

/** Whether a start or end reference to `ref` can be written seated: an entry
 *  with an inset that writes its def through {@link markerDefXml}. */
export function seats(ref: MarkerRef): boolean {
  return writesInset(getMarker(typeof ref === 'string' ? ref : ref.key));
}

/**
 * The def `ref` is written as, and its id. An unsized reference's seated id
 * is the marker key itself: `parseSvg` reads `url(#key)` back as the key when
 * the registry knows it. A sized one is suffixed with its size, and an
 * unseated def of a seating entry with `-tip`.
 */
export function markerDefOf(ref: MarkerRef, seated: boolean): { id: string; def: MarkerDef } {
  const key = typeof ref === 'string' ? ref : ref.key;
  const size = typeof ref === 'string' ? undefined : ref.size;
  const asSeated = seated && seats(ref);
  const base = idOfKey(key);
  const sized = size === undefined ? base : `${base}-s${typeof size === 'number' ? trimNumber(size) : `${trimNumber(size.px)}px`}`;
  const id = !asSeated && seats(ref) ? `${sized}-tip` : sized;
  return { id, def: { key, ...(size === undefined ? {} : { size }), seated: asSeated } };
}

/** FNV-1a, for a key that tells apart two documents' same-named markers. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** What an attribute and an unquoted `url(#…)` both hold as written: no space, quote, markup, or bracket. */
const SAFE_ID = /^[^\s"'&<>()#\\]+$/;

/** `key` as an id an attribute and a `url(#…)` can both hold: itself when it
 *  is one, else its safe characters and a hash of the whole, so two keys that
 *  differ only in what is replaced stay apart. */
function idOfKey(key: string): string {
  if (SAFE_ID.test(key)) return key;
  return `m-${key.replace(/[^\w.-]/g, '_')}-${shortHash(key)}`;
}

/** Whether `def` is written with an attribute in the private namespace. */
export function defUsesPrivateNamespace(def: MarkerDef): boolean {
  return def.size !== undefined || writesInset(getMarker(def.key)) || idOfKey(def.key) !== def.key;
}

/** The `<marker>` def for an entry with no `toSvg` of its own. Unsized, one
 *  marker unit is one stroke width, as the kit draws it. A sized reference is
 *  drawn in user space at `resolveMarkerSize`'s reading of its size, and
 *  records its key and size in the private namespace for the parser, as an
 *  unseated def of a seating entry records its key. The inset goes there too,
 *  in marker units either way, and a seated def says it is seated, so the
 *  parser can move its reference point back to the tip. */
export function markerDefXml(id: string, entry: MarkerEntry, def: MarkerDef, onWarn?: (m: string) => void): string {
  const { key, size, seated } = def;
  const unit = size === undefined ? 1 : resolveMarkerSize({ key, size }, 1);
  const path = entry.path({ size: unit, stroke: { paint: { kind: 'solid', color: '#000' } } });
  const d = pathToD(path);
  const fill = markerPaintAttrs('fill', entry.fill, id, onWarn);
  const outline = entry.outline
    ? ` ${markerPaintAttrs('stroke', entry.outline.paint, id, onWarn)} stroke-width="${trimNumber(entry.outline.width * unit)}"`
      + ' stroke-linecap="round" stroke-linejoin="round"'
    : '';
  // The kit turns every start marker around, which is what SVG 2 spells
  // `auto-start-reverse`; plain `auto` would point a start head into the line.
  const orient = typeof entry.orient === 'number' ? trimNumber(entry.orient * RAD_TO_DEG) : 'auto-start-reverse';
  const units = size === undefined
    ? 'markerUnits="strokeWidth" markerWidth="8" markerHeight="8"'
    : `markerUnits="userSpaceOnUse" markerWidth="${trimNumber(8 * unit)}" markerHeight="${trimNumber(8 * unit)}"`;
  const keyed = size !== undefined
    ? ` ${WZL}:key="${escapeAttr(key)}" ${WZL}:size="${typeof size === 'number' ? trimNumber(size) : `${trimNumber(size.px)}px`}"`
    : id !== key ? ` ${WZL}:key="${escapeAttr(key)}"` : '';
  const inset = writesInset(entry) ? ` ${WZL}:inset="${trimNumber(entry.inset!)}"` : '';
  const seat = seated ? ` ${WZL}:seated="true"` : '';
  const refX = seated ? trimNumber(-entry.inset! * unit) : '0';
  // `overflow="visible"` overrides the UA default of `hidden`, which would
  // otherwise clip the arrowhead to the marker's viewport.
  return (
    `<marker id="${id}" ${units}${keyed}${inset}${seat}` +
    ` refX="${refX}" refY="0" orient="${orient}" overflow="visible">` +
    `<path d="${d}" ${fill}${outline}/></marker>`
  );
}

/** A marker paint as `fill` / `stroke` attributes. `'line'` is SVG 2's
 *  `context-stroke`; a paint server has no `<defs>` slot from here, so it
 *  falls back to the line's paint and says so. */
function markerPaintAttrs(
  attr: 'fill' | 'stroke',
  paint: MarkerPaint | undefined,
  id: string,
  onWarn?: (m: string) => void,
): string {
  if (paint === 'none') return `${attr}="none"`;
  if (paint === undefined || paint === 'line') return `${attr}="context-stroke"`;
  if ('color' in paint && (paint.kind === undefined || paint.kind === 'solid')) {
    return paint.opacity != null && paint.opacity !== 1
      ? `${attr}="${escapeAttr(paint.color)}" ${attr}-opacity="${trimNumber(paint.opacity)}"`
      : `${attr}="${escapeAttr(paint.color)}"`;
  }
  onWarn?.(`marker "${id}" ${attr} is a paint server, which a <marker> def cannot reference here; written as the line's paint`);
  return `${attr}="context-stroke"`;
}
