/**
 * Extract `GestureSchema`s for the inspector's gesture catalog: one per member
 * of `@weasel-js/gestures`' `GestureSpec` union, keyed by its `kind`, listing
 * the fields a binding's spec of that kind declares.
 */
import { Node, type Project } from 'ts-morph';
import { resolve } from 'node:path';
import type { GestureSchema } from '../src/dev/traitSchemas.types.ts';
import { srcRef, sourceFileOrThrow, propertiesOfTypeNode, readJsDoc } from './extract.ts';

export const GESTURE_SPEC_FILE = 'packages/gestures/src/ui/spec.ts';
const UNION_NAME = 'GestureSpec';

export function extractGestures(
  project: Project,
  repoRoot: string,
): Record<string, GestureSchema> {
  const sf = sourceFileOrThrow(project, resolve(repoRoot, GESTURE_SPEC_FILE));
  const union = sf.getTypeAliasOrThrow(UNION_NAME).getTypeNode();
  if (!union || !Node.isUnionTypeNode(union)) throw new Error(`${UNION_NAME} is not a union`);

  const out: Record<string, GestureSchema> = {};
  for (const member of union.getTypeNodes()) {
    if (!Node.isTypeReference(member)) continue;
    const iface = member.getTypeName().getSymbol()?.getDeclarations().find(Node.isInterfaceDeclaration);
    const kind = iface?.getProperty('kind')?.getType();
    if (!iface || !kind?.isStringLiteral()) continue;
    const id = String(kind.getLiteralValue());
    const doc = readJsDoc(iface);
    out[id] = {
      id,
      fields: propertiesOfTypeNode(iface).filter((p) => p.name !== 'kind'),
      ...(doc ? { doc } : {}),
      source: srcRef(iface, repoRoot),
    };
  }
  return out;
}
