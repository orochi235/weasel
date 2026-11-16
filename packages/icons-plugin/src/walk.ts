import { visitorKeys, type Program, type VisitorObject } from 'oxc-parser';

type Enter = (node: unknown) => void;

/** The keys of a node of `type` that hold its children, read as `visitorKeys`' own entry. */
export const childKeys = (type: string): readonly string[] => (Object.hasOwn(visitorKeys, type) ? visitorKeys[type] : []);

/** `node[key]` where `node` holds `key` itself. */
export const child = (node: object, key: string): unknown =>
  Object.hasOwn(node, key) ? (node as Record<string, unknown>)[key] : undefined;

/**
 * Calls each of `visitor`'s handlers on every node of its type, parents before children.
 * oxc-parser's own `Visitor` loads its walker through `require()` of an ES module, which
 * vitest's vm pools cannot do on Node 22.
 */
export function walk(program: Program, visitor: VisitorObject): void {
  const handlers = visitor as Record<string, Enter | undefined>;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const type = (value as { type?: unknown }).type;
    if (typeof type !== 'string') return;
    if (Object.hasOwn(handlers, type)) handlers[type]?.(value);
    for (const key of childKeys(type)) visit(child(value, key));
  };
  visit(program);
}
