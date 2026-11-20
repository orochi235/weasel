import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
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
});
