import { chevron } from '../../../packages/icons/scripts/lib/base.mjs';
import { framed } from './frame.mjs';

// One badge per changeset entry tag (`TAGS` in apps/shared/releases.ts): the Releases filter's
// kind-of-change chips.
export const KINDS = framed({
  // A link pulled apart.
  breaking: `<g transform="rotate(-45 10 10)"><path d="M7.8 7.4H7a2.6 2.6 0 0 0 0 5.2h.8M12.2 7.4H13a2.6 2.6 0 0 1 0 5.2h-.8"/><path d="M10 4.4v1.6M10 14v1.6" stroke-width="1.25"/></g>`,

  // Running out: an hourglass.
  deprecates: `<path d="M6.2 4.6h7.6M6.2 15.4h7.6M7 4.6c0 3.4 3 3.6 3 5.4s-3 2-3 5.4M13 4.6c0 3.4-3 3.6-3 5.4s3 2 3 5.4"/><path d="M8.6 14.2h2.8" stroke-width="1.25"/>`,

  api: `<path d="M8 4.8c-1.6 0-2 .6-2 1.8v1.8c0 .9-.6 1.6-1.4 1.6.8 0 1.4.7 1.4 1.6v1.8c0 1.2.4 1.8 2 1.8M12 4.8c1.6 0 2 .6 2 1.8v1.8c0 .9.6 1.6 1.4 1.6-.8 0-1.4.7-1.4 1.6v1.8c0 1.2-.4 1.8-2 1.8"/>`,

  // A sparkle.
  new: `<path d="M10 4.4c.4 3.6 2 5.2 5.6 5.6-3.6.4-5.2 2-5.6 5.6-.4-3.6-2-5.2-5.6-5.6 3.6-.4 5.2-2 5.6-5.6z"/>`,

  // A path that turns where it used to run straight.
  behavior: `
    <path d="M10.4 6.2h5" stroke-width="1.25" stroke-dasharray="1.4 1.4"/>
    <path d="M4.6 6.2h3.4a2.4 2.4 0 0 1 2.4 2.4v6.4"/><path d="${chevron([10.4, 15.2], [0, 1], 2.4, 45)}"/>`,

  // A table: rows of saved fields.
  data: `<rect x="4.6" y="5" width="10.8" height="10" rx="1"/><path d="M4.6 8.4h10.8M4.6 11.8h10.8M8.6 5v10" stroke-width="1.25"/>`,

  visual: `<path d="M4.4 10s2-3.8 5.6-3.8 5.6 3.8 5.6 3.8-2 3.8-5.6 3.8S4.4 10 4.4 10z"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/>`,

  // A gauge, needle up toward fast.
  // The needle's tip stops a clear gap inside the dial: the dial's inner edge (r 5.4 − 0.75), less a 0.9 gap
  // and the needle's round cap, leaves the tip at r 3.
  perf: `<path d="M4.6 13.6a5.4 5.4 0 0 1 10.8 0"/><path d="M10 13.6 11.72 11.14"/><circle cx="10" cy="13.6" r="1.3" fill="currentColor" stroke="none"/>`,

  // A sticking plaster across the corner: its strip, the pad in the middle and the vent holes either side.
  fix: `<g transform="rotate(-45 10 10)">
    <rect x="3.4" y="7.6" width="13.2" height="4.8" rx="2.4"/>
    <rect x="7.9" y="8.5" width="4.2" height="3" rx="0.5" stroke-width="1.25"/>
    <path d="M5.6 9.3h0M5.6 10.7h0M14.4 9.3h0M14.4 10.7h0" stroke-width="1.25"/></g>`,

  // The works: a cog.
  internal: `<path d="M10.88 6.72 10.72 5.46 9.28 5.46 9.12 6.72 7.6 7.6 6.43 7.11 5.71 8.35 6.72 9.12 6.72 10.88 5.71 11.65 6.43 12.89 7.6 12.4 9.12 13.28 9.28 14.54 10.72 14.54 10.88 13.28 12.4 12.4 13.57 12.89 14.29 11.65 13.28 10.88 13.28 9.12 14.29 8.35 13.57 7.11 12.4 7.6Z"/><circle cx="10" cy="10" r="1.4" stroke-width="1.25"/>`,
});
