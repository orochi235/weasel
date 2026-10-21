/** A root's scene tree, loaded a level at a time as branches open, and reloaded where it is open when the scene changes. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DevtoolsNodeSummary } from '@weasel-js/core/devtools-protocol';
import { useLatest } from '@weasel-js/react';
import type { DevtoolsClient } from '../client';

/** The key the top level is held under. */
const TOP = '';

export interface SceneTree {
  /** Each loaded level, by parent id; the top level under `''`. */
  levels: ReadonlyMap<string, readonly DevtoolsNodeSummary[]>;
  expanded: ReadonlySet<string>;
  setExpanded(ids: Set<string>): void;
  /** Why the top level could not be read, such as a scene not mounted yet. */
  error: string | null;
}

export function useSceneTree(client: DevtoolsClient, rootId: string): SceneTree {
  const [levels, setLevels] = useState<ReadonlyMap<string, readonly DevtoolsNodeSummary[]>>(new Map());
  const [expanded, setExpandedState] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const expandedRef = useLatest(expanded);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback((parent: string): void => {
    const body = parent === TOP ? { type: 'get-children' as const } : { type: 'get-children' as const, nodeId: parent };
    client.request(rootId, body).then(
      (rows) => {
        if (!alive.current) return;
        setLevels((prev) => new Map(prev).set(parent, rows));
        if (parent === TOP) setError(null);
      },
      (err: Error) => {
        if (!alive.current) return;
        if (parent === TOP) setError(err.message);
        setLevels((prev) => {
          const next = new Map(prev);
          next.delete(parent);
          return next;
        });
      },
    );
  }, [client, rootId]);

  useEffect(() => {
    load(TOP);
    return client.onChanged((id, areas) => {
      if (id !== rootId || !areas.includes('scene')) return;
      load(TOP);
      for (const open of expandedRef.current) load(open);
    });
  }, [client, rootId, load, expandedRef]);

  const setExpanded = useCallback((ids: Set<string>): void => {
    for (const id of ids) if (!expandedRef.current.has(id)) load(id);
    setExpandedState(ids);
  }, [load, expandedRef]);

  return { levels, expanded, setExpanded, error };
}
