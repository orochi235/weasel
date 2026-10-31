import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SceneCanvas, useScene } from '@weasel-js/core';
import { fixedWidth } from '@weasel-js/headless';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { useThemeOptional } from '@weasel-js/theme/react';
import { hudButton, hudMeasureEnv } from '@weasel-js/hud';
import { Button } from '@weasel-js/ui/components/Button';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import s from './widgets.stories.module.css';

interface ButtonWidgetArgs {
  label: string;
  size: 'sm' | 'md';
  width: number;
}

/** A HUD button beside the DOM `Button` it shares one measure with, at the same width. Press either. */
function ButtonWidget({ label, size, width }: ButtonWidgetArgs) {
  const hud = useHud();
  const entry = useHudContribution(hud, { font: 'sans-serif' });
  const scene = useScene<{ id: string }>({ items: [] });
  const [presses, setPresses] = useState(0);
  const tokens = useThemeOptional()?.resolved;

  useEffect(() => {
    // The widget takes its height from the shared measure, as the DOM button takes it from CSS.
    const env = hudMeasureEnv({ tokens: tokens ?? resolveTheme(weaselTheme), defaultFont: 'sans-serif' });
    const { height } = hudButton.measure({ label, size }, fixedWidth(width), env);
    const b = hud.button({ id: 'b', x: 16, y: 16, w: width, h: height, label, size });
    const onPress = () => setPresses((n) => n + 1);
    b.on('press', onPress);
    return () => b.dispose();
  }, [hud, label, size, width, tokens]);

  return (
    <div className={s.pair}>
      <SceneCanvas scene={scene} width={width + 32} height={64} ambient={[entry]} aria-label="HUD button" />
      <div className={s.dom} style={{ width }}>
        <Button size={size} fullWidth onClick={() => setPresses((n) => n + 1)}>{label}</Button>
      </div>
      <output className={s.readout}>{presses} presses</output>
    </div>
  );
}

const meta: Meta<typeof ButtonWidget> = {
  title: 'hud/ButtonWidget',
  component: ButtonWidget,
  args: { label: 'Export', size: 'md', width: 120 },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    width: { control: { type: 'range', min: 60, max: 240, step: 10 } },
  },
};
export default meta;
type Story = StoryObj<typeof ButtonWidget>;

export const Medium: Story = {};
export const Small: Story = { args: { size: 'sm', label: 'Save', width: 80 } };
