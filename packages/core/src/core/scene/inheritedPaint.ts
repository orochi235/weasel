import {
  INHERIT, resolveFill, resolveStroke,
  type Fill, type Inherit, type PaintedFill, type PaintedStroke, type Stroke,
} from '@weasel-js/paint';

/**
 * What a node's `'inherit'` fill and stroke resolve to: its nearest enclosing
 * container's, `null` for none. A field the node does not inherit is `null`
 * here whatever its containers hold.
 */
export interface InheritedPaint {
  readonly fill: PaintedFill | null;
  readonly stroke: PaintedStroke | null;
}

type PaintData = { fill?: Fill | Inherit | null; stroke?: Stroke | Inherit | null } | null | undefined;

/** Whether `node`'s fill or stroke is {@link INHERIT}, so painting it needs
 *  its containers' paint. */
export function inheritsPaint(node: { data?: unknown }): boolean {
  const d = node.data as PaintData;
  return d?.fill === INHERIT || d?.stroke === INHERIT;
}

const LAST = new WeakMap<object, InheritedPaint>();

/**
 * {@link InheritedPaint} for `node`, given its ancestors innermost first. Any
 * ancestor is a source, mark or group; one whose own field is `'inherit'`
 * passes the question on to the next, and running out of ancestors is none.
 *
 * Hands back the object it returned last time for `node` while both values
 * are the same references, so a memo can key on it.
 */
export function inheritedPaintOf(
  node: { data?: unknown },
  ancestors: Iterable<{ kind?: string; data?: unknown }>,
): InheritedPaint {
  const d = node.data as PaintData;
  let wantFill = d?.fill === INHERIT;
  let wantStroke = d?.stroke === INHERIT;
  let fill: PaintedFill | null = null;
  let stroke: PaintedStroke | null = null;
  for (const a of ancestors) {
    if (!wantFill && !wantStroke) break;
    const ad = a.data as PaintData;
    if (wantFill && ad?.fill !== INHERIT) {
      fill = resolveFill(ad?.fill);
      wantFill = false;
    }
    if (wantStroke && ad?.stroke !== INHERIT) {
      stroke = resolveStroke(ad?.stroke);
      wantStroke = false;
    }
  }
  const last = LAST.get(node);
  if (last !== undefined && last.fill === fill && last.stroke === stroke) return last;
  const next: InheritedPaint = { fill, stroke };
  LAST.set(node, next);
  return next;
}

/** What `node`'s `'inherit'` fields take from its containers in `scene`, or
 *  `undefined` for a node that inherits nothing. */
export function inheritedPaintIn<TNode extends { data?: unknown; parent?: string | null }>(
  scene: { get(id: never): TNode | undefined },
  node: TNode,
): InheritedPaint | undefined {
  if (!inheritsPaint(node)) return undefined;
  return inheritedPaintOf(node, sceneAncestors((id: never) => scene.get(id), node));
}

/**
 * The descendants of `id` whose `key` is `'inherit'` all the way up to it:
 * those that paint whatever `id`'s own `key` holds, so a preview of that paint
 * reaches them too. Parents before children.
 */
export function paintInheritors(
  scene: { get(id: never): { data?: unknown } | undefined; childrenOf(id: never): readonly string[] },
  id: string,
  key: 'fill' | 'stroke',
): string[] {
  const out: string[] = [];
  const walk = (parent: string): void => {
    for (const child of scene.childrenOf(parent as never)) {
      if ((scene.get(child as never)?.data as PaintData)?.[key] !== INHERIT) continue;
      out.push(child);
      walk(child);
    }
  };
  walk(id);
  return out;
}

/** `node`'s ancestors in `scene`, innermost first, read lazily off `parent`. */
export function* sceneAncestors<TNode extends { parent?: string | null }>(
  get: (id: never) => TNode | undefined,
  node: TNode,
): Generator<TNode> {
  const seen = new Set<string>();
  let id = node.parent ?? null;
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const p = get(id as never);
    if (p === undefined) return;
    yield p;
    id = p.parent ?? null;
  }
}

/** The fields {@link withInheritedPaint} resolves. */
type ResolvedPaintFields<T> = Omit<T, 'fill' | 'stroke'> & {
  fill?: Exclude<T extends { fill?: infer F } ? F : never, Inherit>;
  stroke?: Exclude<T extends { stroke?: infer S } ? S : never, Inherit>;
};

/**
 * `data` with an `'inherit'` fill or stroke replaced by what `inherited` says
 * it resolves to, for a reader that wants the paint a node shows rather than
 * the one it declares. Hands `data` back as is when nothing inherits.
 */
export function withInheritedPaint<T extends { fill?: unknown; stroke?: unknown }>(
  data: T,
  inherited: InheritedPaint | undefined,
): ResolvedPaintFields<T> {
  if (data.fill !== INHERIT && data.stroke !== INHERIT) return data as ResolvedPaintFields<T>;
  return {
    ...data,
    ...(data.fill === INHERIT ? { fill: inherited?.fill ?? null } : {}),
    ...(data.stroke === INHERIT ? { stroke: inherited?.stroke ?? null } : {}),
  } as ResolvedPaintFields<T>;
}
