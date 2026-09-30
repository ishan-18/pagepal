import type { Mood } from '../types';

/** Face parts visible for each mood (built-in characters). */
export const FACE_PARTS: Record<Mood, string[]> = {
  neutral: ['eyes-open', 'mouth-smile'],
  dizzy: ['eyes-spiral', 'mouth-wavy'],
  wince: ['eyes-squeeze', 'mouth-grit'],
  cheer: ['eyes-happy', 'mouth-open'],
  waiting: ['eyes-look', 'mouth-flat'],
  sad: ['eyes-sad', 'mouth-frown'],
  sleepy: ['eyes-lidded', 'mouth-yawn'],
  dozing: ['eyes-closed', 'mouth-rest'],
  shy: ['eyes-open', 'paws', 'mouth-small'],
  concerned: ['eyes-worried', 'mouth-o'],
  confused: ['eyes-confused', 'mouth-side'],
  wink: ['eyes-wink', 'mouth-grin'],
};

/** Effects around the character, shared by every character including custom images. */
export const FX_PARTS: Record<Mood, string[]> = {
  neutral: [],
  dizzy: ['fx-stars'],
  wince: ['fx-sweat'],
  cheer: ['fx-confetti'],
  waiting: ['fx-dots'],
  sad: ['fx-tear'],
  sleepy: ['fx-moon'],
  dozing: ['fx-zzz'],
  shy: ['fx-blush'],
  concerned: ['fx-sweat'],
  confused: ['fx-question'],
  wink: ['fx-sparkle'],
};

export const MOODS = Object.keys(FACE_PARTS) as Mood[];

export const INK = '#2b2340';

const STAR = 'M0 -4.5 L1.3 -1.3 L4.5 0 L1.3 1.3 L0 4.5 L-1.3 1.3 L-4.5 0 L-1.3 -1.3 Z';

export const FACE_SVG = /* svg */ `
<g class="face">
  <circle class="cheek" cx="26" cy="66" r="5" fill="#ff8fb1"/>
  <circle class="cheek" cx="74" cy="66" r="5" fill="#ff8fb1"/>
  <g class="part fx-blush" fill="#ff6f91" opacity=".6">
    <ellipse cx="25" cy="67" rx="8" ry="4.5"/><ellipse cx="75" cy="67" rx="8" ry="4.5"/>
  </g>

  <g fill="${INK}" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
    <g class="part eyes-open" stroke="none">
      <ellipse cx="36" cy="54" rx="5" ry="7"/><ellipse cx="64" cy="54" rx="5" ry="7"/>
      <circle cx="37.6" cy="51" r="1.8" fill="#fff"/><circle cx="65.6" cy="51" r="1.8" fill="#fff"/>
    </g>
    <g class="part eyes-look" stroke="none">
      <ellipse cx="36" cy="52" rx="5" ry="7"/><ellipse cx="64" cy="52" rx="5" ry="7"/>
      <circle cx="37.6" cy="49" r="1.8" fill="#fff"/><circle cx="65.6" cy="49" r="1.8" fill="#fff"/>
    </g>
    <g class="part eyes-spiral" fill="none" stroke-width="2">
      <path class="spin" d="M36 54 a1.5 1.5 0 1 1 3 0 a3 3 0 1 1 -6 0 a4.5 4.5 0 1 1 9 0 a6 6 0 1 1 -12 0"/>
      <path class="spin" d="M64 54 a1.5 1.5 0 1 1 3 0 a3 3 0 1 1 -6 0 a4.5 4.5 0 1 1 9 0 a6 6 0 1 1 -12 0"/>
    </g>
    <g class="part eyes-squeeze" fill="none" stroke-width="3">
      <path d="M31 48 L40 54 L31 60"/><path d="M69 48 L60 54 L69 60"/>
    </g>
    <g class="part eyes-happy" fill="none" stroke-width="3.2">
      <path d="M30 57 Q36 46 42 57"/><path d="M58 57 Q64 46 70 57"/>
    </g>
    <g class="part eyes-sad">
      <ellipse cx="36" cy="57" rx="4.5" ry="6" stroke="none"/><ellipse cx="64" cy="57" rx="4.5" ry="6" stroke="none"/>
      <path d="M28 47 L42 43" fill="none" stroke-width="2.5"/><path d="M58 43 L72 47" fill="none" stroke-width="2.5"/>
    </g>
    <g class="part eyes-lidded" stroke-width="2.5">
      <path d="M31 54 A5 5 0 0 0 41 54 Z" stroke="none"/><path d="M59 54 A5 5 0 0 0 69 54 Z" stroke="none"/>
      <path d="M29.5 54 H42.5 M57.5 54 H70.5" fill="none"/>
    </g>
    <g class="part eyes-closed" fill="none" stroke-width="2.8">
      <path d="M30 54 Q36 60 42 54"/><path d="M58 54 Q64 60 70 54"/>
    </g>
    <g class="part eyes-worried">
      <ellipse cx="36" cy="56" rx="4.6" ry="6.2" stroke="none"/><ellipse cx="64" cy="56" rx="4.6" ry="6.2" stroke="none"/>
      <circle cx="37.4" cy="53.5" r="1.6" fill="#fff" stroke="none"/><circle cx="65.4" cy="53.5" r="1.6" fill="#fff" stroke="none"/>
      <path d="M28 46 Q35 45 41 41" fill="none" stroke-width="2.4"/><path d="M59 41 Q65 45 72 46" fill="none" stroke-width="2.4"/>
    </g>
    <g class="part eyes-confused">
      <ellipse cx="36" cy="56" rx="4.4" ry="5.6" stroke="none"/><ellipse cx="64" cy="54" rx="5.2" ry="7.2" stroke="none"/>
      <circle cx="37.4" cy="53.8" r="1.5" fill="#fff" stroke="none"/><circle cx="65.7" cy="51" r="1.8" fill="#fff" stroke="none"/>
      <path d="M29 47 L42 47" fill="none" stroke-width="2.4"/><path d="M57 42 Q64 36 71 41" fill="none" stroke-width="2.4"/>
    </g>
    <g class="part eyes-wink">
      <path d="M30 56 Q36 47 42 56" fill="none" stroke-width="3.2"/>
      <ellipse cx="64" cy="54" rx="5" ry="7" stroke="none"/><circle cx="65.6" cy="51" r="1.8" fill="#fff" stroke="none"/>
    </g>

    <path class="part mouth-smile" d="M44 69 Q50 74 56 69" fill="none" stroke-width="2.5"/>
    <path class="part mouth-wavy" d="M41 71 q2.25 -3 4.5 0 t4.5 0 t4.5 0 t4.5 0" fill="none" stroke-width="2.5"/>
    <g class="part mouth-grit" stroke-width="2">
      <rect x="41" y="66" width="18" height="8" rx="3" fill="#fff"/>
      <path d="M41 70 H59 M47 66 V74 M53 66 V74" fill="none" stroke-width="1.5"/>
    </g>
    <g class="part mouth-open" stroke="none">
      <path d="M39 65 Q50 84 61 65 Z"/>
      <ellipse cx="50" cy="73.5" rx="5" ry="2.6" fill="#ff6f91"/>
    </g>
    <path class="part mouth-flat" d="M45 71 L55 70" fill="none" stroke-width="2.5"/>
    <path class="part mouth-frown" d="M43 75 Q50 67 57 75" fill="none" stroke-width="2.5"/>
    <ellipse class="part mouth-yawn yawn" cx="50" cy="71" rx="3.5" ry="4.5" stroke="none"/>
    <path class="part mouth-rest" d="M47 71 Q50 73 53 71" fill="none" stroke-width="2"/>
    <path class="part mouth-small" d="M46 71 Q50 74 54 71" fill="none" stroke-width="2"/>
    <ellipse class="part mouth-o" cx="50" cy="72" rx="3.2" ry="3.8" fill="none" stroke-width="2.2"/>
    <path class="part mouth-side" d="M44 72 Q49 69 56 70" fill="none" stroke-width="2.4"/>
    <path class="part mouth-grin" d="M41 66 Q50 77 59 66" fill="none" stroke-width="2.5"/>
  </g>

  <g class="part paws">
    <g class="paw paw-l"><ellipse cx="35" cy="56" rx="11" ry="8.5"/><path d="M30 48.5 v3.5 M35 47.5 v3.5 M40 48.5 v3.5"/></g>
    <g class="paw paw-r"><ellipse cx="65" cy="56" rx="11" ry="8.5"/><path d="M60 48.5 v3.5 M65 47.5 v3.5 M70 48.5 v3.5"/></g>
  </g>
</g>`;

