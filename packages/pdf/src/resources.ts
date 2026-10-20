import { name, type PdfDict, PdfRef } from './objects';

/** Hands out resource names (`GS1`, `Sh1`, …) for one page and writes them as its `/Resources`. */
export class PageResources {
  private readonly gstates = new Map<string, string>();
  private readonly refs = {
    Shading: new Map<number, string>(),
    XObject: new Map<number, string>(),
    Font: new Map<number, string>(),
    Pattern: new Map<number, string>(),
  };

  extGState(fillAlpha: number, strokeAlpha: number): string {
    const key = `${fillAlpha} ${strokeAlpha}`;
    let n = this.gstates.get(key);
    if (n === undefined) {
      n = `GS${this.gstates.size + 1}`;
      this.gstates.set(key, n);
    }
    return n;
  }

  shading(ref: PdfRef): string {
    return this.named('Shading', 'Sh', ref);
  }
  xobject(ref: PdfRef): string {
    return this.named('XObject', 'Im', ref);
  }
  font(ref: PdfRef): string {
    return this.named('Font', 'F', ref);
  }
  pattern(ref: PdfRef): string {
    return this.named('Pattern', 'P', ref);
  }

  private named(kind: keyof PageResources['refs'], prefix: string, ref: PdfRef): string {
    const m = this.refs[kind];
    let n = m.get(ref.id);
    if (n === undefined) {
      n = `${prefix}${m.size + 1}`;
      m.set(ref.id, n);
    }
    return n;
  }

  dict(): PdfDict {
    const out: Record<string, PdfDict> = {};
    if (this.gstates.size) {
      const g: Record<string, PdfDict> = {};
      for (const [key, n] of this.gstates) {
        const [ca, CA] = key.split(' ').map(Number);
        g[n] = { Type: name('ExtGState'), ca, CA };
      }
      out.ExtGState = g;
    }
    for (const [kind, m] of Object.entries(this.refs)) {
      if (!m.size) continue;
      const d: Record<string, PdfRef> = {};
      for (const [id, n] of m) d[n] = new PdfRef(id);
      out[kind] = d;
    }
    return out;
  }
}
