// OKLCH math from Björn Ottosson: https://bottosson.github.io/posts/oklab/

export type ChromaCurve = {
  lRange: [number, number];
  midL: number;
  cBot: number;
  cPeak: number;
  cTop: number;
};

export type ChromaCurvePoint = { L: number; C: number };

export function oklchToHex(L: number, C: number, Hdeg: number): string {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l_ ** 3, mr = m_ ** 3, sr = s_ ** 3;
  const r = 4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr;
  const g = -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr;
  const bl = -0.0041960863 * lr - 0.7034186147 * mr + 1.707614701 * sr;
  const linToSrgb = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  const toByte = (u: number) => Math.max(0, Math.min(255, Math.round(linToSrgb(u) * 255)));
  const hh = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hh(toByte(r))}${hh(toByte(g))}${hh(toByte(bl))}`;
}

export function chromaAt(L: number, curve: ChromaCurve): number {
  const [lo, hi] = curve.lRange;
  if (L <= lo) return curve.cBot;
  if (L >= hi) return curve.cTop;
  if (L <= curve.midL) return curve.cBot + (curve.cPeak - curve.cBot) * ((L - lo) / (curve.midL - lo));
  return curve.cPeak + (curve.cTop - curve.cPeak) * ((L - curve.midL) / (hi - curve.midL));
}
