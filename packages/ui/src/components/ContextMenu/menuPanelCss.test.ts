import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENU_BORDER_WIDTH, MENU_CARET_SIZE, MENU_ICON_SIZE, MENU_MIN_WIDTH } from '@weasel-js/ui-logic';

// The DOM menu's stylesheet sets out the lengths `menuPanelMetrics` reads, which size the HUD menu too. jsdom
// resolves no var(), so this reads them as text; `measure.browser.test.tsx` holds the laid-out box to the measure.
const menuCss = readFileSync(resolve(__dirname, 'ContextMenu.module.css'), 'utf8');
const surfaceCss = readFileSync(resolve(__dirname, '../listbox.module.css'), 'utf8');

/** The declarations of `selector`'s first rule in `css`. */
function rule(selector: string, css = menuCss): Record<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
  }));
}

describe('ContextMenu.module.css lays a panel out as measureMenuPanel measures it', () => {
  it('sets a panel in --wzl-font-size inside a MENU_BORDER_WIDTH border, padded by --wzl-space-2, no narrower than MENU_MIN_WIDTH', () => {
    expect(rule('.surface', surfaceCss)).toMatchObject({
      border: `${MENU_BORDER_WIDTH}px solid var(--wzl-border)`, 'font-family': 'var(--wzl-font-ui)', 'font-size': 'var(--wzl-font-size)',
    });
    expect(rule('.panel')).toMatchObject({
      'box-sizing': 'border-box', padding: 'var(--wzl-space-2)', 'min-width': `${MENU_MIN_WIDTH}px`,
      'line-height': 'var(--wzl-leading-snug)',
    });
  });

  it('sets a row a small control tall, its columns the icon, the label, and the trailing part, a --wzl-space-2 apart', () => {
    expect(rule('.row')).toMatchObject({
      'grid-template-columns': `${MENU_ICON_SIZE}px 1fr auto`,
      gap: 'var(--wzl-space-2)',
      'box-sizing': 'border-box',
      height: 'var(--wzl-control-h-sm)',
      padding: '0 var(--wzl-space-2)',
    });
  });

  it('sets a separator as a 1px rule with --wzl-space-1 either side, and a caret MENU_CARET_SIZE wide', () => {
    expect(rule('.separator')).toMatchObject({ height: '1px', margin: 'var(--wzl-space-1) 0' });
    expect(rule('.caret')).toMatchObject({ width: `${MENU_CARET_SIZE}px` });
  });
});
