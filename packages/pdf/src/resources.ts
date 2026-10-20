import { name, type PdfDict, PdfRef } from './objects';

/** Hands out resource names (`GS1`, `Sh1`, …) for one page and writes them as its `/Resources`. */
export class PageResources {
  private readonly gstates = new Map<string, string>();
  private readonly masks = new Map<number, string>();
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
      n = this.nextGState();
      this.gstates.set(key, n);
    }
    return n;
  }

  /** An ExtGState whose `/SMask` is the luminosity of the transparency group `group`. */
  softMask(group: PdfRef): string {
    let n = this.masks.get(group.id);
    if (n === undefined) {
      n = this.nextGState();
      this.masks.set(group.id, n);
    }
    return n;
  }

  private nextGState(): string {
    return `GS${this.gstates.size + this.masks.size + 1}`;
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
    if (this.gstates.size || this.masks.size) {
      const g: Record<string, PdfDict> = {};
      for (const [key, n] of this.gstates) {
        const [ca, CA] = key.split(' ').map(Number);
        g[n] = { Type: name('ExtGState'), ca, CA };
      }
      for (const [id, n] of this.masks) {
        g[n] = { Type: name('ExtGState'), SMask: { Type: name('Mask'), S: name('Luminosity'), G: new PdfRef(id) } };
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
