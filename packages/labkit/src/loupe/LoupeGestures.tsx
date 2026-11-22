/**
 * Registers the loupe's actions, and mounts the gesture dispatcher on the
 * loupe's host when no camera already has one there, so the aim, the peek key
 * and the wheel route the way every other weasel binding does.
 *
 * Of the dispatcher's element channels only `hover` and `wheel` are wanted
 * here, and `pointer` only while the eyedropper is on, which wants the click.
 * Otherwise `pointer` would open a gesture on every press and capture the
 * pointer, taking clicks from the content under the lens; `contextMenu`
 * suppresses the native menu unconditionally and `ingest` makes the host a
 * file-drop target, none of which a lab asked for by turning a magnifier on.
 */
import {
  type ActionsRegistry,
  InputScope,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { createLoupeActions, type LoupeInputApi } from '@weasel-js/loupe';
import { isDev } from '@weasel-js/react';
import { createPart } from '@weasel-js/registry';
import { type RefObject, useContext, useEffect, useMemo, useState } from 'react';
import { CameraContext, type CameraContextValue } from '../canvas/CameraInput';

/** Props for `<LoupeGestures>`. */
export interface LoupeGesturesProps {
  /** The element the dispatcher listens on — the same one the lens tracks. */
  hostRef: RefObject<HTMLElement | null>;
  input: LoupeInputApi;
  /** `KeyboardEvent.key` for hold-to-peek, or `null` for no peek binding. */
  peekKey: string | null;
  /** Whether the eyedropper is on, so a press on the host is the loupe's to take. */
  dropping?: boolean;
}

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();

const CHANNELS = { pointer: false, hover: true, contextMenu: false, ingest: false } as const;
const DROPPING_CHANNELS = { ...CHANNELS, pointer: true } as const;

/** The loupes registered on each camera's registry. */
const loupesOn = createPart((_registry: ActionsRegistry) => new Set<object>());

/** Warns when a second loupe joins a camera's registry: their actions share ids, so only the newest takes input. */
function useSoleLoupe(registry: ActionsRegistry, shared: boolean): void {
  useEffect(() => {
    if (!shared) return;
    const token = {};
    const loupes = loupesOn(registry);
    loupes.add(token);
    if (loupes.size === 2 && isDev())
      console.warn(
        '[labkit] two loupes in one camera: only the newest aims, peeks and magnifies. Mount one loupe per camera.',
      );
    return () => {
      loupes.delete(token);
    };
  }, [registry, shared]);
}

function LoupeDispatch({
  hostRef,
  input,
  peekKey,
  dropping,
  registry,
  ownDispatcher,
}: LoupeGesturesProps & { registry: ActionsRegistry; ownDispatcher: boolean }) {
  const actions = useMemo(() => createLoupeActions(input, peekKey), [input, peekKey]);
  useSoleLoupe(registry, !ownDispatcher);

  useEffect(() => {
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, actions]);

  useGestureDispatcher({
    canvasRef: hostRef,
    actions: registry,
    entriesById: NO_TOOLS,
    channels: dropping ? DROPPING_CHANNELS : CHANNELS,
    enabled: ownDispatcher,
  });

  return null;
}

/** The loupe's own scope's registry, so two loupes under one provider do not
 *  stack their actions on one id. */
function OwnLoupeDispatch(props: LoupeGesturesProps) {
  const registry = useActionsRegistry();
  if (!registry) return null;
  return <LoupeDispatch {...props} registry={registry} ownDispatcher />;
}

/** Whether `hostRef` is the camera's own element, read after commit, when both refs are attached. */
function useOnCameraElement(
  hostRef: RefObject<HTMLElement | null>,
  camera: CameraContextValue | null,
): boolean {
  const [on, setOn] = useState(camera !== null);
  useEffect(() => {
    setOn(camera !== null && hostRef.current === camera.element());
  }, [camera, hostRef]);
  return on;
}

/**
 * The loupe's input, routed. When its host is a camera's element (`<CanvasStack>`, `<Stage>`) its actions join the
 * camera's dispatcher, which already listens there; on any other host, inside a camera or not, it mounts a dispatcher
 * of its own, in an input scope of its own.
 * With no registry in scope it renders nothing rather than registering actions
 * that could never fire.
 */
export function LoupeGestures(props: LoupeGesturesProps) {
  const registry = useActionsRegistry();
  const camera = useContext(CameraContext);
  const onCamera = useOnCameraElement(props.hostRef, camera);
  if (!registry) return null;
  if (onCamera) return <LoupeDispatch {...props} registry={registry} ownDispatcher={false} />;
  return (
    <InputScope>
      <OwnLoupeDispatch {...props} />
    </InputScope>
  );
}
