import { useState } from 'react';
import { linearScale, logScale, type ContinuousScale } from '@weasel-js/scale';
import { Field } from '@weasel-js/ui/components/Field';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './ScaleDemo.module.css';

const W = 560, H = 64, INSET = 24, BASE = 24;
const DOMAIN = [1, 1000] as const;
const RANGE = [INSET, W - INSET] as const;

const AXES: { name: string; scale: ContinuousScale }[] = [
  { name: 'linearScale', scale: linearScale({ domain: DOMAIN, range: RANGE }) },
  { name: 'logScale', scale: logScale({ domain: DOMAIN, range: RANGE }) },
];

function Axis({ name, scale, value }: { name: string; scale: ContinuousScale; value: number }) {
  const ticks = scale.ticks(6);
  const label = scale.tickFormat?.(6) ?? scale.format;
  const at = scale.position(value);
  return (
    <figure className={s.axis}>
      <figcaption className={s.caption}>
        <code>{name}</code>
        <span>position <output className={s.readout} aria-label={`${name} position`}>{at.toFixed(1)}</output></span>
      </figcaption>
      <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${name} axis`}>
        <line className={s.rule} x1={RANGE[0]} x2={RANGE[1]} y1={BASE} y2={BASE} />
        {ticks.map((t) => (
          <g key={t}>
            <line className={s.tick} x1={scale.position(t)} x2={scale.position(t)} y1={BASE} y2={BASE + 6} />
            <text className={s.label} x={scale.position(t)} y={BASE + 22}>{label(t)}</text>
          </g>
        ))}
        <circle className={s.marker} cx={at} cy={BASE} r={6} />
      </svg>
    </figure>
  );
}

export function ScaleDemo() {
  const [value, setValue] = useState(100);
  return (
    <div className={s.demo}>
      <Field orientation="row" label="value" output={value.toFixed(1)} className={s.field}>
        <Slider
          min={DOMAIN[0]} max={DOMAIN[1]} scale={logScale}
          thumbs={[{ value }]}
          aria-label="value"
          onInput={(ts) => setValue(ts[0]!.value)}
        />
      </Field>
      {AXES.map((a) => <Axis key={a.name} name={a.name} scale={a.scale} value={value} />)}
    </div>
  );
}
