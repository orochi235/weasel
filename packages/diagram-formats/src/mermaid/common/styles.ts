/**
 * Mermaid's `classDef`, `class`, and `style`, which several diagram kinds
 * share: CSS-like `key:value` lists read into a node's own colors, and its
 * colors written back as one.
 */
import type { NodeStyle } from '@weasel-js/diagram';
import type { Warnings } from '../../graphRead';
import { checkedColor } from '../../colorCheck';
import { hexColor } from '../../graphWrite';

/** A style's `key:value` pairs, in order. */
export type StyleProps = [string, string][];

/** Splits on commas outside parentheses. */
function splitTop(text: string): string[] {
  const out = [''];
  let depth = 0;
  for (const c of text) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) out.push('');
    else out[out.length - 1] += c;
  }
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/** `fill:#f96,stroke:#333` as its pairs. */
export const propsOf = (text: string): StyleProps => splitTop(text).map((p) => {
  const at = p.indexOf(':');
  return at < 0 ? [p, ''] : [p.slice(0, at).trim(), p.slice(at + 1).trim()];
});

const KEPT = ['fill', 'stroke', 'color', 'stroke-width', 'stroke-dasharray'];

/** Warns of each property a diagram does not hold. */
export function checkProps(props: StyleProps, warnings: Warnings): void {
  for (const [key] of props) if (!KEPT.includes(key)) warnings.list('Mermaid style properties a diagram does not hold were dropped', key);
}

/** A CSS length in px as a number. */
export const px = (v: string): number => Number(v.replace(/px$/, ''));
/** A `stroke-dasharray` as numbers. */
export const dashOf = (v: string): number[] => v.split(/[\s,]+/).filter((s) => s !== '').map(px);

/** A color a Mermaid file names, or `undefined`, with a warning, when a diagram cannot draw it. */
export const mermaidColor = (css: string | undefined, warnings: Warnings): string | undefined =>
  checkedColor(css, 'Mermaid', (lead, item) => warnings.list(lead, item));

/** A node's colors from the properties that apply to it, `undefined` for none. */
export function nodeColors(props: ReadonlyMap<string, string>, warnings: Warnings): Partial<NodeStyle> | undefined {
  const fill = mermaidColor(props.get('fill'), warnings);
  const stroke = mermaidColor(props.get('stroke'), warnings);
  const text = mermaidColor(props.get('color'), warnings);
  const colors: Partial<NodeStyle> = {
    ...(fill !== undefined ? { fill } : {}),
    ...(stroke !== undefined ? { stroke } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(props.has('stroke-width') ? { strokeWidth: px(props.get('stroke-width')!) } : {}),
    ...(props.has('stroke-dasharray') ? { dash: dashOf(props.get('stroke-dasharray')!) } : {}),
  };
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/** A node's colors as a style's properties, `fill:#ff0000,color:#000000`. */
export function styleProps(style: Partial<NodeStyle>): string {
  return [
    style.fill !== undefined ? `fill:${hexColor(style.fill)}` : null,
    style.stroke !== undefined ? `stroke:${hexColor(style.stroke)}` : null,
    style.text !== undefined ? `color:${hexColor(style.text)}` : null,
    style.strokeWidth !== undefined ? `stroke-width:${style.strokeWidth}px` : null,
    style.dash !== undefined ? `stroke-dasharray:${style.dash.join(' ')}` : null,
  ].filter((p) => p !== null).join(',');
}

/** The `classDef`s, `class` assignments, and `style`s of one diagram, and the colors they give each node. */
export class StyleSheet {
  private readonly defs = new Map<string, StyleProps>();
  private readonly classes = new Map<string, string[]>();
  private readonly styles = new Map<string, StyleProps>();

  constructor(private readonly warnings: Warnings) {}

  classDef(names: readonly string[], props: StyleProps): void {
    checkProps(props, this.warnings);
    for (const name of names) this.defs.set(name, [...(this.defs.get(name) ?? []), ...props]);
  }

  assign(id: string, name: string): void {
    this.classes.set(id, [...(this.classes.get(id) ?? []), name]);
  }

  style(id: string, props: StyleProps): void {
    checkProps(props, this.warnings);
    this.styles.set(id, [...(this.styles.get(id) ?? []), ...props]);
  }

  /** `id`'s colors: the `default` class's, then its classes' in order, then its own style's. */
  colorsOf(id: string): Partial<NodeStyle> | undefined {
    const props = new Map<string, string>();
    const lists = [this.defs.get('default'), ...(this.classes.get(id) ?? []).map((c) => this.defs.get(c)), this.styles.get(id)];
    for (const list of lists) for (const [k, v] of list ?? []) props.set(k, v);
    return nodeColors(props, this.warnings);
  }

  /** Reads `classDef`, `style id …`, and, unless `withClass` is false, `class a,b name` statements; whether `text` was one. */
  statement(text: string, withClass = true): boolean {
    const m = /^(classDef|class|style)\s+(\S+)\s*(.*)$/s.exec(text);
    if (m === null || (!withClass && m[1] === 'class')) return false;
    const [, keyword, first, rest] = m as unknown as [string, string, string, string];
    if (keyword === 'classDef') this.classDef(first.split(','), propsOf(rest));
    else if (keyword === 'style') this.style(first, propsOf(rest));
    else for (const id of first.split(',')) this.assign(id.trim(), rest.trim());
    return true;
  }
}
