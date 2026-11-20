import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import { createPanelHostRegistry, PanelHostContext } from '../lab/panelHost';
import { panelKey } from '../state/undock';
import { UndockedSections } from './UndockedSections';

describe('UndockedSections', () => {
  it('keeps a torn-out section filling its panel', async () => {
    const hosts = createPanelHostRegistry();
    const host = document.createElement('div');
    document.body.append(host);
    hosts.set(panelKey('t1', 'list'), host);
    const section = {
      id: 'list',
      region: 'sidebar',
      item: { title: 'List', fill: true, body: 'rows' },
    } as unknown as TrialContribution;
    await renderSettled(
      <PanelHostContext.Provider value={hosts}>
        <UndockedSections trialId="t1" sections={[section]} onDock={() => {}} />
      </PanelHostContext.Provider>,
      { wrapper: withIcons },
    );
    expect(host.textContent).toContain('rows');
    expect(host.querySelector('[data-fill]')).not.toBeNull();
    host.remove();
  });
});
