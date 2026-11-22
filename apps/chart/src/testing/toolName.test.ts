import { describe, expect, it } from 'vitest';
import { toolButtonName } from './toolName';

describe('toolButtonName', () => {
  it('matches a name holding pattern characters literally', () => {
    expect(toolButtonName('Text (T)').test('Text (T) T')).toBe(true);
    expect(toolButtonName('Text (T)').test('Text T')).toBe(false);
    expect(toolButtonName('a.b').test('axb')).toBe(false);
  });
});
