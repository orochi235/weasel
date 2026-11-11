/**
 * Checks a whole file `writePdf` wrote: its structure through `readPdf`, every reference, every
 * content stream's operators against their operand types, ranges, and nesting, and the resources
 * each stream names. Throws on the first fault. Test-only.
 */
import { type Dict, isDict, Name, type Operation, type ParsedPdf, readContent, readPdf, Ref, Str, type Value } from './pdfReader.fixture';

type Arg = 'num' | 'name' | 'array' | 'dict' | 'str';

const OPS: Record<string, Arg[]> = {
  q: [], Q: [], cm: ['num', 'num', 'num', 'num', 'num', 'num'], gs: ['name'],
  rg: ['num', 'num', 'num'], RG: ['num', 'num', 'num'], w: ['num'], J: ['num'], j: ['num'], M: ['num'],
  d: ['array', 'num'], cs: ['name'], scn: ['name'], sh: ['name'], Do: ['name'],
  m: ['num', 'num'], l: ['num', 'num'], c: ['num', 'num', 'num', 'num', 'num', 'num'], re: ['num', 'num', 'num', 'num'], h: [],
  f: [], 'f*': [], S: [], n: [], W: [], 'W*': [],
  BT: [], ET: [], Tf: ['name', 'num'], Tr: ['num'], Tm: ['num', 'num', 'num', 'num', 'num', 'num'], Td: ['num', 'num'],
  TJ: ['array'], Ts: ['num'], BDC: ['name', 'dict'], EMC: [],
};

const PATH_OPS = new Set(['m', 'l', 'c', 're', 'h']);
const PAINT_OPS = new Set(['f', 'f*', 'S', 'n']);
const TEXT_OPS = new Set(['Tf', 'Tr', 'Tm', 'Td', 'TJ', 'Ts']);
/** General graphics state, color, and marked content: what a text object may hold beside text operators. */
const IN_TEXT = new Set(['ET', 'gs', 'rg', 'RG', 'w', 'J', 'j', 'M', 'd', 'cs', 'scn', 'BDC', 'EMC']);

function argOk(kind: Arg, v: Value): boolean {
  if (kind === 'num') return typeof v === 'number';
  if (kind === 'name') return v instanceof Name;
  if (kind === 'array') return Array.isArray(v);
  if (kind === 'str') return v instanceof Str;
  return isDict(v);
}

const inUnit = (v: Value) => typeof v === 'number' && v >= 0 && v <= 1;

/** What a check found worth counting, so a property can guard that it reached each kind of stream. */
export interface Seen {
  ops: Map<string, number>;
  forms: number;
  images: number;
  shadings: number;
  patterns: number;
}

type Get = (v: Value | undefined) => Value | undefined;

function checkFunction(get: Get, fn: Value | undefined, channels: number): void {
  const f = get(fn);
  if (!isDict(f)) throw new Error('shading function is not a dict');
  if (f.FunctionType === 2) {
    for (const k of ['C0', 'C1']) {
      const c = f[k];
      if (!Array.isArray(c) || c.length !== channels || !c.every(inUnit)) throw new Error(`function /${k} ${JSON.stringify(c)}`);
    }
    return;
  }
  const fns = f.Functions as Value[];
  const bounds = f.Bounds as number[];
  if (f.FunctionType !== 3 || bounds.length !== fns.length - 1 || (f.Encode as Value[]).length !== 2 * fns.length) {
    throw new Error('bad stitching function');
  }
  let lo = 0;
  for (const b of bounds) {
    if (!(b >= lo && b <= 1)) throw new Error(`stitching bounds out of order: ${bounds.join(' ')}`);
    lo = b;
  }
  fns.forEach((g) => checkFunction(get, g, channels));
}

function checkShading(pdf: ParsedPdf, get: Get, checked: Set<number>, seen: Seen, ref: Value): void {
  const id = ref instanceof Ref ? ref.id : -1;
  if (checked.has(id)) return;
  checked.add(id);
  seen.shadings++;
  const o = id > 0 ? pdf.objects.get(id)! : { value: ref, stream: undefined };
  const sh = o.value as Dict;
  const channels = (sh.ColorSpace as Name).value === 'DeviceRGB' ? 3 : 1;
  const coords = sh.Coords as number[] | undefined;
  if (sh.ShadingType === 2 && coords?.length !== 4) throw new Error('axial shading coords');
  if (sh.ShadingType === 3 && (coords?.length !== 6 || coords[2]! < 0 || coords[5]! < 0)) throw new Error('radial shading coords');
  if (sh.ShadingType === 4 && o.stream?.data.length !== 360 * 3 * 11) throw new Error('conic mesh length');
  checkFunction(get, sh.Function, channels);
}

