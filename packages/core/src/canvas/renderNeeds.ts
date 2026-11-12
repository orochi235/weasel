import type { Paint } from '@weasel-js/paint';
import type { FontRequest } from '@weasel-js/font';
import type { DrawCommand } from '@weasel-js/renderer';

/** What drawing a command list loads on demand: the faces its text is set in,
 *  the paint kinds its fills and strokes name, and the pictures its image patterns tile. */
export interface RenderNeeds {
  /** Each `(family, weight, style)` a text run is set in, once, in the order
   *  met. */
  fonts: FontRequest[];
  /** Each paint kind a fill or stroke names, once, in the order met —
   *  registered ones included. */
  paintKinds: string[];
  /** The `src` of each image pattern a fill or stroke tiles, once, in the order met.
   *  `renderNeeds` always fills it; a needs list built elsewhere may leave it out. */
  images?: string[];
}

/**
 * The fonts and paint kinds `commands` draw with, read off the commands
 * themselves: text runs, path fills and strokes, run fills and strokes, and
 * everything under a group. What `warmRender({ render })` loads, beside the
 * pictures image nodes asked for while their commands were built. An image
 * command holds a bitmap already decoded, so it adds nothing.
 */
export function renderNeeds(commands: readonly DrawCommand[]): RenderNeeds {
  const fonts = new Map<string, FontRequest>();
  const kinds = new Set<string>();
  const images = new Set<string>();
  const paint = (p: Paint | null | undefined) => {
    if (!p) return;
    kinds.add(p.kind ?? 'solid');
    if (p.kind === 'image') images.add(p.src);
  };
  const walk = (list: readonly DrawCommand[]) => {
    for (const c of list) {
      if (c.kind === 'group') walk(c.children);
      else if (c.kind === 'path') {
        paint(c.fill?.paint);
        paint(c.stroke?.paint);
      } else if (c.kind === 'text') {
        for (const r of c.runs) {
          const key = `${r.fontFamily}|${r.fontWeight}|${r.fontStyle}`;
          if (!fonts.has(key)) fonts.set(key, { family: r.fontFamily, weight: r.fontWeight, style: r.fontStyle });
          paint(r.fill?.paint);
          paint(r.stroke?.paint);
        }
      }
    }
  };
  walk(commands);
  return { fonts: [...fonts.values()], paintKinds: [...kinds], images: [...images] };
}
