/** `<clipPath>` definitions, and the clip an element's `clip-path` names. */

import { type Path, transformPath } from '@weasel-js/core';
import { AUTO_ORIGIN } from './shapes';
import type { Matrix } from './types';
import { parseTransform } from './transform';
import { collectElementsByTag } from './elements';
import { ownProp } from './cascade';
import { readProperty } from './properties';
import { SUPPORTED_LEAF_TAGS, lowerLeaf } from './lowerLeaf';

/** Element-id → the outline of a `<clipPath>` def, in the document's own
 *  user space. */
export type ClipTable = ReadonlyMap<string, Path>;

/**
 * Lower every `<clipPath>` in the document to one outline.
 *
 * SVG unions a `<clipPath>`'s shapes and a `Path` carries a single outline,
 * so only a one-shape def is modeled; the rest warn and clip nothing, which
 * shows the whole group rather than hiding it.
 */
export function collectClipPaths(root: Element, onWarn: (m: string) => void): ClipTable {
  const out = new Map<string, Path>();
  for (const [id, el] of collectElementsByTag(root, new Set(['clippath']))) {
    const units = el.getAttribute('clipPathUnits');
    if (units && units !== 'userSpaceOnUse') {
      onWarn(`<clipPath id="${id}"> uses clipPathUnits="${units}", which is not modeled`);
      continue;
    }
    const shapes: Element[] = [];
    for (let i = 0; i < el.children.length; i++) {
      if (SUPPORTED_LEAF_TAGS.has(el.children[i].tagName.toLowerCase())) shapes.push(el.children[i]);
    }
    if (shapes.length !== 1) {
      onWarn(
        `<clipPath id="${id}"> holds ${shapes.length} shapes the kit can lower;`
        + ' only a single-shape clip is modeled, so it clips nothing',
      );
      continue;
    }
    const shape = shapes[0];
    const local = parseTransform(shape.getAttribute('transform'), onWarn);
    const path = lowerLeaf(shape, shape.tagName.toLowerCase(), local, onWarn);
    if (path) out.set(id, path);
  }
  return out;
}

/** The outline a `clip-path` attribute names, in the element's own user space
 *  — the space `ctm` maps into, which is also where its children's geometry
 *  lands. */
export function clipFor(
  el: Element,
  ctm: Matrix,
  clips: ClipTable,
  onWarn: (m: string) => void,
): Path | undefined {
  const raw = ownProp(el, 'clip-path');
  if (raw == null) return undefined;
  const ref = readProperty('clip-path', raw);
  if (ref === 'none') return undefined;
  if (!ref) {
    onWarn(`clip-path="${raw}" is not a url(#id) reference; the clip is dropped`);
    return undefined;
  }
  const path = clips.get(ref.id);
  if (!path) {
    onWarn(`clip-path references #${ref.id}, which no <clipPath> in the document defines`);
    return undefined;
  }
  return transformPath(path, ctm, AUTO_ORIGIN);
}
