import { afterEach, expect, test, vi } from 'vitest';
import { watchResize } from './watchResize';

let observers: Stub[] = [];

class Stub {
  observed: { el: Element; options?: ResizeObserverOptions }[] = [];
  disconnected = false;
  constructor(readonly cb: ResizeObserverCallback) { observers.push(this); }
  observe(el: Element, options?: ResizeObserverOptions) { this.observed.push({ el, options }); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  fire(entries: Partial<ResizeObserverEntry>[]) { this.cb(entries as ResizeObserverEntry[], this as unknown as ResizeObserver); }
}

afterEach(() => {
  observers = [];
  vi.unstubAllGlobals();
});

test('watches nothing and stops cleanly where the browser has no ResizeObserver', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const onResize = vi.fn();
  const stop = watchResize(document.createElement('div'), onResize);
  expect(() => stop()).not.toThrow();
  expect(onResize).not.toHaveBeenCalled();
});

test('observes one element, or each of several skipping the missing, with the options given', () => {
  vi.stubGlobal('ResizeObserver', Stub);
  const a = document.createElement('div');
  const b = document.createElement('span');
  watchResize(a, () => {});
  watchResize([a, null, b, undefined], () => {}, { box: 'border-box' });
  expect(observers[0]!.observed.map((o) => o.el)).toEqual([a]);
  expect(observers[1]!.observed).toEqual([{ el: a, options: { box: 'border-box' } }, { el: b, options: { box: 'border-box' } }]);
});

test('takes an iterable element as one element, not as its contents', () => {
  vi.stubGlobal('ResizeObserver', Stub);
  const form = document.createElement('form');
  form.append(document.createElement('input'));
  watchResize(form, () => {});
  expect(observers[0]!.observed.map((o) => o.el)).toEqual([form]);
});

test('hands the entries on, and stopping disconnects', () => {
  vi.stubGlobal('ResizeObserver', Stub);
  const el = document.createElement('div');
  const onResize = vi.fn();
  const stop = watchResize(el, onResize);
  observers[0]!.fire([{ target: el }]);
  expect(onResize).toHaveBeenCalledWith([{ target: el }]);
  stop();
  expect(observers[0]!.disconnected).toBe(true);
});

test('a null target creates no observer', () => {
  vi.stubGlobal('ResizeObserver', Stub);
  watchResize(null, () => {});
  expect(observers).toHaveLength(0);
});
