/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Emitted by `packages/bidi/scripts/gen-bidi-tables.mjs` from the Unicode
 * Character Database. Regenerate with `npm run gen:bidi-tables`.
 */

import type { BidiClass, PairedBracket } from './types';

/** The Unicode release these tables were generated from. */
export const UNICODE_VERSION = '16.0.0';

const CLASSES: readonly BidiClass[] = [
  'L',
  'R',
  'AL',
  'EN',
  'ES',
  'ET',
  'AN',
  'CS',
  'NSM',
  'BN',
  'B',
  'S',
  'WS',
  'ON',
  'LRE',
  'RLE',
  'LRO',
  'RLO',
  'PDF',
  'LRI',
  'RLI',
  'FSI',
  'PDI',
];

// Run-length encoding of Bidi_Class over the whole code space, defaults from
// DerivedBidiClass.txt's `@missing` lines included. Each record is a run
// length in uppercase base 36 followed by one lowercase letter indexing
// CLASSES; coverage is total, so each run starts where the last one ended.
const CLASS_RUNS = 1239;
const CLASS_PACKED =
  '9j1l1k1l1m1kEj3k1l1m2n3f5n1e1h1e2hAd1h6nQa6nQa4n6j1kQj1h1n4f4n1a2n1j2n2f2d1n1a3n1d1a5nNa1nVa1nCH' +
  'a2n7aEn2aEn5a9n1aHn34i4a2n8a1n5a2n1a1n32a1n3Wa7i74a1n2a2n1f1b19i1b1i1b2i1b2i1b1i1Kb6g2n1c2f1c1h1' +
  'c2nBi1CcLiAg1f2g3c1i2Tc7i1g1n6i2c2i1n4i2cAdNc1iUcRi2JcBiFc17b9i2b4n3b1iOb4i1b9i1b3i1b5i17b3i4b1C' +
  'c2g5c9i16cOi1gWi1Ja1i1a1i4a8i4a1i3a7iAa2iTa1i1Ma1i4a4i8a1iKa2iEa2f7a1f2a1i2a2i1La1i4a2i4a2i2a3i3' +
  'a1iUa2i3a1iBa2i1La1i4a5i1a2i4a1iKa2iDa1f8a6i1a1i1Ma1i2a1i1a4i8a1i7a2iBa2iUa1i1Pa1iCa1i11a6n1f1n5' +
  'a1i3a1i1Ja1i1a3i5a3i1a4i7a2iBa2iKa7n2a1i1Ma1iFa2iKa2iSa2i1La2i4a4i8a1iKa2iTa1i20a1i7a3i1a1i2Ia1i' +
  '2a7i4a1f7a8i2Qa1i2a9iBa7i21a2iRa1i1a1i1a1i4n1FaEi1a5i1a2i5aBi1a10i9a1i2Ua4i1a6i1a2i2a2iPa2i4a3iG' +
  'a4iDa1i2a2i6a1iFa1iJJa3i1CaAn2Ua1nHRa1mQa2n39a3iTa2iUa2iUa2i1Sa2i1a7i8a1i2aBi7a1f1a1iIaAn6aBn3i1' +
  'j1i39a2iYa1i3Aa3i4a2i9a1i6a3i4a1n3a2n48aYnNa2i2a1i1Ma1i1a7i1a1i1a1i2a8i6aAi2a1i1CaVi1Da4i1Ca1i1a' +
  '5i1a1i5a1i14a9iCa2iWa4i2a2i1a3i1Ka1i1a2i3a1i1a3i1Ma8i2a2i48a3i1aDi1a7i4a1i6a1i3a2i5Ia1SiCDa1n1a3' +
  'nBa3nDa3nDa3nDa2n1aBm3j1a1bOn1m1k1o1p1s1q1r1h5fFn1hQn1m6j1t1u1v1w6j1d3a6d2e3n1aAd2e3nHa1CfXiFa2n' +
  '1a4n1a2nAa1n1a3n5a6n1a1n1a1n1a1n4a1fBa2n4a5n5a4n2aGn15a3n4a3Mn1e1f82n1XaQn1a44nMaBnLa14nKd26aCIn' +
  '1a9Fn74aHGn2aWn1a2Xn6Da6n4a3i7a7n3Ja1i2OaWi2MnYaQn1a2HnCa5YnQaGn1m4n3aPn9a4i2a1n5a2n5a3n2Ha2i2n3' +
  'a1n2Ia1n5Ga12n9a1n19a2n1DaGnSa3n1EaFnCa4n4Na4n2Ra2nVa1n534a1SnH3Ka1Jn92a3n2Na4i1nAi2nUa2i28a2iEa' +
  'Yn2Ua1n3Da1i3a1i4a1iPa2i1a4n1iBa2f1Ma4n24a2iQaIiDa1i12a8iPaBi1Aa3i1Ca1i2a4i2a2i13a1i1Va6i2a2i2a2' +
  'iCa1i8a1i1Ba1i1Fa1i1a3i2a2i5a2i1a1i16a2i8a1i37a2n3Da1i2a1i4a1iFN3a1b1iAb1e12bDQcIn3Jc1nWjDc3nGiA' +
  'n6aGiWn1h1n1h1a1n1h9n1f2n2e3n1a1n2f1n4a3Zc1j1a2n3f5n1e1h1e2hAd1h6nQa6nQaBn3Ea2f3n2f1a7n1a9j5n2j7' +
  '5a1n1Qa25n3aDn3a1n2Ka1i6Aa1iRd3Ea5iW5a7Zb1n69b3i1b2i5b4i14b3i4b1i4Lb2i2Ab7nCGb10c4i8cAg6cAgVb5i1' +
  'n6PbVg18b2iJb1Oc4i1CbMcBiVcIb4i3Eb1a1i1IaFiBaKnAa1i2a2iAa3i1Da4i2a2i7a1i1Pa3i10a5i1a8i1Qa1iCa2i1' +
  'Ga9iAa4i2a1i2Na3i2a1i1a2i6a1i2a1i4Da1i3a8iLa2i1La2i3a1i11a7i3a5i1Ya6iDa1i1a1i1a1iEa2i2Da8i2a3i1a' +
  '1iNa1i2Ca6i1a1i4a2i1a2i6Ma4i6a2i1a2iRa2i2Da8i2a1i1a2iVaDn1Qa1i1a1i2a6i1a1i2Ta1i1a1i2a4i1a5i77a9i' +
  '1a2i74a2i1a1i4a1i40a4i2a2i4a1iWa6i2a2i14a6i2a4i8a1i9a6i2a3i1AaDi1a2iBAa7i1a6i2CaMi2a7i1a2i1a2i3E' +
  'a6i3a1i1a2i1a7i1a1i20a2i3a1i1a1i9Na2iBa2i1Ga5i5a1i1a1iNa1i3Ea8n4fHn40Ea1i6aFi8UGaCi3a3i1XCa5i1Na' +
  '7iT4a1i1Ra4i27a1n1a1iF5Ka2i1a4j318a5YnQaAd6aC4n24a1Ai2aNiF4a3i9a8j8i2a7iUa4i1Na2nLa1Un3i1n56a2Fn' +
  'OAa1nPa1nVa1nPa1nVa1nPa1nVa1nPa1nVa1nPa1nAa1EdE8a1Ji4a1Ei8a1iEa1iMa5i1aFi11Sa7i1aHi2a7i1a2i1a5i2' +
  'Sa1i4Ga7iAFa1i1Pa4iFa1fDOa4i72a2iEOa5Sb7i31b7iMDb28c1Sb28c4Wb6Oc2nEc74b18n4a2SnCaFn2aFn1aFn1a11n' +
  'AaBd5nVa1n1Ma6n1Pa1n4Ya6n4AaRCn4aHn3aDn3a3Bn4a2Nn6aCn4a1nFaCn4a1Kn8aAn6a14n8aUn2aCn4a2n1Qa9GnCaE' +
  'n2aDn3aAn5a1Kn7aFn2aBn6a9n7a43n1a2KnAdSKa2j1EKEa2j1EKEa2j1EKEa2j1EKEa2j1EKEa2j1EKEa2j1EKEa2j1EKE' +
  'a2j1EKEa2j1EKEa2j1EKEa2j1EKEa76j6Oi2S0j1BEMa2j1EKEa2j1EKEa2j';

