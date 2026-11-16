import { describe, expect, it } from 'vitest';
import { SettingsFields } from './settingsFields';

describe('SettingsFields', () => {
  it('keeps paths named for Object.prototype members as data', () => {
    const fields = new SettingsFields();
    fields.add('__proto__', { polluted: true });
    fields.add('constructor.name', 'x');
    fields.add('toString', 3);
    const { values } = fields.state();
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
    expect(Object.hasOwn(values, '__proto__')).toBe(true);
    expect(values.constructor).toEqual({ name: 'x' });
    expect(values.toString).toBe(3);
  });
});
