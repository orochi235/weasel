import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';
import { stutters } from './headingControl';

describe('stutters', () => {
  it.each([
    ['Chuck', 'Chuck'],
    ['Surface', 'surface'],
    ['Pumping', 'Pump'],
    ['Pump', 'Pumping'],
  ])('%s over %s', (heading, label) => expect(stutters(heading, label)).toBe(true));

  it.each([
    ['Rubber', 'Rubber width'],
    ['Cut', 'Passes'],
    ['Look', 'Lo'],
    ['', ''],
  ])('not %s over %s', (heading, label) => expect(stutters(heading, label)).toBe(false));
});

describe('<ControlPanel> heading controls', () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const pump = () =>
    resolveConfigSchema(
      f.schema({
        on: f.boolean(false).label('Pump').manual(),
        lobes: f
          .number(6)
          .label('Lobes')
          .manual()
          .showIf((c) => c.on === true),
      }),
    );

  it('draws a first row repeating the panel title in the title row, and warns once', () => {
    const schema = pump();
    const { rerender } = render(
      <ControlPanel
        schema={schema}
        title="Pumping"
        config={{ on: false, lobes: 6 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Pumping' })).toBeInTheDocument();
    expect(screen.queryByText('Pump')).toBeNull();
    rerender(
      <ControlPanel
        schema={schema}
        title="Pumping"
        config={{ on: true, lobes: 6 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByText('Lobes')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/"Pump" \(on\) repeats its heading "Pumping"/);
  });

  it('lifts a leaf marked .heading() without warning, whatever its label', () => {
    const schema = resolveConfigSchema(
      f.schema({
        kind: f.enum<string>('none', ['none', 'eccentric']).label('Kind').heading().manual(),
        eccentricity: f.number(8).label('Eccentricity').manual(),
      }),
    );
    render(
      <ControlPanel
        schema={schema}
        title="Chuck"
        config={{ kind: 'none', eccentricity: 8 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'none Chuck' })).toBeInTheDocument();
    expect(screen.queryByText('Kind')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('lifts into a section heading and a group heading', () => {
    const schema = resolveConfigSchema(
      f.schema({
        surface: f
          .enum<string>('flat', ['flat', 'dome'])
          .label('Surface')
          .section('Surface')
          .manual(),
        radius: f.number(10).label('Radius').section('Surface').manual(),
        grid: f
          .group({ show: f.boolean(true).label('Grid').manual(), size: f.number(8).manual() })
          .label('Grid'),
      }),
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ surface: 'flat', radius: 10, grid: { show: true, size: 8 } }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'flat Surface' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Grid' })).toBeInTheDocument();
    expect(screen.getAllByText('Surface')).toHaveLength(1);
    expect(screen.getAllByText('Grid')).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('warns but keeps the row when the stuttering control is too big for a heading', () => {
    const schema = resolveConfigSchema(
      f.schema({ rubber: f.number(8).range(0, 20).label('Rubber').manual() }),
    );
    render(
      <ControlPanel schema={schema} title="Rubber" config={{ rubber: 8 }} setConfig={vi.fn()} />,
    );
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(warn.mock.calls[0][0]).toMatch(/Give it a label of its own/);
  });

  it('leaves a label that only starts with the heading alone', () => {
    const schema = resolveConfigSchema(
      f.schema({ width: f.number(8).label('Rubber width').manual() }),
    );
    render(
      <ControlPanel schema={schema} title="Rubber" config={{ width: 8 }} setConfig={vi.fn()} />,
    );
    expect(screen.getByText('Rubber width')).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});
