/**
 * Cutting text where its script changes. HarfBuzz shapes a buffer as one
 * script in one direction, so a run mixing Latin and Arabic is shaped a piece
 * at a time.
 */
import { bidiClassOf, pairedBracket } from '@weasel-js/bidi';

/**
 * Every value of the Unicode Script property through Unicode 17, but the three
 * that join their neighbors (Common, Inherited, Unknown). The runtime's
 * `\p{Script=…}` answers which one a character is in; a name it does not know
 * yet is skipped, and its characters join their neighbors too.
 */
export const SCRIPT_NAMES = `Latin Arabic Cyrillic Han Hiragana Katakana Hangul Devanagari Greek Hebrew Thai Bengali
Tamil Telugu Gujarati Kannada Malayalam Gurmukhi Oriya Sinhala Myanmar Khmer Lao Georgian Armenian
Ethiopic Tibetan Syriac Thaana Nko Mongolian Bopomofo Javanese Balinese Adlam Samaritan Mandaic
Cherokee Canadian_Aboriginal Ogham Runic Yi Old_Italic Gothic Deseret Tagalog Hanunoo Buhid Tagbanwa
Limbu Tai_Le Linear_B Ugaritic Shavian Osmanya Cypriot Braille Buginese Coptic New_Tai_Lue Glagolitic
Tifinagh Syloti_Nagri Old_Persian Kharoshthi Cuneiform Phoenician Phags_Pa Sundanese Lepcha Ol_Chiki
Vai Saurashtra Kayah_Li Rejang Lycian Carian Lydian Cham Tai_Tham Tai_Viet Avestan Egyptian_Hieroglyphs
Bamum Lisu Meetei_Mayek Imperial_Aramaic Old_South_Arabian Inscriptional_Parthian Inscriptional_Pahlavi
Old_Turkic Kaithi Batak Brahmi Chakma Meroitic_Cursive Meroitic_Hieroglyphs Miao Sharada Sora_Sompeng
Takri Caucasian_Albanian Bassa_Vah Duployan Elbasan Grantha Pahawh_Hmong Khojki Linear_A Mahajani
Manichaean Mende_Kikakui Modi Mro Old_North_Arabian Nabataean Palmyrene Pau_Cin_Hau Old_Permic
Psalter_Pahlavi Siddham Khudawadi Tirhuta Warang_Citi Ahom Anatolian_Hieroglyphs Hatran Multani
Old_Hungarian SignWriting Bhaiksuki Marchen Newa Osage Tangut Masaram_Gondi Nushu Soyombo
Zanabazar_Square Dogra Gunjala_Gondi Makasar Medefaidrin Hanifi_Rohingya Sogdian Old_Sogdian Elymaic
Nandinagari Nyiakeng_Puachue_Hmong Wancho Chorasmian Dives_Akuru Khitan_Small_Script Yezidi
Cypro_Minoan Old_Uyghur Tangsa Toto Vithkuqi Kawi Nag_Mundari Garay Gurung_Khema Kirat_Rai Ol_Onal
Sunuwar Todhri Tulu_Tigalari Sidetic Tai_Yo Beria_Erfe Tolong_Siki`.split(/\s+/);

/** Characters that take the script of the text around them. */
const SHARED = /^[\p{Script=Common}\p{Script=Inherited}\p{Script=Unknown}]$/u;

let tests: Map<string, RegExp> | null = null;

/** The script names this runtime knows, each with its test, in `SCRIPT_NAMES`' order. */
function scriptTests(): Map<string, RegExp> {
  if (tests) return tests;
  tests = new Map();
  for (const name of SCRIPT_NAMES) {
    try {
      tests.set(name, new RegExp(`^\\p{Script=${name}}$`, 'u'));
    } catch {
      // A script newer than this runtime's Unicode.
    }
  }
  return tests;
}

/** The script `ch` is written in, or null when it takes its neighbors'.
 *  `current` is tried first, since most characters continue the piece. */
function scriptOf(ch: string, current: string | null): string | null {
  if (SHARED.test(ch)) return null;
  // Most text is Latin, and the letters below U+0250 that are not shared are all Latin.
  if (ch.codePointAt(0)! < 0x250) return 'Latin';
  const all = scriptTests();
  if (current !== null && all.get(current)?.test(ch)) return current;
  for (const [name, test] of all) if (test.test(ch)) return name;
  return null;
}

/** One stretch of text in a single script. */
export interface ScriptPiece {
  start: number;
  end: number;
  /** Whether the script reads right to left, which HarfBuzz shapes it in. */
  rtl: boolean;
}

/** An open bracket still waiting for its close, and the script it opened in. */
interface Open { close: number; script: string | null }

/** Open brackets remembered at once; deeper nesting forgets the outermost. */
const MAX_OPEN = 64;

/**
 * `text` cut where its script changes, as UTF-16 spans covering all of it.
 *
 * Following UAX #24, a character every script shares (space, digits,
 * punctuation, a combining mark) stays in the piece before it, or the one after
 * it when it opens the text; a closing bracket takes the script its opening
 * bracket was in, so the `)` of `abc (שלום) def` goes with the Latin. A
 * piece reads right to left when the first of its own letters with a strong
 * `Bidi_Class` is R or AL. Empty text has no pieces.
 */
export function scriptPieces(text: string): ScriptPiece[] {
  const pieces: ScriptPiece[] = [];
  const open: Open[] = [];
  let current: string | null = null;
  let rtl: boolean | null = null;
  let start = 0;
  let at = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    let script = scriptOf(ch, current);
    if (script === null) {
      const bracket = pairedBracket(cp);
      if (bracket?.kind === 'open') {
        if (open.length === MAX_OPEN) open.shift();
        open.push({ close: bracket.pair, script: current });
      } else if (bracket?.kind === 'close') {
        let k = open.length - 1;
        while (k >= 0 && open[k].close !== cp) k--;
        if (k >= 0) {
          script = open[k].script;
          open.length = k;
        }
      }
    }
    if (script !== null) {
      if (current === null) {
        for (const o of open) o.script ??= script;
      } else if (script !== current) {
        pieces.push({ start, end: at, rtl: rtl ?? false });
        start = at;
        rtl = null;
      }
      current = script;
      if (rtl === null) {
        const cls = bidiClassOf(cp);
        if (cls === 'L') rtl = false;
        else if (cls === 'R' || cls === 'AL') rtl = true;
      }
    }
    at += ch.length;
  }
  if (at > start) pieces.push({ start, end: at, rtl: rtl ?? false });
  return pieces;
}
