/** What a WGSL module's entry points read and write: the names its vertex
 *  stage takes attributes under, by location, and the locations its fragment
 *  stage writes. */
import { attributeInt, moduleConsts, stripWgslComments } from './wgslLexical';

export interface WgslEntries {
  readonly vertex: string;
  readonly fragment: string;
  /** Each vertex input by name, and by `a_<name>` where it lacks that prefix,
   *  the way a GLSL program names its attributes. */
  readonly attributes: ReadonlyMap<string, number>;
  /** Every location the vertex stage reads. */
  readonly inputs: readonly number[];
  /** Every location the fragment stage writes. */
  readonly outputs: ReadonlySet<number>;
}

/** `@location(N) name: type` pairs in a parameter list or struct body. */
function locationsIn(text: string, consts: ReadonlyMap<string, number>): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const re = /(@location\s*\(([^)]*)\))\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*(\w+)\s*:/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push([m[3], attributeInt(m[1], m[2], consts)]);
  return out;
}

function structBody(src: string, name: string): string {
  const m = new RegExp(`\\bstruct\\s+${name}\\s*\\{([^}]*)\\}`).exec(src);
  return m ? m[1] : '';
}

/** The text between the parenthesis at `open` and its match. */
function parenthesized(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i);
  }
  throw new Error('WGSL: unbalanced parentheses');
}

function entry(src: string, stage: 'vertex' | 'fragment'): { name: string; params: string; result: string } {
  const m = new RegExp(`@${stage}\\s+fn\\s+(\\w+)\\s*\\(`).exec(src);
  if (!m) throw new Error(`WGSL: the module has no @${stage} entry point`);
  const open = m.index + m[0].length - 1;
  const params = parenthesized(src, open);
  const after = src.slice(open + params.length + 2);
  const result = /^\s*(?:->\s*([^{]*))?\{/.exec(after)?.[1]?.trim() ?? '';
  return { name: m[1], params, result };
}

/** Locations a parameter list reads, directly or through a struct parameter. */
function inputsOf(src: string, params: string, consts: ReadonlyMap<string, number>): Array<[string, number]> {
  const out = locationsIn(params, consts);
  const structParam = /(?:^|,)\s*(\w+)\s*:\s*(\w+)\s*(?=,|$)/g;
  for (let m = structParam.exec(params); m; m = structParam.exec(params)) {
    out.push(...locationsIn(structBody(src, m[2]), consts));
  }
  return out;
}

export function reflectEntries(source: string): WgslEntries {
  const src = stripWgslComments(source);
  const vs = entry(src, 'vertex');
  const fs = entry(src, 'fragment');
  const consts = moduleConsts(src);
  const attributes = new Map<string, number>();
  const inputs: number[] = [];
  for (const [name, location] of inputsOf(src, vs.params, consts)) {
    attributes.set(name, location);
    if (!name.startsWith('a_')) attributes.set(`a_${name}`, location);
    if (!inputs.includes(location)) inputs.push(location);
  }
  const direct = /^@location\s*\(([^)]*)\)/.exec(fs.result);
  const outputs = new Set<number>(direct
    ? [attributeInt(direct[0], direct[1], consts)]
    : locationsIn(structBody(src, fs.result.replace(/\W/g, '')), consts).map(([, l]) => l));
  return { vertex: vs.name, fragment: fs.name, attributes, inputs, outputs };
}
