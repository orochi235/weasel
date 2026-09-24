// Stands in for @weasel-js/labkit/styles.css, which labkit's build concatenates from these layers; ui's CSS modules arrive with its components.
import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../packages/labkit/src/styles.less';
// Last, so its Oswald @font-face replaces labkit's, whose URL points into a dist a source build does not have.
import '@weasel-js/theme/fonts.css';
