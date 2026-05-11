import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from 'core/layers/render';
import type { Op } from 'core/ops/types';
import { applyHitExistingGate } from './hitExistingGate';
import { marqueeDrawCommands, type InsertOverlayStyle } from './marquee';
import type { InsertController } from 'interactions/gestures/insert/insert';

type ApplyBatch = (ops: Op[], label: string) => void;

export interface DragInsertToolConfig<TNode extends { id: string }, TPose> {
  id: string;
  cursor: string;
  keybinding?: string;
  controller: InsertController<TNode, TPose>;
  overlayId: string;
  overlayLabel: string;
  defaultStyle: { fill: string; stroke: string; dash: number[]; lineWidth: number };
  overlayStyle?: InsertOverlayStyle;
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Optional ref to receive the active tool ctx's `applyBatch` while a
   *  pointer.onClick or drag.onStart→onEnd is in flight. Cleared on
   *  end/cancel. Wrappers that synthesize an adapter (e.g. `useTextTool`)
   *  pass a ref they also read from in their `useInsert.applyBatch` option;
   *  wrappers whose adapter owns dispatch (e.g. `useInsertTool`) omit. */
  applyBatchRef?: MutableRefObject<ApplyBatch | null>;
}

export interface DragInsertToolResult {
  tool: Tool<undefined>;
  applyBatchRef: MutableRefObject<ApplyBatch | null>;
}

export function defineDragInsertTool<TNode extends { id: string }, TPose>(
  config: DragInsertToolConfig<TNode, TPose>,
): DragInsertToolResult {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const internalRef = useRef<ApplyBatch | null>(null);
  const applyBatchRef = config.applyBatchRef ?? internalRef;

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: config.overlayId,
      label: config.overlayLabel,
      space: 'screen',
      draw: (_data, view) => {
        const cfg = cfgRef.current;
        const ov = cfg.controller.overlay;
        if (!ov) return [];
        return marqueeDrawCommands(view, ov.bounds, cfg.overlayStyle, cfg.defaultStyle);
      },
    }),
    [config.overlayId, config.overlayLabel],
  );

  const tool = useMemo<Tool<undefined>>(() => {
    const { id, cursor, keybinding, controller, hitExisting } = config;
    const supportsClick = controller.supportsPointInsert;
    const supportsDrag = controller.supportsCommitInsert;
    return defineTool({
      id,
      cursor,
      ...(keybinding ? { keybinding } : {}),
      overlay,
      ...(supportsClick
        ? {
            pointer: {
              onClick: (_e, ctx) => {
                if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                applyBatchRef.current = ctx.applyBatch;
                controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                controller.end();
                applyBatchRef.current = null;
                return 'claim';
              },
            },
          }
        : {}),
      ...(supportsDrag
        ? {
            drag: {
              onStart: (_e, ctx) => {
                if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                applyBatchRef.current = ctx.applyBatch;
                controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              },
              onMove: (_e, ctx) => {
                controller.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              },
              onEnd: () => {
                controller.end();
                applyBatchRef.current = null;
                return 'claim';
              },
              onCancel: () => {
                controller.cancel();
                applyBatchRef.current = null;
              },
            },
          }
        : {}),
    });
  }, [
    config.id,
    config.cursor,
    config.keybinding,
    config.controller,
    config.hitExisting,
    overlay,
    applyBatchRef,
  ]);

  return { tool, applyBatchRef };
}
