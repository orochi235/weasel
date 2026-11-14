import { useCallback, useContext, useLayoutEffect, useRef, type ReactElement } from 'react';
import { useColorCss, useTints } from '@weasel-js/theme/react';
import { handleHalf as themeHandleHalf, type HandleSizeToken } from '../../handles';
import { LayerHostContext, type LayerEntry } from './layerHost';
import { NO_MODIFIERS } from './layerCtx';
import type { CurveLayer } from './layerTypes';

/** Props for {@link CustomLayer}, and the state half of every built-in layer's props. */
export interface LayerStateProps<S> {
  /** The layer's state, held by the consumer: the editor never stores it. */
  state: S;
  /** Every change a gesture, key, or undo makes, live during a drag. */
  onChange(next: S): void;
  /** Once per finished edit (a drag's end, a one-shot insert or delete, an undo or redo), with the state before it. */
  onCommit?(next: S, prev: S): void;
}

/** Props for {@link CustomLayer}. */
export interface CustomLayerProps<S> extends LayerStateProps<S> {
  layer: CurveLayer<S>;
}

/**
 * One layer of a `LayeredCurveEditor`, from any {@link CurveLayer}. It draws where it sits among the editor's
 * children, so a later child draws over it and is asked about a press before it.
 */
export function CustomLayer<S>({ layer, state, onChange, onCommit }: CustomLayerProps<S>): ReactElement {
  const host = useContext(LayerHostContext);
  if (!host) throw new Error('A curve layer must sit inside a LayeredCurveEditor or a CurveEditor.');
  const group = useRef<SVGGElement>(null);
  const entry = useRef<LayerEntry | null>(null);
  entry.current ??= { layer, state, onChange, onCommit, el: null } as LayerEntry;
  useLayoutEffect(() => {
    Object.assign(entry.current!, { layer, state, onChange, onCommit });
  });
  const { register } = host;
  useLayoutEffect(() => {
    const own = entry.current!;
    own.el = group.current;
    return register(own);
  }, [register]);

  const colorCss = useColorCss();
  const { resolved } = useTints();
  const handleHalf = useCallback((token: HandleSizeToken) => themeHandleHalf(token, resolved), [resolved]);
  return (
    <g ref={group} data-layer-id={layer.id}>
      {layer.render(state, { ...host.base, modifiers: NO_MODIFIERS, colorCss, handleHalf, isActive: host.active === entry.current })}
    </g>
  );
}
