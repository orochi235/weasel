import { useEffect, useRef } from 'react';
import { DOCK_HOST } from './dockDrop';
import s from './ToolbarDock.module.css';

/** Each bar's host element, and the ref that puts it in whichever slot draws the bar. */
export interface BarHosts {
  /** The element bar `id` is portaled into, made on first ask. */
  host: (id: string) => HTMLElement;
  /** A ref for the slot bar `id` sits in: it moves the bar's host there. The same function each time, per bar. */
  attach: (id: string) => (slot: HTMLElement | null) => void;
}

interface Entry {
  host: HTMLElement;
  attach: (slot: HTMLElement | null) => void;
}

/**
 * Hosts for the dock's bars. Each bar is rendered once, into its host, and a move takes the host from one slot to
 * another with a DOM move, so React never remounts the bar and its state, an open menu or a draft, lives through it.
 */
export function useBarHosts(ids: readonly string[]): BarHosts {
  const entries = useRef(new Map<string, Entry>());
  const entry = (id: string): Entry => {
    let e = entries.current.get(id);
    if (!e) {
      const host = document.createElement('div');
      host.className = s.host!;
      host.setAttribute(DOCK_HOST, id);
      let into: HTMLElement | null = null;
      // React detaches a ref before it attaches the next, so a null here is the slot the host last went into.
      const attach = (slot: HTMLElement | null) => {
        if (slot) slot.appendChild(host);
        else if (into && host.parentNode === into) into.removeChild(host);
        into = slot;
      };
      e = { host, attach };
      entries.current.set(id, e);
    }
    return e;
  };
  useEffect(() => {
    for (const id of entries.current.keys()) if (!ids.includes(id)) entries.current.delete(id);
  });
  return { host: (id) => entry(id).host, attach: (id) => entry(id).attach };
}
