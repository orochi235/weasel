import { type Action, type Tool, type ToolDef, type ToolsApi, useActionsRegistry } from '@weasel-js/core';
import { buildRouteRegistry, type Conflict, findConflicts, type RegistryEntry } from '@weasel-js/core/routing';
import { useEffect, useMemo, useRef, useState } from 'react';

/** The ids a canvas mounted in each of its two tool slots, sorted. */
export interface ToolSlots { registry: readonly string[]; ambient: readonly string[] }

export interface ToolReflection {
  /** Hand to `<SceneCanvas onToolsCreated>`. */
  onToolsCreated: (api: ToolsApi) => void;
  defs: readonly ToolDef[];
  tools: readonly Tool[];
  slots: ToolSlots;
  routes: readonly RegistryEntry[];
  conflicts: readonly Conflict[];
}

/** What a canvas's live tool set declares: its defs, its routes, and where two of them tie. */
export function useToolReflection(): ToolReflection {
  // `useTools` rebuilds the api literal each render — track only the structural signature
  // (sorted tool ids) so we don't spin in a render loop.
  const toolsRef = useRef<ToolsApi | null>(null);
  const [toolsSig, setToolsSig] = useState<string>('');
  const onToolsCreated = (api: ToolsApi) => {
    toolsRef.current = api;
    const sig = [
      ...Object.keys(api.registry),
      ...api.ambient.map((t) => `~${t.id}`),
    ].sort().join(',');
    setToolsSig((prev) => (prev === sig ? prev : sig));
  };

  // Pull live tool defs out of the registry + ambient slots. Both groups
  // get reflected — ambient is where resize / rotate / wheel-zoom live.
  const toolDefs = useMemo<readonly ToolDef[]>(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return [];
    type Slot = { id: string; def?: unknown };
    const all: Slot[] = [
      ...(Object.values(tools.registry) as unknown as Slot[]),
      ...(tools.ambient as unknown as Slot[]),
    ];
    const seen = new Set<string>();
    const out: ToolDef[] = [];
    for (const t of all) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (t.def) out.push(t.def as ToolDef);
    }
    return out;
  }, [toolsSig]);

  // Routes live on the Tool (`bindings`), not the authored def, so the
  // reflection consumers take the Tools themselves.
  const toolList = useMemo(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return [];
    const seen = new Set<string>();
    const out: Tool[] = [];
    for (const t of [...Object.values(tools.registry), ...tools.ambient]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t as Tool);
    }
    return out;
  }, [toolsSig]);

  const toolSlots = useMemo(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return { registry: [] as string[], ambient: [] as string[] };
    return {
      registry: Object.keys(tools.registry).sort(),
      ambient: tools.ambient.map((t) => t.id).sort(),
    };
  }, [toolsSig]);

  const routes = useMemo(() => buildRouteRegistry(toolList), [toolList]);
  const conflicts = useMemo(() => findConflicts(toolList), [toolList]);

  return { onToolsCreated, defs: toolDefs, tools: toolList, slots: toolSlots, routes, conflicts };
}

/** Every action registered in scope, kept current. */
export function useLiveActions(): readonly Action[] {
  const reg = useActionsRegistry();
  const [actions, setActions] = useState<readonly Action[]>(() => (reg ? reg.list() : []));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs to the actions registry subscription
    if (!reg) { setActions([]); return; }
    setActions(reg.list());
    return reg.subscribe(() => setActions(reg.list()));
  }, [reg]);
  return actions;
}
