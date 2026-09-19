import { describe, expect, it } from 'vitest';
import { autoTitle, globDirectory } from './autoTitle';

const ROOT = '/repo';
const under = (file: string, stories = ['path/**/*']) => autoTitle(`${ROOT}/${file}`, ROOT, stories);

// Expected titles were produced by storybook 10.4.0's own userOrAutoTitle and normalizeStoriesEntry for the same globs.
describe('autoTitle', () => {
  it.each([
    ['path/to/file.stories.js', 'to/file'],
    ['path/to-my/file.stories.js', 'to-my/file'],
    ['path/to_my/file.stories.js', 'to_my/file'],
    ['path/to/file.stories.tsx', 'to/file'],
    ['path/to/file.story.js', 'to/file'],
    ['path/to/file.test.stories.js', 'to/file.test'],
    ['path/to/button/button.stories.js', 'to/button'],
    ['path/to/button/Button.stories.js', 'to/Button'],
    ['path/to/button/index.stories.js', 'to/button'],
    ['path/to/button/stories.js', 'to/button'],
    ['path/to/button/story.js', 'to/button'],
    ['path/to/button/Button.mdx', 'to/Button'],
    ['path/index.stories.js', 'index'],
    ['path/Button.stories.js', 'Button'],
  ])('titles %s as %s', (file, title) => {
    expect(under(file)).toBe(title);
  });

  it('titles from the first glob that matches the file', () => {
    const stories = ['packages/ui/src/**/*.stories.tsx', 'packages/**/*.stories.tsx'];
    expect(autoTitle('/repo/packages/ui/src/Slider/Slider.stories.tsx', ROOT, stories)).toBe('Slider');
    expect(autoTitle('/repo/packages/labkit/src/Lab.stories.tsx', ROOT, stories)).toBe('labkit/src/Lab');
  });

  it('agrees with Storybook glob written relative to .storybook, when both globs name the same directory', () => {
    expect(autoTitle('/repo/packages/ui/src/components/Button/Button.stories.tsx', ROOT, ['packages/ui/src/**/*.stories.@(ts|tsx)'])).toBe(
      'components/Button',
    );
  });

  it('accepts a glob written with ./', () => {
    expect(autoTitle('/repo/src/to/file.stories.tsx', ROOT, ['./src/**/*.stories.tsx'])).toBe('to/file');
  });

  it("titles a file no glob matches from its path under the root, by the same rules", () => {
    expect(autoTitle('/repo/elsewhere/Button/Button.stories.tsx', ROOT, ['src/**/*.stories.tsx'])).toBe('elsewhere/Button');
    expect(autoTitle('/repo/Button.stories.tsx', ROOT, [])).toBe('Button');
  });
});

// Expected values are picomatch 4's `scan(pattern).prefix + .base`, which Storybook's normalizeStoriesEntry uses.
describe('globDirectory', () => {
  it.each([
    ['../packages/ui/src/**/*.stories.@(ts|tsx)', '../packages/ui/src'],
    ['./src/*.stories.tsx', './src'],
    ['src/{a,b}/**', 'src'],
    ['*.stories.tsx', ''],
    ['a/@scope/*.tsx', 'a/@scope'],
    ['a/!(x)/y', 'a'],
    ['a/b?/c', 'a'],
    ['a/[bc]/d', 'a'],
  ])('%s searches from %j', (pattern, directory) => {
    expect(globDirectory(pattern)).toBe(directory);
  });

  it("is a file entry's directory when the entry has no glob", () => {
    expect(globDirectory('a/b/c.stories.tsx')).toBe('a/b');
  });
});
