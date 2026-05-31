// Visual parity check: rebuild a slice of the speech-balloons lab side panels
// using only labkit primitives. If the readouts, units, alpha, two-per-row
// effect bodies, subpanels, and accent-tinted effect cards look the same as
// the SB reference, we've captured the styling correctly.

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  EffectCard,
  EffectCardList,
  PropertyList,
  PropertyPanel,
  SelectRow,
  SliderRow,
  Subpanel,
} from './';

const meta: Meta = {
  title: 'UI/Properties/Gallery/SpeechBalloonPanels',
};
export default meta;
type Story = StoryObj;

function BodyPanel() {
  const [base, setBase] = useState<'rectangle' | 'oval' | 'polygon' | 'cloud'>('rectangle');
  const [width, setWidth] = useState(220);
  const [height, setHeight] = useState(140);
  const [lean, setLean] = useState(0);
  const [textColor, setTextColor] = useState('#e6e7ec');
  const [textAlpha, setTextAlpha] = useState(1);

  return (
    <PropertyPanel title={`Body — ${base}`}>
      <PropertyList>
        <SelectRow
          label="Base shape"
          value={base}
          onChange={(v) => setBase(v as typeof base)}
          options={[
            { value: 'rectangle', label: 'rectangle' },
            { value: 'oval', label: 'oval' },
            { value: 'polygon', label: 'polygon' },
            { value: 'cloud', label: 'cloud' },
          ]}
        />
        <SliderRow label="Width" value={width} min={60} max={500} step={2} unit="px" onChange={setWidth} />
        <SliderRow label="Height" value={height} min={20} max={500} step={2} unit="px" onChange={setHeight} />
        <SliderRow
          label="Italic lean"
          value={lean}
          min={-25}
          max={25}
          step={0.5}
          unit={<sup>°</sup>}
          onChange={setLean}
        />
        <ColorRow
          label="Text color"
          value={textColor}
          onChange={setTextColor}
          alpha={textAlpha}
          onAlphaChange={setTextAlpha}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

// A single tail's editor body — demonstrates pack='pairs' + a Subpanel
// divider for the shape-specific section (e.g. Bubbles parameters).
function TailBody() {
  const [shape, setShape] = useState<'classic' | 'bubbles' | 'lightning' | 'wavy'>('bubbles');
  const [angle, setAngle] = useState(115);
  const [outAngle, setOutAngle] = useState(0);
  const [arc, setArc] = useState(0);
  const [size, setSize] = useState(60);
  const [bubbleDiameter, setBubbleDiameter] = useState(30);
  const [count, setCount] = useState(3);
  const [gap, setGap] = useState(0.15);
  const [radial, setRadial] = useState(0);

  return (
    <PropertyList pack="pairs">
      <SelectRow
        label="Shape"
        value={shape}
        onChange={(v) => setShape(v as typeof shape)}
        options={[
          { value: 'classic', label: 'classic' },
          { value: 'bubbles', label: 'bubbles' },
          { value: 'lightning', label: 'lightning' },
          { value: 'wavy', label: 'wavy' },
        ]}
      />
      <SliderRow label="Angle" value={angle} min={0} max={359} unit={<sup>°</sup>} onChange={setAngle} />
      <SliderRow label="Tip angle" value={outAngle} min={-90} max={90} unit={<sup>°</sup>} onChange={setOutAngle} />
      <SliderRow
        label="Bend"
        value={arc}
        min={-1}
        max={1}
        step={0.02}
        format={(v) => v.toFixed(2)}
        onChange={setArc}
      />
      <SliderRow label="Length" value={size} min={8} max={220} step={0.5} unit="px" onChange={setSize} />
      {shape === 'bubbles' && (
        <Subpanel title="Bubbles">
          <SliderRow label="Size" value={bubbleDiameter} min={8} max={120} unit="px" onChange={setBubbleDiameter} />
          <SliderRow label="Count" value={count} min={1} max={8} onChange={setCount} />
          <SliderRow
            label="Gap"
            value={gap}
            min={-1}
            max={1}
            step={0.02}
            format={(v) => v.toFixed(2)}
            onChange={setGap}
          />
          <SliderRow label="Base distance" value={radial} min={-60} max={60} step={0.5} unit="px" onChange={setRadial} />
        </Subpanel>
      )}
    </PropertyList>
  );
}

function StrokePanel() {
  const [width, setWidth] = useState(2);
  const [color, setColor] = useState('#161921');
  const [alpha, setAlpha] = useState(1);
  return (
    <PropertyPanel title="Stroke">
      <PropertyList pack="pairs">
        <SliderRow
          label="Width"
          value={width}
          min={0.5}
          max={12}
          step={0.5}
          unit="px"
          format={(v) => v.toFixed(1)}
          onChange={setWidth}
        />
        <ColorRow label="Color" value={color} onChange={setColor} alpha={alpha} onAlphaChange={setAlpha} />
      </PropertyList>
    </PropertyPanel>
  );
}

function ShadowPanel() {
  const [dx, setDx] = useState(4);
  const [dy, setDy] = useState(8);
  const [blur, setBlur] = useState(10);
  const [opacity, setOpacity] = useState(0.4);
  const [enabled, setEnabled] = useState(true);
  return (
    <PropertyPanel title="Shadow">
      <PropertyList pack="pairs">
        <div className="lk-property-list__span">
          <CheckboxRow label="Enabled" value={enabled} onChange={setEnabled} />
        </div>
        <SliderRow label="Offset X" value={dx} min={-20} max={20} step={0.5} unit="px" format={(v) => v.toFixed(1)} onChange={setDx} />
        <SliderRow label="Offset Y" value={dy} min={-20} max={20} step={0.5} unit="px" format={(v) => v.toFixed(1)} onChange={setDy} />
        <SliderRow label="Blur" value={blur} min={0} max={30} step={0.5} unit="px" format={(v) => v.toFixed(1)} onChange={setBlur} />
        <SliderRow
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={setOpacity}
        />
      </PropertyList>
    </PropertyPanel>
  );
}

export const LeftSidebar: Story = {
  render: () => (
    <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <BodyPanel />
      <StrokePanel />
      <ShadowPanel />
    </div>
  ),
};

// ── Right sidebar: tails ───────────────────────────────────────────
// Each tail is an EffectCard with a per-instance accent (--lk-panel-accent)
// that re-binds --lk-accent inside the card. Drag the badge handle to reorder.

interface TailItem {
  id: number;
  shape: string;
  accent: string;
}

const TAIL_PALETTE = ['#7ec8e3', '#f0a35c', '#a48bd4', '#7fb069', '#d46aaa'];

export const RightSidebarTails: Story = {
  render: () => {
    function TailsList() {
      const [tails, setTails] = useState<TailItem[]>([
        { id: 1, shape: 'classic', accent: TAIL_PALETTE[0]! },
        { id: 2, shape: 'bubbles', accent: TAIL_PALETTE[1]! },
        { id: 3, shape: 'wavy', accent: TAIL_PALETTE[2]! },
      ]);
      const reorder = (sourceId: number, targetId: number, position: 'before' | 'after') => {
        setTails((prev) => {
          const next = prev.filter((t) => t.id !== sourceId);
          const idx = next.findIndex((t) => t.id === targetId);
          const insertAt = position === 'before' ? idx : idx + 1;
          const src = prev.find((t) => t.id === sourceId)!;
          next.splice(insertAt, 0, src);
          return next;
        });
      };
      const remove = (id: number) => setTails((prev) => prev.filter((t) => t.id !== id));
      return (
        <EffectCardList
          items={tails}
          onReorder={reorder}
          defaultExpandedIds={tails.map((t) => t.id)}
          renderItem={(tail, { cardProps }) => (
          <EffectCard
            {...cardProps}
            accent={tail.accent}
            index={tails.findIndex((t) => t.id === tail.id)}
            title={tail.shape}
            primary={<>{Math.round(60 + tail.id * 30)}°</>}
            onRemove={() => remove(tail.id)}
          >
            <TailBody />
          </EffectCard>
        )}
        />
      );
    }
    return (
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TailsList />
      </div>
    );
  },
};

// ── Effect cards without accent — for fill / stroke / shadow stacks ─

export const LayerStack: Story = {
  render: () => {
    function Stack() {
      const [items, setItems] = useState([
        { id: 1, kind: 'fill' },
        { id: 2, kind: 'stroke' },
        { id: 3, kind: 'shadow' },
      ]);
      const reorder = (sourceId: number, targetId: number, position: 'before' | 'after') => {
        setItems((prev) => {
          const next = prev.filter((t) => t.id !== sourceId);
          const idx = next.findIndex((t) => t.id === targetId);
          const insertAt = position === 'before' ? idx : idx + 1;
          const src = prev.find((t) => t.id === sourceId)!;
          next.splice(insertAt, 0, src);
          return next;
        });
      };
      return (
        <EffectCardList
          items={items}
          onReorder={reorder}
          defaultExpandedIds={items.map((i) => i.id)}
          renderItem={(item, { cardProps }) => (
            <EffectCard
              {...cardProps}
              title={item.kind}
              onRemove={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            >
              <PropertyList pack="pairs">
                <SliderRow label="Sample A" value={12} min={0} max={64} unit="px" onChange={() => {}} />
                <SliderRow label="Sample B" value={45} min={-180} max={180} unit={<sup>°</sup>} onChange={() => {}} />
              </PropertyList>
            </EffectCard>
          )}
        />
      );
    }
    return (
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Stack />
      </div>
    );
  },
};
