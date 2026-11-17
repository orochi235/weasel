import { describe, expect, it } from 'vitest';
import { owningTrial } from './owningTrial';

function tree(): Record<string, HTMLElement> {
  document.body.innerHTML = `
    <section data-trial-id="outer">
      <div id="innerChrome">
        <section data-trial-id="inner"><button id="inInner"></button></section>
      </div>
    </section>
    <div class="lk-panel-tile" data-trial-id="outer"><p id="inPanel"></p></div>
    <p id="nowhere"></p>`;
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  return {
    innerChrome: byId('innerChrome'),
    inInner: byId('inInner'),
    inPanel: byId('inPanel'),
    nowhere: byId('nowhere'),
  };
}

describe('owningTrial', () => {
  it("walks out past a nested lab's trials to the trial this lab owns", () => {
    const at = tree();
    expect(owningTrial(at.inInner, (id) => id === 'outer')).toBe('outer');
    expect(owningTrial(at.inInner, (id) => id === 'inner')).toBe('inner');
  });

  it("answers null from a nested lab's own chrome, for the nested lab", () => {
    const at = tree();
    expect(owningTrial(at.innerChrome, (id) => id === 'inner')).toBeNull();
  });

  it('gives an undocked panel to the trial it came from', () => {
    const at = tree();
    expect(owningTrial(at.inPanel, (id) => id === 'outer')).toBe('outer');
  });

  it('answers null outside every trial, and for something that is not an element', () => {
    const at = tree();
    expect(owningTrial(at.nowhere, () => true)).toBeNull();
    expect(owningTrial(null, () => true)).toBeNull();
    expect(owningTrial(window, () => true)).toBeNull();
  });
});
