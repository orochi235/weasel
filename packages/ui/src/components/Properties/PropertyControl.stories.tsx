import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { PropertyControl, type PropertyControlProps } from '@weasel-js/ui/components/Properties';
import s from './PropertyField.stories.module.css';

const meta: Meta<typeof PropertyControl> = {
  title: 'ui/Properties/PropertyControl',
  component: PropertyControl,
};
export default meta;
type Story = StoryObj<typeof PropertyControl>;

// What every kind of field takes: each field the story draws sets its own kind and value.
type Shared = Partial<Omit<PropertyControlProps, 'kind' | 'value' | 'onChange' | 'onInput' | 'control'>>;

/** Controls with no row around them, several to a line — what a paired row or
 *  a tool options strip holds. A slider brings its readout beside the track. */
export const Cells: Story = {
  render: (args) => {
    function Line() {
      const [x, setX] = useState(24);
      const [y, setY] = useState(48);
      const [size, setSize] = useState(40);
      const [bold, setBold] = useState(true);
      const [fill, setFill] = useState('#7ec8e3');
      return (
        <div className={s.column}>
          <div className={s.cell}>
            <PropertyControl {...(args as Shared)} kind="number" name="X" value={x} onChange={setX} />
            <PropertyControl {...(args as Shared)} kind="number" name="Y" value={y} onChange={setY} />
          </div>
          <div className={s.cell}>
            <PropertyControl {...(args as Shared)} kind="number" control="slider" name="Size" value={size} min={0} max={100} onChange={setSize} />
          </div>
          <div className={s.cell}>
            <PropertyControl {...(args as Shared)} kind="boolean" control="toggle" name="Bold" glyph="B" value={bold} onChange={setBold} />
            <PropertyControl {...(args as Shared)} kind="color" name="Fill" value={fill} onChange={setFill} />
          </div>
        </div>
      );
    }
    return <Line />;
  },
};

/** A multi-selection whose nodes disagree: every cell shows no value. */
export const Mixed: Story = {
  render: (args) => {
    const ignore = () => {};
    return (
      <div className={s.column}>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="number" name="X" value={undefined} mixed onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="boolean" control="switch" name="Visible" value={undefined} mixed onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="color" name="Fill" value={undefined} mixed onChange={ignore} />
          <PropertyControl {...(args as Shared)}
            kind="number"
            control="slider"
           
            name="Opacity"
            value={undefined}
            mixed
            min={0}
            max={1}
            step={0.01}
            onChange={ignore}
          />
        </div>
      </div>
    );
  },
};

/** Every kind taking no input, each element of it disabled and still showing its value. */
export const Disabled: Story = {
  render: (args) => {
    const ignore = () => {};
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ];
    return (
      <div className={s.column}>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="number" name="X" value={24} steppers disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="string" name="Title" value="Untitled" disabled onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="number" control="slider" name="Size" value={40} min={0} max={100} disabled onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="boolean" name="Visible" value disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="boolean" control="switch" name="Snap" value disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="boolean" control="toggle" name="Bold" glyph="B" value disabled onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="enum" name="Mode" value="a" options={options} disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="enum" control="menu" name="Menu" value="a" options={options} disabled onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="enum" control="toggle" name="Segments" value="a" options={options} disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="enum" control="radio" name="Radios" value="a" options={options} disabled onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl {...(args as Shared)} kind="color" name="Fill" value="#7ec8e3" alpha disabled onChange={ignore} />
          <PropertyControl {...(args as Shared)} kind="paint" name="Paint" value={{ color: '#7ec8e3' }} disabled onChange={ignore} />
        </div>
      </div>
    );
  },
};
