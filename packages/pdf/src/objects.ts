import { num } from './num';

export class PdfName {
  constructor(readonly value: string) {}
}
export class PdfRef {
  constructor(readonly id: number) {}
}
export class PdfText {
  constructor(readonly value: string) {}
}
export class PdfBytes {
  constructor(readonly value: Uint8Array) {}
}

export type PdfValue =
  | number
  | boolean
  | null
  | PdfName
  | PdfRef
  | PdfText
  | PdfBytes
  | readonly PdfValue[]
  | PdfDict;
export interface PdfDict {
  readonly [key: string]: PdfValue | undefined;
}

/** Serializes as `/n`, escaping delimiters and anything outside printable ASCII as `#xx`. */
export function name(n: string): PdfName {
  return new PdfName(n);
}
/** Serializes as `(…)` when ASCII-safe, else as UTF-16BE hex with a byte-order mark. */
export function text(s: string): PdfText {
  return new PdfText(s);
}
/** Serializes as `<hex>`. */
export function bytes(b: Uint8Array): PdfBytes {
  return new PdfBytes(b);
}

const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');

function writeName(n: string): string {
  let out = '/';
  for (const b of new TextEncoder().encode(n)) {
    const ch = String.fromCharCode(b);
    out += b < 33 || b > 126 || '#()<>[]{}/%'.includes(ch) ? `#${hex2(b)}` : ch;
  }
  return out;
}

function writeText(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, '\\$&')})`;
  let out = '<FEFF';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return `${out}>`;
}

function write(v: PdfValue): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof PdfName) return writeName(v.value);
  if (v instanceof PdfRef) return `${v.id} 0 R`;
  if (v instanceof PdfText) return writeText(v.value);
  if (v instanceof PdfBytes) return `<${Array.from(v.value, hex2).join('')}>`;
  if (Array.isArray(v)) return `[${(v as readonly PdfValue[]).map(write).join(' ')}]`;
  return writeDict(v as PdfDict);
}

function writeDict(d: PdfDict): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) if (v !== undefined) parts.push(`${writeName(k)} ${write(v)}`);
  return `<<${parts.join(' ')}>>`;
}

const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

export class PdfObjects {
  private readonly bodies: (Uint8Array | undefined)[] = [];

  alloc(): PdfRef {
    this.bodies.push(undefined);
    return new PdfRef(this.bodies.length);
  }

  set(ref: PdfRef, value: PdfValue): void {
    this.bodies[ref.id - 1] = latin1(write(value));
  }

  /** Writes `/Length` itself; the caller passes the already-encoded bytes. */
  stream(ref: PdfRef, dict: PdfDict, data: Uint8Array): void {
    const head = latin1(`${writeDict({ ...dict, Length: data.length })}\nstream\n`);
    const tail = latin1('\nendstream');
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head, 0);
    out.set(data, head.length);
    out.set(tail, head.length + data.length);
    this.bodies[ref.id - 1] = out;
  }

  serialize(root: PdfRef, info?: PdfRef): Uint8Array {
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const push = (c: Uint8Array) => {
      chunks.push(c);
      offset += c.length;
    };
    push(Uint8Array.of(...latin1('%PDF-1.7\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));
    const offsets: number[] = [];
    this.bodies.forEach((body, i) => {
      if (!body) throw new Error(`pdf: object ${i + 1} was allocated but never set`);
      offsets.push(offset);
      push(latin1(`${i + 1} 0 obj\n`));
      push(body);
      push(latin1('\nendobj\n'));
    });
    const xref = offset;
    let table = `xref\n0 ${this.bodies.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) table += `${String(o).padStart(10, '0')} 00000 n \n`;
    const trailer = writeDict({ Size: this.bodies.length + 1, Root: root, Info: info });
    push(latin1(`${table}trailer\n${trailer}\nstartxref\n${xref}\n%%EOF\n`));
    const out = new Uint8Array(offset);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}