export function checkPdf(bytes: Uint8Array): { pdf: ParsedPdf; seen: Seen } {
  const pdf = readPdf(bytes);
  const seen: Seen = { ops: new Map(), forms: 0, images: 0, shadings: 0, patterns: 0 };
  const get = (v: Value | undefined): Value | undefined => {
    if (!(v instanceof Ref)) return v;
    if (v.gen !== 0 || !pdf.objects.has(v.id)) throw new Error(`dangling ref ${v.id} ${v.gen} R`);
    return pdf.objects.get(v.id)!.value;
  };
  const walk = (v: Value): void => {
    if (v instanceof Ref) get(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isDict(v)) Object.values(v).forEach(walk);
  };
  for (const o of pdf.objects.values()) walk(o.value);
  walk(pdf.trailer);

  const catalog = get(pdf.trailer.Root);
  if (!isDict(catalog) || !(catalog.Type instanceof Name) || catalog.Type.value !== 'Catalog') throw new Error('no catalog');
  const tree = get(catalog.Pages);
  if (!isDict(tree) || !Array.isArray(tree.Kids) || tree.Count !== tree.Kids.length) throw new Error('bad page tree');

  const checked = new Set<number>();
  const streamOf = (ref: Value | undefined, what: string) => {
    if (!(ref instanceof Ref)) throw new Error(`${what} is not a reference`);
    const o = pdf.objects.get(ref.id)!;
    if (!o.stream || !isDict(o.value)) throw new Error(`${what} is not a stream`);
    return { dict: o.value, data: o.stream.data, id: ref.id };
  };

  const checkStream = (data: Uint8Array, resources: Value | undefined, what: string): void => {
    const res = get(resources);
    if (!isDict(res)) throw new Error(`${what}: no resources`);
    const named = (kind: string, n: Name): Value => {
      const group = get(res[kind]);
      const v = isDict(group) ? group[n.value] : undefined;
      if (v === undefined) throw new Error(`${what}: /${n.value} is not in /${kind}`);
      return v;
    };
    checkOps(readContent(data), what, seen, named);
    const xobjects = get(res.XObject);
    if (isDict(xobjects)) for (const ref of Object.values(xobjects)) checkXObject(ref);
    const patterns = get(res.Pattern);
    if (isDict(patterns)) {
      for (const ref of Object.values(patterns)) {
        const s = streamOf(ref, 'pattern');
        if (checked.has(s.id)) continue;
        checked.add(s.id);
        seen.patterns++;
        checkStream(s.data, s.dict.Resources, `pattern ${s.id}`);
      }
    }
    const gstates = get(res.ExtGState);
    if (isDict(gstates)) {
      for (const g of Object.values(gstates)) {
        const gs = get(g);
        if (!isDict(gs)) throw new Error(`${what}: ExtGState is not a dict`);
        for (const k of ['ca', 'CA']) if (gs[k] !== undefined && !inUnit(gs[k]!)) throw new Error(`${what}: /${k} ${String(gs[k])}`);
        const mask = get(gs.SMask);
        if (isDict(mask)) checkXObject(mask.G);
      }
    }
    const shadings = get(res.Shading);
    if (isDict(shadings)) for (const s of Object.values(shadings)) checkShading(pdf, get, checked, seen, s);
  };

  const checkXObject = (ref: Value | undefined): void => {
    const s = streamOf(ref, 'XObject');
    if (checked.has(s.id)) return;
    checked.add(s.id);
    const sub = (s.dict.Subtype as Name).value;
    if (sub === 'Form') {
      seen.forms++;
      checkStream(s.data, s.dict.Resources, `form ${s.id}`);
    } else if (sub === 'Image') {
      seen.images++;
      const { Width: w, Height: h, ColorSpace: cs } = s.dict;
      if (!Number.isInteger(w) || !Number.isInteger(h) || (w as number) < 1 || (h as number) < 1) throw new Error(`image ${s.id}: size ${w}x${h}`);
      const per = (cs as Name).value === 'DeviceRGB' ? 3 : 1;
      if (s.data.length !== (w as number) * (h as number) * per) throw new Error(`image ${s.id}: ${s.data.length} bytes for ${w}x${h}`);
      if (s.dict.SMask) checkXObject(s.dict.SMask);
    } else throw new Error(`XObject ${s.id}: subtype ${sub}`);
  };

  for (const kid of tree.Kids as Value[]) {
    const page = get(kid);
    if (!isDict(page)) throw new Error('page is not a dict');
    const box = page.MediaBox as number[];
    if (!Array.isArray(box) || box.length !== 4) throw new Error('bad MediaBox');
    const content = streamOf(page.Contents, 'page contents');
    checkStream(content.data, page.Resources, `page ${content.id}`);
  }
  return { pdf, seen };
}

