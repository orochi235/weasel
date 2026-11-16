import { afterEach, describe, expect, it, vi } from 'vitest';
import { swallowClick, swallowNextClick } from './swallowClick';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function mount() {
  const box = document.body.appendChild(document.createElement('div'));
  const row = box.appendChild(document.createElement('button'));
  const heard = vi.fn();
  row.addEventListener('click', heard);
  const click = () => row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return { box, heard, click };
}

describe('swallowClick', () => {
  it('stops and cancels the next click inside the target, and only that one', () => {
    const { box, heard, click } = mount();
    swallowClick(box);
    expect(click()).toBe(false);
    expect(heard).not.toHaveBeenCalled();
    expect(click()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('keeps the default with keepDefault, and lets go when disarmed', () => {
    const { box, heard, click } = mount();
    swallowClick(box, { keepDefault: true });
    expect(click()).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    swallowClick(box)();
    click();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('swallowNextClick', () => {
  it('swallows a click in this task, and none after it', () => {
    vi.useFakeTimers();
    const { box, heard, click } = mount();
    swallowNextClick(box);
    vi.runAllTimers();
    click();
    expect(heard).toHaveBeenCalledTimes(1);
    swallowNextClick(box);
    click();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
