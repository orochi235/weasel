/**
 * A `<tspan>` holding other tspans, read as the stretches of text each is
 * styled and placed by. A stretch is placed by a view of the element it sits
 * directly in, whose `x`, `y`, `dx`, `dy` and `rotate` are the lists that
 * reach its glyphs: for each glyph, the value of the nearest tspan around it
 * that gives one, as SVG reads them. Everything else the view reads is the
 * element's own, so the readers that place a tspan's run place a stretch's.
 */
import { holdsOnlyText, LINES_ATTR } from './tspanLines';

const LISTS = ['x', 'y', 'dx', 'dy', 'rotate'] as const;
type ListName = (typeof LISTS)[number];
type Lists = Readonly<Record<ListName, readonly string[]>>;

/** One stretch of a tspan's text: the view that places it, and the tspans it sits in, outermost first. */
export interface TspanStretch {
  readonly at: Element;
  readonly chain: readonly Element[];
  readonly text: string;
}

const glyphCount = (text: string): number => Array.from(text).length;

const tokensOf = (el: Element, name: ListName): string[] => {
  const raw = el.getAttribute(name)?.trim();
  return raw ? raw.split(/[\s,]+/) : [];
};

/** `rotate` spread over `n` glyphs: its last value turns every glyph past its end. */
const spread = (list: readonly string[], n: number): string[] =>
  list.length === 0 ? [] : Array.from({ length: Math.max(n, list.length) }, (_, i) => list[Math.min(i, list.length - 1)]!);

/** The lists reaching `el`'s glyphs: its own values, then `outer`'s, glyph by glyph. A `rotate` of its own
 *  replaces the outer one for all its glyphs. */
function listsOf(el: Element, outer: Lists | null, glyphs: number): Lists {
  const out = {} as Record<ListName, readonly string[]>;
  for (const name of LISTS) {
    const own = tokensOf(el, name);
    const around = outer?.[name] ?? [];
    if (name === 'rotate') {
      out.rotate = own.length > 0 ? spread(own, glyphs) : around;
      continue;
    }
    const n = Math.max(own.length, around.length);
    out[name] = Array.from({ length: n }, (_, i) => own[i] ?? around[i]!);
  }
  return out;
}

const sliced = (lists: Lists, from: number, n: number): Lists => ({
  x: lists.x.slice(from, from + n), y: lists.y.slice(from, from + n),
  dx: lists.dx.slice(from, from + n), dy: lists.dy.slice(from, from + n),
  rotate: lists.rotate.slice(from, from + n),
});

/** `el` as a stretch of `text` reads it: `lists` for its positions, and its line count only on its first stretch. */
function viewOf(el: Element, lists: Lists, text: string, first: boolean): Element {
  const own = (name: string): string | null => {
    if ((LISTS as readonly string[]).includes(name)) {
      const list = lists[name as ListName];
      return list.length > 0 ? list.join(' ') : null;
    }
    return name === LINES_ATTR && !first ? null : el.getAttribute(name);
  };
  return new Proxy(el, {
    get(target, key) {
      if (key === 'getAttribute') return own;
      if (key === 'hasAttribute') return (name: string) => own(name) !== null;
      if (key === 'textContent') return text;
      if (key === 'childNodes') return [target.ownerDocument.createTextNode(text)];
      if (key === 'children') return [];
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * `sp`'s text as stretches, in order: `sp` itself whole when it holds only
 * text, otherwise each text child, and each tspan inside it read the same
 * way. Another element inside it is read as its text, and reported.
 */
export function tspanStretches(sp: Element, onWarn: (m: string) => void): TspanStretch[] {
  if (holdsOnlyText(sp)) return [{ at: sp, chain: [sp], text: sp.textContent ?? '' }];
  const out: TspanStretch[] = [];
  const walk = (el: Element, chain: readonly Element[], lists: Lists): void => {
    let at = 0;
    for (const child of Array.from(el.childNodes)) {
      const text = child.textContent ?? '';
      const n = glyphCount(text);
      const isTspan = child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'tspan';
      if (isTspan) {
        const inner = child as Element;
        walk(inner, [...chain, inner], listsOf(inner, sliced(lists, at, n), n));
      } else if (child.nodeType === 1 || child.nodeType === 3 /* TEXT_NODE */) {
        if (child.nodeType === 1) {
          onWarn(`<${(child as Element).tagName}> inside a <tspan> is read as that tspan's text: its own styling and position are dropped`);
        }
        if (text) out.push({ at: viewOf(el, sliced(lists, at, n), text, at === 0), chain, text });
      } else continue;
      at += n;
    }
  };
  walk(sp, [sp], listsOf(sp, null, glyphCount(sp.textContent ?? '')));
  return out;
}
