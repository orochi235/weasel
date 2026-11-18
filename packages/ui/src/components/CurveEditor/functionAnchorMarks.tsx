import type { ReactNode } from 'react';
import { decimal, present } from '@weasel-js/quantity';
import { Diamond } from './Diamond';
import { isHiddenAnchor, isPinnedEndpointAt } from './anchorRules';
import s from './CurveEditor.module.css';
import type { LayerRenderCtx } from './layerTypes';
import type { EndpointMode, FunctionLayerOptions, FunctionLayerState } from './functionLayerTypes';

/** What a function layer's options say about how its anchors look, fixed when the layer is built. */
export interface AnchorLook extends Pick<FunctionLayerOptions, 'label' | 'renderAnchor' | 'hideNonInteractive'> {
  readonly endpoints: EndpointMode;
  /** The curve is drawn, so its first and last anchors draw as endpoints. */
  readonly curveVisible: boolean;
}

const formatCoord = (n: number): string => present(n, decimal({ maxPlaces: 3 })).spoken;

/** One focusable, named mark per anchor a function layer shows: the consumer's `renderAnchor`, else a dot or a diamond. */
export function anchorMarks(state: FunctionLayerState, ctx: LayerRenderCtx, look: AnchorLook): ReactNode[] {
  const { points, activeIndex } = state;
  const { endpoints, curveVisible } = look;
  return points.map((point, i) => {
    const a = ctx.toPlot(point);
    const pinned = isPinnedEndpointAt(i, points.length, endpoints);
    const locked = point.locked === true;
    if (isHiddenAnchor(points, i, endpoints, look.hideNonInteractive)) return null;
    const active = activeIndex === i;
    const isEndpoint = curveVisible && (i === 0 || i === points.length - 1);
    const focus = !locked && !(endpoints === 'pinned-both' && pinned)
      ? { tabIndex: 0 }
      : {};
    const a11y = {
      ...focus,
      role: 'button',
      'aria-label': `${look.label ?? 'Point'} ${i + 1} at ${formatCoord(point.x)}, ${formatCoord(point.y)}`,
    };
    if (look.renderAnchor) {
      const node = look.renderAnchor({
        point, index: i,
        cx: a.x, cy: a.y,
        active, locked,
        pinned, endpoint: isEndpoint,
      });
      if (node !== null && node !== undefined) {
        return <g key={i} data-anchor-index={i} {...a11y}>{node}</g>;
      }
    }
    const anchorCls = [
      s.anchor,
      isEndpoint && s.endpoint,
      (pinned || locked) && s.pinned,
      locked && s.locked,
      active && s.active,
    ].filter(Boolean).join(' ');
    if (isEndpoint || locked) {
      const half = ctx.handleHalf(locked ? '--wzl-handle-size-sm' : '--wzl-handle-size-lg');
      return (
        <Diamond
          key={i}
          className={anchorCls}
          at={a}
          half={half}
          data-anchor-index={i}
          {...a11y}
        />
      );
    }
    return (
      <circle
        key={i}
        className={anchorCls}
        cx={a.x}
        cy={a.y}
        r={ctx.handleHalf('--wzl-handle-dot-size')}
        data-anchor-index={i}
        {...a11y}
      />
    );
  });
}
