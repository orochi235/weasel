/**
 * Extract `ActionSchema`s from the kit's action barrels: core's default
 * actions and `@weasel-js/editing`'s entry point.
 *
 * For every exported `const …Action`, find the `Action` object literal it is
 * built from — written in place, passed through `defineAction` or a wrapper
 * such as `inPlane`, or returned by a factory like `createResizeAction()` —
 * and capture `id`, `label`, `group`, `shortcut`, `defaultBinding` (raw
 * source text), and a `SourceRef` pointing at the export's declaration.
 */
import {
  Node,
  type Project,
  type ObjectLiteralExpression,
  SyntaxKind,
} from 'ts-morph';
import { resolve } from 'node:path';
import type { ActionSchema } from '../src/dev/traitSchemas.types.ts';
import { srcRef, sourceFileOrThrow } from './extract.ts';

const BINDING_CLIP = 200;
/** How many calls and references to follow from an export to its literal. */
const MAX_DEPTH = 6;

export const ACTION_BARRELS: readonly string[] = [
  'packages/core/src/interactions/actions/defaults/index.ts',
  'packages/editing/src/index.ts',
];
/** The files the barrels re-export actions from. */
export const ACTION_READS: readonly string[] = [
  'packages/core/src/interactions/actions/defaults',
  'packages/editing/src/index.ts',
  'packages/editing/src/actions',
];

export function extractActions(
  project: Project,
  repoRoot: string,
): Record<string, ActionSchema> {
  const out: ActionSchema[] = [];

  for (const rel of ACTION_BARRELS) {
    const barrel = sourceFileOrThrow(project, resolve(repoRoot, rel));
    for (const [exportName, decls] of barrel.getExportedDeclarations()) {
      if (!exportName.endsWith('Action')) continue;
      const decl = decls.find(Node.isVariableDeclaration);
      const initializer = decl?.getInitializer();
      if (!decl || !initializer) continue;

      const obj = actionLiteral(initializer, MAX_DEPTH);
      if (!obj) {
        console.warn(`[trait-schemas] ${exportName}: no Action literal found behind its initializer`);
        continue;
      }

      const id = readStringProp(obj, 'id') ?? exportName;
      const label = readStringProp(obj, 'label');
      const group = readStringProp(obj, 'group');
      const shortcut = readStringProp(obj, 'shortcut');
      const defaultBinding = readRawProp(obj, 'defaultBinding');

      out.push({
        id,
        ...(label !== undefined ? { label } : {}),
        ...(group !== undefined ? { group } : {}),
        ...(shortcut !== undefined ? { shortcut } : {}),
        ...(defaultBinding !== undefined ? { defaultBinding } : {}),
        source: srcRef(decl, repoRoot),
      });
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  const record: Record<string, ActionSchema> = {};
  for (const a of out) record[a.id] = a;
  return record;
}

/** The object literal with an `id` that `node` evaluates to: looked through
 *  `as` / `satisfies` / parentheses, into a call's arguments (`defineAction({…})`,
 *  `inPlane(…)`), into what a called function returns, and to a referenced
 *  const's initializer. Null past `depth` steps or when none is found. */
function actionLiteral(node: Node, depth: number): ObjectLiteralExpression | null {
  if (depth < 0) return null;
  if (Node.isObjectLiteralExpression(node)) return node.getProperty('id') ? node : null;
  if (
    Node.isAsExpression(node) || Node.isSatisfiesExpression(node)
    || Node.isParenthesizedExpression(node) || Node.isTypeAssertion(node)
  ) {
    return actionLiteral(node.getExpression(), depth);
  }
  if (Node.isIdentifier(node)) {
    for (const decl of declarationsOf(node)) {
      const init = Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined;
      const found = init && actionLiteral(init, depth - 1);
      if (found) return found;
    }
    return null;
  }
  if (!Node.isCallExpression(node)) return null;
  for (const arg of node.getArguments()) {
    const found = actionLiteral(arg, depth - 1);
    if (found) return found;
  }
  for (const decl of declarationsOf(node.getExpression())) {
    const fn = Node.isVariableDeclaration(decl) ? decl.getInitializer() : decl;
    if (!fn || !(Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn))) continue;
    const body = fn.getBody();
    if (body && !Node.isBlock(body)) {
      const found = actionLiteral(body, depth - 1);
      if (found) return found;
      continue;
    }
    for (const ret of fn.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
      const expr = ret.getExpression();
      const found = expr && actionLiteral(expr, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function declarationsOf(node: Node): readonly Node[] {
  const symbol = node.getSymbol();
  const target = symbol?.getAliasedSymbol() ?? symbol;
  return target?.getDeclarations() ?? [];
}

/** Read a property whose initializer is a string literal. Returns the
 *  unquoted value, or undefined if missing / not a string literal. */
function readStringProp(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) return undefined;
  const init = (prop as unknown as { getInitializer: () => Node | undefined }).getInitializer();
  if (!init) return undefined;
  if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) return init.getLiteralValue();
  // A named constant (`id: TOOL_ACTIVATE_ID`) reads through its literal type.
  const type = init.getType();
  return type.isStringLiteral() ? String(type.getLiteralValue()) : undefined;
}

/** Read a property's raw source text, clipped. Used for `defaultBinding`
 *  which may be a literal, array, or call expression. */
function readRawProp(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) return undefined;
  const init = (prop as unknown as { getInitializer: () => Node | undefined }).getInitializer();
  if (!init) return undefined;
  const text = init.getText();
  return text.length > BINDING_CLIP ? text.slice(0, BINDING_CLIP) + '…' : text;
}
