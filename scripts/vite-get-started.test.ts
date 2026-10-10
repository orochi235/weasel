import { describe, expect, it } from 'vitest';
import { sliceSections } from './vite-get-started';

const README = [
  '# weasel',
  'intro',
  '## Install',
  'npm i',
  '```sh',
  '## not a heading',
  '```',
  '## Features',
  'many',
  '## How it fits together',
  'a scene',
  '### Presets',
  'a table',
  '## License',
  'MIT',
].join('\n');

describe('sliceSections', () => {
  it('returns the named sections in the order asked for, headings included', () => {
    expect(sliceSections(README, ['How it fits together', 'Install'])).toBe(
      [
        '## How it fits together',
        'a scene',
        '### Presets',
        'a table',
        '',
        '## Install',
        'npm i',
        '```sh',
        '## not a heading',
        '```',
      ].join('\n'),
    );
  });

  it('throws on a section the document lacks', () => {
    expect(() => sliceSections(README, ['Install', 'Quick start'])).toThrow(/no "## Quick start" section/);
  });
});
