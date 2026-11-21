import { useId, type RefObject } from 'react';
import s from './Badge.module.css';
import { EFFECTS, type BadgeEffectSpec } from './effects';
import { composeOutline, effectParams, offsetOutline, outlineRegion } from './composeOutline';
import type { ComposeSpec } from './composeSpec';
import type { BadgeVariant, ShapeModule } from './types';
import { registryEntry } from './registryEntry';

/** CSS px between a composed badge's outline and its focus ring. */
const FOCUS_RING_OFFSET = 2;

interface BadgeDecoProps {
  svgRef: RefObject<SVGSVGElement | null>;
  compose: ComposeSpec;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as the SHAPES registry types it.
  shapeModule: ShapeModule<any>;
  params: unknown;
  box: { width: number; height: number };
  bloat: number;
  variant: BadgeVariant;
  focused: boolean;
  phase: number;
}

/** The SVG behind a badge's label: a composed outline with its effect layers, or the shape's own drawing. */
export function BadgeDeco({ svgRef, compose, shapeModule, params, box, bloat, variant, focused, phase }: BadgeDecoProps) {
  const bodyMaskId = `badge-mask-${useId().replace(/:/g, '')}`;
  const sampler = compose.base ? compose.base.build(compose.baseParams, box.width, box.height) : null;
  const outline = sampler ? composeOutline(sampler, compose.effects, bloat, box, phase) : null;
  const ShapeBody = shapeModule.Component;

  if (compose.base && outline) {
    const decoEffects = (compose.effects ?? []).filter((eff) => registryEntry(EFFECTS, eff.type)?.Component);
    const zoneOf = (eff: BadgeEffectSpec) => EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground';
    const background = decoEffects.filter((eff) => zoneOf(eff) === 'background');
    const foreground = decoEffects.filter((eff) => zoneOf(eff) === 'foreground');
    const mask = decoEffects.filter((eff) => zoneOf(eff) === 'mask');
    const render = (eff: BadgeEffectSpec, i: number) => {
      const mod = registryEntry(EFFECTS, eff.type);
      const EffComponent = mod?.Component;
      if (!EffComponent) return null;
      const effParams = effectParams(mod, eff);
      return <EffComponent key={`${eff.type as string}-${i}`} sampler={outline} boxW={box.width} boxH={box.height} variant={variant} params={effParams} phase={phase} />;
    };
    const region = mask.length > 0 ? outlineRegion(outline, 10) : null;
    return (
      <svg ref={svgRef} className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {region && (
          <defs>
            <mask id={bodyMaskId} maskUnits="userSpaceOnUse" {...region}>
              <rect {...region} fill="white" />
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
