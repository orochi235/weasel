import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Slider, type Thumb, useDetents } from '@weasel-js/ui/components/Slider';
import { useState } from 'react';
import { Cell } from './Cell';

const RATES = [0.25, 0.5, 1, 2, 4];

export function SliderCells() {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 0.25 }, { value: 0.75 }]);
  const [span, setSpan] = useState<Thumb[]>([{ value: 20 }, { value: 80 }]);
  const [level, setLevel] = useState<Thumb[]>([{ value: 75 }]);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(6);
  const detents = useDetents({
    items: RATES,
    value: rate,
    onInput: setRate,
    formatLabel: (r) => `${r}×`,
  });
  return (
    <>
      <Cell label="Field, Slider">
        <Field label="Range" output={span.map((t) => Math.round(t.value)).join(' – ')}>
          <Slider
            aria-label="Range"
            min={0}
            max={100}
            step={1}
            constraint="ordered"
            thumbs={span}
            onInput={setSpan}
          />
        </Field>
        <Field label="Opacity" output={`${Math.round(level[0]?.value ?? 0)}%`}>
          <Slider
            aria-label="Opacity"
            min={0}
            max={100}
            step={1}
            thumbs={level}
            onInput={setLevel}
          />
        </Field>
        <Slider
          aria-label="Pair"
          min={0}
          max={1}
          step={0.01}
          constraint="ordered"
          thumbs={thumbs}
          onInput={setThumbs}
          readoutPlacement="inline-after"
        />
      </Cell>
      <Cell label="useDetents, InlineRange">
        <Slider aria-label="Playback rate" trackHeight={8} {...detents} />
        <InlineRange
          aria-label="Width"
          min={0}
          max={20}
          value={width}
          onChange={(event) => setWidth(Number((event.target as HTMLInputElement).value))}
        />
      </Cell>
    </>
  );
}
