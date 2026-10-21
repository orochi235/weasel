/** The picture the lens shows: a labeled grid with a mark in each quadrant, so a turn or a zoom reads at a glance. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="#e9eef2"/>
<g stroke="#b8c4ce" stroke-width="0.6">${Array.from({ length: 19 }, (_, i) => `<path d="M${(i + 1) * 10} 0V200M0 ${(i + 1) * 10}H200"/>`).join('')}</g>
<path d="M100 0V200M0 100H200" stroke="#7d8b97" stroke-width="1.2"/>
<circle cx="55" cy="55" r="22" fill="#e08a1e"/>
<rect x="125" y="33" width="44" height="44" rx="6" fill="#2f7fd0"/>
<path d="M55 125l24 44H31z" fill="#2e9e5b"/>
<path d="M147 123l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="#b0413e"/>
<text x="100" y="16" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#4a5864">N</text>
</svg>`;

export const LENS_IMAGE = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
