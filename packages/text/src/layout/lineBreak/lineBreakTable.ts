/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Emitted by `packages/text/scripts/gen-line-break-table.mjs` from the
 * Unicode Character Database. Regenerate with `npm run gen:line-break-table`.
 */

/** The Unicode release this table was generated from. */
export const UNICODE_VERSION = '16.0.0';

// Line-breaking classes after UAX #14's LB1 resolution. QU_PI and QU_PF are
// QU split by General_Category Pi and Pf.
export const BK = 0;
export const CR = 1;
export const LF = 2;
export const NL = 3;
export const SP = 4;
export const ZW = 5;
export const ZWJ = 6;
export const CM = 7;
export const WJ = 8;
export const GL = 9;
export const BA = 10;
export const BB = 11;
export const B2 = 12;
export const HY = 13;
export const CB = 14;
export const CL = 15;
export const CP = 16;
export const EX = 17;
export const IN = 18;
export const NS = 19;
export const OP = 20;
export const QU = 21;
export const IS = 22;
export const NU = 23;
export const PO = 24;
export const PR = 25;
export const SY = 26;
export const AL = 27;
export const HL = 28;
export const ID = 29;
export const EB = 30;
export const EM = 31;
export const H2 = 32;
export const H3 = 33;
export const JL = 34;
export const JV = 35;
export const JT = 36;
export const RI = 37;
export const AK = 38;
export const AP = 39;
export const AS = 40;
export const VF = 41;
export const VI = 42;
export const QU_PI = 43;
export const QU_PF = 44;

/** Low bits of a {@link lineBreakPropsOf} value: the class. */
export const CLASS_MASK = 63;
/** East_Asian_Width is F, W or H — UAX #14's `$EastAsian`. */
export const EAST_ASIAN = 64;
/** Unassigned and Extended_Pictographic, for rule LB30b. */
export const PICTOGRAPHIC_CN = 128;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 71, 73, 74, 79, 81, 82, 83, 84, 88, 89, 91, 93, 94, 95, 96, 97, 98, 155, 157];

