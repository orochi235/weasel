import { useEffect, useMemo, useState } from 'react';
import { isDev, useLatest } from '@weasel-js/react';
import type { View } from 'core/viewport/view';
import type { DebugConfig } from '../debug/types';
import { parseDebugFlags } from '../debug/parseDebugFlags';
import { installDevtoolsHook } from './hook';
import { createDevtoolsRoot, type DevtoolsRoot, type DevtoolsRootSource } from './root';
import type { DevtoolsOverlays } from './protocol';

/** What a panel lays over a canvas's own `debug` prop. */
export interface DevtoolsOverride {
  overlays: DevtoolsOverlays;
  highlight: readonly string[];
}

/** `debug` as the canvas resolves it, with `override` over it. Absent `debug` reads `?debug=` from the URL. */
export function withOverride<D extends DebugConfig>(
  debug: D | false | undefined,
  override: DevtoolsOverride | null,
): D | DebugConfig | false | undefined {
  if (!override) return debug;
  const base: DebugConfig = debug === undefined
    ? (typeof window === 'undefined' ? null : parseDebugFlags(window.location.search)) ?? {}
    : debug === false ? {} : debug;
  return { ...base, ...override.overlays, ...(override.highlight.length ? { highlight: override.highlight } : {}) };
}

/** A canvas's `debug` prop with the override a connected panel holds. */
export function useDevtoolsOverride<T extends DebugConfig | false | undefined>(debug: T) {
  const [override, setOverride] = useState<DevtoolsOverride | null>(null);
  // An override only adds feature flags, so the canvas's own config type still describes the result.
  const effective = useMemo(() => withOverride(debug, override) as T, [debug, override]);
  return { debug: effective, setOverride };
}

/** The live values a root reads, re-read from the latest render on every call. */
export type DevtoolsRootInputs = Omit<DevtoolsRootSource, 'trace' | 'coords' | 'dimension'> & {
  trace: DevtoolsRootSource['trace'];
  coords: DevtoolsRootSource['coords'];
  /** The view's own change feed: a pan writes the view without a render. */
  subscribeView(listener: (view: View) => void): () => void;
};

function dimensionOf(inputs: DevtoolsRootInputs): '2d' | '3d' {
  const scene = inputs.scene();
  const first = scene?.roots[0];
  const pose = first ? scene?.get(first)?.pose : undefined;
  return typeof (pose as { position?: { z?: unknown } } | undefined)?.position?.z === 'number' ? '3d' : '2d';
}

/**
 * This canvas's root, for the test hook and the devtools hook alike. Registered
 * with the devtools hook in a dev build, which installs it, and in a production
 * build only when the app imported `@weasel-js/core/devtools`.
 */
export function useDevtoolsRoot(
  inputs: DevtoolsRootInputs,
  changes: { selection: readonly string[]; tool: string | null },
): DevtoolsRoot {
  const live = useLatest(inputs);
  const [root] = useState(() => {
    const l = live.current;
    return createDevtoolsRoot({
      label: () => live.current.label(),
      get dimension() { return dimensionOf(live.current); },
      scene: () => live.current.scene(),
      selection: () => live.current.selection(),
      select: (ids) => live.current.select(ids),
      view: () => live.current.view(),
      activeTool: () => live.current.activeTool(),
      tools: () => live.current.tools(),
      setTool: (id) => live.current.setTool(id),
      trace: l.trace,
      coords: l.coords,
      frame: () => live.current.frame(),
      overlays: () => live.current.overlays(),
      setOverride: (o) => live.current.setOverride(o),
    });
  });

  useEffect(() => {
    const hook = typeof window === 'undefined' ? null
      : isDev() ? installDevtoolsHook() : window.__weaselDevtools__ ?? null;
    return hook?.register(root);
  }, [root]);

  const scene = inputs.scene();
  useEffect(() => { root.notify('scene'); }, [root, scene]);
  useEffect(() => { root.notify('selection'); }, [root, changes.selection]);
  useEffect(() => { root.notify('tool'); }, [root, changes.tool]);
  const { subscribeView } = inputs;
  useEffect(() => subscribeView(() => root.notify('view')), [root, subscribeView]);
  return root;
}
