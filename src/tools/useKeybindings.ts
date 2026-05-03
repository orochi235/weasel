// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../interactions/actions/useKeybinding';
import type { ToolsApi } from './useTools';
import type { ModifierTrigger } from './types';

export interface UseKeybindingsOptions {
  /** Override map: physical key → tool id. Wins over the tool's declared
   *  keybinding. Pass `null` as the value to unbind a key entirely. */
  overrides?: Record<string, string | null>;
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
}

const MODIFIER_KEY_MAP: Record<string, ModifierTrigger> = {
  ' ': 'space',
  Alt: 'alt',
  Control: 'ctrl',
  Meta: 'meta',
  Shift: 'shift',
};

export function useKeybindings(
  tools: ToolsApi,
  options: UseKeybindingsOptions = {},
): void {
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (optionsRef.current.disable) return;

    function resolveSwitch(key: string): string | null {
      const o = optionsRef.current.overrides;
      if (o && key in o) return o[key]; // explicit override (may be null = unbind)
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].keybinding && reg[id].keybinding!.toLowerCase() === key.toLowerCase()) {
          return id;
        }
      }
      return null;
    }

    function resolveModifierEngage(key: string): string | null {
      const trigger = MODIFIER_KEY_MAP[key];
      if (!trigger) return null;
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].modifier === trigger) return id;
      }
      return null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Modifier engagement first — modifier keys (space, alt, etc.)
      // never double as switch keybindings.
      const modifierTool = resolveModifierEngage(e.key);
      if (modifierTool) {
        toolsRef.current.engageModifier(modifierTool);
        return;
      }

      const switchTo = resolveSwitch(e.key);
      if (switchTo) {
        e.preventDefault();
        toolsRef.current.setActive(switchTo);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const modifierTool = resolveModifierEngage(e.key);
      if (modifierTool && toolsRef.current.modifierEngaged === modifierTool) {
        toolsRef.current.disengageModifier();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
