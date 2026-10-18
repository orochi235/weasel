import type { DrawCommand } from '@weasel-js/core/renderer';
import {
  identity, mat3, multiply, pathFromD, rotateAboutPoint, scale, translate, type Affine, type Path,
} from '@weasel-js/geom';
import type { IconGlyph } from '@weasel-js/icons';

/** The attributes a glyph's elements inherit, as `<Icon>`'s root `<svg>` sets them. */
const ROOT: Readonly<Record<string, string>> = {
  fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5',
  'stroke-linecap': 'round', 'stroke-linejoin': 'round',
};

const INHERITED = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
]);

/** What a glyph is drawn in the place of `currentColor` with, and where. */
export interface GlyphPlacement {
  x: number;
  y: number;
  /** Width and height; the glyph's 20×20 viewBox scales to it. */
  size: number;
  color: string;
}

interface Tag { close: boolean; name: string; attrs: Record<string, string>; selfClosing: boolean }

function* tags(body: string): Generator<Tag> {
  for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!;
    yield { close: m[1] === '/', name: m[2]!, attrs, selfClosing: m[4] === '/' };
  }
}

const num = (v: string | undefined, d = 0) => (v === undefined || v === '' ? d : Number(v));
const nums = (v: string) => v.trim().split(/[\s,]+/).filter((s) => s !== '').map(Number);

/** An SVG `transform` list as one affine. */
function transformOf(v: string | undefined): Affine {
  let m = identity();
  if (!v) return m;
  for (const [, fn, args] of v.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = nums(args!);
    const next: Affine | null = fn === 'translate' ? translate(a[0] ?? 0, a[1] ?? 0)
      : fn === 'scale' ? scale(a[0] ?? 1, a[1] ?? a[0] ?? 1)
        : fn === 'rotate' ? rotateAboutPoint(a[1] ?? 0, a[2] ?? 0, ((a[0] ?? 0) * Math.PI) / 180)
          : fn === 'matrix' && a.length === 6 ? (a as unknown as Affine) : null;
    if (next) m = multiply(m, next);
  }
  return m;
}

