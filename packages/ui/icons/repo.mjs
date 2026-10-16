// What a code-repository viewer shows, four takes on each: its history, one
// snapshot, a comparison, uncommitted work, types, files hung in space, and a
// demo to watch. Drawn for astv's mode bar, which uses one of each four.
//
// Rules inside a frame sit at .1 past the unit, as form.mjs explains.

export const REPO = {
  // The history: a commit on its line, a rail of them, a clock run back, snapshots stacked.
  commitNode: `<circle cx="10" cy="10" r="3"/><path d="M2.75 10H7M13 10h4.25"/>`,
  commitTimeline: `<path d="M5.5 3.5v13"/><circle cx="5.5" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="5.5" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="5.5" cy="14.5" r="1.6" fill="currentColor" stroke="none"/><path d="M9.5 5.5h7M9.5 10h4.5M9.5 14.5h7"/>`,
  commitHistory: `<path d="M3 10a7 7 0 1 0 7-7 7.6 7.6 0 0 0-5.24 2.13L3 6.9"/><path d="M3 3v3.9h3.9"/><path d="M10 6v4l2.75 1.5"/>`,
  commitFrames: `<rect x="6.5" y="6.5" width="10.5" height="9.5" rx="1.5"/><path d="M4.75 13.5V5.5a1.5 1.5 0 0 1 1.5-1.5h8.5"/>`,

  // One snapshot of the tree: a wall cut into cards, a folder, a hierarchy, a bound volume.
  repoWall: `<rect x="3" y="3.5" width="14" height="13" rx="1.5"/><path d="M9.1 3.5v13M9.1 10.1H17M13.1 10.1v6.4"/>`,
  repoFolder: `<path d="M3 6.25a1.5 1.5 0 0 1 1.5-1.5h3.2l1.6 1.75h6.2a1.5 1.5 0 0 1 1.5 1.5v6.25a1.5 1.5 0 0 1-1.5 1.5h-11a1.5 1.5 0 0 1-1.5-1.5z"/>`,
  repoTree: `<rect x="7.5" y="3" width="5" height="3.5" rx="1"/><rect x="3" y="13.5" width="5" height="3.5" rx="1"/><rect x="12" y="13.5" width="5" height="3.5" rx="1"/><path d="M10 6.5V10M5.5 13.5V10h9v3.5"/>`,
  repoBook: `<path d="M15.5 13.5H6.25a1.75 1.75 0 0 0 0 3.5h9.25V3.5H6.25A1.75 1.75 0 0 0 4.5 5.25v10"/>`,

  // Two versions against each other.
  diffOverlap: `<rect x="3" y="3" width="9.5" height="9.5" rx="1.5"/><rect x="7.5" y="7.5" width="9.5" height="9.5" rx="1.5"/>`,
  diffSplit: `<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M10 4v12M5 10h3M12 10h3M13.5 8.5v3"/>`,
  diffSwap: `<path d="M3.5 7h12M12.5 4l3 3-3 3M16.5 13h-12M7.5 10l-3 3 3 3"/>`,
  diffPlusMinus: `<path d="M10 3.5v7M6.5 7h7M6.5 15.5h7"/>`,

  // Work not yet committed: the dashed node and the dashed branch tip are the commit that is not one yet.
  workPencil: `<path d="M4 16l.8-3.4 8.6-8.6a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2l-8.6 8.6z"/><path d="M12 5.5l2.5 2.5"/>`,
  workFile: `<path d="M5 3.5h6l4 4v9H5z"/><path d="M11 3.5v4h4"/><circle cx="10" cy="12.5" r="1.5" fill="currentColor" stroke="none"/>`,
  workCommit: `<path d="M2.75 10H6.5"/><circle cx="10" cy="10" r="3.5" stroke-linecap="butt" stroke-dasharray="2 1.665" stroke-dashoffset="1"/>`,
  workBranch: `<circle cx="5.5" cy="5" r="2"/><circle cx="5.5" cy="15" r="2"/><path d="M5.5 7v6M5.5 11.5c0-3 3-4 6.25-4.25"/><circle cx="14" cy="7" r="2.25" stroke-linecap="butt" stroke-dasharray="1.9 1.634" stroke-dashoffset="0.95"/>`,

  // Types and how they relate.
  typeClass: `<rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/><path d="M3.5 8.1h13M6.25 11.1h5M6.25 14.1h7.5"/>`,
  typeInherits: `<rect x="5" y="2.75" width="10" height="3.5" rx="1"/><rect x="5" y="13.25" width="10" height="3.5" rx="1"/><path d="M10 13.25V8.4M8 10.4l2-2 2 2"/>`,
  typeBraces: `<path d="M7 3.5c-2 0-2 1.5-2 3s0 2.5-1.75 3.5C5 11 5 12 5 13.5s0 3 2 3M13 3.5c2 0 2 1.5 2 3s0 2.5 1.75 3.5C15 11 15 12 15 13.5s0 3-2 3"/>`,
  typeGeneric: `<path d="M6.5 5.5L2.75 10l3.75 4.5M13.5 5.5l3.75 4.5-3.75 4.5M8 7.5h4M10 7.5v5.5"/>`,

  // Files hung in space.
  cloudOutline: `<path d="M6 15.5a3.5 3.5 0 0 1-.4-6.98A4.75 4.75 0 0 1 14.6 7.6 4 4 0 0 1 14 15.5z"/>`,
  cloudPages: `<rect x="3" y="4" width="5.5" height="7" rx="1"/><rect x="11" y="3" width="4" height="5" rx="1"/><rect x="9.5" y="10.5" width="7.5" height="6.5" rx="1"/>`,
  cloudCube: `<path d="M10 2.75l6.25 3.5v7.5L10 17.25l-6.25-3.5v-7.5z"/><path d="M3.75 6.25L10 9.75l6.25-3.5M10 9.75v7.5"/>`,
  cloudTurned: `<path d="M3 6.5l5-2v9l-5 2zM11 5.25l6-1.75v8L11 13.25z"/>`,

  // Something to watch: a walk along a route, or playback.
  demoPlay: `<circle cx="10" cy="10" r="7"/><path d="M8.5 7.25v5.5l4.5-2.75z"/>`,
  demoScreen: `<rect x="2.75" y="4" width="14.5" height="10" rx="1.5"/><path d="M8.75 7v4l3.25-2zM7 17h6"/>`,
  demoRoute: `<circle cx="4.5" cy="15" r="1.75"/><path d="M6.25 15H12a2.5 2.5 0 0 0 0-5H8a2.5 2.5 0 0 1 0-5h5.5"/><path d="M12.5 3l2 2-2 2"/>`,
  demoClapper: `<rect x="3" y="8" width="14" height="8.5" rx="1.5"/><path d="M3 8l13.5-3.2M6.5 7.2L8 4.6M10.5 6.2L12 3.7"/>`,
};
