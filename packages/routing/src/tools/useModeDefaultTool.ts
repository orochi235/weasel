import { useEffect, useRef } from 'react';
import { defaultToolOf, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';

/** What {@link useModeDefaultTool} reads and writes of the tools. */
export interface ModeDefaultToolTarget {
  active: string | null;
  /** The tool the canvas starts on, which `active` may not show yet on the render that mounts it. */
  initial: string | null;
  setActive(id: string | null): void;
  has(id: string): boolean;
}

/** The mode last entered, and the tool to restore on leaving it: undefined when entering it activated none. */
interface Entered {
  mode: ModeDefinition;
  restore: string | null | undefined;
}

/**
 * Follows `modes` with the active tool: entering a mode that names a
 * `defaultTool` activates it, and leaving that mode restores the tool active
 * at entry. A mode already active when this mounts counts as entered then.
 */
export function useModeDefaultTool(modes: ModeRegistry | undefined, tools: ModeDefaultToolTarget): void {
  const toolsRef = useLatest(tools);
  // Outlives the effect, so a re-run (StrictMode's, or a new `tools`) does not enter the same mode again.
  const entered = useRef<Entered | null>(null);
  useEffect(() => {
    if (!modes) return;
    const enter = (next: ModeDefinition, from: string | null): void => {
      const target = defaultToolOf(next, toolsRef.current.has);
      entered.current = { mode: next, restore: target === null ? undefined : from };
      const want = target ?? from;
      if (want !== toolsRef.current.active) toolsRef.current.setActive(want);
    };
    const follow = (): void => {
      const next = modes.current();
      const prior = entered.current;
      if (prior?.mode === next) return;
      const restore = prior?.restore;
      const back = restore !== undefined && (restore === null || toolsRef.current.has(restore));
      enter(next, back ? restore : toolsRef.current.active);
    };
    if (entered.current === null) enter(modes.current(), toolsRef.current.active ?? toolsRef.current.initial);
    follow();
    return modes.subscribe(follow);
  }, [modes, toolsRef]);
}
