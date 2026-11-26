import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { ToolsScope, usePublishTools, useScopedTools } from './toolsScope';
import type { ToolsApi } from './useTools';

const api = (name: string) => ({ name }) as unknown as ToolsApi;

function Canvas({ tools }: { tools: ToolsApi }) {
  usePublishTools(tools);
  return null;
}

function Palette() {
  const tools = useScopedTools() as unknown as { name: string } | null;
  return <span data-testid="palette">{tools?.name ?? 'none'}</span>;
}

const Scope = ({ children }: { children: ReactNode }) => <ToolsScope><Palette />{children}</ToolsScope>;

describe('ToolsScope', () => {
  const a = api('a');
  const b = api('b');

  it('goes back to an earlier canvas still mounted when the newest unmounts', () => {
    const view = render(<Scope>{[<Canvas key="a" tools={a} />, <Canvas key="b" tools={b} />]}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('b');
    view.rerender(<Scope>{[<Canvas key="a" tools={a} />]}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('a');
    view.rerender(<Scope>{null}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('none');
  });

  it('keeps the newest canvas when an earlier one unmounts', () => {
    const view = render(<Scope>{[<Canvas key="a" tools={a} />, <Canvas key="b" tools={b} />]}</Scope>);
    view.rerender(<Scope>{[<Canvas key="b" tools={b} />]}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('b');
  });

  it('keeps the newest canvas when an earlier one publishes new tools', () => {
    const view = render(<Scope>{[<Canvas key="a" tools={a} />, <Canvas key="b" tools={b} />]}</Scope>);
    view.rerender(<Scope>{[<Canvas key="a" tools={api('a2')} />, <Canvas key="b" tools={b} />]}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('b');
    view.rerender(<Scope>{[<Canvas key="a" tools={api('a2')} />]}</Scope>);
    expect(view.getByTestId('palette').textContent).toBe('a2');
  });

  it('keeps its children mounted when `isolate` changes', () => {
    const unmounted = vi.fn();
    function Child() {
      useEffect(() => unmounted, []);
      return null;
    }
    const tree = (isolate: boolean) => <ToolsScope><ToolsScope isolate={isolate}><Child /></ToolsScope></ToolsScope>;
    const view = render(tree(false));
    view.rerender(tree(true));
    view.rerender(tree(false));
    expect(unmounted).not.toHaveBeenCalled();
  });
});
