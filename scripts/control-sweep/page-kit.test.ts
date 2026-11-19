import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSweepKit } from './page-kit.mjs';

interface Kit {
  discover(sel: string, chrome?: string): Array<{ id: string; key: string; kind: string; label: string; skip?: string; selected?: boolean; restoreTo?: string; alternate?: string; native?: boolean; chrome?: boolean }>;
  capture(sel: string, id: string | null, ignore?: string): { dom: Record<string, string>; canvases: unknown[] };
  bigCanvas(sel: string): { x: number; y: number; width: number; height: number } | null;
}
const kit = () => (window as unknown as { __sweep: Kit }).__sweep;

beforeEach(() => {
  // jsdom lays nothing out; give every element a box unless it is marked as showing nothing.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const size = this.hasAttribute('data-test-size') ? Number(this.getAttribute('data-test-size')) : this.hasAttribute('data-test-zero') ? 0 : this.hasAttribute('data-test-tiny') ? 1 : this.hasAttribute('data-test-big') ? 200 : 20;
    return { x: 0, y: 0, left: 0, top: 0, right: size, bottom: size, width: size, height: size, toJSON: () => ({}) } as DOMRect;
  });
  delete (window as unknown as { __sweep?: Kit }).__sweep;
  installSweepKit(window);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const page = (demo: string) => {
  document.body.innerHTML = `
    <aside class="ckd-sidebar"><button>Home</button></aside>
    <div class="ckd-demo-frame" role="group" aria-label="Tween lab">${demo}<div class="ckd-demo-resize" role="button" aria-label="Resize"></div></div>`;
};

describe('discover', () => {
  it('finds the demo’s controls by role, and nothing outside the frame', () => {
    page(`
      <label><input type="checkbox" data-test-tiny> Snap</label>
      <div role="switch" aria-checked="false" aria-label="Loop"></div>
      <div role="group" aria-labelledby="dl"><span id="dl">Distance</span><input type="range" min="0" max="10" value="3" aria-labelledby="dl"><output>3</output></div>
      <select aria-label="Ease"><option>in</option><option>out</option></select>
      <button aria-haspopup="menu">More</button>
      <button aria-pressed="false">Bold</button>
      <button>Play</button>
      <canvas></canvas>`);
    const found = kit().discover('.ckd-demo-frame');
    expect(found.map((c) => c.key)).toEqual([
      'checkbox:Snap', 'switch:Loop', 'slider:Distance', 'select:Ease', 'menu:More', 'toggle:Bold', 'button:Play',
    ]);
    expect(found.find((c) => c.kind === 'select')?.native).toBe(true);
  });

  it('labels radios by their group, remembers the chosen one, and gives duplicates an ordinal', () => {
    page(`
      <div role="radiogroup" aria-label="Space steps by">
        <div role="radio" aria-checked="true">count</div><div role="radio" aria-checked="false">distance</div>
      </div>
      <button>Reset</button><button>Reset</button>`);
    const found = kit().discover('.ckd-demo-frame');
    expect(found.map((c) => c.label)).toEqual(['Space steps by › count', 'Space steps by › distance', 'Reset', 'Reset #2']);
    const distance = found[1];
    expect(distance.selected).toBe(false);
    expect(distance.restoreTo).toBe(found[0].id);
  });

  it('skips stepper buttons, marks disabled controls and downloads, and leaves out what shows nothing', () => {
    page(`
      <div role="group"><input inputmode="decimal" aria-label="Width" value="4"><button slot="increment">▲</button><button data-wzl-subordinate>▼</button></div>
      <button disabled>Undo</button>
      <a download href="x.svg">Save</a>
      <button data-test-zero>Hidden</button>
      <div aria-hidden="true"><select><option>a</option><option>b</option></select></div>`);
    const found = kit().discover('.ckd-demo-frame');
    expect(found.map((c) => [c.key, c.skip])).toEqual([
      ['number:Width', undefined], ['button:Undo', 'disabled'], ['download:Save', 'download link'],
    ]);
  });

  it('keeps a control’s key when its own label carries its value', () => {
    page('<div><label id="l">Mode</label><button aria-haspopup="listbox" aria-labelledby="v l"><span id="v">fast</span></button></div><canvas></canvas>');
    expect(kit().discover('.ckd-demo-frame')[0].key).toBe('select:Mode');
    document.getElementById('v')!.textContent = 'slow';
    expect(kit().discover('.ckd-demo-frame')[0].key).toBe('select:Mode');
  });

  it('gives the chosen radio and the active tool another control to choose first', () => {
    page(`
      <div role="radiogroup" aria-label="Mode"><div role="radio" aria-checked="true">a</div><div role="radio" aria-checked="false">b</div></div>
      <div role="toolbar" aria-label="Tools"><button aria-current="true">Select</button><button>Pen</button></div>`);
    const [a, b, select, pen] = kit().discover('.ckd-demo-frame');
    expect(a.alternate).toBe(b.id);
    expect(b.alternate).toBeUndefined();
    expect(select.alternate).toBe(pen.id);
    expect(pen.alternate).toBeUndefined();
  });

  it('marks controls inside the kit chrome', () => {
    page('<header class="lk-shell-header"><button>Add trial</button></header><button>Play</button>');
    expect(kit().discover('.ckd-demo-frame', '.lk-shell-header').map((c) => [c.label, Boolean(c.chrome)])).toEqual([
      ['Add trial', true], ['Play', false],
    ]);
  });
});

