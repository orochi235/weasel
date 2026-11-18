import {
  PropertyField,
  PropertyGroup,
  PropertyList,
  PropertyPanel,
} from '@weasel-js/ui/components/Properties';
import { useState } from 'react';
import { Cell } from './Cell';

export function ShapePanelCell() {
  const [opacity, setOpacity] = useState(0.8);
  const [radius, setRadius] = useState(12);
  const [fill, setFill] = useState('#5841b8');
  const [alpha, setAlpha] = useState(1);
  const [stroke, setStroke] = useState('#2ec27e');
  const [count, setCount] = useState(8);
  const [cap, setCap] = useState('round');
  const [side, setSide] = useState('center');
  const [label, setLabel] = useState('Badge');
  const [visible, setVisible] = useState(true);
  return (
    <Cell label="PropertyPanel">
      <PropertyPanel title="Shape">
        <PropertyList>
          <PropertyField
            kind="number"
            control="slider"
            label="Opacity"
            value={opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={setOpacity}
          />
          <PropertyField
            kind="number"
            control="slider"
            label="Radius"
            value={radius}
            min={0}
            max={64}
            unit="px"
            onChange={setRadius}
          />
          <PropertyField
            kind="color"
            label="Fill"
            value={fill}
            onChange={setFill}
            alpha={alpha}
            onAlphaChange={setAlpha}
          />
          <PropertyField kind="color" label="Stroke" value={stroke} onChange={setStroke} />
          <PropertyField
            kind="number"
            label="Count"
            value={count}
            min={0}
            max={100}
            step={1}
            onChange={setCount}
          />
          <PropertyField
            kind="enum"
            label="Line cap"
            value={cap}
            onChange={setCap}
            options={[
              { value: 'butt', label: 'Butt' },
              { value: 'round', label: 'Round' },
            ]}
          />
          <PropertyField
            kind="enum"
            control="toggle"
            label="Align"
            value={side}
            onChange={setSide}
            options={[
              { value: 'left', label: 'L' },
              { value: 'center', label: 'C' },
              { value: 'right', label: 'R' },
            ]}
          />
          <PropertyField kind="string" label="Label" value={label} onChange={setLabel} />
          <PropertyField kind="boolean" label="Visible" value={visible} onChange={setVisible} />
          <PropertyGroup title="Bevel" defaultCollapsed>
            <PropertyField
              kind="number"
              control="slider"
              label="Rings"
              value={32}
              min={4}
              max={96}
              step={1}
              onChange={() => {}}
            />
          </PropertyGroup>
        </PropertyList>
      </PropertyPanel>
    </Cell>
  );
}
