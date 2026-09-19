import { describe, expect, it } from 'vitest';
import { sanitize, storyId, storyNameFromExport } from './ids';

// Expected values were produced by storybook/internal/csf 10.4.0 itself.
describe('story ids', () => {
  it.each([
    ['ui/Slider', 'ui-slider'],
    ['WithName', 'withname'],
    ['Über Knöpfe', 'über-knöpfe'],
    ['a  b--c', 'a-b-c'],
    ['Tab\there', 'tab\there'],
    ['weird§chars', 'weird§chars'],
    ['日本', '日本'],
  ])('sanitizes %j as Storybook does', (input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });

  it('joins title and export with a double dash', () => {
    expect(storyId('ui/Slider', 'WithName')).toBe('ui-slider--withname');
  });

  it('rejects a part with nothing left after sanitizing', () => {
    expect(() => storyId('!!!', 'A')).toThrow("Invalid kind '!!!', must include alphanumeric characters");
  });

  it.each([
    ['PrimaryButton', 'Primary Button'],
    ['withIcon2', 'With Icon 2'],
    ['ABCButton', 'ABC Button'],
    ['with_under', 'With Under'],
    ['kebab-case', 'Kebab Case'],
  ])('names export %j as Storybook does', (input, expected) => {
    expect(storyNameFromExport(input)).toBe(expected);
  });
});
