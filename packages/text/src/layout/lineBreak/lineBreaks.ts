/**
 * Line break opportunities per the Unicode Line Breaking Algorithm
 * (UAX #14), default rules, no tailoring: where a line may end, not where it
 * does. Choosing among the opportunities is the wrap's job.
 *
 * Rules LB2–LB31 are applied in order at every position. LB9 is applied up
 * front: a combining mark or ZWJ that follows a base joins it into one unit
 * carrying the base's class, so every later rule reads units, never marks.
 */

import * as table from './lineBreakTable';

// Copied into module locals: vitest rewrites every read of an imported
// binding into a property access, which made this loop 25x slower under test.
const {
  lineBreakPropsOf, CLASS_MASK, EAST_ASIAN, PICTOGRAPHIC_CN,
  BK, CR, LF, NL, SP, ZW, ZWJ, CM, WJ, GL, BA, BB, B2, HY, CB, CL, CP, EX, IN, NS,
  OP, QU, IS, NU, PO, PR, SY, AL, HL, ID, EB, EM, H2, H3, JL, JV, JT, RI,
  AK, AP, AS, VF, VI, QU_PI, QU_PF,
} = table;

/** No opportunity before this position. */
export const NO_BREAK = 0;
/** A line may end before this position. */
export const BREAK_ALLOWED = 1;
/** A line must end before this position: after a hard line break, and at the end of text. */
export const BREAK_MANDATORY = 2;

const HYPHEN = 0x2010;
const DOTTED_CIRCLE = 0x25cc;

const isQU = (c: number): boolean => c === QU || c === QU_PI || c === QU_PF;
const isHard = (c: number): boolean => c === BK || c === CR || c === LF || c === NL;
const isAlpha = (c: number): boolean => c === AL || c === HL;
const isKorean = (c: number): boolean => c === JL || c === JV || c === JT || c === H2 || c === H3;
const isIdeoLike = (c: number): boolean => c === ID || c === EB || c === EM;

/**
 * For each position `0..cps.length`, whether a line may break before it:
 * {@link NO_BREAK}, {@link BREAK_ALLOWED} or {@link BREAK_MANDATORY}. Position
 * 0 never breaks and position `cps.length` always does.
 *
 * `cps` is code points, not UTF-16 units — one entry per scalar value.
 */
