import type { CharacterDefinition, CustomCharacter, Mood } from '../types';
import { FACE_PARTS, FACE_SVG, FX_PARTS, FX_SVG, MOODS, RING_SVG } from './face';

export type RenderableCharacter = CharacterDefinition | CustomCharacter;

export const isImages = (character: RenderableCharacter): character is CustomCharacter => 'images' in character;

/** Which parts are visible per mood for this character. */
export function partsFor(character: RenderableCharacter): Record<Mood, string[]> {
  const parts = {} as Record<Mood, string[]>;
  for (const mood of MOODS) {
    const figure = isImages(character)
      ? [`img-${character.images[mood] ? mood : 'neutral'}`]
      : FACE_PARTS[mood];
    parts[mood] = [...figure, ...FX_PARTS[mood]];
  }
  return parts;
}

/**
 * Static SVG markup. Custom image URLs are *not* interpolated here; the view sets
 * them with setAttribute so a URL can never inject markup.
 */
export function buildSvg(character: RenderableCharacter): string {
  let figure: string;
  if (isImages(character)) {
    figure = MOODS.filter((mood) => character.images[mood])
      .map((mood) => `<image class="part img-${mood}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>`)
      .join('');
  } else {
    figure = `${character.back ?? ''}<path class="body" d="${character.body}"/>${character.front ?? ''}${FACE_SVG}`;
  }
  return `<svg class="pal" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${RING_SVG}<g class="gaze"><g class="figure">${figure}</g></g>${FX_SVG}</svg>`;
}
