import { describe, expect, it } from 'vitest';
import type { ComponentType, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { useActionsRegistry } from '@weasel-js/core';
import { appActions } from './appCommands/actions';
import { EmptyDocument } from './CommandBar.stories';

describe('the CommandBar story', () => {
  it('registers every one of the app\'s own actions, as the app does', () => {
    let ids: string[] = [];
    function Probe() {
      ids = (useActionsRegistry()?.list() ?? []).map((a) => a.id);
      return null;
    }
    const decorate = EmptyDocument.decorators as ((story: ComponentType) => ReactElement)[];
    const { rerender } = render(decorate[0]!(Probe));
    rerender(decorate[0]!(Probe));
    expect(ids).toEqual(expect.arrayContaining(appActions.map((a) => a.id)));
  });
});