// `<code point>[oc]<pair>` per entry, base 36, ascending by code point.
const BRACKETS =
  '14o15,15c14,2Jo2L,2Lc2J,3Fo3H,3Hc3F,30Ao30B,30Bc30A,30Co30D,30Dc30C,4GRo4GS,4GSc4GR,6DHo6DI,6DIc' +
  '6DH,6F1o6F2,6F2c6F1,6FHo6FI,6FIc6FH,6X4o6X5,6X5c6X4,6X6o6X7,6X7c6X6,6Y1o6Y2,6Y2c6Y1,7S8o7S9,7S9c' +
  '7S8,7SAo7SB,7SBc7SA,7SCo7SD,7SDc7SC,7SEo7SF,7SFc7SE,7SGo7SH,7SHc7SG,7SIo7SJ,7SJc7SI,7SKo7SL,7SLc' +
  '7SK,7UTo7UU,7UUc7UT,7VQo7VR,7VRc7VQ,7VSo7VT,7VTc7VS,7VUo7VV,7VVc7VU,7VWo7VX,7VXc7VW,7VYo7VZ,7VZc' +
  '7VY,877o878,878c877,879o87A,87Ac879,87Bo87C,87Cc87B,87Do87E,87Ec87D,87Fo87G,87Gc87F,87Ho87K,87Ic' +
  '87J,87Jo87I,87Kc87H,87Lo87M,87Mc87L,87No87O,87Oc87N,87Po87Q,87Qc87P,87Ro87S,87Sc87R,89Ko89L,89Lc' +
  '89K,89Mo89N,89Nc89M,8AKo8AL,8ALc8AK,942o943,943c942,944o945,945c944,946o947,947c946,948o949,949c' +
  '948,95Ho95I,95Ic95H,95Jo95K,95Kc95J,95Lo95M,95Mc95L,95No95O,95Oc95N,9HKo9HL,9HLc9HK,9HMo9HN,9HNc' +
  '9HM,9HOo9HP,9HPc9HO,9HQo9HR,9HRc9HQ,9HSo9HT,9HTc9HS,9HWo9HX,9HXc9HW,9HYo9HZ,9HZc9HY,9I0o9I1,9I1c' +
  '9I0,9I2o9I3,9I3c9I2,1E8Po1E8Q,1E8Qc1E8P,1E8Ro1E8S,1E8Sc1E8R,1E8To1E8U,1E8Uc1E8T,1EDKo1EDL,1EDLc1' +
  'EDK,1EEZo1EF1,1EF1c1EEZ,1EFVo1EFX,1EFXc1EFV,1EFZo1EG0,1EG0c1EFZ,1EG2o1EG3,1EG3c1EG2';

