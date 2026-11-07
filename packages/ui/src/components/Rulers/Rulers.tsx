import { useSyncExternalStore, type ReactElement } from 'react';
import type { RulerTicks, Rulers as RulersModel } from '@weasel-js/guides';
import s from './Rulers.module.css';

/** Props for {@link Rulers}. */
export interface RulersProps {
  /** What `createRulers` returned; its contribution installed on the canvas. */
  rulers: RulersModel;
  /** Additional class for the root, which covers its positioned container. */
  className?: string;
}

const MINOR = 0.35;
const crisp = (n: number): number => Math.round(n) + 0.5;

/** One ruler's tick marks as path data: each tick crosses the strip from its
 *  inner edge, a labeled one all the way. */
function tickPath(ticks: RulerTicks, size: number, across: 'x' | 'y'): string {
  return ticks.ticks.map(({ at, major }) => {
    const a = crisp(at);
    const from = major ? 0 : size * (1 - MINOR);
    return across === 'y' ? `M${a} ${from}V${size}` : `M${from} ${a}H${size}`;
  }).join('');
}

/**
 * Rulers along the top and left of a canvas, with a box in the corner naming
 * the unit they read in: the chrome half of `createRulers` from
 * `@weasel-js/guides`, whose contribution follows the view and takes the drags
 * that place guides. Place it in the canvas's positioned container; it covers
 * it and passes every pointer event through to the canvas below.
 */
export function Rulers({ rulers, className }: RulersProps): ReactElement | null {
  const state = useSyncExternalStore(rulers.subscribe, rulers.get, rulers.get);
  const layout = rulers.layout();
  if (layout === null) return null;
  const { size } = rulers;
  const { width, height } = state;
  const { top, left, pointer } = layout;
  const mid = size / 2;
  return (
    <div className={[s.rulers, className].filter(Boolean).join(' ')} aria-hidden="true" data-unit={top.unit}>
      <svg className={s.strip} width={width} height={size}>
        <path className={s.ticks} d={tickPath(top, size, 'y')} />
        {top.ticks.map((t) => t.label === undefined ? null : (
          <text key={t.at} className={s.label} x={t.at + 3} y={mid * 0.8}>{t.label}</text>
        ))}
        {pointer && <line className={s.pointer} x1={crisp(pointer.x)} x2={crisp(pointer.x)} y1={0} y2={size} />}
        <line className={s.edge} x1={0} x2={width} y1={size - 0.5} y2={size - 0.5} />
      </svg>
      <svg className={s.strip} width={size} height={height}>
        <path className={s.ticks} d={tickPath(left, size, 'x')} />
        {left.ticks.map((t) => t.label === undefined ? null : (
          <text key={t.at} className={s.label} x={mid * 0.8} y={t.at + 3} textAnchor="end" transform={`rotate(-90 ${mid * 0.8} ${t.at + 3})`}>{t.label}</text>
        ))}
        {pointer && <line className={s.pointer} x1={0} x2={size} y1={crisp(pointer.y)} y2={crisp(pointer.y)} />}
        <line className={s.edge} x1={size - 0.5} x2={size - 0.5} y1={0} y2={height} />
      </svg>
      <svg className={s.strip} width={size} height={size}>
        <text className={s.unit} x={mid} y={mid}>{top.unit}</text>
        <path className={s.edge} d={`M0 ${size - 0.5}H${size - 0.5}V0`} />
      </svg>
    </div>
  );
}