function arcRectD(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  if (rx <= 0 || ry <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return `M ${x + rx} ${y} H ${x + w - rx} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} `
    + `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} `
    + `V ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
}

const ellipseD = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

/** A shape element's outline as path data, or undefined for an element that draws none. */
function shapeD(name: string, a: Readonly<Record<string, string>>): string | undefined {
  switch (name) {
    case 'path': return a.d;
    case 'rect': {
      const w = num(a.width), h = num(a.height);
      const rx = Math.min(num(a.rx, num(a.ry)), w / 2), ry = Math.min(num(a.ry, num(a.rx)), h / 2);
      return arcRectD(num(a.x), num(a.y), w, h, rx, ry);
    }
    case 'circle': return ellipseD(num(a.cx), num(a.cy), num(a.r), num(a.r));
    case 'ellipse': return ellipseD(num(a.cx), num(a.cy), num(a.rx), num(a.ry));
    case 'line': return `M ${num(a.x1)} ${num(a.y1)} L ${num(a.x2)} ${num(a.y2)}`;
    case 'polygon':
    case 'polyline': {
      const p = nums(a.points ?? '');
      if (p.length < 4) return undefined;
      const pts = [];
      for (let i = 0; i + 1 < p.length; i += 2) pts.push(`${p[i]} ${p[i + 1]}`);
      return `M ${pts.join(' L ')}${name === 'polygon' ? ' Z' : ''}`;
    }
    default: return undefined;
  }
}

const paintOf = (v: string | undefined, color: string): string | null =>
  (v === undefined || v === 'none' ? null : /^currentcolor$/i.test(v) ? color : v);

/** One shape's commands: its fill, then its stroke, each at its own opacity. */
function shapeCommands(path: Path, a: Readonly<Record<string, string>>, color: string): DrawCommand[] {
  const out: DrawCommand[] = [];
  const fill = paintOf(a.fill, color);
  if (fill) {
    const p = path.kind === 'polygon' && a['fill-rule'] === 'evenodd' ? { ...path, fillRule: 'evenodd' as const } : path;
    const cmd: DrawCommand = { kind: 'path', path: p, fill: { paint: { kind: 'solid', color: fill } } };
    const alpha = num(a['fill-opacity'], 1);
    out.push(alpha < 1 ? { kind: 'group', alpha, children: [cmd] } : cmd);
  }
  const stroke = paintOf(a.stroke, color);
  if (stroke) {
    const dash = a['stroke-dasharray'] && a['stroke-dasharray'] !== 'none' ? nums(a['stroke-dasharray']) : undefined;
    const cmd: DrawCommand = {
      kind: 'path', path,
      stroke: {
        paint: { kind: 'solid', color: stroke },
        width: num(a['stroke-width'], 1),
        cap: a['stroke-linecap'] as 'butt' | 'round' | 'square' | undefined,
        join: a['stroke-linejoin'] as 'miter' | 'round' | 'bevel' | undefined,
        ...(dash ? { dash } : {}),
      },
    };
    const alpha = num(a['stroke-opacity'], 1);
    out.push(alpha < 1 ? { kind: 'group', alpha, children: [cmd] } : cmd);
  }
  return out;
}

interface Frame { attrs: Readonly<Record<string, string>>; children: DrawCommand[]; group: DrawCommand & { kind: 'group' } }

function frameFor(t: Tag, parent: Readonly<Record<string, string>>): Frame {
  const attrs = { ...parent };
  for (const [k, v] of Object.entries(t.attrs)) if (INHERITED.has(k)) attrs[k] = v;
  const children: DrawCommand[] = [];
  const group: Frame['group'] = { kind: 'group', children };
  const m = transformOf(t.attrs.transform);
  if (m.some((v, i) => v !== identity()[i])) group.transform = mat3.fromAffine(m);
  // Every nested `<svg>` a glyph uses has a viewBox matching its own box, so it only clips.
  if (t.name === 'svg') {
    group.clip = { kind: 'rect', x: num(t.attrs.x), y: num(t.attrs.y), width: num(t.attrs.width), height: num(t.attrs.height) };
  }
  return { attrs, children, group };
}

/**
 * A glyph as draw commands, placed in a square and drawn in `color` wherever it says
 * `currentColor`, as `<Icon>` draws it in the DOM. Reads the elements the icon tables use — `path`,
 * `rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`, `g` and a nested `svg` — with their
 * presentation attributes and transforms. `defs` and what they hold are skipped, so a `clip-path`
 * pointing into them does not clip.
 */
export function glyphCommands(glyph: IconGlyph, at: GlyphPlacement): DrawCommand[] {
  const k = at.size / 20;
  const root: Frame = {
    attrs: ROOT, children: [],
    group: { kind: 'group', transform: mat3.fromAffine([k, 0, 0, k, at.x, at.y]), children: [] },
  };
  root.group.children = root.children;
  const stack: Frame[] = [root];
  let skipping = 0;
  for (const t of tags(glyph.body)) {
    const top = stack.at(-1)!;
    if (skipping > 0 || t.name === 'defs' || t.name === 'clipPath') {
      if (!t.selfClosing) skipping += t.close ? -1 : 1;
      continue;
    }
    if (t.close) {
      if ((t.name === 'g' || t.name === 'svg') && stack.length > 1) stack.pop();
      continue;
    }
    if (t.name === 'g' || t.name === 'svg') {
      const f = frameFor(t, top.attrs);
      top.children.push(f.group);
      if (!t.selfClosing) stack.push(f);
      continue;
    }
    const d = shapeD(t.name, t.attrs);
    if (d === undefined) continue;
    const f = frameFor(t, top.attrs);
    const cmds = shapeCommands(pathFromD(d), f.attrs, at.color);
    if (f.group.transform) top.children.push({ kind: 'group', transform: f.group.transform, children: cmds });
    else top.children.push(...cmds);
  }
  return [root.group];
}
