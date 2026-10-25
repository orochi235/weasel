import { useLatest } from '@weasel-js/core';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { createOverrides, type Overrides } from '../frame/cssVars';
import type { FrameSetup } from '../frame/FrameController';
import { createGlobalsTarget } from '../frame/globalsTarget';
import type { Globals } from '../protocol/messages';
import type { CssOverrides } from './cssVars/overrides';

/** A selector matching only the element carrying `id`. */
export const scopeOf = (id: string) => `[data-fg-host="${id}"]`;

/** Applies `globals` to the host carrying `hostId` through `setup`; the returned function removes what it styled. */
export function applyGlobalsTo(host: HTMLElement, hostId: string, globals: Globals, setup: FrameSetup): () => void {
  const target = createGlobalsTarget(host, scopeOf(hostId));
  setup.applyGlobals?.(globals, target);
  return () => target.dispose();
}

/**
 * The conditions a host element lives under: its globals target, and its CSS variable overrides rule with the
 * trial's persisted overrides put back and kept in step. Everything is scoped to `hostId`; no registry connection.
 * The returned ref holds the overrides while `host` is set.
 */
export function useHostConditions(
  host: HTMLElement | null,
  opts: { hostId: string; globals: Globals; overrides: CssOverrides; setup: FrameSetup },
): RefObject<Overrides | null> {
  const { hostId, globals, overrides: persisted, setup } = opts;
  const latest = useLatest({ setup });
  const overridesRef = useRef<Overrides | null>(null);

  useLayoutEffect(() => {
    if (!host) return;
    const scope = scopeOf(hostId);
    const { cssVarsScope } = latest.current.setup;
    overridesRef.current = createOverrides(
      host.ownerDocument,
      cssVarsScope ? `${scope}, ${scope} :is(${cssVarsScope})` : scope,
    );
    return () => {
      overridesRef.current?.dispose();
      overridesRef.current = null;
    };
  }, [host, hostId, latest]);

  const applied = useRef<Record<string, string>>({});
  useLayoutEffect(() => {
    const overrides = overridesRef.current;
    if (!overrides) return;
    for (const name of Object.keys(applied.current)) if (!(name in persisted)) overrides.set(name, null);
    for (const [name, value] of Object.entries(persisted)) overrides.set(name, value);
    applied.current = { ...persisted };
  }, [host, hostId, persisted]);

  useLayoutEffect(
    () => (host ? applyGlobalsTo(host, hostId, globals, latest.current.setup) : undefined),
    [host, hostId, globals, latest],
  );

  return overridesRef;
}
