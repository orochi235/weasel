/** Graphviz's X11 color names that CSS lacks or reads as another color, each as its hex, from X.org's `rgb.txt`.
 *  `grayN` and `greyN` are left to a formula. */
import { getOwn } from '@weasel-js/registry';

const TABLE = `
  antiquewhite1:ffefdb antiquewhite2:eedfcc antiquewhite3:cdc0b0 antiquewhite4:8b8378 aquamarine1:7fffd4
  aquamarine2:76eec6 aquamarine3:66cdaa aquamarine4:458b74 azure1:f0ffff azure2:e0eeee azure3:c1cdcd azure4:838b8b
  bisque1:ffe4c4 bisque2:eed5b7 bisque3:cdb79e bisque4:8b7d6b blue1:0000ff blue2:0000ee blue3:0000cd blue4:00008b
  brown1:ff4040 brown2:ee3b3b brown3:cd3333 brown4:8b2323 burlywood1:ffd39b burlywood2:eec591 burlywood3:cdaa7d
  burlywood4:8b7355 cadetblue1:98f5ff cadetblue2:8ee5ee cadetblue3:7ac5cd cadetblue4:53868b chartreuse1:7fff00
  chartreuse2:76ee00 chartreuse3:66cd00 chartreuse4:458b00 chocolate1:ff7f24 chocolate2:ee7621 chocolate3:cd661d
  chocolate4:8b4513 coral1:ff7256 coral2:ee6a50 coral3:cd5b45 coral4:8b3e2f cornsilk1:fff8dc cornsilk2:eee8cd
  cornsilk3:cdc8b1 cornsilk4:8b8878 cyan1:00ffff cyan2:00eeee cyan3:00cdcd cyan4:008b8b darkgoldenrod1:ffb90f
  darkgoldenrod2:eead0e darkgoldenrod3:cd950c darkgoldenrod4:8b6508 darkolivegreen1:caff70 darkolivegreen2:bcee68
  darkolivegreen3:a2cd5a darkolivegreen4:6e8b3d darkorange1:ff7f00 darkorange2:ee7600 darkorange3:cd6600
  darkorange4:8b4500 darkorchid1:bf3eff darkorchid2:b23aee darkorchid3:9a32cd darkorchid4:68228b
  darkseagreen1:c1ffc1 darkseagreen2:b4eeb4 darkseagreen3:9bcd9b darkseagreen4:698b69 darkslategray1:97ffff
  darkslategray2:8deeee darkslategray3:79cdcd darkslategray4:528b8b deeppink1:ff1493 deeppink2:ee1289
  deeppink3:cd1076 deeppink4:8b0a50 deepskyblue1:00bfff deepskyblue2:00b2ee deepskyblue3:009acd
  deepskyblue4:00688b dodgerblue1:1e90ff dodgerblue2:1c86ee dodgerblue3:1874cd dodgerblue4:104e8b
  firebrick1:ff3030 firebrick2:ee2c2c firebrick3:cd2626 firebrick4:8b1a1a gold1:ffd700 gold2:eec900 gold3:cdad00
  gold4:8b7500 goldenrod1:ffc125 goldenrod2:eeb422 goldenrod3:cd9b1d goldenrod4:8b6914 gray:bebebe green:00ff00
  green1:00ff00 green2:00ee00 green3:00cd00 green4:008b00 grey:bebebe honeydew1:f0fff0 honeydew2:e0eee0
  honeydew3:c1cdc1 honeydew4:838b83 hotpink1:ff6eb4 hotpink2:ee6aa7 hotpink3:cd6090 hotpink4:8b3a62
  indianred1:ff6a6a indianred2:ee6363 indianred3:cd5555 indianred4:8b3a3a ivory1:fffff0 ivory2:eeeee0
  ivory3:cdcdc1 ivory4:8b8b83 khaki1:fff68f khaki2:eee685 khaki3:cdc673 khaki4:8b864e lavenderblush1:fff0f5
  lavenderblush2:eee0e5 lavenderblush3:cdc1c5 lavenderblush4:8b8386 lemonchiffon1:fffacd lemonchiffon2:eee9bf
  lemonchiffon3:cdc9a5 lemonchiffon4:8b8970 lightblue1:bfefff lightblue2:b2dfee lightblue3:9ac0cd
  lightblue4:68838b lightcyan1:e0ffff lightcyan2:d1eeee lightcyan3:b4cdcd lightcyan4:7a8b8b lightgoldenrod:eedd82
  lightgoldenrod1:ffec8b lightgoldenrod2:eedc82 lightgoldenrod3:cdbe70 lightgoldenrod4:8b814c lightpink1:ffaeb9
  lightpink2:eea2ad lightpink3:cd8c95 lightpink4:8b5f65 lightsalmon1:ffa07a lightsalmon2:ee9572
  lightsalmon3:cd8162 lightsalmon4:8b5742 lightskyblue1:b0e2ff lightskyblue2:a4d3ee lightskyblue3:8db6cd
  lightskyblue4:607b8b lightslateblue:8470ff lightsteelblue1:cae1ff lightsteelblue2:bcd2ee lightsteelblue3:a2b5cd
  lightsteelblue4:6e7b8b lightyellow1:ffffe0 lightyellow2:eeeed1 lightyellow3:cdcdb4 lightyellow4:8b8b7a
  magenta1:ff00ff magenta2:ee00ee magenta3:cd00cd magenta4:8b008b maroon:b03060 maroon1:ff34b3 maroon2:ee30a7
  maroon3:cd2990 maroon4:8b1c62 mediumorchid1:e066ff mediumorchid2:d15fee mediumorchid3:b452cd
  mediumorchid4:7a378b mediumpurple1:ab82ff mediumpurple2:9f79ee mediumpurple3:8968cd mediumpurple4:5d478b
  mistyrose1:ffe4e1 mistyrose2:eed5d2 mistyrose3:cdb7b5 mistyrose4:8b7d7b navajowhite1:ffdead navajowhite2:eecfa1
  navajowhite3:cdb38b navajowhite4:8b795e navyblue:000080 olivedrab1:c0ff3e olivedrab2:b3ee3a olivedrab3:9acd32
  olivedrab4:698b22 orange1:ffa500 orange2:ee9a00 orange3:cd8500 orange4:8b5a00 orangered1:ff4500
  orangered2:ee4000 orangered3:cd3700 orangered4:8b2500 orchid1:ff83fa orchid2:ee7ae9 orchid3:cd69c9
  orchid4:8b4789 palegreen1:9aff9a palegreen2:90ee90 palegreen3:7ccd7c palegreen4:548b54 paleturquoise1:bbffff
  paleturquoise2:aeeeee paleturquoise3:96cdcd paleturquoise4:668b8b palevioletred1:ff82ab palevioletred2:ee799f
  palevioletred3:cd6889 palevioletred4:8b475d peachpuff1:ffdab9 peachpuff2:eecbad peachpuff3:cdaf95
  peachpuff4:8b7765 pink1:ffb5c5 pink2:eea9b8 pink3:cd919e pink4:8b636c plum1:ffbbff plum2:eeaeee plum3:cd96cd
  plum4:8b668b purple:a020f0 purple1:9b30ff purple2:912cee purple3:7d26cd purple4:551a8b red1:ff0000 red2:ee0000
  red3:cd0000 red4:8b0000 rosybrown1:ffc1c1 rosybrown2:eeb4b4 rosybrown3:cd9b9b rosybrown4:8b6969
  royalblue1:4876ff royalblue2:436eee royalblue3:3a5fcd royalblue4:27408b salmon1:ff8c69 salmon2:ee8262
  salmon3:cd7054 salmon4:8b4c39 seagreen1:54ff9f seagreen2:4eee94 seagreen3:43cd80 seagreen4:2e8b57
  seashell1:fff5ee seashell2:eee5de seashell3:cdc5bf seashell4:8b8682 sienna1:ff8247 sienna2:ee7942 sienna3:cd6839
  sienna4:8b4726 skyblue1:87ceff skyblue2:7ec0ee skyblue3:6ca6cd skyblue4:4a708b slateblue1:836fff
  slateblue2:7a67ee slateblue3:6959cd slateblue4:473c8b slategray1:c6e2ff slategray2:b9d3ee slategray3:9fb6cd
  slategray4:6c7b8b snow1:fffafa snow2:eee9e9 snow3:cdc9c9 snow4:8b8989 springgreen1:00ff7f springgreen2:00ee76
  springgreen3:00cd66 springgreen4:008b45 steelblue1:63b8ff steelblue2:5cacee steelblue3:4f94cd steelblue4:36648b
  tan1:ffa54f tan2:ee9a49 tan3:cd853f tan4:8b5a2b thistle1:ffe1ff thistle2:eed2ee thistle3:cdb5cd thistle4:8b7b8b
  tomato1:ff6347 tomato2:ee5c42 tomato3:cd4f39 tomato4:8b3626 turquoise1:00f5ff turquoise2:00e5ee
  turquoise3:00c5cd turquoise4:00868b violetred:d02090 violetred1:ff3e96 violetred2:ee3a8c violetred3:cd3278
  violetred4:8b2252 wheat1:ffe7ba wheat2:eed8ae wheat3:cdba96 wheat4:8b7e66 yellow1:ffff00 yellow2:eeee00
  yellow3:cdcd00 yellow4:8b8b00
`;

const X11_NOT_CSS: Readonly<Record<string, string>> = Object.fromEntries(
  TABLE.trim().split(/\s+/).map((entry) => {
    const [name, hex] = entry.split(':');
    return [name!, `#${hex!}`];
  }),
);

/** The hex of an X11 name, lowercase, that CSS lacks or reads as another color; `undefined` for any other. */
export const x11NotCss = (lower: string): string | undefined => getOwn(X11_NOT_CSS, lower);
