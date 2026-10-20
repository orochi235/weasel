import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup } from '@testing-library/react';
import { EVERY_KIND, mismatches, notAt, rowTexts } from '@weasel-js/ui/testing/paramsText';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { ResolvedConfig } from '../config/types';
import { ControlPanel } from './ControlPanel';

// A row's label and its value are set at one size, `--wzl-params-text-size`, for every kind of field; the ui
// package checks its own surfaces the same way. Computed sizes are a browser's to answer.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '.big { --wzl-params-text-size: 18px; }';
  document.head.append(style);
});

const schema: ResolvedConfig = {
  group: EVERY_KIND,
  sections: [],
  showIf: new Map(),
  renderers: {},
  dialogs: {},
};

describe.each(['pairs', 'one-up'] as const)('ControlPanel, pack %s', (pack) => {
  const draw = (className: string) =>
    renderWithIcons(
      <div className={`lk-root ${className}`}>
        <ControlPanel schema={schema} pack={pack} config={{}} setConfig={() => {}} />
      </div>,
    );

  test('sets every value at its row label’s size', () => {
    const { container } = draw('');
    const rows = rowTexts(container);
    expect(rows.length).toBeGreaterThan(5);
    expect(mismatches(rows).join('\n')).toBe('');
  });

  test('sets every label and value at the size an ancestor gives --wzl-params-text-size', () => {
    const { container } = draw('big');
    expect(notAt(rowTexts(container), '18px').join('\n')).toBe('');
  });
});
