/** Reading SVG path data into commands: what `pathFromD` lowers. */

const NUM_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
/** Same grammar, anchored — used where a number's position matters. */
const NUM_RE_AT = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;

/**
 * Is `d[j]` a command letter, as opposed to the `e` of an exponent? `1e2` is
 * a legal coordinate, and treating its `e` as a command drops the number and
 * everything after it in that argument run.
 */
function isCommandLetter(d: string, j: number): boolean {
  const c = d[j];
  if (!/[A-Za-z]/.test(c)) return false;
  if (c !== 'e' && c !== 'E') return true;
  if (!/[\d.]/.test(d[j - 1] ?? '')) return true;
  const k = d[j + 1] === '+' || d[j + 1] === '-' ? j + 2 : j + 1;
  return !/\d/.test(d[k] ?? '');
}

/** One command of SVG path data: its letter, as written, and the numbers after it. */
export interface PathDataCommand {
  cmd: string;
  args: number[];
}

/**
 * The commands of an SVG path-data string, each with its numbers, read as SVG reads them: `1e2` is a number and not
 * an `e` command, `.5` and `1.5.5` are `0.5` and `1.5`, `0.5`, and an arc's flags need no separator. Letters are
 * kept as written, relative ones included; a number past the double range is dropped, and in an arc's arguments ends
 * them there, since the flags after it could no longer be told apart. What `pathFromD` lowers.
 */
export function tokenizePathData(d: string): PathDataCommand[] {
  const out: PathDataCommand[] = [];
  // Walk character by character so we can group command-letter + arg-run.
  let i = 0;
  while (i < d.length) {
    if (isCommandLetter(d, i)) {
      // Collect numeric args until the next command letter.
      let j = i + 1;
      while (j < d.length && !isCommandLetter(d, j)) j++;
      const argSlice = d.slice(i + 1, j);
      const cmd = d[i];
      out.push({
        cmd,
        args: cmd === 'A' || cmd === 'a' ? readArcArgs(argSlice) : readNumbers(argSlice),
      });
      i = j;
    } else {
      // Skip any whitespace / commas at the head.
      i++;
    }
  }
  return out;
}

function readNumbers(s: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(s)) !== null) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Read an `A`/`a` argument run. The two flags are single `0`/`1` digits that
 * need no separator after them, so `a25 25 -30 0 1 50 -25` may legally be
 * written `a25 25 -30 0150 -25` — which a plain number scan reads as two
 * arguments instead of four, leaving the whole arc short and dropped.
 */
function readArcArgs(s: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ',' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f') { i++; continue; }
    const slot = out.length % 7;
    if (slot === 3 || slot === 4) {
      if (c !== '0' && c !== '1') return out;
      out.push(c === '1' ? 1 : 0);
      i++;
      continue;
    }
    NUM_RE_AT.lastIndex = i;
    const m = NUM_RE_AT.exec(s);
    if (!m) return out;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) return out;
    out.push(n);
    i = NUM_RE_AT.lastIndex;
  }
  return out;
}

/** The first character of `d` past leading whitespace when it is not a letter, as when numbers come before the
 *  first command; data that opens so is in error. */
export function strayPathDataHead(d: string): string | undefined {
  const head = /^[ \t\n\r\f]*([^ \t\n\r\f])/.exec(d)?.[1];
  return head !== undefined && !/[A-Za-z]/.test(head) ? head : undefined;
}
