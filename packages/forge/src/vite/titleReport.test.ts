import { describe, expect, it } from 'vitest';
import { storyId } from '../story/ids';
import type { IndexEntry } from '../story/types';
import { titleReport } from './titleReport';

const entry = (title: string, file: string, exportName = 'Default'): IndexEntry => ({
  id: storyId(title, exportName),
  title,
  name: exportName,
  exportName,
  file,
});

describe('titleReport', () => {
  it('passes titles whose last segment is one word, spaces earlier in the title included', () => {
    const entries = [entry('ui/Bar', '/r/Bar.stories.tsx'), entry('ui/Bar', '/r/lab/BarArc.stories.tsx', 'OnAnArc'), entry('ui/Some group/Tabs', '/r/Tabs.stories.tsx')];
    expect(titleReport(entries, '/r')).toEqual({ lines: ['2 titles, each ending in a component name, and no story id declared twice'], ok: true });
  });

  it('fails a last segment holding whitespace, once per file, with the path under root', () => {
    const entries = [
      entry('ui/Along/Bar on an arc', '/r/lab/BarArc.stories.tsx', 'A'),
      entry('ui/Along/Bar on an arc', '/r/lab/BarArc.stories.tsx', 'B'),
      entry('ui/Prefs/Split\tvalues', '/r/PrefsSplit.stories.tsx'),
    ];
    const { lines, ok } = titleReport(entries, '/r');
    expect(ok).toBe(false);
    expect(lines).toEqual([
      "lab/BarArc.stories.tsx  'ui/Along/Bar on an arc'",
      "PrefsSplit.stories.tsx  'ui/Prefs/Split\tvalues'",
      expect.stringMatching(/^2 story files are titled for something other than a component/),
    ]);
  });

  it('fails two files under one title exporting the same name', () => {
    const { lines, ok } = titleReport([entry('ui/Bar', '/r/Bar.stories.tsx', 'Lab'), entry('ui/Bar', '/r/lab/BarArc.stories.tsx', 'Lab')], '/r');
    expect(ok).toBe(false);
    expect(lines).toEqual(['ui-bar--lab  declared by Bar.stories.tsx, lab/BarArc.stories.tsx', '1 story id is declared twice. Rename one of each pair\'s exports.']);
  });
});
