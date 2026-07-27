/**
 * Dev-only Vite plugin. Walks every transformed module's AST and, for any
 * function-valued property of an object literal (e.g. `{ onStart: (e) => …,
 * onMove: (e) => … }`), wraps the function with
 *
 *   /*#__PURE__\*\/ Object.assign(<fn>, { __source: { file, line, col } })
 *
 * so the dev inspector (RegistryDetail) can render an "open in editor" link
 * pointing at the exact authoring site of each callback. Plain runtime
 * behavior is unaffected — callers still invoke `fn(...)` as before.
 *
 * Strictly opt-in via `include` (callback-dense source folders only) and
 * skipped entirely in production builds via `apply: 'serve'`.
 */
import { parseAst, type Plugin } from 'vite';
import MagicString from 'magic-string';
import { walk } from 'estree-walker';
import type { Node } from 'estree';

interface Options {
  /** Absolute filesystem paths (or path prefixes) to include. */
  includeDirs: readonly string[];
}

export function callbackSourcePlugin(opts: Options): Plugin {
  return {
    name: 'weasel:callback-source',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      if (!shouldTransform(id, opts.includeDirs)) return null;
      // Cheap bail: no object literals with function values worth touching.
      if (!/=>|function\s*\(/.test(code)) return null;

      const lang = id.endsWith('.tsx') ? 'tsx'
        : id.endsWith('.ts') ? 'ts'
        : id.endsWith('.jsx') ? 'jsx' : 'js';
      let ast: Node;
      try {
        ast = parseAst(code, {
          sourceType: 'module',
          lang,
        } as Parameters<typeof parseAst>[1]) as unknown as Node;
      } catch {
        return null;
      }

      const ms = new MagicString(code);
      let mutated = false;
      const lineOffsets = buildLineOffsets(code);

      const tag = (fn: Node): void => {
        const range = (fn as unknown as { start?: number; end?: number });
        if (range.start == null || range.end == null) return;
        const { line, col } = offsetToLineCol(lineOffsets, range.start);
        const meta = JSON.stringify({ file: id, line, col });
        ms.appendLeft(range.start, '/*#__PURE__*/Object.assign(');
        ms.appendRight(range.end, `,{__source:${meta}})`);
        mutated = true;
      };

      walk(ast, {
        enter(node) {
          if (node.type === 'Property') {
            if (node.shorthand) return;
            const v = node.value;
            if (v.type !== 'FunctionExpression' && v.type !== 'ArrowFunctionExpression') return;
            // Skip getters/setters/methods — they aren't plain function-valued
            // properties.
            if (node.kind !== 'init') return;
            if ((node as { method?: boolean }).method) return;
            // Computed keys are tagged too: route sub-tables key on
            // `[mods('shift')]`, and skipping those left every modifier
            // variant in the inspector without a source link.
            tag(v);
            return;
          }
          // Named handler consts (`const collapseDeferredClick = (ctx) => …`)
          // referenced from a route table by identifier. Without this the
          // property rule above sees an Identifier, not a function, and the
          // route's source column comes up blank — which is most of what
          // `useSelectTool` does.
          if (node.type === 'VariableDeclarator') {
            const init = node.init;
            if (!init) return;
            if (init.type !== 'FunctionExpression' && init.type !== 'ArrowFunctionExpression') return;
            if (node.id.type !== 'Identifier') return;
            // Capitalized names are React components by convention, and
            // react-refresh only registers those. Wrapping one in
            // `Object.assign(...)` hides the declaration from Fast Refresh and
            // downgrades the module to a full reload — not worth a source link.
            if (!/^[a-z_$]/.test(node.id.name)) return;
            tag(init);
          }
        },
      });

      if (!mutated) return null;
      return { code: ms.toString(), map: ms.generateMap({ hires: 'boundary' }) };
    },
  };
}

function buildLineOffsets(code: string): readonly number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  return offsets;
}

function offsetToLineCol(
  lineOffsets: readonly number[],
  offset: number,
): { line: number; col: number } {
  // Binary search for the greatest lineOffset <= offset.
  let lo = 0;
  let hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineOffsets[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - lineOffsets[lo]! };
}

function shouldTransform(id: string, includeDirs: readonly string[]): boolean {
  if (id.includes('node_modules')) return false;
  if (id.includes('?')) return false;
  if (!/\.(t|j)sx?$/.test(id)) return false;
  // Skip test files — irrelevant and adds noise.
  if (/\.(test|spec|stories)\.[tj]sx?$/.test(id)) return false;
  return includeDirs.some((d) => id.startsWith(d));
}
