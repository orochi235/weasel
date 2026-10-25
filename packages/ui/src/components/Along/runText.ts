import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { runStationAt, type Point, type TrackRun } from '@weasel-js/geom';
import row from './runRow.module.css';
import s from './runText.module.css';

/** Marks the copy of a text node drawn along the run, and the element whose own glyphs that copy stands in for. */
const BEND = 'data-run-text-bend';
const HIDES = 'data-run-text-hides';
const SVG = 'http://www.w3.org/2000/svg';

/** One text node's copy along the run: an empty span after it, holding the svg its glyphs are drawn in. */
interface Bend {
  span: HTMLSpanElement;
  path: SVGPathElement;
  text: SVGTextElement;
}

let ids = 0;

/**
 * Draws every line of text in a run row's items along the run itself rather than straight across each item: each text
 * node's glyphs are laid on the curve through the text's own baseline, parallel to the run. The text node stays where
 * it is, glyphs transparent, so it keeps the item's size, its accessible name and its selection; the copy is an
 * aria-hidden svg placed after it, so it inherits the color, font and state styles the text would have worn.
 */
export function useRunText(root: RefObject<HTMLElement | null>, run: TrackRun): void {
  const bends = useRef(new Map<Text, Bend>());
  const draw = useRef<() => void>(() => {});
  draw.current = () => {
    const el = root.current;
    if (el !== null) bendText(el, run, bends.current);
  };
  useLayoutEffect(() => draw.current());
  useEffect(() => {
    const el = root.current;
    if (el === null || typeof MutationObserver === 'undefined') return;
    // A label can change without the row re-rendering: a child's own state, or a web font landing.
    const watch = new MutationObserver((records) => {
      if (records.some((r) => !ours(r.target) && !(r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(ours)))) draw.current();
    });
    watch.observe(el, { subtree: true, childList: true, characterData: true });
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    const redraw = (): void => draw.current();
    fonts?.addEventListener?.('loadingdone', redraw);
    const all = bends.current;
    return () => {
      watch.disconnect();
      fonts?.removeEventListener?.('loadingdone', redraw);
      for (const [node, bend] of all) drop(node, bend, all);
    };
  }, [root]);
}

const ours = (node: Node): boolean => (node instanceof Element ? node : node.parentElement)?.closest(`[${BEND}]`) != null;

/** Lays a copy of every text node under `root`'s run items along `run`, and drops the copies of nodes gone since. */
function bendText(root: HTMLElement, run: TrackRun, bends: Map<Text, Bend>): void {
  const seen = new Set<Text>();
  const box = root.getBoundingClientRect();
  // Without layout, as under jsdom, there is nothing to measure the text against.
  if (box.width > 0 && root.offsetWidth > 0 && run.length > 0 && typeof Range !== 'undefined' && 'getBoundingClientRect' in Range.prototype) {
    const scale = box.width / root.offsetWidth;
    const toRoot = (x: number, y: number): Point => ({ x: (x - box.left) / scale, y: (y - box.top) / scale });
    const range = document.createRange();
    for (const item of root.querySelectorAll<HTMLElement>(`.${row.item}`)) {
      const turn = turnOf(item);
      for (const node of textUnder(item)) {
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const parent = node.parentElement!;
        const bend = bends.get(node) ?? make(node);
        bends.set(node, bend);
        seen.add(node);
        parent.setAttribute(HIDES, '');
        const o = bend.span.getBoundingClientRect();
        lay(bend, run, toRoot(r.left + r.width / 2, r.top + r.height / 2), toRoot(o.left, o.top), turn, parent, node.data);
      }
    }
  }
  for (const [node, bend] of bends) if (!seen.has(node)) drop(node, bend, bends);
}

/** The text nodes under `item` that show: not blank, not one of the copies, and not under an item of its own. */
function textUnder(item: HTMLElement): Text[] {
  const found: Text[] = [];
  const walk = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
    const node = n as Text;
    const parent = node.parentElement;
    if (parent === null || node.data.trim() === '' || ours(node)) continue;
    if (parent.closest(`.${row.item}`) !== item) continue;
    found.push(node);
  }
  return found;
}

/** The radians `item` is turned by on screen, read off its transform: its spot's angle and any upright half turn. */
function turnOf(item: HTMLElement): number {
  const t = getComputedStyle(item).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrixReadOnly(t);
  return Math.atan2(m.b, m.a);
}

function make(node: Text): Bend {
  const span = document.createElement('span');
  span.className = s.bend!;
  span.setAttribute(BEND, '');
  span.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', s.svg!);
  const path = document.createElementNS(SVG, 'path');
  path.id = `wzl-run-text-${++ids}`;
  path.setAttribute('fill', 'none');
  const text = document.createElementNS(SVG, 'text');
  const along = document.createElementNS(SVG, 'textPath');
  along.setAttribute('href', `#${path.id}`);
  along.setAttribute('startOffset', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.append(along);
  svg.append(path, text);
  span.append(svg);
  node.after(span);
  return { span, path, text };
}

function drop(node: Text, bend: Bend, bends: Map<Text, Bend>): void {
  bend.span.remove();
  bends.delete(node);
  const parent = node.parentElement;
  if (parent !== null && ![...bends.keys()].some((other) => other.parentElement === parent)) parent.removeAttribute(HIDES);
}

/** Px between the points of a copy's path. */
const STEP = 3;

/**
 * Lays `bend` along `run` through the baseline of text centered at `center`, on an item turned by `turn` radians; the
 * span holding it sits at `origin`. Everything is in the run's px.
 */
function lay(bend: Bend, run: TrackRun, center: Point, origin: Point, turn: number, parent: Element, data: string): void {
  const font = metricsOf(parent, data);
  // The text box's center sits half its ascent less its descent above the baseline, down the item's own axis.
  const sink = (font.ascent - font.descent) / 2;
  const base = { x: center.x - Math.sin(turn) * sink, y: center.y + Math.cos(turn) * sink };
  const d = run.nearest(base, { open: true, about: run.nearest(base).f }).f * run.length;
  const at = runStationAt(run, d, 0, 'follow');
  const shift = (base.x - at.point.x) * at.normal.x + (base.y - at.point.y) * at.normal.y;
  const reach = font.width / 2 + font.ascent * 2;
  const steps = Math.max(2, Math.ceil((2 * reach) / STEP));
  const cos = Math.cos(-turn);
  const sin = Math.sin(-turn);
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = runStationAt(run, d - reach + (2 * reach * i) / steps, shift, 'follow').point;
    const x = p.x - origin.x;
    const y = p.y - origin.y;
    pts.push({ x: x * cos - y * sin, y: x * sin + y * cos });
  }
  // Read left to right in the item's own frame, whichever way the run runs.
  if (pts[pts.length - 1]!.x < pts[0]!.x) pts.reverse();
  bend.path.setAttribute('d', pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(''));
  const along = bend.text.firstChild!;
  if (along.textContent !== data) along.textContent = data;
}

const round = (v: number): number => Math.round(v * 100) / 100;

let measure: CanvasRenderingContext2D | null | undefined;

/** The ascent and descent of `parent`'s font, and the width of `data` set in it. */
function metricsOf(parent: Element, data: string): { ascent: number; descent: number; width: number } {
  const style = getComputedStyle(parent);
  const size = Number.parseFloat(style.fontSize) || 16;
  measure ??= document.createElement('canvas').getContext('2d');
  if (measure == null) return { ascent: size * 0.8, descent: size * 0.2, width: data.length * size * 0.6 };
  measure.font = style.font || `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const m = measure.measureText(data);
  return { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent, width: m.width };
}
