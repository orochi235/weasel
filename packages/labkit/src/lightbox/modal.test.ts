import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { liftStack } from './modal';

// jsdom has no popover support: track the top layer here, in show order.
const topLayer: HTMLElement[] = [];
const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const originalMatches = Element.prototype.matches;

beforeEach(() => {
  proto.showPopover = function (this: HTMLElement) {
    if (!this.isConnected) throw new DOMException('not connected', 'InvalidStateError');
    if (!topLayer.includes(this)) topLayer.push(this);
  };
  proto.hidePopover = function (this: HTMLElement) {
    topLayer.splice(topLayer.indexOf(this), 1);
  };
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':popover-open') return topLayer.includes(this as HTMLElement);
    return originalMatches.call(this, selector);
  } as typeof originalMatches;
});

afterEach(() => {
  delete proto.showPopover;
  delete proto.hidePopover;
  Element.prototype.matches = originalMatches;
  topLayer.length = 0;
  document.body.replaceChildren();
});

function attached(): HTMLElement {
  return document.body.appendChild(document.createElement('div'));
}

describe('liftStack', () => {
  it('skips a detached member and lifts the rest', () => {
    const stale = document.createElement('div');
    const self = attached();
    const undo = liftStack([stale, self], self);
    expect(topLayer).toEqual([self]);
    expect(stale.hasAttribute('popover')).toBe(false);
    expect(self.hasAttribute('data-lk-lightbox-scrim')).toBe(true);
    undo();
    expect(topLayer).toEqual([]);
  });

  it('undoes what it lifted before a member that throws, then rethrows', () => {
    const below = attached();
    const self = attached();
    const failing = attached();
    failing.showPopover = () => {
      throw new Error('refused');
    };
    expect(() => liftStack([below, self, failing], self)).toThrow('refused');
    expect(topLayer).toEqual([]);
    for (const el of [below, self, failing]) {
      expect(el.hasAttribute('popover')).toBe(false);
      expect(el.hasAttribute('data-lk-lightbox-layer')).toBe(false);
      expect(el.hasAttribute('data-lk-lightbox-scrim')).toBe(false);
    }
  });

  it('leaves a shared layer an outer lightbox lifted as it was when an inner one closes', () => {
    const buffer = attached();
    const outer = attached();
    const overlay = attached();
    const inner = attached();
    const undoOuter = liftStack([buffer, outer, overlay], outer);
    const undoInner = liftStack([buffer, inner, overlay], inner);
    expect(topLayer).toEqual([buffer, outer, inner, overlay]);
    expect(inner.hasAttribute('data-lk-lightbox-scrim')).toBe(true);

    undoInner();
    expect(topLayer).toEqual([buffer, outer, overlay]);
    expect(buffer.hasAttribute('data-lk-lightbox-scrim')).toBe(true);
    expect(buffer.hasAttribute('data-lk-lightbox-layer')).toBe(true);
    expect(overlay.getAttribute('popover')).toBe('manual');
    expect(inner.hasAttribute('popover')).toBe(false);

    undoOuter();
    expect(topLayer).toEqual([]);
    expect(buffer.hasAttribute('popover')).toBe(false);
  });
});
