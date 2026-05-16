import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useActionsRegistry,
  useScene,
  type ToolsApi,
} from '@orochi235/weasel';
import type { ToolEntry, ActionEntry } from './registryData';
import s from './RegistryInspector.module.css';

export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
}

interface ProbeProps {
  onSnapshot(s: RegistrySnapshot): void;
}

interface ShapeData { fill: string }
interface ShapePose { x: number; y: number; width: number; height: number }

/** Mounts a hidden SceneCanvas with the exhaustive tool bundle and lets the
 *  canvas auto-wire its built-in actions (delete / undoRedo / nudge / escape
 *  / selectAll / clipboard / etc.) into the surrounding `ActionsProvider`.
 *  Calls `onSnapshot` with the resulting tool/action lists on every change.
 *
 *  Hidden but kept in the layout tree so the hooks remain alive across
 *  re-renders of the inspector UI. */
export function RegistryProbe({ onSnapshot }: ProbeProps) {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  // `onToolsCreated` fires every render because `useTools` synthesizes a new
  // ToolsApi object literal each render. Track only the structural signature
  // (registry tool ids) — that's all this probe needs — to avoid a render
  // loop. Identity-tracking via plain useState would loop forever.
  const [toolsRegistrySig, setToolsRegistrySig] = useState<string>('');
  const toolsRef = useRef<ToolsApi | null>(null);
  const handleToolsCreated = (api: ToolsApi) => {
    toolsRef.current = api;
    const sig = Object.keys(api.registry).sort().join(',');
    setToolsRegistrySig((prev) => (prev === sig ? prev : sig));
  };
  const tools = toolsRef.current;
  const reg = useActionsRegistry();

  // `reg.list()` returns a new array each call, but the registry itself is a
  // stable context value — and re-rendering when tools change is enough to
  // refresh the action list (action registration fires in effects that run
  // after the initial render).
  const actionsList = reg ? reg.list() : [];

  const toolEntries: readonly ToolEntry[] = useMemo(() => {
    if (!tools) return [];
    void toolsRegistrySig;
    return Object.values(tools.registry).map((t) => {
      const def = t.def;
      const contributesActionIds: string[] = [];
      if (def && typeof def === 'object' && 'phases' in def) {
        const phases = (def as { phases?: Record<string, unknown> }).phases ?? {};
        for (const p of Object.values(phases)) {
          if (p && typeof p === 'object' && 'routes' in p) {
            const routes = (p as { routes?: Record<string, unknown> }).routes ?? {};
            for (const r of Object.values(routes)) {
              if (r && typeof r === 'object' && 'actionId' in r) {
                const a = (r as { actionId?: string }).actionId;
                if (a) contributesActionIds.push(a);
              }
            }
          }
        }
      }
      return {
        kind: 'tool' as const,
        id: t.id,
        label: t.id,
        cursor: typeof t.cursor === 'string' ? t.cursor : undefined,
        contributesActionIds: Array.from(new Set(contributesActionIds)),
      };
    });
  }, [tools, toolsRegistrySig]);

  const actionEntries: readonly ActionEntry[] = actionsList.map((a) => ({
    kind: 'action' as const,
    id: a.id,
    label: a.label ?? a.id,
    shortcut: a.defaultBinding ? formatBinding(a.defaultBinding) : undefined,
  }));

  const lastRef = useRef<string>('');
  useEffect(() => {
    const sig = JSON.stringify({
      t: toolEntries.map((t) => t.id),
      a: actionEntries.map((a) => a.id),
    });
    if (sig === lastRef.current) return;
    lastRef.current = sig;
    onSnapshot({ tools: toolEntries, actions: actionEntries });
  });

  return (
    <div aria-hidden="true" className={s.hidden}>
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        toolBundle="exhaustive"
        onToolsCreated={handleToolsCreated}
      />
    </div>
  );
}

function formatBinding(b: {
  key: string | readonly string[];
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}): string {
  const parts: string[] = [];
  if (b.mod) parts.push('Mod');
  if (b.alt) parts.push('Alt');
  if (b.shift === true) parts.push('Shift');
  parts.push(typeof b.key === 'string' ? b.key : b.key.join('/'));
  return parts.join('+');
}
