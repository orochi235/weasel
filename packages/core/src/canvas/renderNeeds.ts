import type { FillStyle } from '@weasel-js/paint';
import type { FontRequest } from '@weasel-js/font';
import type { DrawCommand } from '../renderer/DrawCommand';

/** What drawing a command list loads on demand: the faces its text is set in
 *  and the paint kinds its fills and strokes name. */
export interface RenderNeeds {
  /** Each `(family, weight, style)` a text run is set in, once, in the order
   *  met. */
  fonts: FontRequest[];
  /** Each paint kind a fill or stroke names, once, in the order met —
   *  registered ones included. */
  paintKinds: string[];
}

/**
 * The fonts and paint kinds `commands` draw with, read off the commands
 * themselves: text runs, path fills and strokes, run fills and strokes, and
 * everything under a group. What `warmRender({ render })` loads, and nothing
 * more. Images, sprites and shaders load nothing on demand, so they add
 * nothing.
 */
export function renderNeeds(commands: readonly DrawCommand[]): RenderNeeds {
  const fonts = new Map<string, FontRequest>();
  const kinds = new Set<string>();
  const paint = (p: FillStyle | null | undefined) => {
    if (p) kinds.add(p.fill ?? 'solid');
  };
  const walk = (list: readonly DrawCommand[]) => {
    for (const c of list) {
      if (c.kind === 'group') walk(c.children);
      else if (c.kind === 'path') {
        paint(c.fill);
        paint(c.stroke?.paint);
      } else if (c.kind === 'text') {
        for (const r of c.runs) {
          const key = `${r.fontFamily}|${r.fontWeight}|${r.fontStyle}`;
          if (!fonts.has(key)) fonts.set(key, { family: r.fontFamily, weight: r.fontWeight, style: r.fontStyle });
          paint(r.fill);
          paint(r.stroke?.paint);
        }
      }
    }
  };
  walk(commands);
  return { fonts: [...fonts.values()], paintKinds: [...kinds] };
}