// `<code point>:<mirror>` per entry, base 36, ascending by code point.
const MIRRORING =
  '14:15,15:14,1O:1Q,1Q:1O,2J:2L,2L:2J,3F:3H,3H:3F,4R:57,57:4R,30A:30B,30B:30A,30C:30D,30D:30C,4GR:' +
  '4GS,4GS:4GR,6D5:6D6,6D6:6D5,6DH:6DI,6DI:6DH,6F1:6F2,6F2:6F1,6FH:6FI,6FI:6FH,6Q0:6Q3,6Q1:6Q4,6Q2:' +
  '6Q5,6Q3:6Q0,6Q4:6Q1,6Q5:6Q2,6QD:8AD,6QN:8OU,6QO:883,6QP:87V,6QQ:880,6QS:8HA,6RG:6RH,6RH:6RG,6RN:' +
  '6VH,6RP:6RW,6RW:6RP,6S2:6S3,6S3:6S2,6S4:6S5,6S5:6S4,6SK:6SL,6SL:6SK,6SM:6SN,6SN:6SM,6SO:6SP,6SP:' +
  '6SO,6SQ:6SR,6SR:6SQ,6SU:6SV,6SV:6SU,6SW:6SX,6SX:6SW,6SY:6SZ,6SZ:6SY,6T0:6T1,6T1:6T0,6T2:6T3,6T3:' +
  '6T2,6T4:6T5,6T5:6T4,6T6:6T7,6T7:6T6,6T8:6T9,6T9:6T8,6TA:6TB,6TB:6TA,6TC:6TD,6TD:6TC,6TE:6TF,6TF:' +
  '6TE,6TG:6TH,6TH:6TG,6TI:6TJ,6TJ:6TI,6TK:6TL,6TL:6TK,6TM:6TN,6TN:6TM,6TR:6TS,6TS:6TR,6TT:6TU,6TU:' +
  '6TT,6U0:88O,6UA:6UB,6UB:6UA,6UE:8GU,6UG:8H0,6UH:8GZ,6UJ:8H1,6UO:6UP,6UP:6UO,6UQ:6UR,6UR:6UQ,6US:' +
  '6UT,6UT:6US,6UU:6UV,6UV:6UU,6UW:7VG,6VD:6VE,6VE:6VD,6VF:6VG,6VG:6VF,6VH:6RN,6VK:6VL,6VL:6VK,6VQ:' +
  '6VR,6VR:6VQ,6VS:6VT,6VT:6VS,6VU:6VV,6VV:6VU,6VW:6VX,6VX:6VW,6VY:6VZ,6VZ:6VY,6W0:6W1,6W1:6W0,6W2:' +
  '6W3,6W3:6W2,6W4:6W5,6W5:6W4,6W6:6W7,6W7:6W6,6W8:6W9,6W9:6W8,6WA:6WB,6WB:6WA,6WC:6WD,6WD:6WC,6WG:' +
  '6WH,6WH:6WG,6WI:6WQ,6WJ:6WR,6WK:6WS,6WM:6WT,6WN:6WU,6WQ:6WI,6WR:6WJ,6WS:6WK,6WT:6WM,6WU:6WN,6X4:' +
  '6X5,6X5:6X4,6X6:6X7,6X7:6X6,6Y1:6Y2,6Y2:6Y1,7S8:7S9,7S9:7S8,7SA:7SB,7SB:7SA,7SC:7SD,7SD:7SC,7SE:' +
  '7SF,7SF:7SE,7SG:7SH,7SH:7SG,7SI:7SJ,7SJ:7SI,7SK:7SL,7SL:7SK,7UR:7US,7US:7UR,7UT:7UU,7UU:7UT,7UW:' +
  '7UX,7UX:7UW,7UZ:7V1,7V1:7UZ,7V9:7VA,7VA:7V9,7VG:6UW,7VH:7VI,7VI:7VH,7VM:7VN,7VN:7VM,7VO:7VP,7VP:' +
  '7VO,7VQ:7VR,7VR:7VQ,7VS:7VT,7VT:7VS,7VU:7VV,7VV:7VU,7VW:7VX,7VX:7VW,7VY:7VZ,7VZ:7VY,877:878,878:' +
  '877,879:87A,87A:879,87B:87C,87C:87B,87D:87E,87E:87D,87F:87G,87G:87F,87H:87K,87I:87J,87J:87I,87K:' +
  '87H,87L:87M,87M:87L,87N:87O,87O:87N,87P:87Q,87Q:87P,87R:87S,87S:87R,87V:6QP,880:6QQ,883:6QO,884:' +
  '885,885:884,888:889,889:888,88A:88B,88B:88A,88C:88D,88D:88C,88E:88F,88F:88E,88O:6U0,88W:88X,88X:' +
  '88W,890:891,891:890,89B:89C,89C:89B,89D:89E,89E:89D,89G:89H,89H:89G,89K:89L,89L:89K,89M:89N,89N:' +
  '89M,8A0:8A1,8A1:8A0,8AD:6QD,8AG:8AH,8AH:8AG,8AK:8AL,8AL:8AK,8BV:8BW,8BW:8BV,8BX:8BY,8BY:8BX,8C4:' +
  '8C5,8C5:8C4,8CC:8CD,8CD:8CC,8DG:8DH,8DH:8DG,8E1:8E2,8E2:8E1,8E3:8E4,8E4:8E3,8E5:8E6,8E6:8E5,8E7:' +
  '8E8,8E8:8E7,8E9:8EA,8EA:8E9,8EB:8EC,8EC:8EB,8ED:8EE,8EE:8ED,8EF:8EG,8EG:8EF,8EH:8EI,8EI:8EH,8EJ:' +
  '8EK,8EK:8EJ,8EL:8EM,8EM:8EL,8EN:8EO,8EO:8EN,8EP:8EQ,8EQ:8EP,8ER:8ES,8ES:8ER,8ET:8EU,8EU:8ET,8EV:' +
  '8EW,8EW:8EV,8EX:8EY,8EY:8EX,8EZ:8F0,8F0:8EZ,8F1:8F2,8F2:8F1,8F3:8F4,8F4:8F3,8F5:8F6,8F6:8F5,8FA:' +
  '8FB,8FB:8FA,8FC:8FD,8FD:8FC,8FE:8FF,8FF:8FE,8FG:8FH,8FH:8FG,8FJ:8FK,8FK:8FJ,8FL:8FM,8FM:8FL,8FN:' +
  '8FO,8FO:8FN,8FP:8FQ,8FQ:8FP,8FR:8FS,8FS:8FR,8FT:8FU,8FU:8FT,8FV:8FW,8FW:8FV,8FX:8FY,8FY:8FX,8FZ:' +
  '8G0,8G0:8FZ,8G1:8G2,8G2:8G1,8G3:8G4,8G4:8G3,8G5:8G6,8G6:8G5,8G7:8G8,8G8:8G7,8G9:8GA,8GA:8G9,8GB:' +
  '8GC,8GC:8GB,8GD:8GE,8GE:8GD,8GF:8GG,8GG:8GF,8GH:8GI,8GI:8GH,8GJ:8GK,8GK:8GJ,8GL:8GM,8GM:8GL,8GU:' +
  '6UE,8GZ:6UH,8H0:6UG,8H1:6UJ,8H8:8H9,8H9:8H8,8HA:6QS,8HJ:8HK,8HK:8HJ,8HL:8HM,8HM:8HL,8OU:6QN,936:' +
  '937,937:936,938:939,939:938,93D:93E,93E:93D,93G:93H,93H:93G,93W:93X,93X:93W,940:941,941:940,942:' +
  '943,943:942,944:945,945:944,946:947,947:946,948:949,949:948,95H:95I,95I:95H,95J:95K,95K:95J,95L:' +
  '95M,95M:95L,95N:95O,95O:95N,9HK:9HL,9HL:9HK,9HM:9HN,9HN:9HM,9HO:9HP,9HP:9HO,9HQ:9HR,9HR:9HQ,9HS:' +
  '9HT,9HT:9HS,9HW:9HX,9HX:9HW,9HY:9HZ,9HZ:9HY,9I0:9I1,9I1:9I0,9I2:9I3,9I3:9I2,1E8P:1E8Q,1E8Q:1E8P,' +
  '1E8R:1E8S,1E8S:1E8R,1E8T:1E8U,1E8U:1E8T,1E90:1E91,1E91:1E90,1EDK:1EDL,1EDL:1EDK,1EE4:1EE6,1EE6:1' +
  'EE4,1EEZ:1EF1,1EF1:1EEZ,1EFV:1EFX,1EFX:1EFV,1EFZ:1EG0,1EG0:1EFZ,1EG2:1EG3,1EG3:1EG2';

