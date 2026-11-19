/**
 * The half of the control sweep that runs inside the page. Playwright serializes `installSweepKit`
 * and runs it there, so it reads nothing from module scope; a test passes jsdom's window instead.
 * It installs `window.__sweep`, which finds the demo's controls, stamps each with `data-sweep-id`,
 * and digests the demo's DOM.
 */
export function installSweepKit(win) {
  const w = win ?? window;
  const doc = w.document;
  if (w.__sweep) return;

  /**
   * Notes on each canvas which kind of context the page made for it (`2d`, `webgl2`, …), or
   * `offscreen` when it handed its drawing to a worker. Asking a canvas for a context to find out would
   * make one, and a canvas given the wrong kind first can never get the right one.
   */
  function watchCanvasContexts() {
    const proto = w.HTMLCanvasElement?.prototype;
    if (!proto || proto.__sweepWatched) return;
    proto.__sweepWatched = true;
    const getContext = proto.getContext;
    proto.getContext = function (type, ...rest) {
      const ctx = getContext.call(this, type, ...rest);
      if (ctx && !this.__sweepContext) this.__sweepContext = type;
      return ctx;
    };
    const transfer = proto.transferControlToOffscreen;
    if (transfer) {
      proto.transferControlToOffscreen = function (...args) {
        this.__sweepContext = 'offscreen';
        return transfer.apply(this, args);
      };
    }
  }
  watchCanvasContexts();

  // Every load draws the same "random" scene, so two loads differ only by what the sweep did to one.
  if (w.Math.random.name === 'random') {
    let seed = 0x9e3779b9;
    w.Math.random = function seeded() {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CANDIDATES = [
    'input[type=checkbox]', 'input[type=radio]', 'input[type=range]', 'input[type=number]', 'input[type=color]',
    'input[type=file]', 'input[inputmode=decimal]', 'input[inputmode=numeric]', 'select', 'button', 'a[download]',
    '[role=checkbox]', '[role=switch]', '[role=radio]', '[role=slider]', '[role=spinbutton]', '[role=button]', '[role=tab]',
  ].join(',');
  const GROUPS = '[role=radiogroup],[role=tablist],[role=toolbar],[role=group],fieldset';
  const PEER_GROUPS = '[role=radiogroup],[role=tablist]';
  const MENU_ITEMS = '[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox]';
  const IGNORED_ATTR = /^(data-sweep-[\w-]+|data-(hovered|focused|focus-visible|focus-within|pressed)|tabindex)$/;
  const STATUS = '[aria-live]:not([aria-live=off]),[role=status],[role=log]';
  const POPUPS = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[popover]';
  let nextId = 1;

  const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const text = (el) => squash(el?.textContent).slice(0, 80);
  const idOf = (el) => {
    if (!el.dataset.sweepId) el.dataset.sweepId = String(nextId++);
    return el.dataset.sweepId;
  };
  const byId = (id) => doc.querySelector(`[data-sweep-id="${id}"]`);
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16).padStart(8, '0');
  };

  const kindOf = (el) => {
    const role = el.getAttribute('role');
    const type = el.tagName === 'INPUT' ? (el.getAttribute('type') ?? 'text').toLowerCase() : '';
    if (el.tagName === 'A') return 'download';
    if (type === 'file') return 'file';
    if (role === 'switch') return 'switch';
    if (type === 'checkbox' || role === 'checkbox') return 'checkbox';
    if (type === 'radio' || role === 'radio') return 'radio';
    if (role === 'tab') return 'tab';
    if (type === 'range' || role === 'slider') return 'slider';
    if (type === 'color') return 'color';
    if (el.tagName === 'SELECT') return 'select';
    if (el.tagName === 'INPUT' || role === 'spinbutton') return 'number';
    const popup = el.getAttribute('aria-haspopup');
    if (popup === 'listbox') return 'select';
    if (popup === 'menu' || popup === 'true') return 'menu';
    if (el.hasAttribute('aria-pressed')) return 'toggle';
    return 'button';
  };

  /** A visually hidden input is operated through its label or the nearest box that shows. */
  const hitOf = (el) => {
    const shows = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    if (el.tagName !== 'INPUT' || shows(el)) return el;
    const label = el.labels?.[0] ?? el.closest('label');
    if (label) return label;
    for (let p = el.parentElement; p; p = p.parentElement) if (shows(p)) return p;
    return el;
  };

  const visible = (el) => {
    const hit = hitOf(el);
    const r = hit.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return typeof hit.checkVisibility === 'function' ? hit.checkVisibility({ visibilityProperty: true }) : true;
  };

  const disabled = (el) => el.disabled === true || el.getAttribute('aria-disabled') === 'true'
    || el.hasAttribute('data-disabled') || Boolean(el.closest('fieldset:disabled,[aria-disabled=true]'));

  const groupNameOf = (g) => {
    const by = g.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map((id) => text(doc.getElementById(id))).filter(Boolean).join(' ');
    return squash(g.getAttribute('aria-label')) || text(g.querySelector(':scope > legend'));
  };

  const nameOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => text(doc.getElementById(id))).filter(Boolean).join(' ');
      if (t) return t;
    }
    const aria = squash(el.getAttribute('aria-label'));
    if (aria) return aria;
    if (el.labels?.length) {
      const t = [...el.labels].map(text).filter(Boolean).join(' ');
      if (t) return t;
    }
    const label = el.closest('label');
    if (label && text(label)) return text(label);
    return text(el) || squash(el.getAttribute('title')) || text(el.querySelector('title'))
      || squash(el.getAttribute('placeholder')) || squash(el.getAttribute('name'));
  };

  const peersOf = (el, all) => {
    const g = el.closest(PEER_GROUPS);
    return g ? all.filter((c) => c !== el && g.contains(c)) : [];
  };

  /**
   * The box holding the control, its label and its own readout: the highest ancestor holding no other
   * control, no canvas and no status line. Its changes are the control's own and do not count.
   */
  /** Controls named for the same setting: a slider and its number field, "Distance" and "Reset Distance". */
  const sameSetting = (el, all) => {
    const name = nameOf(el).toLowerCase();
    if (name.length < 3) return [];
    return all.filter((c) => {
      if (c === el) return false;
      const other = nameOf(c).toLowerCase();
      return other.length >= 3 && (other.includes(name) || name.includes(other));
    });
  };

  /** Whether `p` holds, beside `field`, a picture big enough to be what a control drives: a chart's SVG, an image. */
  const showsSomething = (p, field) => [...p.querySelectorAll('svg,img,[role=img]')].some((v) => {
    if (field.contains(v)) return false;
    const r = v.getBoundingClientRect();
    return r.width >= 64 && r.height >= 64;
  });

  const fieldOf = (el, all, root) => {
    const peers = new Set([...peersOf(el, all), ...sameSetting(el, all)]);
    const g = el.closest(PEER_GROUPS);
    let field = g && root.contains(g) && g !== root ? g : el;
    // A disclosure's field is itself: what it shows or hides sits beside it, and is the whole of its effect.
    if (el.hasAttribute('aria-expanded') && !el.hasAttribute('aria-haspopup')) return el;
    while (field.parentElement && field.parentElement !== root && root.contains(field.parentElement)) {
      const p = field.parentElement;
      if (p.querySelector('canvas') || p.querySelector(STATUS) || showsSomething(p, field)) break;
      if (all.some((c) => c !== el && !peers.has(c) && p.contains(c))) break;
      field = p;
    }
    return field;
  };

  /** The field's own label, for controls whose accessible name carries their value (a select's trigger). */
  const fieldLabelOf = (el, field) => {
    const label = [...field.querySelectorAll('label,[slot=label],legend')].find((l) => !l.contains(el) && text(l));
    return label ? text(label) : '';
  };

  /** Whether `el` is part of another control rather than one of its own. */
  const subordinate = (el, root) => {
    if (el.closest('.ckd-demo-resize,[aria-hidden=true],[inert]') || el.hasAttribute('data-wzl-subordinate')) return true;
    const slot = el.getAttribute('slot');
    if (slot === 'increment' || slot === 'decrement') return true;
    return !root.contains(el);
  };

  const describe = (el, all, root, chromeSel) => {
    const kind = kindOf(el);
    const field = fieldOf(el, all, root);
    const own = kind === 'select' || kind === 'number' || kind === 'slider' ? fieldLabelOf(el, field) : '';
    const name = own || nameOf(el) || `(unnamed ${kind})`;
    const g = el.parentElement?.closest(GROUPS);
    const group = g && g !== root && root.contains(g) ? groupNameOf(g) : '';
    const label = group && group !== name ? `${group} › ${name}` : name;
    const d = { id: idOf(el), kind, name, label, disabled: disabled(el) };
    if (chromeSel && el.closest(chromeSel)) d.chrome = true;
    const keys = el.getAttribute('aria-keyshortcuts');
    if (keys) d.shortcuts = keys.split(/\s+/).filter(Boolean);
    if (el.tagName === 'SELECT') d.native = true;
    if (kind === 'download') d.skip = 'download link';
    else if (kind === 'file') d.skip = 'file picker';
    else if (d.disabled) d.skip = 'disabled';
    const chosen = (e) => e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-selected') === 'true' || e.checked === true;
    if (kind === 'radio' || kind === 'tab') {
      d.selected = chosen(el);
      const peers = peersOf(el, all);
      const current = peers.find(chosen);
      if (current) d.restoreTo = idOf(current);
      const other = peers.find((p) => !chosen(p) && !disabled(p));
      if (d.selected && other) d.alternate = idOf(other);
    }
    // A palette's tools: one of them current. Choosing the current one again does nothing, so it is
    // tried after choosing another.
    if (kind === 'button' && (el.parentElement?.closest(GROUPS) ?? el.parentElement)?.querySelector('[aria-current=true]')) d.tool = true;
    if (kind === 'button' && el.getAttribute('aria-current') === 'true') {
      d.selected = true;
      const box = el.parentElement?.closest(GROUPS) ?? el.parentElement;
      const other = all.find((c) => c !== el && box?.contains(c) && c.hasAttribute('aria-current') === false && kindOf(c) === 'button' && !disabled(c));
      if (other) d.alternate = idOf(other);
    }
    return d;
  };

  /**
   * Every control in `root`, in document order, each with a key unique within the demo. One inside
   * `chromeSel` is marked `chrome`: the same kit control in every demo that has it.
   */
  const discover = (rootSel, chromeSel) => {
    const root = doc.querySelector(rootSel);
    if (!root) return [];
    const found = [...root.querySelectorAll(CANDIDATES)].filter((el) => !subordinate(el, root));
    const all = found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
    const seen = new Map();
    const out = [];
    for (const el of all) {
      if (!visible(el)) continue;
      const d = describe(el, all, root, chromeSel);
      const base = `${d.kind}:${d.label}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      d.key = n > 1 ? `${base}#${n}` : base;
      if (n > 1) d.label = `${d.label} #${n}`;
      out.push(d);
    }
    return out;
  };

  const fieldById = (rootSel, id) => {
    const root = doc.querySelector(rootSel);
    const el = id && byId(id);
    if (!root || !el) return null;
    // Pinned at the first capture: operating a control can add a neighbor (a reset button) that would
    // shrink a field computed afresh, and the row it gave up would read as the control's effect.
    const pinned = doc.querySelector(`[data-sweep-field="${id}"]`);
    if (pinned) return pinned;
    const all = [...root.querySelectorAll(CANDIDATES)].filter((c) => !subordinate(c, root));
    const field = fieldOf(el, all, root);
    field.dataset.sweepField = id;
    return field;
  };

  /** Per element of `root` outside `exclude` and not matching `ignore`, by its child-index path: a hash of tag, attributes, text and value. */
  const digest = (root, exclude, ignore) => {
    const out = {};
    const walk = (el, path) => {
      if (exclude.includes(el) || (ignore && el.matches(ignore))) return;
      const attrs = [...el.attributes].filter((a) => !IGNORED_ATTR.test(a.name)).map((a) => `${a.name}=${a.value}`).sort();
      let s = `${el.tagName}[${attrs.join(' ')}]`;
      for (const n of el.childNodes) {
        if (n.nodeType === 3) {
          const t = squash(n.data);
          if (t) s += `"${t}"`;
        }
      }
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') s += ` v=${el.value}${el.checked ? ' on' : ''}`;
      out[path] = fnv(s);
      let i = 0;
      for (const c of el.children) walk(c, `${path}.${i++}`);
    };
    walk(root, '0');
    return out;
  };

  /** A 2D canvas's own pixels, hashed, so nothing drawn over or under it counts; undefined when it cannot be read. */
  const pixelHash = (c) => {
    try {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
      let h = 0x811c9dc5;
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193);
      return `${c.width}x${c.height}:${(h >>> 0).toString(16)}`;
    } catch {
      return undefined;
    }
  };

  /** The demo's DOM digest and the on-screen rect of each canvas, both without the field of control `id`; the digest also without what matches `ignore`. */
  const capture = (rootSel, id, ignore) => {
    const root = doc.querySelector(rootSel);
    if (!root) return { dom: {}, canvases: [] };
    const field = fieldById(rootSel, id);
    const exclude = field ? [field] : [];
    const vw = w.innerWidth;
    const vh = w.innerHeight;
    const names = [];
    const canvases = [...root.querySelectorAll('canvas')].filter((c) => !exclude.some((x) => x.contains(c))).flatMap((c) => {
      const r = c.getBoundingClientRect();
      const x = Math.max(0, r.left);
      const y = Math.max(0, r.top);
      const width = Math.min(vw, r.right) - x;
      const height = Math.min(vh, r.bottom) - y;
      if (width < 1 || height < 1) return [];
      // A canvas no one ever drew on (an idle buffer) shows only what lies under it.
      if (!c.__sweepContext) return [];
      const named = c.closest('[aria-label],[class]');
      names.push(`${squash(c.getAttribute('aria-label') ?? named?.getAttribute('aria-label') ?? String(named?.className ?? '').split(' ')[0])} ${c.__sweepContext} ${Math.round(r.width)}×${Math.round(r.height)}`);
      const pixels = c.__sweepContext === '2d' ? pixelHash(c) : undefined;
      return [pixels ? { pixels } : { x, y, width, height }];
    });
    const dom = digest(root, exclude, ignore);
    // A popup the control opens lives outside the frame; that it is open is the change.
    dom.popups = String([...doc.querySelectorAll(POPUPS)].filter((p) => !root.contains(p) && visible(p)).length);
    return { dom, canvases, names };
  };

  /** A short description of the element at each digest path, for a person reading what changed. */
  const describePaths = (rootSel, paths) => {
    const root = doc.querySelector(rootSel);
    return paths.map((path) => {
      let el = root;
      for (const i of path.split('.').slice(1)) el = el?.children[Number(i)];
      if (!el) return `${path}: gone`;
      const cls = String(el.className?.baseVal ?? el.className ?? '').split(' ').filter(Boolean)[0];
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${text(el).slice(0, 30)}"`;
    });
  };

  /** What a control holds now: a slider's or field's value and range, a checkbox's state. */
  const state = (id) => {
    const el = byId(id);
    if (!el) return null;
    const num = (v) => (v === null || v === undefined || v === '' ? undefined : Number(v));
    return {
      value: el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.value : el.getAttribute('aria-valuenow'),
      min: num(el.getAttribute('min') ?? el.getAttribute('aria-valuemin')),
      max: num(el.getAttribute('max') ?? el.getAttribute('aria-valuemax')),
      checked: el.checked === true || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true',
      options: el.tagName === 'SELECT' ? [...el.options].filter((o) => !o.disabled).map((o) => o.value) : undefined,
    };
  };

  /** The rect of the demo's largest canvas or SVG surface on screen, for a probing drag. */
  const bigCanvas = (rootSel) => {
    const root = doc.querySelector(rootSel);
    const rects = root ? [...root.querySelectorAll('canvas,svg')].map((c) => c.getBoundingClientRect()).filter((r) => r.width >= 100 && r.height >= 100) : [];
    const r = rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
  };

  /** Marks the element a click on control `id` should land on, and answers its selector. */
  const markHit = (id) => {
    const el = byId(id);
    if (!el) return null;
    const hit = hitOf(el);
    hit.dataset.sweepHit = id;
    return `[data-sweep-hit="${id}"]`;
  };

  /** The items of the open popup (a menu or a listbox), newest popup first, each stamped. */
  const popupItems = (kind) => {
    const sel = kind === 'menu' ? '[role=menu]' : '[role=listbox]';
    const popups = [...doc.querySelectorAll(sel)].filter((p) => visible(p));
    const popup = popups.at(-1);
    if (!popup) return [];
    const items = [...popup.querySelectorAll(kind === 'menu' ? MENU_ITEMS : '[role=option]')].filter((i) => visible(i));
    return items.map((i) => ({
      id: idOf(i),
      label: nameOf(i) || text(i),
      disabled: disabled(i),
      selected: i.getAttribute('aria-selected') === 'true' || i.getAttribute('aria-checked') === 'true',
      submenu: i.hasAttribute('aria-haspopup'),
    }));
  };

  w.__sweep = { discover, capture, digest, state, markHit, popupItems, fieldById, bigCanvas, describePaths };
}
