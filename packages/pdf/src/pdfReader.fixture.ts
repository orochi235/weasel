/**
 * A minimal PDF reader for pdf's property tests: the object syntax, the file's xref and trailer, and
 * content-stream tokens. Strict where the writer should be: anything it cannot read throws. Test-only.
 */
import { inflateSync } from 'node:zlib';

export class Name {
  constructor(readonly value: string) {}
}
export class Ref {
  constructor(readonly id: number, readonly gen: number) {}
}
/** A string's bytes, literal or hex alike. */
export class Str {
  constructor(readonly bytes: Uint8Array, readonly hex: boolean) {}
}
export class Op {
  constructor(readonly op: string) {}
}
export type Value = number | boolean | null | Name | Ref | Str | Value[] | Dict;
export interface Dict { [key: string]: Value }

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([...'()<>[]{}/%'].map((c) => c.charCodeAt(0)));
/** The only number form the writer may use: no exponent, no leading `+` or `.`. */
export const NUMBER = /^-?\d+(\.\d+)?$/;

export class Lexer {
  at = 0;
  constructor(readonly b: Uint8Array) {}

  skipSpace(): void {
    for (;;) {
      while (this.at < this.b.length && WS.has(this.b[this.at]!)) this.at++;
      if (this.b[this.at] !== 0x25) return;
      while (this.at < this.b.length && this.b[this.at] !== 0x0a && this.b[this.at] !== 0x0d) this.at++;
    }
  }

  done(): boolean {
    this.skipSpace();
    return this.at >= this.b.length;
  }

  private regular(): string {
    const start = this.at;
    while (this.at < this.b.length && !WS.has(this.b[this.at]!) && !DELIM.has(this.b[this.at]!)) this.at++;
    return String.fromCharCode(...this.b.subarray(start, this.at));
  }

  private name(): Name {
    this.at++;
    const raw = this.regular();
    const out: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '#') {
        const h = raw.slice(i + 1, i + 3);
        if (!/^[0-9A-Fa-f]{2}$/.test(h)) throw new Error(`bad name escape in /${raw}`);
        out.push(parseInt(h, 16));
        i += 2;
      } else out.push(raw.charCodeAt(i));
    }
    if (out.includes(0)) throw new Error(`name /${raw} holds a NUL`);
    return new Name(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(out)));
  }

  private literal(): Str {
    this.at++;
    const out: number[] = [];
    let depth = 1;
    const ESC: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
    for (;;) {
      if (this.at >= this.b.length) throw new Error('unterminated string');
      const c = this.b[this.at++]!;
      if (c === 0x5c) {
        const e = String.fromCharCode(this.b[this.at++]!);
        if (e in ESC) out.push(ESC[e]!);
        else if (/[0-7]/.test(e)) {
          let oct = e;
          while (oct.length < 3 && /[0-7]/.test(String.fromCharCode(this.b[this.at]!))) oct += String.fromCharCode(this.b[this.at++]!);
          out.push(parseInt(oct, 8) & 0xff);
        } else if (e !== '\n' && e !== '\r') out.push(e.charCodeAt(0));
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29 && --depth === 0) return new Str(Uint8Array.from(out), false);
      out.push(c);
    }
  }

  private hexString(): Str {
    this.at++;
    let digits = '';
    for (;;) {
      const c = this.b[this.at++];
      if (c === undefined) throw new Error('unterminated hex string');
      if (c === 0x3e) break;
      if (WS.has(c)) continue;
      const ch = String.fromCharCode(c);
      if (!/[0-9A-Fa-f]/.test(ch)) throw new Error(`bad hex digit ${ch}`);
      digits += ch;
    }
    if (digits.length % 2) digits += '0';
    return new Str(Uint8Array.from(digits.match(/../g) ?? [], (h) => parseInt(h, 16)), true);
  }

  /** One token: a value's opening, a closing delimiter as an `Op`, or a bare keyword as an `Op`. */
  token(): Value | Op {
    this.skipSpace();
    const c = this.b[this.at];
    if (c === undefined) throw new Error('unexpected end of input');
    if (c === 0x2f) return this.name();
    if (c === 0x28) return this.literal();
    if (c === 0x3c && this.b[this.at + 1] === 0x3c) {
      this.at += 2;
      return new Op('<<');
    }
    if (c === 0x3e && this.b[this.at + 1] === 0x3e) {
      this.at += 2;
      return new Op('>>');
    }
    if (c === 0x3c) return this.hexString();
    if (c === 0x5b || c === 0x5d) {
      this.at++;
      return new Op(String.fromCharCode(c));
    }
    if (DELIM.has(c)) throw new Error(`stray delimiter ${String.fromCharCode(c)} at ${this.at}`);
    const word = this.regular();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      if (!NUMBER.test(word)) throw new Error(`number ${word} is not in the writer's form`);
      return Number(word);
    }
    if (/^[+-]?[\d.]/.test(word)) throw new Error(`malformed number ${word}`);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return new Op(word);
  }

  /** A whole value, refs (`n g R`) included. Throws on anything else. */
  value(): Value {
    const t = this.valueOrOp();
    if (t instanceof Op) throw new Error(`expected a value, got ${t.op}`);
    return t;
  }

  /** A whole value, or the next keyword as an `Op`. */
  valueOrOp(): Value | Op {
    const t = this.token();
    if (t instanceof Op) {
      if (t.op === '[') {
        const out: Value[] = [];
        for (;;) {
          const v = this.valueOrOp();
          if (v instanceof Op && v.op === ']') return out;
          if (v instanceof Op) throw new Error(`operator ${v.op} inside an array`);
          out.push(v);
        }
      }
      if (t.op === '<<') {
        const out: Dict = Object.create(null) as Dict;
        for (;;) {
          const k = this.valueOrOp();
          if (k instanceof Op && k.op === '>>') return out;
          if (!(k instanceof Name)) throw new Error('dictionary key is not a name');
          if (Object.hasOwn(out, k.value)) throw new Error(`duplicate key /${k.value}`);
          out[k.value] = this.value();
        }
      }
      return t;
    }
    if (typeof t === 'number' && Number.isInteger(t) && t >= 0) {
      const save = this.at;
      try {
        const gen = this.token();
        const r = this.token();
        if (typeof gen === 'number' && r instanceof Op && r.op === 'R') return new Ref(t, gen);
      } catch {
        // not a ref
      }
      this.at = save;
    }
    return t;
  }

  expect(text: string): void {
    const got = String.fromCharCode(...this.b.subarray(this.at, this.at + text.length));
    if (got !== text) throw new Error(`expected ${JSON.stringify(text)} at ${this.at}, got ${JSON.stringify(got)}`);
    this.at += text.length;
  }
}