let starts: Int32Array | null = null;
let values: Uint8Array | null = null;

function classTable(): { starts: Int32Array; values: Uint8Array } {
  if (starts === null || values === null) {
    const s = new Int32Array(CLASS_RUNS);
    const v = new Uint8Array(CLASS_RUNS);
    let cp = 0;
    let run = 0;
    let len = 0;
    for (let i = 0; i < CLASS_PACKED.length; i++) {
      const code = CLASS_PACKED.charCodeAt(i);
      if (code >= 97) {
        s[run] = cp;
        v[run] = code - 97;
        run++;
        cp += len;
        len = 0;
      } else {
        len = len * 36 + (code <= 57 ? code - 48 : code - 55);
      }
    }
    starts = s;
    values = v;
  }
  return { starts, values };
}

let brackets: Map<number, PairedBracket> | null = null;
let mirrors: Map<number, number> | null = null;

/**
 * The `Bidi_Class` of a code point.
 *
 * Unassigned code points resolve to the default their block declares, which is
 * `R` or `AL` inside the right-to-left blocks and `L` elsewhere.
 */
export function bidiClassOf(cp: number): BidiClass {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return 'L';
  const table = classTable();
  let lo = 0;
  let hi = table.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (table.starts[mid] <= cp) lo = mid;
    else hi = mid - 1;
  }
  return CLASSES[table.values[lo]];
}

/**
 * The `Bidi_Paired_Bracket` of a code point, for BD16 and rule N0, or `null`
 * where the code point is not one half of a pair.
 */
export function pairedBracket(cp: number): PairedBracket | null {
  if (brackets === null) {
    brackets = new Map();
    for (const record of BRACKETS.split(',')) {
      const at = record.search(/[oc]/);
      brackets.set(parseInt(record.slice(0, at), 36), {
        pair: parseInt(record.slice(at + 1), 36),
        kind: record[at] === 'o' ? 'open' : 'close',
      });
    }
  }
  return brackets.get(cp) ?? null;
}

/**
 * The `Bidi_Mirroring_Glyph` of a code point, or `null` where it has none.
 *
 * This is the mapping rule L4 applies, and only that: it is a hint for
 * selecting a mirrored glyph, not a character transformation, and a font's own
 * `rtlm` feature supersedes it where one exists.
 */
export function mirrorOf(cp: number): number | null {
  if (mirrors === null) {
    mirrors = new Map();
    for (const record of MIRRORING.split(',')) {
      const at = record.indexOf(':');
      mirrors.set(parseInt(record.slice(0, at), 36), parseInt(record.slice(at + 1), 36));
    }
  }
  return mirrors.get(cp) ?? null;
}
