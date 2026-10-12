// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { fixedSeat, nearestPortalHost } from './fixedSeat';

afterEach(() => { document.body.innerHTML = ''; });

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.getElementById('from')!;
}

describe('nearestPortalHost', () => {
  it('is the nearest themed or opted-in ancestor, and null when there is none', () => {
    expect(nearestPortalHost(mount('<div data-wzl-theme="x"><div data-wzl-portal-host id="h"><i id="from"></i></div></div>'))?.id).toBe('h');
    expect(nearestPortalHost(mount('<i id="from"></i>'))).toBeNull();
    expect(nearestPortalHost(null)).toBeNull();
  });
});

describe('fixedSeat', () => {
  it('seats on the body at the viewport origin when nothing above is a host', () => {
    expect(fixedSeat(mount('<i id="from"></i>'))).toEqual({ host: document.body, left: 0, top: 0 });
  });

  it('seats on the host at the viewport origin when the host leaves fixed boxes to the viewport', () => {
    const from = mount('<div data-wzl-theme="x" id="h"><i id="from"></i></div>');
    expect(fixedSeat(from)).toEqual({ host: document.getElementById('h'), left: 0, top: 0 });
  });

  it("answers the host's own corner when the host contains its fixed descendants", () => {
    const from = mount('<div data-wzl-theme="x" id="h" style="transform: translate(1px, 0)"><i id="from"></i></div>');
    const host = document.getElementById('h')!;
    host.getBoundingClientRect = () => ({ left: 40, top: 25, right: 0, bottom: 0, width: 0, height: 0, x: 40, y: 25, toJSON: () => ({}) });
    expect(fixedSeat(from)).toEqual({ host, left: 40, top: 25 });
  });
});
