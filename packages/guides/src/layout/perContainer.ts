import type { LayoutContainer, LayoutSnap, LayoutStrategy } from '@weasel-js/core';

/** Options for `perContainer`. */
export interface PerContainerOptions<TPose> {
  /** The snap every container shares: a strategy's `snap` is read with no
   *  container in hand, so it cannot come from the one the factory builds. */
  snap: LayoutSnap<TPose>;
  /** Shared for the same reason. Absent, a container's body is its bounds. */
  contains?: LayoutStrategy<TPose>['contains'];
  /** How many containers' strategies to keep. Past it, the one used longest
   *  ago is dropped and built again when next asked for. Default 256. */
  max?: number;
}

/** A strategy `perContainer` built, and the way to drop one container's state. */
export type PerContainerStrategy<TPose> = LayoutStrategy<TPose> & {
  /** Drop what was built for `containerId`: for a container that is gone, or
   *  whose cached state no longer describes it. */
  forget(containerId: string): void;
};

/**
 * A layout strategy that keeps state, as one strategy value: `factory` runs
 * once for each container the layout is asked about, and what it returns
 * serves that container from then on, closing over whatever it caches — a
 * spatial index, the last arrangement, a solver's warm start.
 *
 * Declare the result on as many containers as you like. A method the built
 * strategy leaves out behaves as its absence would.
 */
export function perContainer<TPose>(
  factory: (container: LayoutContainer) => LayoutStrategy<TPose>,
  opts: PerContainerOptions<TPose>,
): PerContainerStrategy<TPose> {
  const max = opts.max ?? 256;
  const built = new Map<string, LayoutStrategy<TPose>>();

  const of = (container: LayoutContainer): LayoutStrategy<TPose> => {
    let strategy = built.get(container.id);
    if (strategy) built.delete(container.id);
    else strategy = factory(container);
    // Re-inserted on every use, so the map's first key is the one used longest ago.
    built.set(container.id, strategy);
    if (built.size > max) built.delete(built.keys().next().value!);
    return strategy;
  };

  return {
    snap: opts.snap,
    contains: opts.contains,
    forget: (containerId) => void built.delete(containerId),

    childPoses: (container, children) => of(container).childPoses(container, children),
    getDropTargets: (container, children, dragged) => of(container).getDropTargets(container, children, dragged),
    reflowPoses: (container, children, dragged, target) =>
      of(container).reflowPoses(container, children, dragged, target),
    commitDrop: (container, children, dragged, target) =>
      of(container).commitDrop(container, children, dragged, target),

    dropRegion: (container) => of(container).dropRegion?.(container) ?? null,
    acceptsDrop: (container, dragged) => of(container).acceptsDrop?.(container, dragged) ?? true,
    arrive(container, children, arrivals) {
      const s = of(container);
      return s.arrive ? s.arrive(container, children, arrivals) : { poses: s.childPoses(container, children) };
    },
    depart(container, children, departed) {
      const s = of(container);
      return s.depart ? s.depart(container, children, departed) : { poses: s.childPoses(container, children) };
    },
    contentExtent: (container, children) =>
      of(container).contentExtent?.(container, children) ?? container.bounds,
    releaseDrop: (container, children, dragged) =>
      of(container).releaseDrop?.(container, children, dragged) ?? null,
  };
}
