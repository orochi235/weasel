/**
 * Extract `ActionSchema`s from the kit's default-actions barrel.
 *
 * The barrel `packages/core/src/interactions/actions/defaults/index.ts` re-exports each
 * action descriptor. For every named export whose declaration is an
 * `Action`-shaped object literal, capture `id`, `label`, `group`,
 * `shortcut`, `defaultBinding` (raw source text), and a `SourceRef`
 * pointing at the per-file declaration site.
 */
import {
  type Project,
  type Node,
  type ObjectLiteralExpression,
  SyntaxKind,
  VariableDeclaration,
} from 'ts-morph';
import { resolve } from 'node:path';
import type { ActionSchema } from '../src/dev/traitSchemas.types';
import { srcRef, sourceFileOrThrow } from './extract';

const BINDING_CLIP = 200;

export function extractActions(
  project: Project,
  repoRoot: string,
): Record<string, ActionSchema> {
  const barrel = sourceFileOrThrow(
    project,
    resolve(repoRoot, 'packages/core/src/interactions/actions/defaults/index.ts'),
  );

  const out: ActionSchema[] = [];

  for (const [exportName, decls] of barrel.getExportedDeclarations()) {
    for (const decl of decls) {
      if (!(decl instanceof VariableDeclaration)) continue;
      const initializer = decl.getInitializer();
      if (!initializer) continue;

      // The Action shape may be wrapped in a satisfies / as expression;
      // unwrap to the underlying object literal if possible.
      const obj = unwrapObjectLiteral(initializer);
      if (!obj) continue;

      const id = readStringProp(obj, 'id') ?? exportName;
      const label = readStringProp(obj, 'label');
      const group = readStringProp(obj, 'group');
      const shortcut = readStringProp(obj, 'shortcut');
      const defaultBinding = readRawProp(obj, 'defaultBinding');

      const schema: ActionSchema = {
        id,
        ...(label !== undefined ? { label } : {}),
        ...(group !== undefined ? { group } : {}),
        ...(shortcut !== undefined ? { shortcut } : {}),
        ...(defaultBinding !== undefined ? { defaultBinding } : {}),
        source: srcRef(decl, repoRoot),
      };
      out.push(schema);
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  const record: Record<string, ActionSchema> = {};
  for (const a of out) record[a.id] = a;
  return record;
}

/** If the node is (directly or via `as`/`satisfies`) an object literal,
 *  return it. Otherwise null. */
function unwrapObjectLiteral(node: Node): ObjectLiteralExpression | null {
  let current: Node | undefined = node;
  // Walk through `as` / `satisfies` / parenthesized wrappers.
  while (current) {
    const kind = current.getKind();
    if (kind === SyntaxKind.ObjectLiteralExpression) {
      return current as ObjectLiteralExpression;
    }
    if (
      kind === SyntaxKind.AsExpression
      || kind === SyntaxKind.SatisfiesExpression
      || kind === SyntaxKind.ParenthesizedExpression
      || kind === SyntaxKind.TypeAssertionExpression
    ) {
      const inner: Node | undefined = (current as unknown as { getExpression?: () => Node | undefined }).getExpression?.();
      if (!inner) return null;
      current = inner;
      continue;
    }
    return null;
  }
  return null;
}

/** Read a property whose initializer is a string literal. Returns the
 *  unquoted value, or undefined if missing / not a string literal. */
function readStringProp(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) return undefined;
  const init = (prop as unknown as { getInitializer: () => Node | undefined }).getInitializer();
  if (!init) return undefined;
  if (init.getKind() === SyntaxKind.StringLiteral
      || init.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return (init as unknown as { getLiteralValue: () => string }).getLiteralValue();
  }
  return undefined;
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
