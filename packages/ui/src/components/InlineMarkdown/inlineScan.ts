/**
 * The marks of a line of inline markdown, found by one walk that remembers, for every place a mark's text can
 * reach, where that text closes or that it cannot. A mark's text is read the same way from wherever it is entered,
 * so a second opener reaching a place the first already walked past has its answer there, and a run of openers
 * with no closer costs one walk rather than one walk each.
 *
 * Underscores are never emphasis: prose here names snake_case identifiers.
 */

/** One mark found at `start`, ending before `end`; `body` is its text and `href` a link's address. */
export type InlineMatch =
  | { kind: 'code' | 'keys' | 'both' | 'strong' | 'em' | 'del' | 'escaped'; start: number; end: number; body: string }
  | { kind: 'link'; start: number; end: number; body: string; href: string };

/** How a mark's text reads: the characters it stops at, and the mark that closes it. */
interface Body {
  readonly stop: string;
  readonly close: string;
}

const BOTH: Body = { stop: '', close: '***' };
const STRONG: Body = { stop: '', close: '**' };
const EM: Body = { stop: '*', close: '*' };
const DEL: Body = { stop: '', close: '~~' };
const LABEL: Body = { stop: ']', close: '' };

const SPACE = /\s/;
const PUNCTUATION = /[\p{P}\p{S}]/u;
const ESCAPABLE = '`*~[]\\<';

const codePointLength = (src: string, i: number): number => ((src.codePointAt(i) ?? 0) > 0xffff ? 2 : 1);

/** Where a `<kbd>` span opening at `p` ends, past its `</kbd>`, or -1 where none opens there. */
function kbdEnd(src: string, p: number): number {
  if (!src.startsWith('<kbd>', p)) return -1;
  const j = src.indexOf('</kbd>', p + 5);
  return j > p + 5 ? j + 6 : -1;
}

/**
 * Where the unit of a mark's text at `i` ends, or -1 where text cannot go on: a backslash pair is one unit and a
 * code span another and a `<kbd>` span a third, so none can hold the close; a backtick that a later one would pair with but cannot, as in
 * two side by side, ends the text.
 */
function unitEnd(src: string, i: number, stop: string): number {
  if (i >= src.length) return -1;
  const c = src[i];
  if (c === '\\') return i + 1 < src.length ? i + 1 + codePointLength(src, i + 1) : -1;
  if (c === '`') {
    const j = src.indexOf('`', i + 1);
    return j < 0 ? i + 1 : j > i + 1 ? j + 1 : -1;
  }
  if (c === '<') {
    const k = kbdEnd(src, i);
    if (k >= 0) return k;
  }
  if (stop.includes(c)) return -1;
  return i + codePointLength(src, i);
}

/**
 * Whether a mark `len` long at `p` opens: against a non-space, and before punctuation only after a space or the
 * line's start, so `a * b` and globs such as `src/*.ts` stay as written. `refuse` is what may not follow it.
 */
function opensAt(src: string, p: number, len: number, refuse: (c: string) => boolean): boolean {
  const cp = src.codePointAt(p + len);
  if (cp === undefined) return false;
  const next = String.fromCodePoint(cp);
  if (refuse(next)) return next === '`' || next === '<' || next === '\\';
  if (p === 0 || SPACE.test(src[p - 1])) return true;
  return next === '`' || next === '<' || next === '\\' || !PUNCTUATION.test(next);
}

const spaceRefused = (c: string): boolean => SPACE.test(c);
const spaceOrStarRefused = (c: string): boolean => c === '*' || SPACE.test(c);

export class InlineScan {
  private readonly ends = new Map<Body, Map<number, number>>();
  private readonly hrefs = new Map<number, number>();
  private readonly src: string;

  constructor(src: string) {
    this.src = src;
  }

  /** The mark starting at `p`, if one does, trying them in precedence order. */
  matchAt(p: number): InlineMatch | null {
    const src = this.src;
    switch (src[p]) {
      case '`': {
        const j = src.indexOf('`', p + 1);
        return j > p + 1 ? { kind: 'code', start: p, end: j + 1, body: src.slice(p + 1, j) } : null;
      }
      case '<': {
        const end = kbdEnd(src, p);
        return end < 0 ? null : { kind: 'keys', start: p, end, body: src.slice(p + 5, end - 6) };
      }
      case '*':
        return this.mark('both', BOTH, p, spaceRefused) ?? this.mark('strong', STRONG, p, spaceRefused)
          ?? this.mark('em', EM, p, spaceOrStarRefused);
      case '~':
        return this.mark('del', DEL, p, spaceRefused);
      case '[':
        return this.link(p);
      case '\\':
        return p + 1 < src.length && ESCAPABLE.includes(src[p + 1])
          ? { kind: 'escaped', start: p, end: p + 2, body: src[p + 1] }
          : null;
      default:
        return null;
    }
  }

  private mark(kind: 'both' | 'strong' | 'em' | 'del', body: Body, p: number, refuse: (c: string) => boolean): InlineMatch | null {
    const len = body.close.length;
    if (!this.src.startsWith(body.close, p) || !opensAt(this.src, p, len, refuse)) return null;
    const first = unitEnd(this.src, p + len, body.stop);
    if (first < 0) return null;
    const close = this.walk(body, first);
    return close < 0 ? null : { kind, start: p, end: close + len, body: this.src.slice(p + len, close) };
  }

  private link(p: number): InlineMatch | null {
    const src = this.src;
    const first = unitEnd(src, p + 1, LABEL.stop);
    if (first < 0) return null;
    const labelEnd = this.walk(LABEL, first);
    if (src[labelEnd] !== ']' || src[labelEnd + 1] !== '(') return null;
    const hrefEnd = this.href(labelEnd + 2);
    if (hrefEnd < 0) return null;
    return { kind: 'link', start: p, end: hrefEnd + 1, body: src.slice(p + 1, labelEnd), href: src.slice(labelEnd + 2, hrefEnd) };
  }

  /**
   * From `i`, a place a mark's text has reached, where `body` closes, or -1 where it cannot; for a link's label,
   * where the label runs out. Each place passed on the way is given the same answer.
   */
  private walk(body: Body, i: number): number {
    let memo = this.ends.get(body);
    if (memo === undefined) this.ends.set(body, (memo = new Map()));
    const passed: number[] = [];
    let answer: number;
    for (;;) {
      const known = memo.get(i);
      if (known !== undefined) {
        answer = known;
        break;
      }
      passed.push(i);
      if (body.close && this.src.startsWith(body.close, i) && !SPACE.test(this.src[i - 1])) {
        answer = i;
        break;
      }
      const next = unitEnd(this.src, i, body.stop);
      if (next < 0) {
        answer = body.close ? -1 : i;
        break;
      }
      i = next;
    }
    for (const at of passed) memo.set(at, answer);
    return answer;
  }

  /** Where a link address starting at `h` ends, at its closing parenthesis, or -1. It may hold one level of
   *  balanced parentheses, as a Wikipedia page's often does. */
  private href(h: number): number {
    const known = this.hrefs.get(h);
    if (known !== undefined) return known;
    const src = this.src;
    const plain = (c: string | undefined): boolean => c !== undefined && c !== '(' && c !== ')' && !SPACE.test(c);
    let k = h;
    for (;;) {
      if (plain(src[k])) k++;
      else if (src[k] === '(') {
        let g = k + 1;
        while (plain(src[g])) g++;
        if (src[g] !== ')') break;
        k = g + 1;
      } else break;
    }
    const end = k > h && src[k] === ')' ? k : -1;
    this.hrefs.set(h, end);
    return end;
  }
}
