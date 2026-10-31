import { useEffect } from 'react';
import { defaultToolOf, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';

/** What {@link useModeDefaultTool} reads and writes of the tools. */
export interface ModeDefaultToolTarget {
  active: string | null;
  setActive(id: string | null): void;
  has(id: string): boolean;
}

/**
 * Follows `modes` with the active tool: entering a mode that names a
 * `defaultTool` activates it, and leaving that mode restores the tool active
 * at entry. A mode already active when this mounts counts as entered then.
 */
export function useModeDefaultTool(modes: ModeRegistry | undefined, tools: ModeDefaultToolTarget): void {
  const toolsRef = useLatest(tools);
  useEffect(() => {
    if (!modes) return;
    let mode = modes.current();
    // The tool to restore on leaving `mode`; undefined when entering it activated none.
    let restore: string | null | undefined;
    const enter = (next: ModeDefinition, from: string | null): void => {
      const target = defaultToolOf(next, toolsRef.current.has);
      if (target === null) {
        if (from !== toolsRef.current.active) toolsRef.current.setActive(from);
        return;
      }
      restore = from;
      if (target !== toolsRef.current.active) toolsRef.current.setActive(target);
    };
    enter(mode, toolsRef.current.active);
    return modes.subscribe(() => {
      const next = modes.current();
      if (next === mode) return;
      mode = next;
      const prior = restore;
      restore = undefined;
      const from = prior !== undefined && (prior === null || toolsRef.current.has(prior)) ? prior : toolsRef.current.active;
      enter(next, from);
    });
  }, [modes, toolsRef]);
}
