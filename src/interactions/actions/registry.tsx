/**
 * @experimental
 * Actions Registry — owns one `keydown` listener per scope and dispatches to
 * registered `Action` descriptors. Spec: docs/superpowers/specs/2026-05-09-actions-registry-design.md
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { isEditableTarget } from './useKeybinding';
import type { KeyBinding } from './useKeybinding';

export type { KeyBinding } from './useKeybinding';

/**
 * @experimental
 * Single registered action. v1: one binding per action.
 */
export interface Action {
  id: string;
  label: string;
  defaultBinding?: KeyBinding;
  run: () => void;
}

/**
 * @experimental
 * Partial override or full descriptor passed via `<SceneCanvas actions={...}>`.
 * `null` disables a default at this id.
 */
export type ActionEntry = null | Partial<Action> | Action;

/**
 * @experimental
 * Shape of the `actions` prop on `<SceneCanvas>`. `null` disables all defaults.
 */
export type ActionsProp = null | Record<string, ActionEntry>;

/**
 * @experimental
 * Imperative API exposed by `useActionsRegistry()`.
 */
export interface ActionsRegistry {
  register(action: Action): () => void;
  unregister(id: string): void;
  list(): readonly Action[];
  trigger(id: string): boolean;
}

const ActionsContext = createContext<ActionsRegistry | null>(null);

function keyMatches(eventKey: string, spec: string | readonly string[]): boolean {
  const want = typeof spec === 'string' ? [spec] : spec;
  const ek = eventKey.toLowerCase();
  return want.some((k) => k.toLowerCase() === ek);
}

function bindingMatches(b: KeyBinding, e: KeyboardEvent): boolean {
  if (!keyMatches(e.key, b.key)) return false;
  const wantsMod = b.mod === true;
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantsMod !== hasMod) return false;
  const wantsAlt = b.alt === true;
  if (wantsAlt !== e.altKey) return false;
  const shift = b.shift;
  if (shift === undefined || shift === false) {
    if (e.shiftKey) return false;
  } else if (shift === true) {
    if (!e.shiftKey) return false;
  }
  return true;
}

/**
 * @experimental
 * Mounts an `ActionsRegistry` and one `document` keydown listener for its
 * lifetime. Children call `useActionsRegistry()` or `useAction()` to participate.
 */
export function ActionsProvider({ children }: { children: ReactNode }): ReactElement {
  const actionsRef = useRef<Map<string, Action>>(new Map());
  const versionRef = useRef(0);
  const cachedRef = useRef<readonly Action[]>([]);
  const cachedVerRef = useRef(-1);

  const registry = useMemo<ActionsRegistry>(() => {
    const snapshot = (): readonly Action[] => {
      const v = versionRef.current;
      if (cachedVerRef.current === v) return cachedRef.current;
      const out = Object.freeze(Array.from(actionsRef.current.values()));
      cachedRef.current = out;
      cachedVerRef.current = v;
      return out;
    };
    return {
      register: (action: Action) => {
        actionsRef.current.set(action.id, action);
        versionRef.current++;
        return () => {
          const cur = actionsRef.current.get(action.id);
          // Only unregister if the current entry is still us (last-writer-wins
          // means a later registrant should not be clobbered by our cleanup).
          if (cur === action) {
            actionsRef.current.delete(action.id);
            versionRef.current++;
          }
        };
      },
      unregister: (id: string) => {
        if (actionsRef.current.delete(id)) versionRef.current++;
      },
      list: () => snapshot(),
      trigger: (id: string) => {
        const a = actionsRef.current.get(id);
        if (!a) return false;
        try {
          a.run();
        } catch (err) {
          console.error(`weasel ActionsRegistry: action "${id}" threw`, err);
        }
        return true;
      },
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const action of actionsRef.current.values()) {
        const b = action.defaultBinding;
        if (!b) continue;
        if (!bindingMatches(b, e)) continue;
        const skipEditable = b.skipInEditable ?? true;
        if (skipEditable && isEditableTarget(e.target)) continue;
        if ((b.preventDefault ?? true)) e.preventDefault();
        try {
          action.run();
        } catch (err) {
          console.error(`weasel ActionsRegistry: action "${action.id}" threw`, err);
        }
        // First match wins; remaining actions skipped (spec §risks).
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <ActionsContext.Provider value={registry}>{children}</ActionsContext.Provider>;
}

/**
 * @experimental
 * Returns the parent `ActionsRegistry`, or `null` when no provider is in scope.
 */
export function useActionsRegistry(): ActionsRegistry | null {
  return useContext(ActionsContext);
}

/**
 * @experimental
 * Register an `Action` for the lifetime of the calling component. No-op when
 * no `ActionsProvider` is in scope. Re-registers on `action` reference change
 * (consumers should memoize stable identities to avoid churn).
 */
export function useAction(action: Action): void {
  const reg = useActionsRegistry();
  useEffect(() => {
    if (!reg) return;
    return reg.register(action);
  }, [reg, action]);
}
