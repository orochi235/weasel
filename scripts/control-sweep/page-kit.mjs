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
  const fieldOf = (el, all, root) => {
    const peers = new Set(peersOf(el, all));
    const g = el.closest(PEER_GROUPS);
    let field = g && root.contains(g) && g !== root ? g : el;
    while (field.parentElement && field.parentElement !== root && root.contains(field.parentElement)) {
      const p = field.parentElement;
      if (p.querySelector('canvas') || p.querySelector(STATUS)) break;
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
    if (el.closest('.ckd-demo-resize') || el.hasAttribute('data-wzl-subordinate')) return true;
    const slot = el.getAttribute('slot');
    if (slot === 'increment' || slot === 'decrement') return true;
    return !root.contains(el);
  };

  const describe = (el, all, root) => {
    const kind = kindOf(el);
    const field = fieldOf(el, all, root);
    const own = kind === 'select' || kind === 'number' || kind === 'slider' ? fieldLabelOf(el, field) : '';
    const name = own || nameOf(el) || `(unnamed ${kind})`;
    const g = el.parentElement?.closest(GROUPS);
    const group = g && g !== root && root.contains(g) ? groupNameOf(g) : '';
    const label = group && group !== name ? `${group} › ${name}` : name;
    const d = { id: idOf(el), kind, label, disabled: disabled(el) };
    if (el.tagName === 'SELECT') d.native = true;
    if (kind === 'download') d.skip = 'download link';
    else if (kind === 'file') d.skip = 'file picker';
    else if (d.disabled) d.skip = 'disabled';
    if (kind === 'radio' || kind === 'tab') {
      d.selected = el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' || el.checked === true;
      const chosen = peersOf(el, all).find((p) => p.getAttribute('aria-checked') === 'true' || p.getAttribute('aria-selected') === 'true' || p.checked === true);
      if (chosen) d.restoreTo = idOf(chosen);
    }
    return d;
  };

  /** Every control in `root`, in document order, each with a key unique within the demo. */
  const discover = (rootSel) => {
    const root = doc.querySelector(rootSel);
    if (!root) return [];
    const found = [...root.querySelectorAll(CANDIDATES)].filter((el) => !subordinate(el, root));
    const all = found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
    const seen = new Map();
    const out = [];
    for (const el of all) {
      if (!visible(el)) continue;
      const d = describe(el, all, root);
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
    const all = [...root.querySelectorAll(CANDIDATES)].filter((c) => !subordinate(c, root));
    return fieldOf(el, all, root);
  };

  /** Per element of `root` outside `exclude`, by its child-index path: a hash of tag, attributes, text and value. */
  const digest = (root, exclude) => {
    const out = {};
    const walk = (el, path) => {
      if (exclude.includes(el)) return;
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

  /** The demo's DOM digest and the on-screen rect of each canvas, both without the field of control `id`. */
  const capture = (rootSel, id) => {
    const root = doc.querySelector(rootSel);
    if (!root) return { dom: {}, canvases: [] };
    const field = fieldById(rootSel, id);
    const exclude = field ? [field] : [];
    const vw = w.innerWidth;
    const vh = w.innerHeight;
    const canvases = [...root.querySelectorAll('canvas')].filter((c) => !exclude.some((x) => x.contains(c))).flatMap((c) => {
      const r = c.getBoundingClientRect();
      const x = Math.max(0, r.left);
      const y = Math.max(0, r.top);
      const width = Math.min(vw, r.right) - x;
      const height = Math.min(vh, r.bottom) - y;
      return width >= 1 && height >= 1 ? [{ x, y, width, height }] : [];
    });
    return { dom: digest(root, exclude), canvases };
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

  w.__sweep = { discover, capture, digest, state, markHit, popupItems, fieldById };
}
