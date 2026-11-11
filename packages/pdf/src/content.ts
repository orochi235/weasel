import { latin1Bytes } from './latin1';
import { num } from './num';

/** How finely the stream writes a coordinate: the current matrix's stretch, and the stretches `q` saved. */
interface Precision {
  readonly scale: number;
  readonly saved: readonly number[];
}

/**
 * The decimals for each entry of an affine `[a, b, c, d, e, f]` written where coordinates take
 * `decimals`: each axis keeps four decimals of its own stretch, and the offset takes `decimals`.
 */
export function affinePlaces(m: readonly number[], decimals = 4): number[] {
  const axis = (x: number, y: number) => {
    const n = Math.hypot(x, y);
    return n > 0 && Number.isFinite(n) ? decimals + Math.max(0, -Math.floor(Math.log10(n))) : decimals;
  };
  const [ab, cd] = [axis(m[0]!, m[1]!), axis(m[2]!, m[3]!)];
  return [ab, ab, cd, cd, decimals, decimals];
}

/** How far an affine `[a, b, c, d, e, f]` stretches its longer axis. */
const stretch = (m: readonly number[]) => Math.max(Math.hypot(m[0]!, m[1]!), Math.hypot(m[2]!, m[3]!));

const PAGE: Precision = { scale: 1, saved: [] };

/** Decimals that keep a coordinate within 1e-4 of a page unit at `scale` page units per unit. */
const decimalsAt = (scale: number) => 4 + Math.max(0, Math.ceil(Math.log10(scale)));

/**
 * A page's content stream, built one operator per line. Each number is written finely enough to land
 * within 1e-4 of a page unit through the matrices `cm` has set, and a matrix keeps four decimals of
 * each axis's own stretch, so a group scaled far down is not written as a singular one.
 */
export class ContentStream {
  private readonly lines: string[] = [];
  /** The precision after each line, for `rollback`. */
  private readonly after: Precision[] = [];
  private at: Precision = PAGE;

  /** Numbers are written with `num`; strings go in as given, so a name operand is `'/GS1'`. */
  op(operator: string, ...operands: (number | string)[]): this {
    const decimals = decimalsAt(this.at.scale);
    const matrix = (operator === 'cm' || operator === 'Tm') && operands.length === 6;
    const places = matrix ? affinePlaces(operands.map(Number), decimals) : operands.map(() => decimals);
    const args = operands.map((o, i) => (typeof o === 'number' ? num(o, places[i]) : o));
    this.lines.push(args.length ? `${args.join(' ')} ${operator}` : operator);
    this.at = this.next(operator, operands);
    this.after.push(this.at);
    return this;
  }

  /** The decimals a coordinate takes here, or in the frame `m` (an affine) maps into here. */
  places(m?: readonly number[]): number {
    const s = m ? stretch(m) : 1;
    return decimalsAt(Number.isFinite(s) && s > 0 ? this.at.scale * s : this.at.scale);
  }

  private next(operator: string, operands: readonly (number | string)[]): Precision {
    const { scale, saved } = this.at;
    if (operator === 'q') return { scale, saved: [...saved, scale] };
    if (operator === 'Q') return saved.length ? { scale: saved[saved.length - 1]!, saved: saved.slice(0, -1) } : this.at;
    if (operator !== 'cm') return this.at;
    const s = stretch(operands.map(Number));
    return Number.isFinite(s) && s > 0 ? { scale: scale * s, saved } : this.at;
  }

  /** Where the stream ends now, for `rollback`. */
  mark(): number {
    return this.lines.length;
  }

  /** Drops every operator written since `mark` answered `at`. */
  rollback(at: number): void {
    this.lines.length = at;
    this.after.length = at;
    this.at = at > 0 ? this.after[at - 1]! : PAGE;
  }

  bytes(): Uint8Array {
    return latin1Bytes(`${this.lines.join('\n')}\n`);
  }
}
