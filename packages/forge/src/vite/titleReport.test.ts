import type { Logger } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { storyId } from '../story/ids';
import type { IndexEntry } from '../story/types';
import { titleReport, warnShared } from './titleReport';

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

  it('prints a file outside root relative to it, not as a sibling directory cut at the prefix', () => {
    const { lines } = titleReport([entry('ui/Bar on an arc', '/r2/Bar.stories.tsx')], '/r');
    expect(lines[0]).toBe("../r2/Bar.stories.tsx  'ui/Bar on an arc'");
  });

  it('fails two files under one title exporting the same name', () => {
    const { lines, ok } = titleReport([entry('ui/Bar', '/r/Bar.stories.tsx', 'Lab'), entry('ui/Bar', '/r/lab/BarArc.stories.tsx', 'Lab')], '/r');
    expect(ok).toBe(false);
    expect(lines).toEqual(['ui-bar--lab  declared by Bar.stories.tsx, lab/BarArc.stories.tsx', '1 story id is declared twice. Rename one of each pair\'s exports.']);
  });
});

describe('warnShared', () => {
  it('names one file once, with the exports sharing the id, and says to rename one rather than retitle', () => {
    const warn = vi.fn();
    const a = entry('ui/Button', '/r/a.stories.tsx', 'Primary');
    const b = entry('ui/Button', '/r/a.stories.tsx', 'primary');
    expect(warnShared([a, b], '/r', { warn } as unknown as Logger)).toEqual([a]);
    expect(warn).toHaveBeenCalledWith(
      '[forge] story id ui-button--primary is declared by a.stories.tsx as Primary, primary; the workshop shows only the first. Rename one of the exports.',
    );
  });

  it('lists each file once in the report when one of them declares the id twice', () => {
    const entries = [entry('ui/Bar', '/r/a.stories.tsx', 'Lab'), entry('ui/Bar', '/r/a.stories.tsx', 'lab'), entry('ui/Bar', '/r/b.stories.tsx', 'Lab')];
    expect(titleReport(entries, '/r').lines[0]).toBe('ui-bar--lab  declared by a.stories.tsx, b.stories.tsx');
  });

  it('keeps only the first entry of a story id two files declare, as its warning says', () => {
    const first = entry('ui/Button', '/r/a.stories.tsx', 'Primary');
    const second = entry('ui/Button', '/r/b.stories.tsx', 'Primary');
    const other = entry('ui/Button', '/r/b.stories.tsx', 'Ghost');
    expect(warnShared([first, second, other], '/r', undefined)).toEqual([first, other]);
  });
});

