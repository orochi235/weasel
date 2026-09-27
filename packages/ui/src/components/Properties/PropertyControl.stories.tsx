import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { PropertyControl } from './PropertyField';
import s from './PropertyField.stories.module.css';

const meta: Meta<typeof PropertyControl> = {
  title: 'ui/Properties/PropertyControl',
  component: PropertyControl,
};
export default meta;
type Story = StoryObj<typeof PropertyControl>;

/** Controls with no row around them, several to a line — what a paired row or
 *  a tool options strip holds. A slider brings its readout beside the track. */
export const Cells: Story = {
  render: () => {
    function Line() {
      const [x, setX] = useState(24);
      const [y, setY] = useState(48);
      const [size, setSize] = useState(40);
      const [bold, setBold] = useState(true);
      const [fill, setFill] = useState('#7ec8e3');
      return (
        <div className={s.column}>
          <div className={s.cell}>
            <PropertyControl kind="number" name="X" value={x} onChange={setX} />
            <PropertyControl kind="number" name="Y" value={y} onChange={setY} />
          </div>
          <div className={s.cell}>
            <PropertyControl kind="number" control="slider" name="Size" value={size} min={0} max={100} onChange={setSize} />
          </div>
          <div className={s.cell}>
            <PropertyControl kind="boolean" control="toggle" name="Bold" glyph="B" value={bold} onChange={setBold} />
            <PropertyControl kind="color" name="Fill" value={fill} onChange={setFill} />
          </div>
        </div>
      );
    }
    return <Line />;
  },
};

/** A multi-selection whose nodes disagree: every cell shows no value. */
export const Mixed: Story = {
  render: () => {
    const ignore = () => {};
    return (
      <div className={s.column}>
        <div className={s.cell}>
          <PropertyControl kind="number" name="X" value={undefined} mixed onChange={ignore} />
          <PropertyControl kind="boolean" control="switch" name="Visible" value={undefined} mixed onChange={ignore} />
        </div>
        <div className={s.cell}>
          <PropertyControl kind="color" name="Fill" value={undefined} mixed onChange={ignore} />
          <PropertyControl
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
