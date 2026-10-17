const ANNOTATED = /\/\*\s*@icon\s*\*\/\s*(['"])([^'"]+)\1/g;

/** Every qualified ref the module names through an `@icon` annotation. */
export function collectIconRefs(code: string): string[] {
  return [...code.matchAll(ANNOTATED)].map((m) => m[2]!);
}