export function lineBreakOpportunities(cps: ArrayLike<number>): Uint8Array {
  const n = cps.length;
  const out = new Uint8Array(n + 1);
  if (n === 0) return out;
  out[n] = BREAK_MANDATORY;

  // LB9/LB10: collapse each base and the marks it carries into one unit.
  const cls = new Uint8Array(n);
  const ea = new Uint8Array(n);
  const pict = new Uint8Array(n);
  const cp = new Int32Array(n);
  /** Original index of each unit's first code point. */
  const start = new Int32Array(n);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const props = lineBreakPropsOf(cps[i]);
    const c = props & CLASS_MASK;
    if ((c === CM || c === ZWJ) && u > 0) {
      const base = cls[u - 1];
      if (!isHard(base) && base !== SP && base !== ZW) continue;
    }
    if (c === CM || c === ZWJ) {
      cls[u] = AL; ea[u] = 0; pict[u] = 0;
    } else {
      cls[u] = c; ea[u] = props & EAST_ASIAN ? 1 : 0; pict[u] = props & PICTOGRAPHIC_CN ? 1 : 0;
    }
    cp[u] = cps[i];
    start[u] = i;
    u++;
  }
  const units = u;

  // The original class of the code point just before unit `b`, which is the
  // last mark `b - 1` absorbed when it absorbed any.
  const prevIsZWJ = (b: number): boolean => (lineBreakPropsOf(cps[start[b] - 1]) & CLASS_MASK) === ZWJ;

  /** The unit before `k`'s run of spaces — `k` itself when it is not a space. */
  const beforeSpaces = (k: number): number => {
    while (k >= 0 && cls[k] === SP) k--;
    return k;
  };

  for (let b = 1; b < units; b++) {
    out[start[b]] = decide(b);
  }
  return out;

  function decide(b: number): number {
    const a = b - 1;
    const A = cls[a];
    const B = cls[b];

    // LB4, LB5
    if (A === CR && B === LF) return NO_BREAK;
    if (isHard(A)) return BREAK_MANDATORY;
    // LB6, LB7
    if (isHard(B) || B === SP || B === ZW) return NO_BREAK;
    // LB8
    const s = beforeSpaces(a);
    if (s >= 0 && cls[s] === ZW) return BREAK_ALLOWED;
    // LB8a
    if (prevIsZWJ(b)) return NO_BREAK;
    // LB11, LB12, LB12a
    if (A === WJ || B === WJ || A === GL) return NO_BREAK;
    if (B === GL && A !== SP && A !== BA && A !== HY) return NO_BREAK;
    // LB13
    if (B === CL || B === CP || B === EX || B === SY) return NO_BREAK;
    // LB14
    const S = s >= 0 ? cls[s] : -1;
    if (S === OP) return NO_BREAK;
    // LB15a
    if (S === QU_PI) {
      const p = s - 1;
      if (p < 0) return NO_BREAK;
      const P = cls[p];
      if (isHard(P) || P === OP || isQU(P) || P === GL || P === SP || P === ZW) return NO_BREAK;
    }
    // LB15b
    if (B === QU_PF) {
      if (b + 1 >= units) return NO_BREAK;
      const N = cls[b + 1];
      if (N === SP || N === GL || N === WJ || N === CL || isQU(N) || N === CP || N === EX
          || N === IS || N === SY || isHard(N) || N === ZW) return NO_BREAK;
    }
    // LB15c, LB15d
    if (A === SP && B === IS && b + 1 < units && cls[b + 1] === NU) return BREAK_ALLOWED;
    if (B === IS) return NO_BREAK;
    // LB16, LB17
    if ((S === CL || S === CP) && B === NS) return NO_BREAK;
    if (S === B2 && B === B2) return NO_BREAK;
    // LB18
    if (A === SP) return BREAK_ALLOWED;
    // LB19
    if (B === QU || B === QU_PF) return NO_BREAK;
    if (A === QU || A === QU_PI) return NO_BREAK;
    // LB19a
    if (isQU(B)) {
      if (!ea[a]) return NO_BREAK;
      if (b + 1 >= units || !ea[b + 1]) return NO_BREAK;
    }
    if (isQU(A)) {
      if (!ea[b]) return NO_BREAK;
      if (a === 0 || !ea[a - 1]) return NO_BREAK;
    }
    // LB20
    if (A === CB || B === CB) return BREAK_ALLOWED;
    // LB20a
    if ((A === HY || cp[a] === HYPHEN) && B === AL) {
      if (a === 0) return NO_BREAK;
      const P = cls[a - 1];
      if (isHard(P) || P === SP || P === ZW || P === CB || P === GL) return NO_BREAK;
    }
    // LB21
    if (B === BA || B === HY || B === NS || A === BB) return NO_BREAK;
    // LB21a
    if (a > 0 && cls[a - 1] === HL && (A === HY || (A === BA && !ea[a])) && B !== HL) return NO_BREAK;
    // LB21b, LB22
    if (A === SY && B === HL) return NO_BREAK;
    if (B === IN) return NO_BREAK;
    // LB23, LB23a, LB24
    if ((isAlpha(A) && B === NU) || (A === NU && isAlpha(B))) return NO_BREAK;
    if ((A === PR && isIdeoLike(B)) || (isIdeoLike(A) && B === PO)) return NO_BREAK;
    if (((A === PR || A === PO) && isAlpha(B)) || (isAlpha(A) && (B === PR || B === PO))) return NO_BREAK;
    // LB25
    if (B === PO || B === PR) {
      let k = A === CL || A === CP ? a - 1 : a;
      while (k >= 0 && (cls[k] === SY || cls[k] === IS)) k--;
      if (k >= 0 && cls[k] === NU) return NO_BREAK;
    }
    if (A === PO || A === PR) {
      if (B === NU) return NO_BREAK;
      if (B === OP && b + 1 < units) {
        const N = cls[b + 1];
        if (N === NU) return NO_BREAK;
        if (N === IS && b + 2 < units && cls[b + 2] === NU) return NO_BREAK;
      }
    }
    if ((A === HY || A === IS) && B === NU) return NO_BREAK;
    if (B === NU) {
      let k = a;
      while (k >= 0 && (cls[k] === SY || cls[k] === IS)) k--;
      if (k >= 0 && cls[k] === NU) return NO_BREAK;
    }
    // LB26, LB27
    if (A === JL && (B === JL || B === JV || B === H2 || B === H3)) return NO_BREAK;
    if ((A === JV || A === H2) && (B === JV || B === JT)) return NO_BREAK;
    if ((A === JT || A === H3) && B === JT) return NO_BREAK;
    if ((isKorean(A) && B === PO) || (A === PR && isKorean(B))) return NO_BREAK;
    // LB28
    if (isAlpha(A) && isAlpha(B)) return NO_BREAK;
    // LB28a
    const aksaraA = A === AK || A === AS || cp[a] === DOTTED_CIRCLE;
    const aksaraB = B === AK || B === AS || cp[b] === DOTTED_CIRCLE;
    if (A === AP && aksaraB) return NO_BREAK;
    if (aksaraA && (B === VF || B === VI)) return NO_BREAK;
    if (A === VI && a > 0 && (cls[a - 1] === AK || cls[a - 1] === AS || cp[a - 1] === DOTTED_CIRCLE)
        && (B === AK || cp[b] === DOTTED_CIRCLE)) return NO_BREAK;
    if (aksaraA && aksaraB && b + 1 < units && cls[b + 1] === VF) return NO_BREAK;
    // LB29, LB30
    if (A === IS && isAlpha(B)) return NO_BREAK;
    if ((isAlpha(A) || A === NU) && B === OP && !ea[b]) return NO_BREAK;
    if (A === CP && !ea[a] && (isAlpha(B) || B === NU)) return NO_BREAK;
    // LB30a
    if (A === RI && B === RI) {
      let k = a;
      while (k >= 0 && cls[k] === RI) k--;
      if ((a - k) % 2 === 1) return NO_BREAK;
    }
    // LB30b
    if (B === EM && (A === EB || pict[a])) return NO_BREAK;
    // LB31
    return BREAK_ALLOWED;
  }
}
