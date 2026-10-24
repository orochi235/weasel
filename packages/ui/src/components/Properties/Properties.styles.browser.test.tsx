import '@weasel-js/theme/tokens.css';
import { afterEach, expect, test } from 'vitest';
import s from './Properties.module.css';

// The module is assembled from imported sheets. Each one's rules have to land in
// the module's own scope, or a class the components ask for styles nothing; only
// the real CSS pipeline can say which, since the jsdom proxy answers to any key.

let host: HTMLElement | undefined;
afterEach(() => host?.remove());

function mount(html: string): HTMLElement {
  host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

test('a rule from every imported sheet reaches the class the module exports', () => {
  const root = mount(`
    <div class="${s.panel}" data-motif="sheet" data-part="panel">
      <div class="${s.list} ${s.listPairs}" data-part="list">
        <label class="${s.row} ${s.rowInline}" data-part="row"><span class="${s.rowLabel}" data-part="label">Gap</span></label>
        <label class="${s.row} ${s.rowColor}" data-part="color"></label>
        <label class="${s.row} ${s.rowAuto}"><span class="${s.readout}" data-part="auto">auto</span></label>
        <div class="${s.group}"><div class="${s.groupBody}" data-part="group"></div></div>
        <section class="${s.subpanel}" data-motif="divider" data-part="subpanel"><div class="${s.subpanelBody}" data-part="subpanelBody"></div></section>
      </div>
    </div>`);
  const style = (part: string) => getComputedStyle(root.querySelector(`[data-part="${part}"]`)!);
  expect(style('panel').boxSizing).toBe('border-box'); // family.css
  expect(style('panel').userSelect).toBe('none'); // family.css
  // The box is the sheet motif's to draw; the panel's own sheets give it the slots it draws from.
  expect(style('panel').getPropertyValue('--_s-border-style').trim()).toBe('solid'); // PropertyPanel.stance.css
  expect(style('subpanel').getPropertyValue('--_s-title-case').trim()).not.toBe(''); // Subpanel.stance.css
  expect(style('list').display).toBe('grid'); // PropertyList.css
  expect(style('row').display).not.toBe('inline'); // PropertyRow.css
  expect(style('label').whiteSpace).not.toBe(''); // PropertyRow.inline.css
  expect(style('color').display).not.toBe('inline'); // PropertyRow.variants.css
  expect(style('group').display).toBe('grid'); // PropertyGroup.css
  expect(style('subpanelBody').display).toBe('grid'); // Subpanel.css
  expect(style('auto').textTransform).toBe('uppercase'); // PropertyRow.auto.css
  // A rule naming two components: a subpanel spans both columns of a paired list.
  expect(style('subpanel').gridColumnStart).toBe('1');
  expect(style('subpanel').gridColumnEnd).toBe('-1');
});

test('a subpanel spans both columns of a paired group, as it does a paired list', () => {
  const root = mount(`
    <div class="${s.group} ${s.groupPairs}">
      <div class="${s.groupBody}">
        <section class="${s.subpanel}" data-part="subpanel"></section>
      </div>
    </div>`);
  const sub = getComputedStyle(root.querySelector('[data-part="subpanel"]')!);
  expect(sub.gridColumnStart).toBe('1');
  expect(sub.gridColumnEnd).toBe('-1');
});