export const FX_SVG = /* svg */ `
<g class="part fx-stars" transform="translate(50 9)" fill="#ffd23f" stroke="#e0a800" stroke-width=".6">
  <path class="star s1" d="${STAR}"/><path class="star s2" d="${STAR}"/><path class="star s3" d="${STAR}"/>
</g>
<path class="part fx-sweat" d="M84 30 Q89 39 84 42 Q79 39 84 30 Z" fill="#7cc7ff"/>
<g class="part fx-confetti">
  <rect class="c1" x="14" y="20" width="5" height="5" fill="#ffd23f"/>
  <rect class="c2" x="80" y="18" width="5" height="5" fill="#ff6f91"/>
  <rect class="c3" x="24" y="6" width="4" height="6" fill="#56c98a"/>
  <rect class="c4" x="72" y="4" width="4" height="6" fill="#7cc7ff"/>
  <circle class="c5" cx="50" cy="0" r="2.5" fill="#ffd23f"/>
</g>
<g class="part fx-dots" fill="${INK}">
  <circle class="d1" cx="80" cy="10" r="3"/><circle class="d2" cx="89" cy="10" r="3"/><circle class="d3" cx="98" cy="10" r="3"/>
</g>
<path class="part fx-tear" d="M33 63 Q36 69 33 71 Q30 69 33 63 Z" fill="#7cc7ff"/>
<path class="part fx-moon" d="M14 4 A9 9 0 1 0 24 17 A7 7 0 1 1 14 4 Z" fill="#ffe27a"/>
<g class="part fx-zzz" fill="${INK}" font-family="system-ui, sans-serif" font-weight="700">
  <text class="z1" x="74" y="30" font-size="10">z</text>
  <text class="z2" x="80" y="22" font-size="13">z</text>
  <text class="z3" x="87" y="12" font-size="16">z</text>
</g>
<text class="part fx-question" x="78" y="30" font-size="22" font-weight="800" font-family="system-ui, sans-serif" fill="#2b2340">?</text>
<g class="part fx-sparkle" fill="#ffd23f" stroke="#e0a800" stroke-width=".6">
  <g transform="translate(84 36)"><path class="sp1" d="${STAR}"/></g>
  <g transform="translate(91 46) scale(.6)"><path class="sp2" d="${STAR}"/></g>
</g>`;

/** Progress ring behind the character, driven by `--pp-progress` (0..100). */
export const RING_SVG = /* svg */ `
<g class="ring">
  <circle class="ring-track" cx="50" cy="54" r="49"/>
  <circle class="ring-bar" cx="50" cy="54" r="49" pathLength="100" transform="rotate(-90 50 54)"/>
</g>`;