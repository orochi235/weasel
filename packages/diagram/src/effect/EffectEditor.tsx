import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import { DiagramView, type DiagramViewApi } from '../DiagramView';
import { diagramScene } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { addStage, ensureWireIds, nextStageId } from './edit';
import { editHandlers, pinShown, stageBoxes, type Box } from './editorHandlers';
import { editorScene, type EditorLookOptions } from './editorMapping';
import { applyLookRoutes } from './lookRoutes';
import { editorReorders } from './editorReorder';
import { useReleaseReplaced } from './releaseReplaced';
import { paintRun } from './run';
import { useRunPortOptions } from './runPorts';
import { freeSpot } from './place';
import type { LanesOptions } from './lanes';
import type { NodeGraphOptions } from './nodeGraph';
import { stageFromType, type EffectStageType } from './stageTypes';
import type { EffectDoc, EffectRun } from './types';

/** Which look `EffectEditor` draws in, and that look's options. Keep the
 *  options object's identity steady between renders. */
export type EffectEditorLookProps =
  | { look?: 'nodeGraph'; options?: NodeGraphOptions }
  | { look: 'rack'; options?: EditorLookOptions['rack'] }
  | { look: 'lanes'; options?: LanesOptions };

/** Props for `EffectEditor`. */
export type EffectEditorProps = EffectEditorBaseProps & EffectEditorLookProps;

/** `EffectEditor`'s props apart from its look. */
export interface EffectEditorBaseProps {
  /** The pipeline and where its stages sit. The editor keeps none of it:
   *  every edit comes back through `onChange` and shows once `doc` follows. */
  doc: EffectDoc;
  /** Hears each edit as the doc it makes, and a name for it fit for an undo
   *  entry: 'Move', 'Connect', 'Delete', 'Reconnect', 'Edit route', 'Add stage',
   *  'Reorder' or 'Reorder lanes'. */
  onChange: (next: EffectDoc, label: string) => void;
  /** One run of the pipeline, drawn over it as `EffectChart` draws its
   *  `run`, with the stage it is `at` outlined. */
  run?: EffectRun;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for anything else, a wire included. */
  onSelect?: (stage: string | null) => void;
  /** CSS pixels. Omit both to fill the parent. */
  width?: number;
  height?: number;
  background?: Paint;
  className?: string;
}

/** What a `ref` on `EffectEditor` holds. */
export interface EffectEditorApi {
  /** Adds a stage of type `type`. Under `nodeGraph` its top-left goes at the
   *  world point under `client` when given, or in the first free spot in view
   *  (`freeSpot`), and like a drag it pins every stage layout placed where it
   *  shows, so nothing moves under it; the other looks place it themselves.
   *  Returns the new stage's id. */
  addStage(type: EffectStageType, client?: { x: number; y: number }): string;
}

/** The pipeline-mode editor: a look's drawing of an effect pipeline, whose
 *  ports wire output to input, and whose wires and stages reconnect and
 *  delete. Under `nodeGraph` stages drag freely; under `rack` and `lanes` a
 *  stage on the main line drags along it to another place, rewiring the
 *  pipeline, and under `lanes` a lane drags by its header. A selected
 *  wire's route drags under every look: into `routes` under `nodeGraph`, and
 *  into `lookRoutes` under the others, where it holds only while the wire's
 *  ends stay put. Every edit is a doc handed to `onChange`. Text paints only in a registered font family,
 *  as with `EffectChart`. */
