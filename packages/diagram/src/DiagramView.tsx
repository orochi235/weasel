import {
  dragPanContribution,
  fitViewToBounds,
  SceneCanvas,
  useScene,
  useSelection,
  WeaselProvider,
  type RectPose,
  type View,
} from '@weasel-js/core';
import { useEffect, useMemo } from 'react';
import { withDiagramRegistry } from './edge';
import type { DiagramSceneData, DiagramSpec } from './fromData';
import { useMirroredSelection } from './mirrorSelection';
import { registerDiagramShape } from './shape';

export interface DiagramViewProps {
  specs: readonly DiagramSpec[];
  width: number;
  height: number;
  /** A participant id, or null for none. */
  selected?: string | null;
  /** Reports what each click leaves picked, `null` for none — a re-click on the
   *  picked node reports it again. The canvas keeps the pick even if
   *  `selected` does not follow it; only a change to `selected` is pushed in. */
  onSelect?: (id: string | null) => void;
  /** The smallest scale the initial fit may use. Unset, the whole diagram fits
   *  however small that makes it; set, it stops here and the rest is a pan away. */
  minScale?: number;
  /** Which part of a diagram too big for the box it opens on: its middle
   *  (default) or its top-left, where a layered flow begins. */
  anchor?: 'center' | 'start';
  className?: string;
}

let made = 0;
const keys = new WeakMap<readonly DiagramSpec[], number>();
const keyOf = (specs: readonly DiagramSpec[]) => {
  let k = keys.get(specs);
  if (k === undefined) keys.set(specs, (k = ++made));
  return k;
};

const AMBIENT = [dragPanContribution()];

/** A read-only diagram: drag or wheel to pan, zoom, and pick a node, nothing else. A new `specs`
 *  array is a new scene, fitted to the box, so memoize it: one built inline
 *  remounts the scene on every render. Labels paint only in a registered font
 *  family; `diagramScene` defaults to sans-serif, so call
 *  `registerCanvasFont('sans-serif')` or text renders blank. */
export function DiagramView(props: DiagramViewProps) {
  return (
    <WeaselProvider>
      <Inner key={keyOf(props.specs)} {...props} />
    </WeaselProvider>
  );
}

function Inner({ specs, width, height, selected, onSelect, minScale, anchor, className }: DiagramViewProps) {
  useEffect(() => registerDiagramShape<RectPose>(), []);
  const registry = useMemo(() => withDiagramRegistry<RectPose>(), []);
  const scene = useScene<DiagramSceneData, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: specs as DiagramSpec[],
    registry,
  });
  const selection = useSelection({ scene, mode: 'single' });
  const onClick = useMirroredSelection(selection, selected, onSelect);
  const defaultView = useMemo(
    () => fitDiagram(specs, { width, height }, minScale, anchor),
    [specs, width, height, minScale, anchor],
  );
  return (
    <SceneCanvas
      scene={scene}
      selection={selection}
      features={['view', 'pick']}
      ambient={AMBIENT}
      onClick={onClick}
      width={width}
      height={height}
      className={className}
      {...(defaultView ? { defaultView } : {})}
    />
  );
}

/** The view `DiagramView` opens on: every container in the box, never above 1:1
 *  and never below `minScale`. */
export function fitDiagram(
  specs: readonly DiagramSpec[],
  size: { width: number; height: number },
  minScale?: number,
  anchor?: 'center' | 'start',
): View | undefined {
  const boxes = specs.filter((s) => s.kind === 'container').map((s) => s.pose as RectPose);
  if (boxes.length === 0) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const bounds = {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
  return fitViewToBounds(bounds, size, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
    maxScale: 1,
    ...(minScale !== undefined ? { minScale } : {}),
    ...(anchor !== undefined ? { anchor } : {}),
  });
}
