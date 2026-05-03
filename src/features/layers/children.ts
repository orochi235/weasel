/**
 * Z-ordered child renderer — replaces the manual `for (id of getChildren()) ...`
 * pattern with a `RenderLayer` factory that consumes an `OrderedAdapter`.
 *
 * Children are drawn in z-order (forward iteration: index 0 = bottom). The
 * caller supplies a `drawChild` callback that knows how to render one object;
 * this layer is the boilerplate-free way to plug a scene graph's z-order into
 * the layer composition system.
 *
 * If the adapter doesn't implement `getChildren` (it's optional on
 * `OrderedAdapter`), the layer is a silent no-op — adopt z-order incrementally
 * without breaking existing layers.
 */

import type { RenderLayer } from './render';
import type { OrderedAdapter } from '../../core/adapters/types';

export interface CreateChildrenLayerOpts<TData> {
  /** Layer id for the visibility/order map. Default `'children'`. */
  id?: string;
  /** Human-readable label. Default `'Children'`. */
  label?: string;
  /** Source of `getChildren`. Only the read side is used. */
  adapter: Pick<OrderedAdapter, 'getChildren'>;
  /** Parent id (null = root). Function form lets the layer follow a moving
   *  selection or focus. Default `null`. */
  parentId?: string | null | (() => string | null);
  /** Draw one child. Called once per id in z-order (bottom → top). */
  drawChild(ctx: CanvasRenderingContext2D, id: string, data: TData): void;
  /** Forwarded to the produced `RenderLayer`. */
  defaultVisible?: boolean;
  /** Forwarded to the produced `RenderLayer`. */
  alwaysOn?: boolean;
}

export function createChildrenLayer<TData = unknown>(
  opts: CreateChildrenLayerOpts<TData>,
): RenderLayer<TData> {
  return {
    id: opts.id ?? 'children',
    label: opts.label ?? 'Children',
    defaultVisible: opts.defaultVisible,
    alwaysOn: opts.alwaysOn,
    draw: (ctx, data) => {
      const getChildren = opts.adapter.getChildren;
      if (!getChildren) return;
      const parent =
        typeof opts.parentId === 'function'
          ? opts.parentId()
          : opts.parentId ?? null;
      const ids = getChildren(parent);
      for (const id of ids) {
        opts.drawChild(ctx, id, data);
      }
    },
  };
}
