/**
 * Op-factory extractor.
 *
 * Reads the kit's `src/core/ops/*.ts` modules and produces an `OpFactorySchema`
 * per exported `create*Op` function. The args object's type is resolved against
 * the same source file (interface or type alias) and its property signatures
 * become `PropertyDescriptor[]`.
 *
 * Missing files are skipped silently so a kit rename doesn't crash the
 * inspector. Args types that can't be resolved emit an empty `params` list
 * rather than throwing.
 */
import {
  SyntaxKind,
  Node,
  type Project,
  type FunctionDeclaration,
  type InterfaceDeclaration,
  type SourceFile,
  type TypeAliasDeclaration,
} from 'ts-morph';
import { resolve } from 'node:path';
import type { OpFactorySchema, PropertyDescriptor } from '../src/dev/traitSchemas.types';
import { srcRef, readJsDoc, sourceFileOrThrow } from './extract';

const SOURCES: readonly string[] = [
  'packages/core/src/core/ops/create.ts',
  'packages/core/src/core/ops/delete.ts',
  'packages/core/src/core/ops/transform.ts',
  'packages/core/src/core/ops/reparent.ts',
  'packages/core/src/core/ops/select.ts',
  'packages/core/src/core/ops/setText.ts',
  'packages/core/src/core/ops/setPath.ts',
];

export function extractOps(project: Project, repoRoot: string): Record<string, OpFactorySchema> {
  const out: Record<string, OpFactorySchema> = {};

  for (const rel of SOURCES) {
    const abs = resolve(repoRoot, rel);
    let sf: SourceFile;
    try {
      sf = sourceFileOrThrow(project, abs);
    } catch {
      continue; // kit may rename — skip silently
    }

    for (const fn of sf.getFunctions()) {
      if (!fn.isExported()) continue;
      const name = fn.getName();
      if (!name || !name.startsWith('create') || !name.endsWith('Op')) continue;

      out[name] = {
        id: name,
        params: paramsOf(fn, sf),
        returnType: returnTypeOf(fn),
        jsdoc: readJsDoc(fn),
        source: srcRef(fn, repoRoot),
      };
    }
  }

  return out;
}

function returnTypeOf(fn: FunctionDeclaration): string {
  const node = fn.getReturnTypeNode();
  if (node) return node.getText();
  const fallback = fn.getReturnType().getText(fn);
  return fallback.length <= 120 ? fallback : `${fallback.slice(0, 117)}...`;
}

function paramsOf(fn: FunctionDeclaration, sf: SourceFile): readonly PropertyDescriptor[] {
  const first = fn.getParameters()[0];
  if (!first) return [];
  const typeNode = first.getTypeNode();
  if (!typeNode) return [];

  // Expect a TypeReference like `InsertArgs<TNode>`; grab the identifier.
  const refName = typeReferenceName(typeNode);
  if (!refName) return [];

  const decl = sf.getInterface(refName) ?? sf.getTypeAlias(refName);
  if (!decl) return [];

  return propertiesFromDecl(decl);
}

function typeReferenceName(typeNode: Node): string | null {
  if (typeNode.getKind() !== SyntaxKind.TypeReference) return null;
  const ident = typeNode.getFirstChildByKind(SyntaxKind.Identifier);
  return ident ? ident.getText() : null;
}

function propertiesFromDecl(decl: InterfaceDeclaration | TypeAliasDeclaration): readonly PropertyDescriptor[] {
  if (decl.getKind() === SyntaxKind.InterfaceDeclaration) {
    return (decl as InterfaceDeclaration).getProperties().map(propertyToDescriptor);
  }
  // Type alias: peel to its TypeLiteral if present.
  const aliasTypeNode = (decl as TypeAliasDeclaration).getTypeNode();
  if (!aliasTypeNode || aliasTypeNode.getKind() !== SyntaxKind.TypeLiteral) return [];
  const out: PropertyDescriptor[] = [];
  for (const member of aliasTypeNode.getChildrenOfKind(SyntaxKind.PropertySignature)) {
    out.push(propertyToDescriptor(member));
  }
  return out;
}

function propertyToDescriptor(member: Node): PropertyDescriptor {
  const ps = member as unknown as {
    getName: () => string;
    hasQuestionToken: () => boolean;
    getTypeNode: () => Node | undefined;
  };
  const typeNode = ps.getTypeNode();
  const doc = readJsDoc(member);
  return {
    name: ps.getName(),
    type: typeNode ? typeNode.getText() : 'unknown',
    optional: ps.hasQuestionToken(),
    ...(doc ? { doc } : {}),
  };
}
