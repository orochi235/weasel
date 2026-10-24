import { describe, expect, it } from 'vitest';
import { librariesFrom, TITLE_LIBRARIES } from './library';

const UI = '/repo/packages/ui/src/components/Button/Button.stories.tsx';

describe('librariesFrom', () => {
  const libraries = librariesFrom([
    { path: '/packages/ui/', label: 'ui', tint: { ref: 'swatch-red' } },
    { path: '/packages/labkit/', label: 'labkit' },
  ]);

  it('reads the library from the file, not the title prefix', () => {
    expect(libraries.of({ title: 'ui/Foundations/Button', file: UI })).toBe('ui');
    expect(libraries.of({ title: 'Primitives/Checkbox', file: UI })).toBe('ui');
    expect(libraries.of({ title: 'Primitives/Checkbox', file: UI.replaceAll('/', '\\') })).toBe('ui');
  });

  it('falls back to the title prefix for a file under no listed library', () => {
    expect(libraries.of({ title: 'Notes/Scratch', file: '/elsewhere/Scratch.stories.tsx' })).toBe('Notes');
  });

  it('tints a library that names a tint', () => {
    expect(libraries.tintOf('ui')).toEqual({ ref: 'swatch-red' });
    expect(libraries.tintOf('labkit')).toBeUndefined();
    expect(libraries.tintOf('Notes')).toBeUndefined();
  });

  it('knows no library of its own: a project with a packages/ui is not labeled as weasel-ui', () => {
    expect(TITLE_LIBRARIES.of({ title: 'Primitives/Checkbox', file: UI })).toBe('Primitives');
    expect(TITLE_LIBRARIES.of({ title: 'Kit/Slider', file: '/repo/apps/draw/src/Slider.stories.tsx' })).toBe('Kit');
  });
});
