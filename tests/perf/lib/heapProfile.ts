/**
 * Reading a V8 sampling heap profile (`HeapProfiler.stopSampling`): which
 * functions allocated, by bytes.
 */

export interface HeapProfileNode {
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber?: number };
  selfSize: number;
  id: number;
  children: HeapProfileNode[];
}

export interface HeapProfile { head: HeapProfileNode }

export interface Allocator {
  /** `name (file:line)`, the line 1-based. */
  fn: string;
  /** Bytes allocated by the function itself. */
  self: number;
  /** Bytes allocated by it and everything it called, each byte counted once
   *  however often the function recurs on the stack. */
  total: number;
}

/** `fn` for a call frame, its url cut to the path inside the repo or bundle. */
export function frameName(cf: HeapProfileNode['callFrame']): string {
  const name = cf.functionName || '(anonymous)';
  if (!cf.url) return name;
  const path = cf.url.replace(/[?#].*$/, '').replace(/^.*?\/(packages|apps|tests|node_modules)\//, '$1/');
  return `${name} (${path}:${cf.lineNumber + 1})`;
}

/** Every function in the profile, by bytes, most self bytes first. */
export function allocators(profile: HeapProfile): { all: number; rows: Allocator[] } {
  const rows = new Map<string, Allocator>();
  let all = 0;
  const row = (fn: string) => {
    let r = rows.get(fn);
    if (!r) { r = { fn, self: 0, total: 0 }; rows.set(fn, r); }
    return r;
  };
  const stack: string[] = [];
  const visit = (node: HeapProfileNode) => {
    const fn = frameName(node.callFrame);
    stack.push(fn);
    if (node.selfSize > 0) {
      all += node.selfSize;
      row(fn).self += node.selfSize;
      for (const f of new Set(stack)) row(f).total += node.selfSize;
    }
    for (const c of node.children) visit(c);
    stack.pop();
  };
  visit(profile.head);
  return { all, rows: [...rows.values()].sort((a, b) => b.self - a.self) };
}
