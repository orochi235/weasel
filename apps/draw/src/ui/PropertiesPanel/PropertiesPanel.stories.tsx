import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  PropertiesPanel,
  PropertyRow,
  PropertyTextInput,
  PropertyNumberInput,
  PropertyAxisInput,
  PropertyColorInput,
  PropertySelect,
  PropertyButton,
  PropertyReadOnly,
  PropertySwatchGrid,
} from './PropertiesPanel';

const meta: Meta<typeof PropertiesPanel> = {
  title: 'weasel-ui/PropertiesPanel',
  component: PropertiesPanel,
};

export default meta;
type Story = StoryObj<typeof PropertiesPanel>;

export const Empty: Story = {
  render: () => <PropertiesPanel title="Untitled" />,
};

export const SwatchGrid: Story = {
  render: () => {
    const palette = [
      '#1a1a1a', '#c64a3a', '#d4843a', '#d4c43a',
      '#5ab04a', '#3aa0c6', '#4a6fd4', '#9a4ad4',
      '#d44a9a', '#6a6a6a', '#a4a4a4', '#ffffff',
    ];
    const [color, setColor] = useState<string | null>(palette[6]);
    return (
      <PropertiesPanel title="Fill swatch">
        <PropertyRow label="Color">
          <PropertySwatchGrid
            value={color}
            onChange={setColor}
            options={palette.map((c) => ({ value: c }))}
            columns={6}
          />
        </PropertyRow>
        <PropertyRow label="Value">
          <PropertyReadOnly>{color ?? '(none)'}</PropertyReadOnly>
        </PropertyRow>
      </PropertiesPanel>
    );
  },
};

export const MixedInputs: Story = {
  render: () => {
    const [name, setName] = useState('rectangle');
    const [width, setWidth] = useState(120);
    const [posX, setPosX] = useState(20);
    const [posY, setPosY] = useState(40);
    const [fill, setFill] = useState('#4a8fd4');
    const [shape, setShape] = useState('rect');
    return (
      <PropertiesPanel title="Selection">
        <PropertyRow label="Name">
          <PropertyTextInput value={name} onChange={setName} />
        </PropertyRow>
        <PropertyRow label="Width">
          <PropertyNumberInput value={width} onChange={setWidth} min={0} max={500} step={1} span={4} />
        </PropertyRow>
        <PropertyRow label="Position">
          <PropertyAxisInput axis="X" value={posX} onChange={setPosX} step={1} />
          <PropertyAxisInput axis="Y" value={posY} onChange={setPosY} step={1} />
        </PropertyRow>
        <PropertyRow label="Fill">
          <PropertyColorInput value={fill} onChange={setFill} />
        </PropertyRow>
        <PropertyRow label="Shape">
          <PropertySelect
            value={shape}
            onChange={setShape}
            options={[
              { value: 'rect', label: 'Rectangle' },
              { value: 'ellipse', label: 'Ellipse' },
              { value: 'star', label: 'Star' },
            ]}
            span={6}
          />
        </PropertyRow>
        <PropertyRow label="ID">
          <PropertyReadOnly>obj_8a2c</PropertyReadOnly>
        </PropertyRow>
        <PropertyRow label="">
          <PropertyButton onClick={() => undefined} span={4}>Delete</PropertyButton>
        </PropertyRow>
      </PropertiesPanel>
    );
  },
};
