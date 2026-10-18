import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Badge } from '../Badge';
import { InlineRange } from '../../InlineRange';
import type { BadgeStatus } from '../types';
import { Field } from './ParamControl';
import type { LabSnapshot } from './snapshot';
import { effectSpecs } from './transitions';
import controls from './controls.stories.module.css';
import s from './ComposeLab.stories.module.css';

/** The `style` that feeds a badge its `custom` status color. */
export function customEdge(status: BadgeStatus, color: string): CSSProperties | undefined {
  return status === 'custom' ? ({ ['--badge-edge' as never]: color }) : undefined;
}

type Shown = Pick<
  LabSnapshot,
  | 'base' | 'baseParams' | 'labEffects' | 'status' | 'customColor' | 'variant' | 'bloat' | 'size' | 'label'
  | 'crawlOn' | 'crawlSpeed' | 'labelX' | 'labelY' | 'zoom' | 'padTop' | 'padRight' | 'padBottom' | 'padLeft'
  | 'fontFamily' | 'fontSizeDelta' | 'bold' | 'italic' | 'caps'
>;

function labelStyle(lab: Shown): CSSProperties {
  return {
    transform: `translate(${lab.labelX}px, ${lab.labelY}px)`,
    fontFamily: lab.fontFamily === 'inherit' ? undefined : lab.fontFamily,
    fontSize: lab.fontSizeDelta !== 0 ? `calc(1em + ${lab.fontSizeDelta}px)` : undefined,
    fontWeight: lab.bold ? 700 : undefined,
    fontStyle: lab.italic ? 'italic' : undefined,
    fontVariantCaps: lab.caps !== 'normal' ? lab.caps : undefined,
  };
}

/** The lab's badge, scaled by `zoom` inside a box that grows to hold the scaled size, and the zoom slider under it. */
export function Preview({ lab, onZoom }: { lab: Shown; onZoom: (zoom: number) => void }) {
  const { base, baseParams, labEffects, variant, status, bloat, label, zoom } = lab;
  const scaledRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = scaledRef.current;
    if (!el) return;
    // offsetWidth/offsetHeight are the layout box, which a transform does not change.
    const measure = () => {
      setNatural({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [base, baseParams, labEffects, variant, status, bloat, label]);

  const box: CSSProperties = {
    width: natural.w > 0 ? natural.w * zoom : undefined,
    height: natural.h > 0 ? natural.h * zoom : undefined,
    minHeight: Math.max(40, 40 * zoom),
  };
  return (
    <>
      <div className={s.stage}>
        <div className={s.stageBox} style={box}>
          <div ref={scaledRef} className={s.stageScaled} style={{ transform: `scale(${zoom})` }}>
            <Badge
              base={base}
              baseParams={baseParams as never}
              effects={effectSpecs(labEffects)}
              status={status}
              variant={variant}
              bloat={bloat}
              size={lab.size}
              padding={`${lab.padTop}px ${lab.padRight}px ${lab.padBottom}px ${lab.padLeft}px`}
              crawl={lab.crawlOn ? lab.crawlSpeed : undefined}
              style={customEdge(status, lab.customColor)}
            >
              <span className={s.labelText} style={labelStyle(lab)}>{label}</span>
            </Badge>
          </div>
        </div>
      </div>
      <Field label="zoom" columns={s.zoom}>
        <InlineRange className={controls.fill} min={1} max={6} step={0.1} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} />
        <span className={controls.label}>{zoom.toFixed(1)}×</span>
      </Field>
    </>
  );
}
