import { describe, expect, it } from 'vitest';
import type { ConfigField } from '../controls/types';
import { validateConfigSchema } from './validateConfigSchema';

describe('validateConfigSchema', () => {
  it('returns valid for a well-formed schema', () => {
    const fields: ConfigField[] = [
      { key: 'freq', label: 'Frequency', type: 'slider', min: 0, max: 10, default: 5 },
      { key: 'on', label: 'On', type: 'checkbox', default: true },
    ];
    expect(validateConfigSchema(fields)).toEqual({ valid: true, errors: [] });
  });

  it('flags duplicate keys', () => {
    const fields: ConfigField[] = [
      { key: 'a', label: 'A', type: 'checkbox', default: true },
      { key: 'a', label: 'A2', type: 'checkbox', default: false },
    ];
    const r = validateConfigSchema(fields);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Duplicate config key: "a"');
  });

  it('flags unknown field type', () => {
    const fields = [
      { key: 'x', label: 'X', type: 'mystery', default: 1 },
    ] as unknown as ConfigField[];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Unknown field type: "mystery" on key "x"');
  });

  it('flags slider min >= max', () => {
    const fields: ConfigField[] = [
      { key: 's', label: 'S', type: 'slider', min: 5, max: 5, default: 5 },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Slider "s": min must be < max');
  });

  it('flags slider default outside [min, max]', () => {
    const fields: ConfigField[] = [
      { key: 's', label: 'S', type: 'slider', min: 0, max: 10, default: 99 },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Slider "s": default 99 is outside [min, max]');
  });

  it('flags select with empty options', () => {
    const fields: ConfigField[] = [
      { key: 'sel', label: 'Sel', type: 'select', default: 'a', options: [] },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Select "sel": options array must not be empty');
  });

  it('flags select with duplicate option values', () => {
    const fields: ConfigField[] = [
      {
        key: 'sel',
        label: 'Sel',
        type: 'select',
        default: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'a', label: 'A2' },
        ],
      },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Select "sel": duplicate option value "a"');
  });

  it('flags select default not in options', () => {
    const fields: ConfigField[] = [
      {
        key: 'sel',
        label: 'Sel',
        type: 'select',
        default: 'z',
        options: [{ value: 'a', label: 'A' }],
      },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Select "sel": default "z" is not among options');
  });

  it('flags non-finite slider default', () => {
    const fields: ConfigField[] = [
      { key: 's', label: 'S', type: 'slider', min: 0, max: 10, default: Number.NaN },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Field "s": default must be a finite number');
  });

  it('flags non-finite number default', () => {
    const fields: ConfigField[] = [
      { key: 'n', label: 'N', type: 'number', default: Number.POSITIVE_INFINITY },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Field "n": default must be a finite number');
  });

  it('flags empty key', () => {
    const fields: ConfigField[] = [{ key: '', label: 'L', type: 'checkbox', default: false }];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Field has empty key');
  });

  it('flags empty label', () => {
    const fields: ConfigField[] = [{ key: 'k', label: '', type: 'checkbox', default: false }];
    const r = validateConfigSchema(fields);
    expect(r.errors).toContain('Field "k" has empty label');
  });

  it('collects multiple errors in a single call', () => {
    const fields: ConfigField[] = [
      { key: 'a', label: 'A', type: 'slider', min: 10, max: 0, default: 5 },
      { key: 'a', label: 'A2', type: 'checkbox', default: true },
    ];
    const r = validateConfigSchema(fields);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
    expect(r.errors).toContain('Slider "a": min must be < max');
    expect(r.errors).toContain('Duplicate config key: "a"');
  });
});
