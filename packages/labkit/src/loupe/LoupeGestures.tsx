/**
 * Mounts the gesture dispatcher on a loupe's host and registers the loupe's
 * actions on it, so the peek key and the wheel route the way every other
 * weasel binding does.
 *
 * Three of the dispatcher's four element channels are off. Only `wheel` is
 * wanted here; `contextMenu` suppresses the native menu unconditionally and
 * `ingest` makes the host a file-drop target, neither of which a lab asked
 * for by turning a magnifier on.
 */
import {
  type ActionsRegistry,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { type RefObject, useEffect, useMemo } from 'react';
import { createLoupeActions, type LoupeInputApi } from './loupeActions';

/** Props for `<LoupeGestures>`. */
export interface LoupeGesturesProps {
  /** The element the dispatcher listens on — the same one the lens tracks. */
  hostRef: RefObject<HTMLElement | null>;
  input: LoupeInputApi;
  /** `KeyboardEvent.key` for hold-to-peek, or `null` for no peek binding. */
  peekKey: string | null;
}

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();

const CHANNELS = { pointer: false, contextMenu: false, ingest: false } as const;

function LoupeDispatch({
  hostRef,
  input,
  peekKey,
  registry,
}: LoupeGesturesProps & { registry: ActionsRegistry }) {
  const actions = useMemo(() => createLoupeActions(input, peekKey), [input, peekKey]);

  useEffect(() => {
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, actions]);

  useGestureDispatcher({
    canvasRef: hostRef,
    actions: registry,
    toolsById: NO_TOOLS,
    channels: CHANNELS,
  });

  return null;
}

/**
 * The loupe's input, routed. Render it inside a `<WeaselProvider isolate>` —
 * with no registry in scope it renders nothing rather than registering
 * actions that could never fire.
 */
export function LoupeGestures(props: LoupeGesturesProps) {
  const registry = useActionsRegistry();
  if (!registry) return null;
  return <LoupeDispatch {...props} registry={registry} />;
}