export const EffectEditor = forwardRef<EffectEditorApi, EffectEditorProps>(function EffectEditor(
  { doc, onChange, run, selected, onSelect, look = 'nodeGraph', options, width, height, background, className },
  ref,
) {
  const built = useMemo(() => editorScene(doc, look, options), [doc, look, options]);
  const specs = useMemo(() => applyLookRoutes(diagramScene(built.data, built.scene), doc, look, built)
    // A group box picked would stay lit while `onSelect` says none; DiagramView makes edges pickable again.
    .map((s) => (s.pickable === false || built.stageOf(s.id as string) !== undefined ? s : { ...s, pickable: false })), [built, doc, look]);
  const painted = useMemo(() => paintRun(doc.pipeline, specs, run, built.exits), [doc.pipeline, specs, run, built]);
  useReleaseReplaced(run);
  const portOptions = useRunPortOptions(built.color, doc.pipeline, run);

  // The wire picked on the canvas, kept so a controlled `selected` of null does not clear it.
  const [edge, setEdge] = useState<string | null>(null);
  const pickedWire = edge === null ? undefined : built.wireOf(edge);
  const now = useLatest({ doc, built, specs, look, options, onChange });
  const view = useRef<DiagramViewApi | null>(null);
  const handlers = useMemo(() => editHandlers(() => now.current, () => setEdge(null)), [now]);
  const reorders = useMemo(() => editorReorders(() => {
    const { doc: d, built: b, specs: shown, onChange: report } = now.current;
    const boxes = new Map(shown.map((s) => [s.id as string, s.pose as Box]));
    return { doc: d, order: b.order, laneOrder: b.laneOrder, boxOf: (id) => boxes.get(id), onChange: report };
  }), [now]);

  useImperativeHandle(ref, () => ({
    addStage: (type, client) => {
      const { doc: d, specs: shown, look: l, options: opts, onChange: report } = now.current;
      const stage = stageFromType(type, nextStageId(d.pipeline, type.type));
      if (l !== 'nodeGraph') {
        report(addStage(ensureWireIds(d), stage), 'Add stage');
        return stage.id;
      }
      const pinned = ensureWireIds(pinShown(d, shown));
      if (client && view.current) {
        report(addStage(pinned, stage, view.current.worldAt(client.x, client.y)), 'Add stage');
      } else {
        const boxes = stageBoxes(d, shown);
        const alone: EffectDoc = { pipeline: { ...d.pipeline, stages: [stage], wires: [], groups: [] }, places: {} };
        const size = stageBoxes(alone, drawnSpecs(alone, opts as NodeGraphOptions | undefined)).get(stage.id) ?? { width: 0, height: 0 };
        const at = freeSpot([...boxes.values()], size, view.current?.visible() ?? null);
        report(addStage(pinned, stage, at), 'Add stage');
      }
      return stage.id;
    },
  }), [now]);

  const onSelectRef = useLatest(onSelect);
  const pick = useCallback((id: string | null) => {
    const { built: b } = now.current;
    const stage = id === null ? undefined : b.stageOf(id);
    setEdge(id !== null && stage === undefined && b.wireOf(id) !== undefined ? id : null);
    onSelectRef.current?.(stage ?? null);
  }, [now, onSelectRef]);

  const shown = selected === undefined ? undefined : selected ?? (pickedWire === undefined ? null : edge);
  // Keyed by look so each look opens fitted: DiagramView keeps its view across new specs.
  return (
    <DiagramView
      key={look}
      ref={view}
      specs={painted}
      width={width}
      height={height}
      minScale={EFFECT_MIN_SCALE}
      anchor="start"
      ports="connect"
      portOptions={portOptions}
      canConnect={handlers.canConnect}
      onConnect={handlers.onConnect}
      onReconnect={handlers.onReconnect}
      onEditRoute={handlers.onEditRoute}
      onDelete={handlers.onDelete}
      {...(look === 'nodeGraph' ? { onMove: handlers.onMove } : { ambient: reorders })}
      onSelect={pick}
      {...(shown !== undefined ? { selected: shown } : {})}
      {...(background !== undefined ? { background } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
});

/** The doc as `DiagramView` is handed it. */
function drawnSpecs(doc: EffectDoc, options: NodeGraphOptions | undefined) {
  const built = editorScene(doc, 'nodeGraph', options);
  return diagramScene(built.data, built.scene);
}
