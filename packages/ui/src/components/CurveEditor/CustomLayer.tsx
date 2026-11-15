import { useCallback, useContext, useLayoutEffect, useReducer, useRef, type ReactElement } from 'react';
import { useColorCss, useTints } from '@weasel-js/theme/react';
import { handleHalf as themeHandleHalf, type HandleSizeToken } from '../../handles';
import { LayerHostContext, stateOf, type LayerEntry } from './layerHost';
import { NO_MODIFIERS } from './layerCtx';
import type { CurveLayer } from './layerTypes';

/**
 * Props for {@link CustomLayer}, and the state half of every built-in layer's props. The callbacks are the kit's edit
 * protocol (`docs/conventions.md`, "Edit callbacks"): a drag, a one-shot insert or delete, a key, and an undo or redo
 * are each one edit. `onChange` takes the state the edit began from as well.
 */
export interface LayerStateProps<S> {
  /** The layer's state, held by the consumer. Without `onInput` the editor draws its own draft while an edit runs. */
  state: S;
  onInput?(next: S): void;
  onChange?(next: S, prev: S): void;
  onCancel?(): void;
}

/** Props for {@link CustomLayer}. */
export interface CustomLayerProps<S> extends LayerStateProps<S> {
  layer: CurveLayer<S>;
}

/**
 * One layer of a `LayeredCurveEditor`, from any {@link CurveLayer}. It draws where it sits among the editor's
 * children, so a later child draws over it and is asked about a press before it.
 */
export function CustomLayer<S>({ layer, state, onInput, onChange, onCancel }: CustomLayerProps<S>): ReactElement {
  const host = useContext(LayerHostContext);
  if (!host) throw new Error('A curve layer must sit inside a LayeredCurveEditor or a CurveEditor.');
  const group = useRef<SVGGElement>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const entry = useRef<LayerEntry | null>(null);
  entry.current ??= { layer, state, onInput, onChange, onCancel, redraw, el: null } as LayerEntry;
  useLayoutEffect(() => {
    Object.assign(entry.current!, { layer, state, onInput, onChange, onCancel });
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
      {layer.render((entry.current!.draft ? stateOf(entry.current!) : state) as S, { ...host.base, modifiers: NO_MODIFIERS, colorCss, handleHalf, isActive: host.active === entry.current })}
    </g>
  );
}
