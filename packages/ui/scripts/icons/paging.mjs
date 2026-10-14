import { chevron } from './base.mjs';

// Paging: one step through a sequence, or all the way to an end of it. The
// chevron is `chevron`'s own, turned on its side; a bar behind it is the end.
const L = 6.6;
const SPREAD = 48;
const BAR = `v9.8`;

export const PAGING = {
  first: `<path d="M5.6 5.1${BAR}"/><path d="${chevron([9.8, 10], [-1, 0], L, SPREAD)}"/>`,
  prev: `<path d="${chevron([7.8, 10], [-1, 0], L, SPREAD)}"/>`,
  next: `<path d="${chevron([12.2, 10], [1, 0], L, SPREAD)}"/>`,
  last: `<path d="${chevron([10.2, 10], [1, 0], L, SPREAD)}"/><path d="M14.4 5.1${BAR}"/>`,
};
