import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { defineTool, claim, begin } from '../routing';
import type { Tool, ToolPresentation } from '../types';
import type { RenderLayer } from 'core/layers/render';
import type { Op } from 'core/ops/types';
import { applyHitExistingGate } from './hitExistingGate';
import { marqueeDrawCommands, type InsertOverlayStyle } from './marquee';
import type { InsertController } from 'interactions/gestures/insert/insert';
import type { KeyBinding } from 'interactions/actions/useKeybinding';

/** @internal */
type ApplyBatch = (ops: Op[], label: string) => void;

export interface DragInsertToolConfig<TNode extends { id: string }, TPose> {
  id: string;
  cursor: string;
  keybinding?: KeyBinding;
  presentation?: ToolPresentation<undefined>;
  controller: InsertController<TNode, TPose>;
  overlayId: string;
  overlayLabel: string;
  defaultStyle: { fill: string; stroke: string; dash: number[]; lineWidth: number };
  overlayStyle?: InsertOverlayStyle;
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Optional ref to receive the active tool ctx's `applyOps` while a
   *  pointer.onClick or drag.onStart→onEnd is in flight. Cleared on
   *  end/cancel. Wrappers that synthesize an adapter (e.g. `useTextTool`)
   *  pass a ref they also read from in their `useInsert.applyOps` option;
   *  wrappers whose adapter owns dispatch (e.g. `useInsertTool`) omit. */
  applyOpsRef?: MutableRefObject<ApplyBatch | null>;
}

export interface DragInsertToolResult {
  tool: Tool<undefined>;
  applyOpsRef: MutableRefObject<ApplyBatch | null>;
}

export function defineDragInsertTool<TNode extends { id: string }, TPose>(
  config: DragInsertToolConfig<TNode, TPose>,
): DragInsertToolResult {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const internalRef = useRef<ApplyBatch | null>(null);
  const applyOpsRef = config.applyOpsRef ?? internalRef;

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
    const { id, cursor, keybinding, presentation, controller, hitExisting } = config;
    const supportsClick = controller.supportsPointInsert;
    const supportsDrag = controller.supportsCommitInsert;
    return defineTool<undefined>({
      id,
      cursor,
      ...(keybinding ? { keybinding } : {}),
      ...(presentation ? { presentation } : {}),
      initial: {
        overlay: () => overlay,
        ...(supportsClick
          ? {
              click: {
                // Universal route — fires for every target (empty, node,
                // affordance). The hit-existing gate runs as part of the
                // action, matching the imperative tool's "always claim,
                // gate inside" semantics.
                '*': (ctx) => {
                  if (applyHitExistingGate(ctx, hitExisting)) return claim();
                  applyOpsRef.current = ctx.applyOps;
                  controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                  controller.end();
                  applyOpsRef.current = null;
                  return claim();
                },
              },
            }
          : {}),
        ...(supportsDrag
          ? {
              drag: (ctx) => {
                if (applyHitExistingGate(ctx, hitExisting)) return claim();
                applyOpsRef.current = ctx.applyOps;
                controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return begin({
                  scratch: undefined,
                  onMove: (c) => {
                    controller.move(c.worldX, c.worldY, c.modifiers);
                    return claim();
                  },
                  onRelease: () => {
                    controller.end();
                    applyOpsRef.current = null;
                    return claim();
                  },
                  onCancel: () => {
                    controller.cancel();
                    applyOpsRef.current = null;
                  },
                });
              },
            }
          : {}),
      },
    });
  }, [
    config.id,
    config.cursor,
    config.keybinding,
    config.presentation,
    config.controller,
    config.hitExisting,
    overlay,
    applyOpsRef,
  ]);

  return { tool, applyOpsRef };
}