// Run-length encoding over the whole code space: each record is a decimal run
// length, then one ALPHABET character indexing PALETTE.
const RUNS = 2787;
const PACKED =
  '9H1K1C2A1B18H1E1R1V1b1Z1Y1b1V1U1Q1b1Z1W1N1W1a10X2W3b1R27b1U1Z1Q29b1U1K1P1b6H1D26H1J1U1Y3Z5b1n1b1' +
  'K2b1Y1Z2b1L6b1o3b1U520b1L3b1L18b1L32b79H1J12H7J13H14b1W260b7H255b1W1K4b1Z1b45H1K1H1b2H1b2H1R1H8b' +
  '27c4b4c13b6X3b3Y2W2b11H1R1H3R43b21H10X1Y2X3b1H99b1R1b7H1X1b6H2b2H1b4H2b10X23b1H30b27H91b11H15b10' +
  'X33b9H4b1W1R3b1H2Z22b4H1b9H1b3H1b5H43b3H52b2X5b9H42b24H1X33H54b3H1b18H1b7H10b2H2K10X17b3H56b1H1b' +
  '7H2b2H2b3H9b1H10b2H2b10X2b2Y5b1Y1b1Z2b1H2b3H56b1H1b5H4b2H2b3H3b1H20b10X2H3b1H11b3H56b1H1b8H1b3H1' +
  'b3H20b2H2b10X1b1Z8b6H1b3H56b1H1b7H2b2H2b3H7b3H10b2H2b10X18b1H59b5H3b3H1b4H9b1H14b10X9b1Z6b5H55b1' +
  'H1b7H1b3H1b4H7b2H11b2H2b10X7b1L9b3H1L55b1H1b7H1b3H1b4H7b2H11b2H2b10X3b1H12b4H55b2H1b7H1b3H1b4H9b' +
  '1H10b2H2b10X9b1Y7b3H70b1H4b6H1b1H1b8H6b10X2b2H61b1H2b7H4b1Z7b8H1b10X2K85b1H2b9H11b7H1b10X39b4L1b' +
  '2L1J2L1K1J5R1J1b1R3b2H6b10X10b1K1H1b1H1b1H1U1P1U1P2H49b14H1K5H1K2H5b11H1b36H1b2K6b1H9b2L1K1L5b2J' +
  '80b20H1b10X2K10b4H4b3H1b3H2b7H3b4H13b12H1b1H10X4H98b96(72f88g349b3H1b1K158b1K639b1K26b1U1P78b3K3' +
  '6b4H28b3H2K27b2H30b2H64b32H2K1T1b1K1b1K1Z1b1H2b10X24b2R2K1L1b2R1b3H1J1H10X107b2H34b1H118b12H4b12' +
  'H8b2R10X128b11X60b5H57b10H1b29H2b1H10X6b10X22b31H49b5H47i16H1m8i1b2K10k2K1d4K10d9H9d3K3H30b13H2b' +
  '10X6b38k12H2l48b20H3b5K10X6b10X36b2K80b3H1b21H4b1H6b1H2b3H198b13H1J46H1J3H509b1L2b7K1J3K1F1H1G2H' +
  '1K1J2K1M3b1n1o1U2n1o1U1n4b3S1K2A5H1J8Y1b1n1o1b2T6b1W1U1P3T12b1K1Y4K1b3K1I5b10H13b1U1P14b1U1P17b7' +
  'Z1Y1Z1y12Z1Y4Z1Y2Z1Y1Z1Y15Z33H18b1Y5b1Y12b1Z251b2Z219b1S24b1U1P1U1P14b2!13b1w1s190b4z3b1!2d1!521' +
  'b2z1b4d16b2!2b1d1b3d1e2d16b8z1b3d12b12z20b1d22b1!10b6z3b1z13b1z8b2z17b2!5d2!3d4b1d1z3d1b1d1!3b2d' +
  '2b1d2b3d8b1!6b1d2!1d1!1b2d1e1!2b1!7d1z2b2d2#2e26b1z35b1z1b1z4b3z1b1z3b6V1b2R1d3b1U1P1U1P1U1P1U1P' +
  '1U1P1U1P1U1P31b3z24b1z14b1z5b1U1P31b1U1P1U1P1U1P1U1P1U1P403b1U1P1U1P1U1P1U1P1U1P1U1P1U1P1U1P1U1P' +
  '1U1P1U1P63b1U1P1U1P32b1U1P285b2z51b1z4b1z409b3H7b1R3K1b1R1K112b1K14b1H96b32H2V1n1o1n1o3V1n1o1V1n' +
  '1o8K1b1K1U1K2b1n1o2b1n1o1U1P1U1P1U1P1U1P4K1R1b2K1b2K5b2M3K1b2K1U8K1b1K1b2K3b2R1U1Q1U1Q1U1Q1U1Q1K' +
  '34b26!1b89!12b214!26b16!1r2s2!1v2!1w1s1w1s1w1s1w1s1w1s2!1w1s1w1s1w1s1w1s1v1w2s10!6p5!1p5!2v2!1d1' +
  'b1v1!1v1!1v1!1v1!1v25!1v31!1v1!1v1!1v6!1v6!2v2b2p4v1!2v1!1v1!1v1!1v1!1v25!1v31!1v1!1v1!1v6!1v6!2' +
  'v4!4v1!5b43!1b94!1b86!9b1!16v31!1b40!8b7024!64z21013!1v1143!3b55!55b2K269b1K1R1K16b10X69b4H1b10H' +
  '32b2H80b2H1b5K266b1H3b1H4b1H23b5H4b1H11b1Y59b2L2R8b2H50b18H8b2K10X6b18H10b1L2b1H10X28b8H2K23b13H' +
  '12b29(3b4H47i13H1m6d3K4d1b1K10k4b2d5b1H10b10X6b41k14H9b3K1H8K2H2b10k2b1d3K27b3H50b1H1b3H2b2H5b2H' +
  '1b1H41b5H2K3b2H236b8H1K2H2b10X6b1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27' +
  '&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&' +
  '1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1' +
  '%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%' +
  '27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%2' +
  '7&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27' +
  '&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&' +
  '1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1' +
  '%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%' +
  '27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%2' +
  '7&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27' +
  '&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&' +
  '1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1' +
  '%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%' +
  '27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%2' +
  '7&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27' +
  '&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&' +
  '1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1' +
  '%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%' +
  '27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%2' +
  '7&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27&1%27' +
  '&1%27&1%27&12b23f4b49g8452b512!29b1c1H10c1b13c1b5c1b1c1b2c1b2c1b10c494b1P1U188b1Y3b16H3s2v2t1w1s' +
  '1u6b1J1H1J1H1J1H2J1H1J1H1J1H2J1H5!1w1s1w1s1w1s1w1s1w1s1w1s1w1s1w1s2!1w1s7!1s1!1s1b2v2t1!1w1s1w1s' +
  '1w1s8!1b1!1y1x1!147b1I1b1t2!1y1x2!1w1s2!1s1!1s11!2v3!1t27!1w1!1s29!1w1!1s1!1w2s1w2s1v1!10v45!2v3' +
  '1!3b6!2b6!2b6!2b3!3b1x1y3!2y1b7z10b3H1O259b3K250b1H226b1H149b5H36b1K48b1K207b10X941b1K199b1K225b' +
  '3H1b2H5b4H40b3H4b1H16b8K141b2H9b6K1S66b7K484b4H8b10X6b10X31b5H1K316b2H1K78b4H70b11H49b4H122b3H2j' +
  '51i14H1m2K5d4b20d10k1H2i2H1i9b1J3H45b11H2b1X4K1H10b1X34b10X6b3H36b14H1b10X4K1b2H44b1H1b1L10b3H48' +
  'b14H4b2K1b1K4H1b2H10X1b1L1b3K76b12H2K1b2K1b1H2b1H103b1K53b12H5b10X6b4H1b8i2b2i2b22i1b7i1b2i1b5i1' +
  'b2H1K7H2b2H2b2H1m2b1k6b1H5b1K2k2i2H2b7H3b5H11b10k1b1k2b1k1b2k36i1b1d9H1b1H2b1H1b4H1b4H1m1j1H3d1b' +
  '2d8b2H82b18H4b4K1b10X2K2b1H81b20H12b10X213b7H2b9H1L2K2R3b15K4b2H82b17H2K13b10X6b13L62b13H8b10X6b' +
  '20X57b15H4b10X2b3K237b15H165b10X22b7i2b1i2b8i1b2i1b24i6H1b2H2b3H1m1j1H1j2H3K9b10k119b7H2b7H1b1L1' +
  'b1H28b10H40b7H1b4H1L1b4K1L1b1H9b11H46b16H3K1b3L2K93b10L230b10X53b8H1b8H1b5K10b10X22b1L1R32b22H1b' +
  '14H122b6H3b1H1b2H1b7H1b1H8b10X48b5H1b2H1b5H8b10X310b18k1K4H2K7b2H1j1H13i1b34i7H3b4H1m2K11d10k1H1' +
  '30b4Y30b1K1136b5K3555b3U3P36b1P3b1U1P1U1P239b1U2P179b1U7J1U1P3J1U1P1U1P1H6b15H4472b1U1P6960b30k1' +
  '8H10k2342b10X4b2K80b10X38b5H1K58b7H3K10b1K11b10X532b2K10X285b2K182b1H1b55H7b4H77b4v1q11b2p14b613' +
  '6!8b768!470z41b1z9!8935b4z1b7z1b2z1b291!15b1v29b3v2b1v14b4v8b396!2465b2H1K4H4172b10X518b46H2b23H' +
  '542b5H3b22H2b7H30b4H148b3H187b87z9b23z1111b50X512b55H4b50H8b1H14b1H2b4K16b5H1b15H1360b7H1b17H2b7' +
  'H1b2H1b5H100b1H160b7H9b10X356b1H61b4H10X5b1Z492b4H10X244b2H1b10X725b7H109b7H5b10X4b2U844b1Y3b1Y8' +
  '47b4d1!39d4*100d12*15d2*15d1*14d1!1*37d10*142b1z2b10z19b56*26h3!13*44!4*9!7*2!14*6!154*33!12d9!1' +
  'd70!1d7!1#14!8d2b2d21!2z5!1z5!3#2!1#2!1#2e2d5!12d17!3d1!3d3!5$63!1d1!1d2#2!11#21!19#3!1#4!3#1!3#' +
  '7!1#1!1#14!1z1!1z1!1z5!1#4!1z1!2z74!2d1!7z16!14z13!12z12b1d4!1d24!12d2e4d1#21d1e4d2#13d1!47d8b24' +
  'd6b1d74!3#3!5#38b3V3T4b35!1#16!3#9!1#5!6d1#3d3!2d3!4*4!11d2!3*4d9!3*116b3d4*5d85b5d6*12!4*1!15*1' +
  '2b4)56b8)10b6)40b8)30b2)12b4)2b62)12b1#2!1#8!8#6!1#9!10#1!1d3#7!1d48!1#61!2#1!2#1!1#17!3#1!13#34' +
  '!84b12*14d2*13!3*10!5*52!3#1!7*15!2*11!6*9#7*240b10X6b1022*2b65534!2b65534!655363b1H30b96H128b24' +
  '0H196112b';

