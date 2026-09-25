import type { Meta, StoryObj } from '@weasel-js/forge';
import { type ReactNode, useState } from 'react';
import { PropertyField } from './PropertyField';
import { PropertyList } from './PropertyPanel';
import { SideBySide } from './storyLayouts';
import s from './PropertyField.stories.module.css';

const meta: Meta<typeof PropertyField> = {
  title: 'ui/Properties/PropertyField',
  component: PropertyField,
};
export default meta;
type Story = StoryObj<typeof PropertyField>;

const ALIGN = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
] as const;
type Align = (typeof ALIGN)[number]['value'];

const BLEND = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
] as const;
type Blend = (typeof BLEND)[number]['value'];

/** One of every kind, in the layout each takes by default. */
function EveryKind({ layout }: { layout?: 'block' | 'inline' }) {
  const [visible, setVisible] = useState(true);
  const [snap, setSnap] = useState(false);
  const [opacity, setOpacity] = useState(0.65);
  const [radius, setRadius] = useState(12);
  const [name, setName] = useState('Layer 1');
  const [blend, setBlend] = useState<Blend>('normal');
  const [align, setAlign] = useState<Align>('center');
  const [fill, setFill] = useState('#b08adb');
  return (
    <PropertyList pack="one-up">
      <PropertyField kind="boolean" label="Visible" value={visible} onChange={setVisible} layout={layout} />
      <PropertyField
        kind="boolean"
        control="switch"
        label="Snap"
        value={snap}
        onChange={setSnap}
        layout={layout}
      />
      <PropertyField
        kind="number"
        control="slider"
        label="Opacity"
        value={opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={setOpacity}
        layout={layout}
      />
      <PropertyField kind="number" label="Radius" value={radius} unit="px" onChange={setRadius} layout={layout} />
      <PropertyField kind="string" label="Name" value={name} onChange={setName} layout={layout} />
      <PropertyField kind="enum" label="Blend" value={blend} options={BLEND} onChange={setBlend} layout={layout} />
      <PropertyField
        kind="enum"
        control="toggle"
        label="Align"
        value={align}
        options={ALIGN}
        onChange={setAlign}
        layout={layout}
      />
      <PropertyField kind="color" label="Fill" value={fill} onChange={setFill} layout={layout} />
    </PropertyList>
  );
}

export const BothLayouts: Story = {
  render: () => <SideBySide block={<EveryKind />} inline={<EveryKind layout="inline" />} />,
};

function Slider({ initial, ...rest }: {
  initial: number;
  label: string;
  min: number;
  max: number;
  step?: number;
  notation?: 'plain' | 'compact';
  unit?: ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return <PropertyField kind="number" control="slider" value={value} onChange={setValue} {...rest} />;
}

/** A slider's readout is editable, carries a unit, widens to the widest value
 *  its range can show, and abbreviates under `compact`. */
export const SliderReadouts: Story = {
  render: () => (
    <div className={s.column}>
      <Slider initial={12} label="Radius" min={0} max={64} unit="px" />
      <Slider initial={45} label="Angle" min={-180} max={180} unit={<sup>°</sup>} />
      <Slider initial={200_000} label="Glyphs" min={0} max={200_000} step={1000} />
      <Slider initial={2_000_000} label="Glyphs" min={0} max={2_000_000} step={1000} notation="compact" />
    </div>
  ),
};

/** `onInput` follows the drag and `onChange` fires once it ends. Drag the
 *  track, or type into the number, and watch the two counts diverge. */
export const LiveAndCommitted: Story = {
  render: () => {
    function Split() {
      const [value, setValue] = useState(40);
      const [text, setText] = useState('draft');
      const [moves, setMoves] = useState(0);
      const [commits, setCommits] = useState(0);
      const live = () => setMoves((c) => c + 1);
      const settled = () => setCommits((c) => c + 1);
      return (
        <div className={s.column}>
          <PropertyField
            kind="number"
            control="slider"
            label="Samples"
            value={value}
            min={0}
            max={100}
            onInput={(n) => {
              setValue(n);
              live();
            }}
            onChange={settled}
          />
          <PropertyField
            kind="string"
            label="Title"
            value={text}
            onInput={live}
            onChange={(next) => {
              setText(next);
              settled();
            }}
          />
          <p className={s.count}>
            {moves} live, {commits} committed
          </p>
        </div>
      );
    }
    return <Split />;
  },
};

/** `alpha` as a number is a channel of its own; `true` keeps it in the hex. */
export const ColorAlpha: Story = {
  render: () => {
    function Alphas() {
      const [fill, setFill] = useState('#7ec8e3');
      const [fillAlpha, setFillAlpha] = useState(0.65);
      const [tint, setTint] = useState('#b08adb80');
      return (
        <div className={s.wide}>
          <PropertyList>
            <PropertyField
              kind="color"
              label="Fill"
              value={fill}
              onChange={setFill}
              alpha={fillAlpha}
              onAlphaChange={setFillAlpha}
            />
            <PropertyField kind="color" label="Tint" value={tint} alpha onChange={setTint} />
          </PropertyList>
          <PropertyField
            kind="color"
            label="Flat"
            value={fill}
            onChange={setFill}
            alpha={1}
            alphaDisabled
          />
        </div>
      );
    }
    return <Alphas />;
  },
};

/** What a field shows when its sources disagree, and when they agree on
 *  holding nothing: no value chosen, in whatever form each control has. */
export const MixedAndUnset: Story = {
  render: () => {
    const ignore = () => {};
    const column = (state: { mixed?: boolean; unset?: boolean }) => (
      <PropertyList pack="one-up">
        <PropertyField kind="boolean" label="Visible" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="boolean" control="switch" label="Snap" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="number" label="Radius" value={undefined} onChange={ignore} {...state} />
        <PropertyField
          kind="number"
          control="slider"
          label="Opacity"
          value={undefined}
          min={0}
          max={1}
          step={0.01}
          onChange={ignore}
          {...state}
        />
        <PropertyField kind="string" label="Name" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="enum" label="Blend" value={undefined} options={BLEND} onChange={ignore} {...state} />
        <PropertyField kind="color" label="Fill" value={undefined} onChange={ignore} {...state} />
      </PropertyList>
    );
    return (
      <div className={s.pair}>
        <div>
          <p className={s.caption}>Mixed</p>
          {column({ mixed: true })}
        </div>
        <div>
          <p className={s.caption}>Unset</p>
          {column({ unset: true })}
        </div>
      </div>
    );
  },
};

/** The same fields drawn `bare` — the controls the row styles — and `framed`,
 *  the kit's field components. A framed number reads a unit typed into it. */
export const BareAndFramed: Story = {
  render: () => {
    function Chromes() {
      const [on, setOn] = useState(true);
      const [width, setWidth] = useState(2.5);
      const [label, setLabel] = useState('Title');
      const [blend, setBlend] = useState<Blend>('multiply');
      const [align, setAlign] = useState<Align>('left');
      const [fill, setFill] = useState('#ffb347');
      const column = (chrome: 'bare' | 'framed') => (
        <PropertyList pack="one-up">
          <PropertyField kind="boolean" chrome={chrome} label="Visible" value={on} onChange={setOn} layout="inline" />
          <PropertyField
            kind="number"
            chrome={chrome}
            label="Width"
            value={width}
            unit="cm"
            accepts={{ cm: 1, mm: 0.1, in: 2.54 }}
            onChange={setWidth}
            layout="inline"
          />
          <PropertyField kind="string" chrome={chrome} label="Label" value={label} onChange={setLabel} layout="inline" />
          <PropertyField
            kind="enum"
            chrome={chrome}
            label="Blend"
            value={blend}
            options={BLEND}
            onChange={setBlend}
            layout="inline"
          />
          <PropertyField
            kind="enum"
            control="radio"
            chrome={chrome}
            label="Align"
            value={align}
            options={ALIGN}
            onChange={setAlign}
          />
          <PropertyField kind="color" chrome={chrome} label="Fill" value={fill} onChange={setFill} layout="inline" />
        </PropertyList>
      );
      return (
        <div className={s.pair}>
          <div>
            <p className={s.caption}>Bare</p>
            {column('bare')}
          </div>
          <div>
            <p className={s.caption}>Framed</p>
            {column('framed')}
          </div>
        </div>
      );
    }
    return <Chromes />;
  },
};

/** An auto row hides its control and reads out the word; its label toggles
 *  the state. */
export const Auto: Story = {
  render: () => {
    function AutoRows() {
      const [auto, setAuto] = useState(true);
      const [gap, setGap] = useState(12);
      return (
        <div className={s.column}>
          <PropertyField
            kind="number"
            control="slider"
            label="Gap"
            value={gap}
            min={0}
            max={48}
            onChange={setGap}
            auto={auto}
            onAutoChange={setAuto}
            readout={auto ? 'auto' : undefined}
          />
        </div>
      );
    }
    return <AutoRows />;
  },
};
