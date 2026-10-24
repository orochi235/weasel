import { act, fireEvent, render, screen } from '@testing-library/react';
import { type PrefLinearUnit, prefUnit } from '@weasel-js/prefs';
import { ANGLE_RADIANS } from '@weasel-js/quantity';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const DEGREES: PrefLinearUnit = { suffix: '°', scale: Math.PI / 180, precision: 1 };

const resolved = (unit: PrefLinearUnit) =>
  resolveConfigSchema(f.schema({ angle: f.number(0).input().unit(unit).label('Angle') }), []);
const throughJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('a number whose unit is data', () => {
  it.each([
    ['written out', DEGREES],
    ['built from a unit system', prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' })],
  ] as const)(
    'resolves to a leaf holding the unit as it was given, which JSON carries whole: %s',
    (_name, unit) => {
      const leaf = resolved(unit).group.children.angle as unknown as { unit: PrefLinearUnit };
      expect(leaf.unit).toEqual(unit);
      expect(throughJson(leaf.unit)).toEqual(unit);
    },
  );

  it('shows the stored value in the unit and stores what is typed converted back', () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={resolved(DEGREES)}
        config={{ angle: Math.PI / 2 }}
        setConfig={setConfig}
      />,
    );
    const field = screen.getByLabelText('Angle') as HTMLInputElement;
    expect(field.value).toBe('90');
    fireEvent.change(field, { target: { value: '45' } });
    fireEvent.blur(field);
    expect(setConfig.mock.calls[0][0]).toBe('angle');
    expect(setConfig.mock.calls[0][1] as number).toBeCloseTo(Math.PI / 4, 10);
  });
});

describe('what a row with a unit would read as auto', () => {
  const help = (unit: Parameters<ReturnType<typeof f.number>['unit']>[0]) => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            angle: f
              .number(0)
              .input()
              .unit(unit)
              .auto(() => Math.PI / 4)
              .label('Angle'),
          }),
          [],
        )}
        config={{ angle: Math.PI / 2 }}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    // React Aria only counts a hover once the pointer has moved.
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    fireEvent.pointerEnter(screen.getByText('Angle'), { pointerType: 'mouse' });
    return screen.getByRole('tooltip');
  };

  it('is quoted in the unit the field shows, with its suffix', () => {
    expect(help(DEGREES)).toHaveTextContent(/^auto 45°$/);
  });

  it('is quoted through the format of a unit that is a pair of functions', () => {
    const turns = {
      toDisplay: (stored: number) => stored / (2 * Math.PI),
      fromDisplay: (shown: number) => shown * 2 * Math.PI,
      format: (stored: number) => `${stored / (2 * Math.PI)} of a turn`,
    };
    expect(help(turns)).toHaveTextContent(/^auto 0\.125 of a turn$/);
  });
});
