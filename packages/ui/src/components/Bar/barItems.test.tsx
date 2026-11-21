import { afterEach, describe, expect, it, vi } from 'vitest';
import { lineItems } from './barItems';
import { BarGroup } from './barParts';

afterEach(() => {
  vi.restoreAllMocks();
});

const keys = (children: React.ReactNode, mark = false) => lineItems(children, mark).map((item) => item.key);

describe('lineItems', () => {
  it('keys a keyless child by its slot, so a conditional child before it does not move its key', () => {
    expect(keys([false, <b />, <u />])).toEqual(keys([<i />, <b />, <u />]).slice(1));
  });

  it('keys a keyless child inside a fragment or array by its scope, apart from its siblings elsewhere', () => {
    const k = keys(
      <>
        {[<b key="x" />]}
        <>{false}<i /></>
      </>,
    );
    expect(new Set(k).size).toBe(k.length);
  });

  it('keeps a key one child holds, and gives a second child holding it a key of its own, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = lineItems([[<b key="x" />], [<i key="x" />]], true);
    expect(items[0]!.key).toBe('x');
    expect(items[1]!.key).not.toBe('x');
    expect(items[1]!.in).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('marks a keyed group as a unit of the top level', () => {
    const items = lineItems([<BarGroup key="history"><b /></BarGroup>, <i key="save" />], true);
    expect(items.filter((item) => !item.divider).map((item) => [item.key, item.in])).toEqual([['history', ''], ['save', '']]);
  });
});
