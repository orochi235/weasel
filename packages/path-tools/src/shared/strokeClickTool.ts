import { useMemo } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { Action, GestureBinding, ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type RenderLayer, type Tool } from '@weasel-js/core';

/** Options for a tool that acts on the stroke under a click. */
export interface StrokeClickToolOptions {
  /** Override the default keybinding. Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** How far from a stroke a click may land and still reach it, in screen
   *  pixels. Read on every click. Default 6. */
  radiusPx?: number | (() => number);
}

/** What the tool is: its id, label, icon, hook name, the action its click
 *  hands the press to, and its default key. */
export interface StrokeClickToolSpec {
  id: string;
  label: string;
  icon: IconRef;
  hookName: string;
  actionId: string;
  keybinding: ToolKeybinding;
}

/** The tool's own extras: actions it registers, bindings beside its click,
 *  an overlay, and what to drop when it is put down. */
export interface StrokeClickExtras {
  actions?: Action[];
  bindings?: GestureBinding[];
  overlay?: RenderLayer<unknown>;
  onDeactivate?: () => void;
}

/** A declarative tool whose click binding, and any extra binding, hands the
 *  press and `radiusPx` to `spec.actionId`. */
export function useStrokeClickTool(
  spec: StrokeClickToolSpec,
  options: StrokeClickToolOptions,
  extras: StrokeClickExtras = {},
): Tool {
  const { keybinding = spec.keybinding, radiusPx } = options;
  const { id, label, icon, hookName, actionId } = spec;
  return useMemo(() => {
    const params = radiusPx !== undefined
      ? { params: () => ({ radiusPx: typeof radiusPx === 'function' ? radiusPx() : radiusPx }) }
      : {};
    return defineTool({
      id,
      ...(keybinding ? { keybinding } : {}),
      capabilities: ['creates-shapes'],
      hookName,
      cursor: 'crosshair',
      presentation: { label, group: 'path', icon },
      ...(extras.actions ? { actions: extras.actions } : {}),
      ...(extras.overlay ? { overlay: extras.overlay } : {}),
      ...(extras.onDeactivate ? { onDeactivate: extras.onDeactivate } : {}),
      bindings: [
        { spec: { kind: 'click' }, actionId, opts: { id: `${id}.click`, ...params } },
        ...(extras.bindings ?? []).map((b) => ({ ...b, opts: { ...b.opts, ...params } })),
      ],
    });
  }, [id, label, icon, hookName, actionId, keybinding, radiusPx, extras.actions, extras.bindings, extras.overlay, extras.onDeactivate]);
}
