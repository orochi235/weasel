import {
  fitViewToBounds,
  SceneCanvas,
  useScene,
  useSelection,
  WeaselProvider,
  type RectPose,
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
  onSelect?: (id: string | null) => void;
  className?: string;
}

let made = 0;
const keys = new WeakMap<readonly DiagramSpec[], number>();
const keyOf = (specs: readonly DiagramSpec[]) => {
  let k = keys.get(specs);
  if (k === undefined) keys.set(specs, (k = ++made));
  return k;
};

/** A read-only diagram: pan, zoom and pick a node, nothing else. A new `specs`
 *  array is a new scene, fitted to the box. */
export function DiagramView(props: DiagramViewProps) {
  return (
    <WeaselProvider>
      <Inner key={keyOf(props.specs)} {...props} />
    </WeaselProvider>
  );
}

function Inner({ specs, width, height, selected, onSelect, className }: DiagramViewProps) {
  useEffect(() => registerDiagramShape<RectPose>(), []);
  const registry = useMemo(() => withDiagramRegistry<RectPose>(), []);
  const scene = useScene<DiagramSceneData, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: specs as DiagramSpec[],
    registry,
  });
  const selection = useSelection({ scene, mode: 'single' });
  useMirroredSelection(selection, selected, onSelect);
  const defaultView = useMemo(() => {
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
    return fitViewToBounds(bounds, { width, height }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { maxScale: 1 });
  }, [specs, width, height]);
  return (
    <SceneCanvas
      scene={scene}
      selection={selection}
      features={['view', 'pick']}
      width={width}
      height={height}
      className={className}
      {...(defaultView ? { defaultView } : {})}
    />
  );
}
