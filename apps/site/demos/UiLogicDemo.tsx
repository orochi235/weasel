import { useMemo, useState } from 'react';
import { expandVars } from '@weasel-js/theme';
import { useTints } from '@weasel-js/theme/react';
import { measureButton, UNBOUNDED, type ButtonSize, type FontSpec, type MeasureEnv } from '@weasel-js/ui-logic';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Field } from '@weasel-js/ui/components/Field';
import { Icon } from '@weasel-js/ui/components/Icon';
import { Input } from '@weasel-js/ui/components/Input';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { Slider } from '@weasel-js/ui/components/Slider';
import { icon } from '../icons.gen';
import s from './UiLogicDemo.module.css';

const SIZES: { value: ButtonSize; label: string }[] = [
  { value: 'xs', label: 'xs' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
];

const STAR = icon('shape:star');

const SCALE = 2;
const PAD = 8;

let context: CanvasRenderingContext2D | null | undefined;

function measureText(text: string, font: FontSpec) {
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) return { width: 0, ascent: font.size * 0.8, descent: font.size * 0.2 };
  context.font = `${font.weight ?? 400} ${font.size}px ${font.family ?? 'sans-serif'}`;
  const m = context.measureText(text);
  return { width: m.width, ascent: m.fontBoundingBoxAscent ?? font.size * 0.8, descent: m.fontBoundingBoxDescent ?? font.size * 0.2 };
}

/** A target with no CSS of its own, as a canvas is: tokens from the theme's resolved record, text from a 2D context. */
function useThemeMeasureEnv(): MeasureEnv {
  const { resolved } = useTints();
  return useMemo(() => {
    const tokens = resolved as Readonly<Record<string, string>>;
    return {
      token: (name) => (Object.hasOwn(tokens, name) ? expandVars(tokens[name]!, tokens) : undefined),
      text: measureText,
    };
  }, [resolved]);
}

export function UiLogicDemo() {
  const env = useThemeMeasureEnv();
  const [label, setLabel] = useState('Export');
  const [size, setSize] = useState<ButtonSize>('md');
  const [leading, setLeading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [maxWidth, setMaxWidth] = useState(240);

  const face = { label, size, leadingIcon: leading ? 'star' : undefined, loading };
  const { width, height, layout } = measureButton(face, { ...UNBOUNDED, maxWidth }, env);

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <Input aria-label="Label" value={label} onChange={setLabel} className={s.label} />
        <SegmentedBar aria-label="Size" size="sm" items={SIZES} value={size} onChange={(v) => v && setSize(v)} />
        <Checkbox isSelected={leading} onChange={setLeading}>leading icon</Checkbox>
        <Checkbox isSelected={loading} onChange={setLoading}>loading</Checkbox>
      </div>
      <Field label="max width" orientation="row" output={`${maxWidth} px`}>
        <Slider min={40} max={240} step={1} thumbs={[{ value: maxWidth }]} onInput={(ts) => setMaxWidth(ts[0]!.value)} readoutPlacement="none" />
      </Field>
      <svg
        className={s.drawing}
        width={(width + PAD * 2) * SCALE}
        height={(height + PAD * 2 + 10) * SCALE}
        viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2 + 10}`}
        role="img"
        aria-label={`measured ${width.toFixed(1)} by ${height.toFixed(1)}`}
      >
        <rect className={s.box} width={width} height={height} rx={3} />
        {layout.parts.map(({ part, rect }) => (
          <g key={part}>
            <rect className={s.part} x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
            <text className={s.partName} x={rect.x} y={height + 7}>{part}</text>
          </g>
        ))}
      </svg>
      <div className={s.dom}>
        <Button size={size} loading={loading} leadingIcon={leading ? <Icon name={STAR} size={14} /> : undefined}>
          {label}
        </Button>
        <span className={s.readout}>measureButton: {width.toFixed(1)} × {height.toFixed(1)}</span>
      </div>
    </div>
  );
}
