import { describe, expect, it } from 'vitest';
import { storyId } from '../story/ids';
import type { IndexEntry } from '../story/types';
import { folderTitleReport, folderTitles } from './folderTitles';

const RULE = { library: 'ui', src: 'pkg/ui/src', components: 'components' };
const EXPORTS: Record<string, string[]> = { Keycaps: ['KeyCap', 'KeySequence'], Slider: ['Slider'], 'inspector/SelectionPanel': ['SelectionPanel'] };
const exportsOf = (folder: string) => new Set(EXPORTS[folder] ?? []);
const fits = (rel: string, title: string) => folderTitles(rel, RULE, exportsOf)?.fits(title);

const entry = (title: string, file: string): IndexEntry => ({ id: storyId(title, 'Default'), title, name: 'Default', exportName: 'Default', file });

describe('folderTitles', () => {
  it('takes the folder for a file named for it, an aspect after a dot aside', () => {
    expect(fits('pkg/ui/src/components/Slider/Slider.stories.tsx', 'ui/Slider')).toBe(true);
    expect(fits('pkg/ui/src/components/Slider/Slider.detents.stories.tsx', 'ui/Slider')).toBe(true);
    expect(fits('pkg/ui/src/components/Slider/Slider.stories.tsx', 'ui/Foundations/Slider')).toBe(false);
  });

  it('takes the folder and an export for a file named for that export', () => {
    expect(fits('pkg/ui/src/components/Keycaps/KeySequence.stories.tsx', 'ui/Keycaps/KeySequence')).toBe(true);
    expect(fits('pkg/ui/src/components/Keycaps/Keycaps.stories.tsx', 'ui/Keycaps/KeySequence')).toBe(false);
    expect(fits('pkg/ui/src/components/Keycaps/KeyBank.stories.tsx', 'ui/Keycaps/KeyBank')).toBe(false);
    expect(folderTitles('pkg/ui/src/components/Keycaps/KeyBank.stories.tsx', RULE, exportsOf)?.expected).toBe('ui/Keycaps/KeyBank');
  });

  it('lets a lab story take its folder or one of its exports, whatever its file is named', () => {
    expect(fits('pkg/ui/src/components/Slider/lab/SliderArc.stories.tsx', 'ui/Slider')).toBe(true);
    expect(fits('pkg/ui/src/components/Keycaps/lab/Arc.stories.tsx', 'ui/Keycaps/KeyCap')).toBe(true);
    expect(fits('pkg/ui/src/components/Keycaps/lab/Arc.stories.tsx', 'ui/Keycaps/Arc')).toBe(false);
  });

  it('reads a lowercase group and the next folder as one folder', () => {
    expect(fits('pkg/ui/src/components/inspector/SelectionPanel/SelectionPanel.stories.tsx', 'ui/inspector/SelectionPanel')).toBe(true);
    expect(fits('pkg/ui/src/components/inspector/SelectionPanel/SelectionPanel.stories.tsx', 'ui/SelectionPanel')).toBe(false);
  });

  it('titles a story outside the component folders for its directory, and leaves other paths alone', () => {
    expect(fits('pkg/ui/src/cursors/cursors.stories.tsx', 'ui/cursors')).toBe(true);
    expect(fits('pkg/ui/src/cursors/cursors.stories.tsx', 'ui/Cursors/Gallery')).toBe(false);
    expect(folderTitles('pkg/labkit/src/Lab.stories.tsx', RULE, exportsOf)).toBeNull();
  });
});

describe('folderTitleReport', () => {
  it('lists each file once with the title it should take', () => {
    const entries = [
      entry('ui/Foundations/Slider', '/r/pkg/ui/src/components/Slider/Slider.stories.tsx'),
      entry('ui/Foundations/Slider', '/r/pkg/ui/src/components/Slider/Slider.stories.tsx'),
      entry('ui/Keycaps/KeySequence', '/r/pkg/ui/src/components/Keycaps/KeySequence.stories.tsx'),
    ];
    const { lines, ok } = folderTitleReport(entries, RULE, exportsOf, '/r');
    expect(ok).toBe(false);
    expect(lines[0]).toBe("pkg/ui/src/components/Slider/Slider.stories.tsx  'ui/Foundations/Slider' → 'ui/Slider'");
    expect(lines).toHaveLength(2);
  });

  it('passes when every covered file fits', () => {
    expect(folderTitleReport([entry('ui/Slider', '/r/pkg/ui/src/components/Slider/Slider.stories.tsx')], RULE, exportsOf, '/r')).toEqual({ lines: [], ok: true });
  });
});
