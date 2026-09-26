/**
 * Registers the loupe's actions, and mounts the gesture dispatcher on the
 * loupe's host when no camera already has one there, so the peek key and the
 * wheel route the way every other weasel binding does.
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
import { type RefObject, useContext, useEffect, useMemo } from 'react';
import { CameraContext } from '../canvas/CameraInput';
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
  ownDispatcher,
}: LoupeGesturesProps & { registry: ActionsRegistry; ownDispatcher: boolean }) {
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
    enabled: ownDispatcher,
  });

  return null;
}

/**
 * The loupe's input, routed. Inside a camera (`<CanvasStack>`, `<Stage>`) its
 * actions join the camera's dispatcher, which already listens on the host;
 * elsewhere it mounts a dispatcher of its own. With no registry in scope it
 * renders nothing rather than registering actions that could never fire.
 */
export function LoupeGestures(props: LoupeGesturesProps) {
  const registry = useActionsRegistry();
  const camera = useContext(CameraContext);
  if (!registry) return null;
  return <LoupeDispatch {...props} registry={registry} ownDispatcher={camera === null} />;
}
