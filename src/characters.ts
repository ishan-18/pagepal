import type { CharacterDefinition } from './types';

/** Type helper for your own SVG characters. */
export const defineCharacter = (definition: CharacterDefinition): CharacterDefinition => definition;

const INK = '#2b2340';
const HIGHLIGHT = '<ellipse cx="34" cy="34" rx="10" ry="5.5" fill="#fff" opacity=".22" transform="rotate(-30 34 34)"/>';

// Plain object literals (not defineCharacter() calls) so bundlers can drop unused characters.
export const blob: CharacterDefinition = {
  name: 'blob',
  color: '#7c5cff',
  back: `
    <g class="sprout">
      <path d="M50 16 Q49 8 54 4" fill="none" stroke="#3fa66b" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="58" cy="5" rx="6" ry="3.2" fill="#56c98a" transform="rotate(-20 58 5)"/>
    </g>`,
  body: 'M50 14 C78 14 92 36 92 60 C92 82 74 94 50 94 C26 94 8 82 8 60 C8 36 22 14 50 14 Z',
  front: HIGHLIGHT,
};

export const cat: CharacterDefinition = {
  name: 'cat',
  color: '#ffa94d',
  back: `
    <path class="tail tail-outline" d="M84 84 Q104 76 97 52" fill="none" stroke-width="9" stroke-linecap="round"/>
    <path class="tail tail-fill" d="M84 84 Q104 76 97 52" fill="none" stroke-width="5.5" stroke-linecap="round"/>
    <g class="ear ear-l"><path class="fur" d="M20 40 L24 7 L47 22 Z"/><path d="M26 31 L27.5 14 L39 23 Z" fill="#ff8fb1" opacity=".8"/></g>
    <g class="ear ear-r"><path class="fur" d="M80 40 L76 7 L53 22 Z"/><path d="M74 31 L72.5 14 L61 23 Z" fill="#ff8fb1" opacity=".8"/></g>`,
  body: 'M50 18 C80 18 92 36 92 60 C92 84 74 94 50 94 C26 94 8 84 8 60 C8 36 20 18 50 18 Z',
  front: `${HIGHLIGHT}
    <path d="M47.5 62 L52.5 62 L50 65 Z" fill="#ff6f91"/>
    <path d="M4 61 L19 63.5 M4 68.5 L19 67.5 M96 61 L81 63.5 M96 68.5 L81 67.5" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>`,
};

export const ghost: CharacterDefinition = {
  name: 'ghost',
  color: '#eeeaff',
  body: 'M14 58 C14 30 30 14 50 14 C70 14 86 30 86 58 L86 90 Q81 84 75 90 Q69 96 63 90 Q57 84 50 90 Q43 96 37 90 Q31 84 25 90 Q19 96 14 90 Z',
  front: HIGHLIGHT,
  motion: 'hover',
};
