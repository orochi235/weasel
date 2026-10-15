/**
 * The corner panel of the dynamic-corners lab: what the selected corners of
 * the open path are now, editable, and mixed where they differ.
 */
import {
  cornerFrames,
  cornerSpecAt,
  type NodeId,
  type PolygonPath,
  useActionsRegistry,
} from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from '@weasel-js/ui';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import s from './DynamicCornersLabDemo.module.css';

/** The selected corners, read the way the controls show them. */
export interface CornerSummary {
  count: number;
  style: string | undefined;
  radius: number | undefined;
}

/** The part of a scene the panel reads. */
export interface CornerScene {
  get(id: NodeId): { data: unknown } | undefined;
  subscribe(listener: () => void): () => void;
}

/** Which path is open and which of its anchors are selected. */
export interface CornerSelection {
  editingId(): string | null;
  selectedAnchors(): ReadonlySet<number>;
  subscribe(listener: () => void): () => void;
}

const ENABLED = { path: 'count', above: 0 };

const SCHEMA: PrefGroup = {
  name: 'Corners',
  children: {
    count: { kind: 'number', name: 'Selected corners', description: '', default: 0, hidden: true },
    style: {
      kind: 'enum', name: 'Style', description: '', default: 'round', control: 'toggle', enableIf: ENABLED,
      options: [
        { value: 'round', label: 'round' },
        { value: 'chamfer', label: 'chamfer' },
        { value: 'inverted', label: 'inverted' },
      ],
    },
    radius: {
      kind: 'number', name: 'Radius', description: '', default: 0, min: 0, max: 200, step: 1,
      control: 'input', enableIf: ENABLED,
    },
  },
};

const SHARP = 'sharp';

/** One value if every entry agrees, else undefined. */
const agreed = <T,>(values: readonly T[]): T | undefined =>
  values.every((v) => v === values[0]) ? values[0] : undefined;

function summarize(scene: CornerScene, selection: CornerSelection): CornerSummary {
  const id = selection.editingId();
  const path = id ? (scene.get(id as NodeId)?.data as { path?: PolygonPath } | undefined)?.path : undefined;
  if (!path || path.kind !== 'polygon') return { count: 0, style: undefined, radius: undefined };
  const picked = selection.selectedAnchors();
  const specs = cornerFrames(path).filter((f) => picked.has(f.index)).map((f) => cornerSpecAt(path, f.index));
  return {
    count: specs.length,
    // A sharp corner has no style to show, and shows none pressed.
    style: agreed(specs.map((c) => (c && c.radius > 0 ? c.style : SHARP))),
    radius: agreed(specs.map((c) => Math.round((c?.radius ?? 0) * 10) / 10)),
  };
}

export function CornerPanel({ scene, selection }: {
  scene: CornerScene;
  selection: CornerSelection;
}) {
  const actions = useActionsRegistry();
  const subscribe = useCallback((l: () => void) => {
    const offScene = scene.subscribe(l);
    const offSelection = selection.subscribe(l);
    return () => { offScene(); offSelection(); };
  }, [scene, selection]);
  const key = useSyncExternalStore(subscribe, () => JSON.stringify(summarize(scene, selection)));
  const summary = useMemo(() => JSON.parse(key) as CornerSummary, [key]);
  const mixed = useMemo(() => new Set([
    ...(summary.count > 1 && summary.style === undefined ? ['style'] : []),
    ...(summary.count > 1 && summary.radius === undefined ? ['radius'] : []),
  ]), [summary]);
  return (
    <div className={s.panel}>
      {summary.count === 0 && (
        <p className={s.prompt}>Click a corner anchor (Shift-click for more) to edit it</p>
      )}
      <PrefsForm
        schema={SCHEMA}
        layout="list"
        values={{
          count: summary.count,
          style: summary.style === SHARP ? undefined : summary.style,
          radius: summary.radius,
        }}
        mixed={mixed}
        onChange={(path, value) => {
          if (path === 'style') actions?.trigger('setCorners', { style: value });
          if (path === 'radius') actions?.trigger('setCorners', { radius: value });
        }}
      />
    </div>
  );
}
