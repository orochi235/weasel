import { latin1Bytes } from './latin1';
import { num } from './num';

/** A page's content stream, built one operator per line. */
export class ContentStream {
  private readonly lines: string[] = [];

  /** Numbers are written with `num`; strings go in as given, so a name operand is `'/GS1'`. */
  op(operator: string, ...operands: (number | string)[]): this {
    const args = operands.map((o) => (typeof o === 'number' ? num(o) : o));
    this.lines.push(args.length ? `${args.join(' ')} ${operator}` : operator);
    return this;
  }

  /** Where the stream ends now, for `rollback`. */
  mark(): number {
    return this.lines.length;
  }

  /** Drops every operator written since `mark` answered `at`. */
  rollback(at: number): void {
    this.lines.length = at;
  }

  bytes(): Uint8Array {
    return latin1Bytes(`${this.lines.join('\n')}\n`);
  }
}
