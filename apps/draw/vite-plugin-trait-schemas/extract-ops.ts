/**
 * Produces an `OpFactorySchema` per `create*Op` function the kit's ops barrel
 * exports, followed through its re-exports. The args object's type is resolved
 * through the checker, so an args type declared in another file is found too.
 * Args types that can't be resolved emit an empty `params` list rather than
 * throwing.
 */
import {
  Node,
  SyntaxKind,
  type Project,
  type FunctionDeclaration,
} from 'ts-morph';
import { resolve } from 'node:path';
import type { OpFactorySchema, PropertyDescriptor } from '../src/dev/traitSchemas.types.ts';
import { srcRef, readJsDoc, sourceFileOrThrow, propertiesOfTypeNode } from './extract.ts';

/** The ops barrel, and the directory holding every file it re-exports from. */
export const OPS_BARREL = 'packages/core/src/core/ops/index.ts';
export const OPS_READS: readonly string[] = ['packages/core/src/core/ops'];

export function extractOps(project: Project, repoRoot: string): Record<string, OpFactorySchema> {
  const barrel = sourceFileOrThrow(project, resolve(repoRoot, OPS_BARREL));
  const out: Record<string, OpFactorySchema> = {};

  for (const [name, decls] of barrel.getExportedDeclarations()) {
    if (!name.startsWith('create') || !name.endsWith('Op')) continue;
    const fn = decls.find(Node.isFunctionDeclaration);
    if (!fn) continue;
    out[name] = {
      id: name,
      params: paramsOf(fn),
      returnType: returnTypeOf(fn),
      jsdoc: readJsDoc(fn),
      source: srcRef(fn, repoRoot),
    };
  }

  return out;
}

function returnTypeOf(fn: FunctionDeclaration): string {
  const node = fn.getReturnTypeNode();
  if (node) return node.getText();
  const fallback = fn.getReturnType().getText(fn);
  return fallback.length <= 120 ? fallback : `${fallback.slice(0, 117)}...`;
}

function paramsOf(fn: FunctionDeclaration): readonly PropertyDescriptor[] {
  const typeNode = fn.getParameters()[0]?.getTypeNode();
  if (!typeNode || !Node.isTypeReference(typeNode)) return [];
  // `InsertArgs<TNode>`: follow the name to its declaration, through an import.
  const symbol = typeNode.getTypeName().getSymbol();
  const target = symbol?.getAliasedSymbol() ?? symbol;
  for (const decl of target?.getDeclarations() ?? []) {
    if (Node.isInterfaceDeclaration(decl)) return propertiesOfTypeNode(decl);
    if (Node.isTypeAliasDeclaration(decl)) {
      const aliased = decl.getTypeNode();
      if (!aliased || !Node.isTypeLiteral(aliased)) return [];
      return aliased.getChildrenOfKind(SyntaxKind.PropertySignature).map((m) => propertiesOfTypeNode(m)[0]!);
    }
  }
  return [];
}
