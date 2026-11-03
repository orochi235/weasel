import { isPageStructure } from '@weasel-js/core';
import { CHART_SCENE_KEY } from '../chartPersistence';

interface SavedNode { page?: unknown; pageRun?: unknown }

/** Every node the session store last saved, page run and pages included. */
export function savedNodes<T>(): (T & SavedNode)[] {
  const raw = localStorage.getItem(CHART_SCENE_KEY);
  return raw ? (JSON.parse(raw) as { nodes: (T & SavedNode)[] }).nodes : [];
}

/** The chart's own nodes as last saved: everything but the page run and its pages, which carry no data. */
export function savedContent<T>(): T[] {
  return savedNodes<T>().filter((n) => !isPageStructure(n));
}
