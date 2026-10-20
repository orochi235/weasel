import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import { DiagramView, type DiagramViewApi } from '../DiagramView';
import { diagramScene } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { addStage, ensureWireIds, nextStageId } from './edit';
import { editHandlers, pinShown, stageBoxes } from './editorHandlers';
import { isPart, useEditorPicks } from './editorPicks';
import { groupStages, nextGroupId, ungroup } from './groupEdit';
import { useGroupTitle } from './groupTitle';
import { editorScene, type EditorLookOptions } from './editorMapping';
import { applyLookRoutes } from './lookRoutes';
import { editorReorders, type ReorderSource } from './editorReorder';
import { renameGroupContribution } from './renameGroupAction';
import { useReleaseReplaced } from './releaseReplaced';
import { paintRun } from './run';
import { useRunPortOptions } from './runPorts';
import { freeSpot } from './place';
import type { LanesOptions } from './lanes';
import type { NodeGraphOptions } from './nodeGraph';
import { stageFromType, type EffectStageType } from './stageTypes';
import type { EffectBox, EffectDoc, EffectRun } from './types';

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
   *  'Reorder', 'Reorder lanes', 'Resize group', 'Group', 'Ungroup' or 'Rename group'. */
  onChange: (next: EffectDoc, label: string) => void;
  /** One run of the pipeline, drawn over it as `EffectChart` draws its
   *  `run`, with the stage it is `at` outlined. */
  run?: EffectRun;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for anything else, a wire included. */
  onSelect?: (stage: string | null) => void;
  /** A group id, or null for none: drawn picked while no stage is. */
  selectedGroup?: string | null;
  /** Hears each pick: a group's id, or `null` for anything else. */
  onSelectGroup?: (group: string | null) => void;
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
  /** Groups stages and groups, as `groupStages` does, and reports it as 'Group'.
   *  Under `nodeGraph` it first pins every stage where it shows, as a drag
   *  does. Returns the new group's id, or `null` for no ids. */
  group(ids: readonly string[]): string | null;
  /** Dissolves a group, as `ungroup` does, and reports it as 'Ungroup'. */
  ungroup(id: string): void;
  /** Opens the field a group's title is renamed in, over its title, or above
   *  its box where it has none; a double-click on the title does
   *  the same. Renaming reports 'Rename group'. */
  renameGroup(id: string): void;
}

/** The pipeline-mode editor: a look's drawing of an effect pipeline, whose
 *  ports wire output to input, and whose wires and stages reconnect and
 *  delete. Under `nodeGraph` stages drag freely, and each group is a titled
 *  box: drag a stage into or out of it, drag the box to carry what it holds,
 *  resize it, or double-click its title to rename it; under `rack` and `lanes` a
 *  stage on the main line drags along it to another place, rewiring the
 *  pipeline, a group drags along it by its title, and a double-click on that
 *  title renames it; under `lanes` a lane drags by its header. A selected
 *  wire's route drags under every look: into `routes` under `nodeGraph`, and
 *  into `lookRoutes` under the others, where it holds only while the wire's
 *  ends stay put. Every edit is a doc handed to `onChange`. Text paints only in a registered font family,
 *  as with `EffectChart`. */
export const EffectEditor = forwardRef<EffectEditorApi, EffectEditorProps>(function EffectEditor(
  { doc, onChange, run, selected, onSelect, selectedGroup, onSelectGroup, look = 'nodeGraph', options, width, height, background, className },
  ref,
) {
  const built = useMemo(() => editorScene(doc, look, options), [doc, look, options]);
  const specs = useMemo(() => applyLookRoutes(diagramScene(built.data, built.scene), doc, look, built)
    // Only stages and groups pick, so a lane or a row is never lit while `onSelect` says none; DiagramView makes edges pickable again.
    .map((s) => (s.pickable === false || isPart(built, s.id as string) ? s : { ...s, pickable: false })), [built, doc, look]);
  const painted = useMemo(() => paintRun(doc.pipeline, specs, run, built.exits), [doc.pipeline, specs, run, built]);
  useReleaseReplaced(run);
  const portOptions = useRunPortOptions(built.color, doc.pipeline, run);

  const picks = useEditorPicks(built, { selected, selectedGroup, onSelect, onSelectGroup });
  const now = useLatest({ doc, built, specs, look, options, onChange });
  const view = useRef<DiagramViewApi | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const handlers = useMemo(() => editHandlers(() => now.current, picks.unpick, setRenaming), [now, picks.unpick]);
  const ambient = useMemo(() => {
    const source = (): ReorderSource => {
      const { doc: d, built: b, specs: shown, onChange: report } = now.current;
      const boxes = new Map(shown.map((s) => [s.id as string, s.pose as EffectBox]));
      return { doc: d, order: b.order, laneOrder: b.laneOrder, boxOf: (id) => boxes.get(id), onChange: report };
    };
    return [...editorReorders(source), renameGroupContribution(source, setRenaming)];
  }, [now]);

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
    group: (ids) => {
      const { doc: d, specs: shown, look: l, onChange: report } = now.current;
      if (ids.length === 0) return null;
      const base = l === 'nodeGraph' ? pinShown(ensureWireIds(d), shown) : d;
      report(groupStages(base, ids), 'Group');
      return nextGroupId(d.pipeline);
    },
    ungroup: (id) => {
      const { doc: d, onChange: report } = now.current;
      if (d.pipeline.groups?.some((g) => g.id === id)) report(ungroup(d, id), 'Ungroup');
    },
    renameGroup: (id) => setRenaming(id),
  }), [now]);

  const title = useGroupTitle(doc, look, renaming, setRenaming, onChange);
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
      {...(look === 'nodeGraph' ? { onMove: handlers.onMove } : { ambient })}
      {...(look === 'nodeGraph' ? { onEditContainer: handlers.onEditContainer } : {})}
      onSelect={picks.pick}
      {...(picks.shown !== undefined ? { selected: picks.shown } : {})}
      {...(title !== null ? { overlays: title } : {})}
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
