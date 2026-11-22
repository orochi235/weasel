import type { GlobalsTarget, StoryContext } from '@weasel-js/forge';
import { systemColorScheme, useSystemColorScheme, watchColorScheme, type ColorScheme } from '@weasel-js/react';

type Globals = StoryContext['globals'];
export type Mode = ColorScheme;

/** An explicit `light` or `dark` stands; anything else, `auto` included, follows the OS. */
export const resolveMode = (picked: unknown, system: Mode): Mode =>
  picked === 'light' || picked === 'dark' ? picked : system;

/**
 * An `applyGlobals` that hands `apply` the resolved mode, and applies each target's last globals again when the OS
 * scheme changes. One target per root: the workshop applies to every open story's host through this one function.
 * A root that has left the document is forgotten at the next apply or scheme change. The OS is watched only while a
 * root is followed; `dispose` stops following them all, for a frame config that is about to be replaced.
 */
export function followScheme(
  apply: (globals: Globals, target: GlobalsTarget, mode: Mode) => void,
): ((globals: Globals, target: GlobalsTarget) => void) & { dispose(): void } {
  const last = new Map<HTMLElement, { globals: Globals; target: GlobalsTarget }>();
  let unwatch: (() => void) | null = null;
  const dispose = () => {
    last.clear();
    unwatch?.();
    unwatch = null;
  };
  const run = ({ globals, target }: { globals: Globals; target: GlobalsTarget }) =>
    apply(globals, target, resolveMode(globals.mode, systemColorScheme()));
  const rerun = () => {
    for (const [root, entry] of last) {
      if (root.isConnected) run(entry);
      else last.delete(root);
    }
    if (last.size === 0) dispose();
  };
  const applyGlobals = (globals: Globals, target: GlobalsTarget) => {
    for (const root of last.keys()) if (root !== target.root && !root.isConnected) last.delete(root);
    const entry = { globals, target };
    last.set(target.root, entry);
    unwatch ??= watchColorScheme(rerun);
    run(entry);
  };
  return Object.assign(applyGlobals, { dispose });
}

/** The mode `picked` resolves to, following the OS while it does. */
export function useResolvedMode(picked: unknown): Mode {
  return resolveMode(picked, useSystemColorScheme());
}
