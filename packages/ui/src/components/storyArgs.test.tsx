import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// forge gives a story controls only when its `render` takes args, so a story whose harness holds state still has to
// pass them through to the instance it draws, and a story drawing several applies them to each, under each cell's own
// props. Each case sets one arg and looks for it in the DOM.

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

  it('LastOperationPanel AfterACommand', async () => {
    const { AfterACommand } = await import('./LastOperationPanel/LastOperationPanel.stories');
    draw(AfterACommand as Story, { closeLabel: 'Dismiss here' });
    expect(screen.getByRole('button', { name: 'Dismiss here' })).toBeInTheDocument();
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

  it.each(['HeadingInRail', 'HeadingInColumns'])('PrefsHeading %s', async (name) => {
    const mod = (await import('./Prefs/PrefsHeading.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { className: 'form-here' });
    expect(document.querySelector('.form-here')).not.toBeNull();
  });

  it.each(['CompoundKinds', 'Mixed'])('PrefKinds %s', async (name) => {
    const mod = (await import('./Prefs/PrefKinds.stories')) as unknown as Record<string, Story>;
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

type Load = () => Promise<unknown>;

describe('a story drawing several instances applies its args to each', { timeout: 30_000 }, () => {
  it.each<[string, string, Load, object, string, number]>([
    ['Button', 'Matrix', () => import('./Button/Button.stories'), { 'data-arg': 'here' }, '[data-arg="here"]', 8],
    ['Code', 'Diff', () => import('./Code/Code.stories'), { className: 'arg-here' }, '.arg-here', 3],
    ['MotifFrame', 'Motifs', () => import('./MotifFrame/MotifFrame.stories'), { className: 'arg-here' }, '.arg-here', 6],
    ['ToolPalette', 'Split', () => import('./ToolPalette/ToolPalette.stories'), { className: 'arg-here' }, '.arg-here', 2],
    ['PropertyField', 'MixedAndUnset', () => import('./Properties/PropertyField.stories'), { rowClassName: 'arg-here' }, '.arg-here', 14],
    ['PropertyControl', 'Cells', () => import('./Properties/PropertyControl.stories'), { className: 'arg-here' }, '.arg-here', 5],
  ])('%s %s', async (_, name, load, args, selector, count) => {
    draw((await load() as Record<string, Story>)[name], args);
    expect(document.querySelectorAll(selector)).toHaveLength(count);
  });

  it.each<[string, string, Load, string, number]>([
    ['NumberField', 'FitWidth', () => import('./NumberField/NumberField.stories'), 'textbox', 3],
    ['Select', 'LabelBeside', () => import('./Select/Select.stories'), 'button', 3],
  ])('%s %s', async (_, name, load, role, count) => {
    draw((await load() as Record<string, Story>)[name], { isDisabled: true });
    const fields = screen.getAllByRole(role);
    expect(fields).toHaveLength(count);
    for (const el of fields) expect(el).toBeDisabled();
  });

  it('a cell\'s own prop wins over the arg it varies', async () => {
    const { States } = await import('./Disclosure/Disclosure.stories');
    draw(States as Story, { label: 'From args', disabled: true });
    const toggles = screen.getAllByRole('button');
    expect(toggles.map((el) => el.getAttribute('aria-label'))).toEqual(['Shut', 'Open', 'Disabled']);
    for (const el of toggles) expect(el).toBeDisabled();
  });

  it('BarField Kinds, one cell per field kind', async () => {
    const { Kinds } = await import('./Bar/BarField.stories');
    draw(Kinds as Story, { disabled: true });
    const controls = [...document.querySelectorAll('input, button, select, textarea')];
    expect(controls.length).toBeGreaterThan(5);
    for (const el of controls) expect(el).toBeDisabled();
  });
});

describe('a story drawing one instance of a generic or union-typed component passes its args to it', { timeout: 30_000 }, () => {
  it.each<[string, string, Load]>([
    ['DataGrid', 'Default', () => import('./DataGrid/DataGrid.stories')],
    ['ListEditor', 'Default', () => import('./ListEditor/ListEditor.stories')],
    ['ListEditor', 'EntryKinds', () => import('./ListEditor/ListEditor.stories')],
    ['TokenField', 'Records', () => import('./TokenField/TokenField.stories')],
    ['ActionBar', 'Default', () => import('./ActionBar/ActionBar.stories')],
    ['PageTabs', 'Editable', () => import('./PageTabs/PageTabs.stories')],
    ['PrefSchemaEditor', 'Default', () => import('./PrefSchemaEditor/PrefSchemaEditor.stories')],
    ['Tree', 'Selectable', () => import('./Tree/Tree.stories')],
  ])('%s %s', async (_, name, load) => {
    draw((await load() as Record<string, Story>)[name], { className: 'arg-here' });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });
});
