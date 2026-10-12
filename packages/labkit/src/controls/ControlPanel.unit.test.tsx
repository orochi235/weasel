import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(setConfig.mock.calls[0][0]).toBe('angle');
    expect(setConfig.mock.calls[0][1] as number).toBeCloseTo(Math.PI / 4, 10);
  });
});
