import { useId, type RefObject } from 'react';
import s from './Badge.module.css';
import { EFFECTS, type BadgeEffectSpec } from './effects';
import { composeOutline, offsetOutline } from './composeOutline';
import type { ComposeSpec } from './composeSpec';
import type { BadgeVariant, ShapeModule } from './types';

/** CSS px between a composed badge's outline and its focus ring. */
const FOCUS_RING_OFFSET = 2;

interface BadgeDecoProps {
  svgRef: RefObject<SVGSVGElement | null>;
  compose: ComposeSpec;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as the SHAPES registry types it.
  shapeModule: ShapeModule<any>;
  params: unknown;
  box: { w: number; h: number };
  bloat: number;
  variant: BadgeVariant;
  focused: boolean;
  phase: number;
}

/** The SVG behind a badge's label: a composed outline with its effect layers, or the shape's own drawing. */
export function BadgeDeco({ svgRef, compose, shapeModule, params, box, bloat, variant, focused, phase }: BadgeDecoProps) {
  const bodyMaskId = `badge-mask-${useId().replace(/:/g, '')}`;
  const sampler = compose.base ? compose.base.build(compose.baseParams, box.w, box.h) : null;
  const outline = sampler ? composeOutline(sampler, compose.effects, bloat, box, phase) : null;
  const ShapeBody = shapeModule.Component;

  if (compose.base && outline) {
    const decoEffects = (compose.effects ?? []).filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS]?.Component);
    const zoneOf = (eff: BadgeEffectSpec) => EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground';
    const background = decoEffects.filter((eff) => zoneOf(eff) === 'background');
    const foreground = decoEffects.filter((eff) => zoneOf(eff) === 'foreground');
    const mask = decoEffects.filter((eff) => zoneOf(eff) === 'mask');
    const render = (eff: BadgeEffectSpec, i: number) => {
      const mod = EFFECTS[eff.type as keyof typeof EFFECTS];
      const EffComponent = mod?.Component;
      if (!EffComponent) return null;
      const effParams = { ...(mod.defaults ?? {}), ...(eff.params ?? {}) };
      return <EffComponent key={`${eff.type as string}-${i}`} sampler={outline} boxW={box.w} boxH={box.h} variant={variant} params={effParams} phase={phase} />;
    };
    return (
      <svg ref={svgRef} className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {mask.length > 0 && (
          <defs>
            <mask id={bodyMaskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
              <rect x="-10" y="-10" width="120" height="120" fill="white" />
              {mask.map(render)}
            </mask>
          </defs>
        )}
        {background.map(render)}
        <g {...(mask.length > 0 ? { mask: `url(#${bodyMaskId})` } : {})}>
          {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={outline.bodyPath} />}
          {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={outline.bodyPath} />}
        </g>
        {foreground.map(render)}
        {focused && <path className="badge-focus" d={offsetOutline(outline, FOCUS_RING_OFFSET, box)} />}
      </svg>
    );
  }
  if (shapeModule.renderMode === 'css' || !ShapeBody) return null;
  return (
    <svg
      className={s.deco}
      viewBox="0 0 100 100"
      preserveAspectRatio={shapeModule.stretches === false ? 'xMidYMid meet' : 'none'}
      aria-hidden="true"
    >
      <ShapeBody variant={variant} focused={focused} params={params} phase={phase} />
    </svg>
  );
}