/** Operand types and ranges, path construction, q/Q, BT/ET and BDC/EMC nesting, and named resources. */
function checkOps(ops: Operation[], what: string, seen: Seen, named: (kind: string, n: Name) => Value): void {
  let q = 0;
  let marked = 0;
  let inText = false;
  let state: 'page' | 'path' | 'clip' = 'page';
  for (const [i, { op, args }] of ops.entries()) {
    const at = `${what}, op ${i} ${op} [${args.map((a) => (a instanceof Name ? `/${a.value}` : JSON.stringify(a))).join(' ')}]`;
    const shape = OPS[op];
    if (!shape) throw new Error(`${at}: unknown operator`);
    if (shape.length !== args.length || !shape.every((k, j) => argOk(k, args[j]!))) throw new Error(`${at}: bad operands`);
    seen.ops.set(op, (seen.ops.get(op) ?? 0) + 1);
    if (state === 'clip' && !PAINT_OPS.has(op)) throw new Error(`${at}: a clip must be followed by a painting operator`);
    if (state === 'path' && !PATH_OPS.has(op) && !PAINT_OPS.has(op) && op !== 'W' && op !== 'W*') {
      throw new Error(`${at}: inside path construction`);
    }
    if (TEXT_OPS.has(op) && !inText) throw new Error(`${at}: text operator outside BT/ET`);
    if (inText && !TEXT_OPS.has(op) && !IN_TEXT.has(op)) throw new Error(`${at}: not allowed inside BT/ET`);
    const nums = args.filter((a): a is number => typeof a === 'number');
    switch (op) {
      case 'q': q++; break;
      case 'Q': if (--q < 0) throw new Error(`${at}: Q without q`); break;
      case 'BT': if (inText) throw new Error(`${at}: nested BT`); inText = true; break;
      case 'ET': if (!inText) throw new Error(`${at}: ET without BT`); inText = false; break;
      case 'BDC': marked++; break;
      case 'EMC': if (--marked < 0) throw new Error(`${at}: EMC without BDC`); break;
      case 'm': case 're': state = 'path'; break;
      case 'l': case 'c': case 'h': if (state !== 'path') throw new Error(`${at}: no current point`); break;
      case 'W': case 'W*': if (state !== 'path') throw new Error(`${at}: clip with no path`); state = 'clip'; break;
      case 'f': case 'f*': case 'S': case 'n': if (state === 'page') throw new Error(`${at}: paints no path`); state = 'page'; break;
      case 'rg': case 'RG': if (!nums.every((v) => v >= 0 && v <= 1)) throw new Error(`${at}: color out of 0..1`); break;
      case 'w': if (nums[0]! < 0) throw new Error(`${at}: negative width`); break;
      case 'J': case 'j': if (![0, 1, 2].includes(nums[0]!)) throw new Error(`${at}: bad style`); break;
      case 'M': if (nums[0]! < 1) throw new Error(`${at}: miter limit below 1`); break;
      case 'Tr': if (!Number.isInteger(nums[0]) || nums[0]! < 0 || nums[0]! > 7) throw new Error(`${at}: bad render mode`); break;
      case 'd': {
        const dash = args[0] as Value[];
        if (!dash.every((v) => typeof v === 'number' && v >= 0) || !dash.some((v) => (v as number) > 0) || nums[0]! < 0) {
          throw new Error(`${at}: bad dash`);
        }
        break;
      }
      case 'gs': named('ExtGState', args[0] as Name); break;
      case 'sh': named('Shading', args[0] as Name); break;
      case 'Do': named('XObject', args[0] as Name); break;
      case 'scn': named('Pattern', args[0] as Name); break;
      case 'Tf': named('Font', args[0] as Name); break;
      case 'cs': if ((args[0] as Name).value !== 'Pattern') named('ColorSpace', args[0] as Name); break;
      case 'TJ': if (!(args[0] as Value[]).every((v) => typeof v === 'number' || v instanceof Str)) throw new Error(`${at}: bad TJ`); break;
      default:
    }
  }
  if (q !== 0) throw new Error(`${what}: ${q} q left open`);
  if (marked !== 0) throw new Error(`${what}: ${marked} BDC left open`);
  if (inText) throw new Error(`${what}: BT left open`);
  if (state !== 'page') throw new Error(`${what}: path left unpainted`);
}
