import type { Paint } from '@weasel-js/core';
import { ColorField } from '@weasel-js/ui/components/ColorField';
import { ComboBox } from '@weasel-js/ui/components/ComboBox';
import { GradientEditor } from '@weasel-js/ui/components/GradientEditor';
import { Input } from '@weasel-js/ui/components/Input';
import { NumberField } from '@weasel-js/ui/components/NumberField';
import { PaintInput } from '@weasel-js/ui/components/PaintInput';
import { Select } from '@weasel-js/ui/components/Select';
import { useState } from 'react';
import { Cell } from './Cell';
import { Section } from './Section';
import { SliderCells } from './SliderCells';

export function FieldsAndPickers() {
  const [color, setColor] = useState('#b08adbff');
  const [gradient, setGradient] = useState<Paint>({
    kind: 'linear-gradient',
    from: { x: 0.1, y: 0.1 },
    to: { x: 0.9, y: 0.9 },
    stops: [
      { offset: 0, color: '#0fb5a8' },
      { offset: 1, color: '#f4c43c' },
    ],
  });
  const [paint, setPaint] = useState<Paint | null>({ kind: 'solid', color: '#b08adb' });
  return (
    <Section title="Fields & pickers">
      <Cell label="Input">
        <Input label="Name" placeholder="e.g. Pico" />
        <Input
          label="Size"
          leadingAdornment={<span>W</span>}
          trailingAdornment={<span>px</span>}
          defaultValue="120"
        />
        <Input label="Required" invalid errorMessage="Name is required." />
      </Cell>
      <Cell label="NumberField, Select, ComboBox">
        <NumberField label="Opacity" minValue={0} maxValue={100} step={5} defaultValue={80} />
        <Select
          label="Color"
          defaultSelectedKey="g"
          options={[
            { value: 'r', label: 'Red' },
            { value: 'g', label: 'Green' },
            { value: 'b', label: 'Blue' },
          ]}
        />
        <ComboBox
          label="Filter"
          placeholder="Type to filter…"
          options={[
            { value: 'r', label: 'Red' },
            { value: 'g', label: 'Green' },
          ]}
        />
      </Cell>
      <SliderCells />
      <Cell label="ColorField, GradientEditor">
        <ColorField value={color} alpha onInput={setColor} onChange={setColor} aria-label="Color" />
        <GradientEditor value={gradient} onInput={setGradient} onChange={setGradient} kindSwitch />
      </Cell>
      <Cell label="PaintInput">
        <PaintInput
          value={paint}
          onInput={setPaint}
          onChange={setPaint}
          allowNone
          aria-label="Fill"
        />
      </Cell>
    </Section>
  );
}