describe('capture', () => {
  it('ignores the operated control’s field and focus attributes, and sees everything else', () => {
    page(`
      <div class="row"><label id="dl">Distance</label><input type="range" aria-labelledby="dl" value="3"><output>3</output></div>
      <div class="row"><button>Play</button></div>
      <p class="status">steps: 4</p>
      <canvas></canvas>`);
    const [slider] = kit().discover('.ckd-demo-frame');
    const before = kit().capture('.ckd-demo-frame', slider.id).dom;
    const input = document.querySelector('input')!;
    input.value = '9';
    document.querySelector('output')!.textContent = '9';
    document.querySelector('button')!.setAttribute('data-hovered', 'true');
    expect(kit().capture('.ckd-demo-frame', slider.id).dom).toEqual(before);
    document.querySelector('.status')!.textContent = 'steps: 9';
    expect(kit().capture('.ckd-demo-frame', slider.id).dom).not.toEqual(before);
  });

  it('treats a radio group as one field, so choosing another option is not a change by itself', () => {
    page(`
      <div role="radiogroup" aria-label="Mode"><div role="radio" aria-checked="true">a</div><div role="radio" aria-checked="false">b</div></div>
      <button>Other</button><canvas></canvas>`);
    const [a, b] = kit().discover('.ckd-demo-frame');
    const before = kit().capture('.ckd-demo-frame', b.id).dom;
    document.querySelector(`[data-sweep-id="${a.id}"]`)!.setAttribute('aria-checked', 'false');
    document.querySelector(`[data-sweep-id="${b.id}"]`)!.setAttribute('aria-checked', 'true');
    expect(kit().capture('.ckd-demo-frame', b.id).dom).toEqual(before);
  });

  it('keeps the field it first found when operating the control adds a neighbor to its row', () => {
    page('<div class="row"><label>Distance</label><input type="range" aria-label="Distance" value="3"></div><p>steps: 4</p><canvas></canvas>');
    const [slider] = kit().discover('.ckd-demo-frame');
    const before = kit().capture('.ckd-demo-frame', slider.id).dom;
    document.querySelector('.row')!.insertAdjacentHTML('beforeend', '<button>Reset Distance</button>');
    expect(kit().capture('.ckd-demo-frame', slider.id).dom).toEqual(before);
  });

  it('counts a slider’s own number field and its reset button as the slider, and ignores what `ignore` names', () => {
    page(`
      <div class="row"><span>Distance</span><input type="range" aria-label="Distance" value="3"><input inputmode="decimal" aria-label="Distance" value="3"><span role="button" aria-label="Reset Distance" hidden></span></div>
      <div class="row"><input type="range" aria-label="Steps" value="5"></div>
      <button aria-label="Undo" disabled>↶</button><canvas></canvas>`);
    const [slider] = kit().discover('.ckd-demo-frame');
    const capture = () => kit().capture('.ckd-demo-frame', slider.id, '[aria-label=Undo]').dom;
    const before = capture();
    (document.querySelectorAll('input')[1] as HTMLInputElement).value = '9';
    document.querySelector('[aria-label="Reset Distance"]')!.removeAttribute('hidden');
    document.querySelector('[aria-label=Undo]')!.removeAttribute('disabled');
    expect(capture()).toEqual(before);
    (document.querySelectorAll('input')[2] as HTMLInputElement).value = '9';
    expect(capture()).not.toEqual(before);
  });

  it('stops a lone control’s field short of a chart it drives', () => {
    page('<div class="demo"><div class="field"><label>value</label><input type="range" aria-label="value" value="1"></div><svg data-test-big role="img"><text>1</text></svg></div>');
    const [slider] = kit().discover('.ckd-demo-frame');
    const before = kit().capture('.ckd-demo-frame', slider.id).dom;
    document.querySelector('text')!.textContent = '9';
    expect(kit().capture('.ckd-demo-frame', slider.id).dom).not.toEqual(before);
  });

  it('counts what a disclosure hides as its effect, not its field', () => {
    page('<div class="node"><button aria-expanded="true">scale</button><div class="kids"><span>x: 1</span></div></div><canvas></canvas>');
    const [toggle] = kit().discover('.ckd-demo-frame');
    const before = kit().capture('.ckd-demo-frame', toggle.id).dom;
    document.querySelector('.kids')!.remove();
    expect(kit().capture('.ckd-demo-frame', toggle.id).dom).not.toEqual(before);
  });

  it('normalizes whitespace in text', () => {
    page('<p>a   b</p><canvas></canvas>');
    const before = kit().capture('.ckd-demo-frame', null).dom;
    document.querySelector('p')!.textContent = ' a b\n';
    expect(kit().capture('.ckd-demo-frame', null).dom).toEqual(before);
  });
});

describe('bigCanvas', () => {
  it('drags on the largest surface that takes a press, passing over an inert buffer that spans the lab', () => {
    page(`
      <div style="pointer-events: none"><canvas data-test-size="800"></canvas></div>
      <svg data-test-size="300"></svg>
      <div role="application" aria-label="Annotations on pane" data-test-size="400"></div>
      <canvas data-test-size="500" style="pointer-events: none"></canvas>`);
    expect(kit().bigCanvas('.ckd-demo-frame')?.width).toBe(400);
  });

  it('falls back to the largest surface when none takes a press', () => {
    page(`
      <canvas data-test-size="300" style="pointer-events: none"></canvas>
      <canvas data-test-size="500" style="pointer-events: none"></canvas>
      <canvas data-test-size="20"></canvas>`);
    expect(kit().bigCanvas('.ckd-demo-frame')?.width).toBe(500);
  });
});
