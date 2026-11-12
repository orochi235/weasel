import { useColorCss, useTints } from '@weasel-js/theme/react';
import { useCallback } from 'react';
import { handleHalf as themeHandleHalf, type HandleSizeToken } from '../../handles';
import type { CurveLayer, LayerCtx, LayerModifiers } from './layerTypes';

const NO_MODIFIERS: LayerModifiers = { shift: false, alt: false, meta: false, ctrl: false };

/** Each layer's visuals in its own group, bottom to top, with the render context each is handed. */
export function CurveLayers({ layers, base, activeLayerId }: {
  layers: ReadonlyArray<{ layer: CurveLayer<unknown>; state: unknown }>;
  base: Omit<LayerCtx, 'modifiers'>;
  activeLayerId: string | null;
}) {
  const colorCss = useColorCss();
  const { resolved } = useTints();
  const handleHalf = useCallback((token: HandleSizeToken) => themeHandleHalf(token, resolved), [resolved]);
  return (
    <>
      {layers.map(({ layer, state }) => (
        <g key={layer.id} data-layer-id={layer.id}>
          {layer.render(state, { ...base, modifiers: NO_MODIFIERS, colorCss, handleHalf, isActive: activeLayerId === layer.id })}
        </g>
      ))}
    </>
  );
}
