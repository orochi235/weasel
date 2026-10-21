import { describe, expect, it } from 'vitest';
import { paramValues } from './params';

describe('paramValues', () => {
  it('keys by id else label, preferring the control value', () => {
    expect(
      paramValues({
        id: 's',
        title: 'S',
        params: [
          { id: 'f', label: 'freq', value: '440 Hz', control: { kind: 'number', value: 440 } },
          { label: 'note', value: 'A4' },
        ],
      }),
    ).toEqual({ f: 440, note: 'A4' });
  });
});
