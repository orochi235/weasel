import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { OptionsBar } from '@weasel-js/ui/components/OptionsBar';
import { Radio, RadioGroup } from '@weasel-js/ui/components/RadioGroup';
import { Switch } from '@weasel-js/ui/components/Switch';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';

// Windows high contrast: the browser repaints backgrounds as Canvas and drops box-shadows, so a
// state drawn only with those is gone.

beforeAll(() => commands.forcedColors('active'));
afterAll(() => commands.forcedColors('none'));
afterEach(cleanup);

const bg = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).backgroundColor;
const part = (root: Element, name: string) => root.querySelector(`[class*='${name}']`)!;

/** The color forced colors repaint every author background as. */
function canvas(): string {
  const probe = document.body.appendChild(document.createElement('div'));
  probe.setAttribute('style', 'background: red');
  const color = bg(probe);
  probe.remove();
  return color;
}

test('the emulation is on', () => {
  expect(matchMedia('(forced-colors: active)').matches).toBe(true);
});

describe('a chosen control still reads as chosen', () => {
  test('a checked checkbox draws its mark apart from its box', () => {
    render(<Checkbox defaultSelected>on</Checkbox>);
    const box = screen.getByRole('checkbox');
    expect(bg(box, '::before')).not.toBe(bg(box));
  });

  test('a switch draws its thumb apart from its track, on and off', () => {
    render(<><Switch defaultSelected>on</Switch><Switch>off</Switch></>);
    for (const sw of screen.getAllByRole('switch')) {
      const label = sw.closest('label')!;
      expect(bg(part(label, 'thumb'))).not.toBe(bg(part(label, 'track')));
    }
  });

  test('a chosen radio draws its dot apart from its ring', () => {
    render(<RadioGroup aria-label="g" defaultValue="a"><Radio value="a">a</Radio><Radio value="b">b</Radio></RadioGroup>);
    const label = screen.getByRole('radio', { name: 'a' }).closest('label')!;
    const dot = part(label, 'dot');
    expect(bg(dot, '::after')).not.toBe(bg(dot));
  });

  test('the selected tab keeps its indicator', () => {
    render(
      <Tabs><TabList aria-label="t"><Tab id="a">A</Tab><Tab id="b">B</Tab></TabList><TabPanel id="a">x</TabPanel><TabPanel id="b">y</TabPanel></Tabs>,
    );
    const tab = screen.getByRole('tab', { name: 'A' });
    expect(bg(tab, '::after')).not.toBe(canvas());
  });

  test('a selected segment fills apart from the others', () => {
    render(
      <OptionsBar
        ariaLabel="Bar"
        items={['a', 'b'].map((v, i) => ({ value: v, label: v, selected: i === 0, onChange: () => {} }))}
      />,
    );
    const [on, off] = screen.getAllByRole('button');
    expect(bg(on!)).not.toBe(bg(off!));
    expect(bg(on!)).not.toBe(canvas());
  });
});
