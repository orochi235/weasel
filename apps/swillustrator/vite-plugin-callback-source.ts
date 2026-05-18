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

      let ast: Node;
      try {
        ast = parseAst(code, { sourceType: 'module' }) as unknown as Node;
      } catch {
        return null;
      }

      const ms = new MagicString(code);
      let mutated = false;

      walk(ast, {
        enter(node) {
          if (node.type !== 'Property') return;
          if (node.computed || node.shorthand) return;
          const v = node.value;
          if (v.type !== 'FunctionExpression' && v.type !== 'ArrowFunctionExpression') return;
          // Skip getters/setters/methods — they aren't plain function-valued
          // properties.
          if (node.kind !== 'init') return;
          if ((node as { method?: boolean }).method) return;

          const range = (v as unknown as { start?: number; end?: number });
          const loc = (v as unknown as { loc?: { start: { line: number; column: number } } }).loc;
          if (range.start == null || range.end == null || !loc) return;

          const meta = JSON.stringify({
            file: id,
            line: loc.start.line,
            col: loc.start.column,
          });
          ms.appendLeft(range.start, '/*#__PURE__*/Object.assign(');
          ms.appendRight(range.end, `,{__source:${meta}})`);
          mutated = true;
        },
      });

      if (!mutated) return null;
      return { code: ms.toString(), map: ms.generateMap({ hires: 'boundary' }) };
    },
  };
}

function shouldTransform(id: string, includeDirs: readonly string[]): boolean {
  if (id.includes('node_modules')) return false;
  if (id.includes('?')) return false;
  if (!/\.(t|j)sx?$/.test(id)) return false;
  // Skip test files — irrelevant and adds noise.
  if (/\.(test|spec|stories)\.[tj]sx?$/.test(id)) return false;
  return includeDirs.some((d) => id.startsWith(d));
}
