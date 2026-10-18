import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// forge gives a story controls only when its `render` takes args, so a story whose harness holds state still has to
// pass them through to the instance it draws. Each case sets one arg and looks for it in the DOM.

type Render = (args: never, ctx: never) => ReactNode;
type Story = { render?: Render; args?: object };

function draw(story: Story, args: object): void {
  if (!story.render) throw new Error('story has no render');
  expect(story.render.length).toBeGreaterThan(0);
  const run = story.render;
  function Host(): ReactElement {
    return <>{run({ ...story.args, ...args } as never, {} as never)}</>;
  }
  render(<Host />);
}

const disabled = (role: string) => () => {
  for (const el of screen.getAllByRole(role)) expect(el).toBeDisabled();
};

describe('a story drawing one stateful instance passes its args to it', { timeout: 30_000 }, () => {
  it.each([
    ['Checkbox', 'Controlled', () => import('./Checkbox/Checkbox.stories'), disabled('checkbox')],
    ['Switch', 'Controlled', () => import('./Switch/Switch.stories'), disabled('switch')],
    ['NumberField', 'Controlled', () => import('./NumberField/NumberField.stories'), disabled('textbox')],
    ['Input', 'Controlled', () => import('./Input/Input.stories'), disabled('textbox')],
    ['RangeSlider', 'Controlled', () => import('./RangeSlider/RangeSlider.stories'), disabled('slider')],
    ['ComboBox', 'Controlled', () => import('./ComboBox/ComboBox.stories'), disabled('combobox')],
  ] as const)('%s %s', async (_, name, load, check) => {
    const mod = (await load()) as unknown as Record<string, Story>;
    draw(mod[name], { isDisabled: true });
    check();
  });

  it('Select Controlled', async () => {
    const { Controlled } = await import('./Select/Select.stories');
    draw(Controlled as Story, { isDisabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('SwatchGrid Default', async () => {
    const { Default } = await import('./SwatchGrid/SwatchGrid.stories');
    draw(Default as Story, { 'aria-label': 'Swatches here' });
    expect(screen.getByLabelText('Swatches here')).toBeInTheDocument();
  });

  it.each(['Empty', 'ARowPerKind', 'AnyOf', 'Groups', 'NoneOf', 'Problems', 'OverAnotherSchema'])(
    'PrefConditionEditor %s',
    async (name) => {
      const mod = (await import('./PrefConditionEditor/PrefConditionEditor.stories')) as unknown as Record<string, Story>;
      draw(mod[name], { 'aria-label': 'Visible when' });
      expect(screen.getAllByLabelText('Visible when').length).toBeGreaterThan(0);
    },
  );

  it.each(['Default', 'NoneAndTranslucent', 'Gradient'])('FillStrokeSwatch %s', async (name) => {
    const mod = (await import('./FillStrokeSwatch/FillStrokeSwatch.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { 'aria-label': 'Paints here' });
    expect(screen.getByLabelText('Paints here')).toBeInTheDocument();
  });

  it.each(['SeveralAnchors', 'OneAnchor'])('AnchorFields %s', async (name) => {
    const mod = (await import('./AnchorFields/AnchorFields.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { unit: 'furlongs' });
    expect(screen.getAllByText('furlongs').length).toBeGreaterThan(0);
  });

  it.each(['Selectable', 'Nested', 'Cards'])('LayerList %s', async (name) => {
    const mod = (await import('./LayerList/LayerList.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { title: 'Layers here' });
    expect(screen.getByRole('heading', { name: 'Layers here' })).toBeInTheDocument();
  });

  it('ToolOptionsBar FromASchema', async () => {
    const { FromASchema } = await import('./ToolOptionsBar/ToolOptionsBar.stories');
    draw(FromASchema as Story, { label: 'Pen' });
    expect(screen.getByRole('toolbar', { name: 'Pen' })).toBeInTheDocument();
  });

  it('TokenPanel Default', async () => {
    const { Default } = await import('./TokenPanel/TokenPanel.stories');
    draw(Default as Story, { className: 'tokens-here' });
    expect(document.querySelector('.tokens-here')).not.toBeNull();
  });

  it('SidebarPanel Interactive', async () => {
    const { Interactive } = await import('./SidebarPanel/SidebarPanel.stories');
    draw(Interactive as Story, { className: 'panel-here' });
    expect(document.querySelector('.panel-here')).not.toBeNull();
  });

  it.each(['Rail', 'Columns'])('PrefsHeading %s', async (name) => {
    const mod = (await import('./Prefs/PrefsHeading.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { className: 'form-here' });
    expect(document.querySelector('.form-here')).not.toBeNull();
  });

  it('CurveField DomeContour', async () => {
    const { DomeContour } = await import('./Properties/CurveField.stories');
    draw(DomeContour as Story, { height: 77 });
    expect(document.querySelector('svg[height="77"]')).not.toBeNull();
  });
});

describe('a story drawing one plain instance is args only', () => {
  it('QuantityText Muted', async () => {
    const { Muted } = await import('./QuantityText/QuantityText.stories');
    expect(Muted.render).toBeUndefined();
    expect(Muted.args).toMatchObject({ mute: true });
  });
});