let bmp: Uint8Array | null = null;
let astralStarts: Int32Array | null = null;
let astralValues: Uint8Array | null = null;

function decode(): void {
  const direct = new Uint8Array(0x10000);
  const starts = new Int32Array(RUNS);
  const values = new Uint8Array(RUNS);
  const slot = new Uint8Array(128);
  for (let i = 0; i < ALPHABET.length; i++) slot[ALPHABET.charCodeAt(i)] = PALETTE[i];
  let cp = 0;
  let run = 0;
  let len = 0;
  for (let i = 0; i < PACKED.length; i++) {
    const code = PACKED.charCodeAt(i);
    if (code <= 57 && code >= 48) len = len * 10 + code - 48;
    else {
      const v = slot[code];
      starts[run] = cp;
      values[run] = v;
      if (cp < 0x10000) direct.fill(v, cp, Math.min(cp + len, 0x10000));
      run++;
      cp += len;
      len = 0;
    }
  }
  bmp = direct;
  astralStarts = starts;
  astralValues = values;
}

/**
 * The class of `cp` in the low bits (`& CLASS_MASK`), with the
 * {@link EAST_ASIAN} and {@link PICTOGRAPHIC_CN} flags above them.
 */
export function lineBreakPropsOf(cp: number): number {
  if (bmp === null) decode();
  if (cp < 0x10000) return bmp![cp];
  if (cp > 0x10ffff) return AL;
  const starts = astralStarts!;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= cp) lo = mid;
    else hi = mid - 1;
  }
  return astralValues![lo];
}
