import { describe, expect, it } from 'vitest';
import { timestampsFromLog } from './vite-demo-timestamps.ts';

/** `git log --name-status --format=%x00%aI` text, commits newest first. */
const log = (...commits: [date: string, ...entries: string[]][]) =>
  commits.map(([date, ...entries]) => `\0${date}\n\n${entries.join('\n')}\n`).join('');

describe('timestampsFromLog', () => {
  it('takes the newest commit touching a file and the oldest one adding it', () => {
    const text = log(['2026-03-01', 'M\tdemos/a.tsx'], ['2026-02-01', 'M\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])).toEqual({
      'demos/a.tsx': { created: '2026-01-01', lastModified: '2026-03-01' },
    });
  });

  it('follows a rename back to the add of the old name', () => {
    const text = log(['2026-03-01', 'R100\tdemo/a.tsx\tdemos/a.tsx'], ['2026-01-01', 'A\tdemo/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])).toEqual({
      'demos/a.tsx': { created: '2026-01-01', lastModified: '2026-03-01' },
    });
  });

  it('dates the last change by the current name only, as a log of that path would', () => {
    const text = log(['2026-03-01', 'R090\tdemo/a.tsx\tdemos/a.tsx'], ['2026-02-01', 'M\tdemo/a.tsx'], ['2026-01-01', 'A\tdemo/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].lastModified).toBe('2026-03-01');
  });

  it('counts a merge that changed the file, whose combined status is two letters', () => {
    const text = log(['2026-03-01', 'MM\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].lastModified).toBe('2026-03-01');
  });

  it('keeps the oldest add of a file deleted and added again', () => {
    const text = log(['2026-03-01', 'A\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].created).toBe('2026-01-01');
  });

  it('leaves out a file no commit names', () => {
    expect(timestampsFromLog(log(['2026-01-01', 'A\tdemos/a.tsx']), ['demos/new.tsx'])).toEqual({});
  });
});
