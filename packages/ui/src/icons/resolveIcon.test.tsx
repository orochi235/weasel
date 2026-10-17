import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { withIcons } from '../testing/withIcons';
import { icon } from '../icons.gen';
import { resolveIcon } from './resolveIcon';

/** Path data from `core:unknown`'s question mark, which a name the registry lacks draws in development. */
const PLACEHOLDER_PATH = 'M 7.5 8 Q 7.5 5.5 10 5.5';

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

it('draws a qualified name, at the size asked for', () => {
  const { container } = render(<>{resolveIcon(icon('close'), 16)}</>, { wrapper: withIcons });
  expect(container.querySelector('svg')).toHaveAttribute('width', '16');
});

it('takes a qualified string read from data', () => {
  const { container } = render(<>{resolveIcon('ui:close')}</>, { wrapper: withIcons });
  expect(container.querySelector('svg')).toHaveAttribute('width', '14');
  expect(warn).not.toHaveBeenCalled();
});

it('draws nothing for a bare or malformed string', () => {
  expect(resolveIcon(undefined)).toBeUndefined();
  expect(resolveIcon('bold')).toBeUndefined();
  expect(resolveIcon('toString')).toBeUndefined();
  expect(resolveIcon('ui:a:b')).toBeUndefined();
});

// A prefs schema loaded as JSON reaches resolveIcon as plain strings.
describe('a name read from data', () => {
  const namesIn = (json: string) => (JSON.parse(json) as { icons: string[] }).icons;

  it('draws the placeholder for a qualified name no table holds, and warns once', () => {
    const names = namesIn('{ "icons": ["ui:neverDrawn", "ui:neverDrawn"] }');
    const { container } = render(<>{names.map((name, i) => <span key={i}>{resolveIcon(name)}</span>)}</>, { wrapper: withIcons });
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    expect(svgs[0]!.innerHTML).toContain(PLACEHOLDER_PATH);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"ui:neverDrawn"');
  });

  it('draws nothing for a bare name, and warns once', () => {
    const names = namesIn('{ "icons": ["neverQualified", "neverQualified"] }');
    const { container } = render(<>{names.map((name, i) => <span key={i}>{resolveIcon(name)}</span>)}</>, { wrapper: withIcons });
    expect(container.querySelector('svg')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"neverQualified" is not qualified');
  });
});