export interface PdfObject {
  value: Value;
  /** The stream's bytes as stored, and decoded when its filter is FlateDecode. */
  stream?: { raw: Uint8Array; data: Uint8Array };
}

export interface ParsedPdf {
  trailer: Dict;
  objects: Map<number, PdfObject>;
}

/** Reads a whole file the way `PdfObjects.serialize` lays one out, checking every xref offset. */
export function readPdf(bytes: Uint8Array): ParsedPdf {
  const text = String.fromCharCode(...bytes.subarray(0, 9));
  if (text !== '%PDF-1.7\n') throw new Error('bad header');
  const tail = String.fromCharCode(...bytes.subarray(Math.max(0, bytes.length - 40)));
  const m = /startxref\n(\d+)\n%%EOF\n$/.exec(tail);
  if (!m) throw new Error('no startxref');
  const lx = new Lexer(bytes);
  lx.at = Number(m[1]);
  lx.expect('xref\n');
  lx.expect('0 ');
  const head = /^(\d+)\n/.exec(String.fromCharCode(...bytes.subarray(lx.at, lx.at + 12)));
  if (!head) throw new Error('bad xref subsection');
  lx.at += head[0].length;
  const size = Number(head[1]);
  const offsets: number[] = [];
  for (let i = 0; i < size; i++) {
    const line = String.fromCharCode(...bytes.subarray(lx.at, lx.at + 20));
    const e = /^(\d{10}) (\d{5}) ([nf]) \n$/.exec(line);
    if (!e) throw new Error(`bad xref entry ${JSON.stringify(line)}`);
    if (i === 0 ? e[3] !== 'f' : e[3] !== 'n') throw new Error(`xref entry ${i} kind ${e[3]}`);
    offsets.push(Number(e[1]));
    lx.at += 20;
  }
  lx.expect('trailer\n');
  const trailer = lx.value();
  if (!isDict(trailer) || trailer.Size !== size) throw new Error('trailer /Size does not match the xref');
  const objects = new Map<number, PdfObject>();
  for (let id = 1; id < size; id++) objects.set(id, readObject(bytes, offsets[id]!, id));
  return { trailer, objects };
}

function readObject(bytes: Uint8Array, offset: number, id: number): PdfObject {
  const lx = new Lexer(bytes);
  lx.at = offset;
  lx.expect(`${id} 0 obj\n`);
  const value = lx.value();
  if (isDict(value) && String.fromCharCode(...bytes.subarray(lx.at, lx.at + 8)) === '\nstream\n') {
    lx.at += 8;
    const len = value.Length;
    if (typeof len !== 'number') throw new Error(`object ${id}: stream with no /Length`);
    const raw = bytes.slice(lx.at, lx.at + len);
    lx.at += len;
    lx.expect('\nendstream\nendobj\n');
    const filter = value.Filter;
    if (filter !== undefined && !(filter instanceof Name && filter.value === 'FlateDecode')) {
      throw new Error(`object ${id}: unknown filter`);
    }
    const data = filter ? new Uint8Array(inflateSync(raw)) : raw;
    return { value, stream: { raw, data } };
  }
  lx.expect('\nendobj\n');
  return { value };
}

export function isDict(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Name) && !(v instanceof Ref) && !(v instanceof Str);
}

/** A text string's characters: UTF-16BE after a byte-order mark, else one char per byte. */
export function textOf(s: Str): string {
  const b = s.bytes;
  if (b[0] === 0xfe && b[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < b.length; i += 2) out += String.fromCharCode((b[i]! << 8) | b[i + 1]!);
    return out;
  }
  return String.fromCharCode(...b);
}

export interface Operation {
  op: string;
  args: Value[];
}

/** A content stream as its operators, each with the operands before it. */
export function readContent(data: Uint8Array): Operation[] {
  const lx = new Lexer(data);
  const out: Operation[] = [];
  let args: Value[] = [];
  while (!lx.done()) {
    const t = lx.valueOrOp();
    if (t instanceof Op) {
      out.push({ op: t.op, args });
      args = [];
    } else args.push(t);
  }
  if (args.length) throw new Error('operands after the last operator');
  return out;
}
