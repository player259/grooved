/**
 * 35 B0 Acoustic Bass Drum  59 B2 Ride Cymbal 2
 * 36 C1 Bass Drum 1         60 C3 Hi Bongo
 * 37 C#1 Side Stick         61 C#3 Low Bongo
 * 38 D1 Acoustic Snare      62 D3 Mute Hi Conga
 * 39 Eb1 Hand Clap          63 Eb3 Open Hi Conga
 * 40 E1 Electric Snare      64 E3 Low Conga
 * 41 F1 Low Floor Tom       65 F3 High Timbale
 * 42 F#1 Closed Hi Hat      66 F#3 Low Timbale
 * 43 G1 High Floor Tom      67 G3 High Agogo
 * 44 Ab1 Pedal Hi-Hat       68 Ab3 Low Agogo
 * 45 A1 Low Tom             69 A3 Cabasa
 * 46 Bb1 Open Hi-Hat        70 Bb3 Maracas
 * 47 B1 Low-Mid Tom         71 B3 Short Whistle
 * 48 C2 Hi Mid Tom          72 C4 Long Whistle
 * 49 C#2 Crash Cymbal 1     73 C#4 Short Guiro
 * 50 D2 High Tom            74 D4 Long Guiro
 * 51 Eb2 Ride Cymbal 1      75 Eb4 Claves
 * 52 E2 Chinese Cymbal      76 E4 Hi Wood Block
 * 53 F2 Ride Bell           77 F4 Low Wood Block
 * 54 F#2 Tambourine         78 F#4 Mute Cuica
 * 55 G2 Splash Cymbal       79 G4 Open Cuica
 * 56 Ab2 Cowbell            80 Ab4 Mute Triangle
 * 57 A2 Crash Cymbal 2      81 A4 Open Triangle
 * 58 Bb2 Vibraslap
 */

import SvgFlam from "./images/flam.svg?raw";
import SvgDrag from "./images/drag.svg?raw";

import {
  DrumNote,
  ATTR_GHOST,
  ATTR_FLAM,
  ATTR_DRAG,
  ATTR_ANNOT_BORDER,
  ATTR_ANNOT_SMALLER, TYPE_ANNOT, ATTR_ANNOT_BELOW, ATTR_ACCENT
} from '$lib/Noted/NotedDrums';
import type { Measure, Meter, Note, Position, Tuplet } from '$lib/Noted/types';
import { Noted } from '$lib/Noted/Noted';

const MIDI_HIHAT_CLOSED = 42;
const MIDI_HIHAT_OPEN = 46;
const MIDI_HIHAT_PEDAL = 44;
const MIDI_SNARE = 38;
const MIDI_SNARE_CROSS_STICK = 37;
const MIDI_BASSDRUM = 36;
const MIDI_TOM_HIGH = 48;
const MIDI_TOM_LOW = 47;
const MIDI_TOM_FLOOR = 43;
const MIDI_RIDE = 51;
const MIDI_CRASH = 49;

export enum Line {
  ANNOT_TOP = 'top',
  CRASH = 'cr',
  RIDE = 'rd',
  HIHAT = 'hh',
  HIGH_TOM = 'ht',
  LOW_TOM = 'lt',
  SNARE = 'sn',
  FLOOR_TOM = 'ft',
  BASSDRUM = 'bd',
  HIHAT_PEDAL = 'hhp',
  ANNOT_BTM = 'btm',
}

export const DEFAULT_LINE_SET: Line[] = [
  Line.ANNOT_TOP,
  Line.CRASH,
  Line.HIHAT,
  Line.HIGH_TOM,
  Line.LOW_TOM,
  Line.SNARE,
  Line.FLOOR_TOM,
  Line.BASSDRUM,
];

export const LINE_LABELS: { [key in Line]: string } = {
  [Line.ANNOT_TOP]: 'Annotation top',
  [Line.CRASH]: 'Crash',
  [Line.RIDE]: 'Ride',
  [Line.HIHAT]: 'Hi-hat',
  [Line.HIGH_TOM]: 'High tom',
  [Line.LOW_TOM]: 'Low tom',
  [Line.SNARE]: 'Snare',
  [Line.FLOOR_TOM]: 'Floor tom',
  [Line.BASSDRUM]: 'Bass drum',
  [Line.HIHAT_PEDAL]: 'Hi-hat pedal',
  [Line.ANNOT_BTM]: 'Annotation bottom',
}

export const MEASURE_NAMES: { [key in Measure]: string } = {
  1: '1st',
  2: '2nd',
  4: '4th',
  8: '8th',
  16: '16th',
  32: '32nd',
  64: '64th',
  128: '128th',
}

export const MEASURE_SYMBOLS: { [key in Measure]: string } = {
  1: '𝅝',
  2: '𝅗𝅥',
  4: '𝅘𝅥',
  8: '𝅘𝅥𝅮',
  16: '𝅘𝅥𝅯',
  32: '𝅘𝅥𝅰',
  64: '𝅘𝅥𝅱',
  128: '𝅘𝅥𝅲',
}

export const DEFAULT_NOTE_SYMBOL = '⬤';
// export const DEFAULT_NOTE_SYMBOL = '◯';
// export const EMPTY_NOTE_SYMBOL = '·';
export const EMPTY_NOTE_SYMBOL = '◯';
export const EMPTY_ANNOT_SYMBOL = '·';
// export const EMPTY_CYMBAL_SYMBOL = '🗙';
export const EMPTY_CYMBAL_SYMBOL = '🞄';

export const LINE_EMPTY_SYMBOL: { [key in Line]: string } = {
  [Line.ANNOT_TOP]: EMPTY_ANNOT_SYMBOL,
  [Line.CRASH]: EMPTY_CYMBAL_SYMBOL,
  [Line.RIDE]: EMPTY_CYMBAL_SYMBOL,
  [Line.HIHAT]: EMPTY_CYMBAL_SYMBOL,
  [Line.HIGH_TOM]: EMPTY_NOTE_SYMBOL,
  [Line.LOW_TOM]: EMPTY_NOTE_SYMBOL,
  [Line.SNARE]: EMPTY_NOTE_SYMBOL,
  [Line.FLOOR_TOM]: EMPTY_NOTE_SYMBOL,
  [Line.BASSDRUM]: EMPTY_NOTE_SYMBOL,
  [Line.HIHAT_PEDAL]: EMPTY_CYMBAL_SYMBOL,
  [Line.ANNOT_BTM]: EMPTY_ANNOT_SYMBOL,
}

export type DrumNoteTemplate = {
  line: Line,
  value: DrumNote,
  attributes?: string[],
  symbol: string,
}

export const TEMPLATES: DrumNoteTemplate[] = [
  { line: Line.CRASH, value: DrumNote.CRASH, symbol: '🗙' },
  { line: Line.RIDE, value: DrumNote.RIDE, symbol: '🗙' },
  { line: Line.RIDE, value: DrumNote.RIDE_BELL, symbol: '△' },
  { line: Line.HIHAT, value: DrumNote.HIHAT_CLOSED, symbol: '🗙' },
  { line: Line.HIHAT, value: DrumNote.HIHAT_OPEN, symbol: '⨂' },
  { line: Line.HIGH_TOM, value: DrumNote.HIGH_TOM, symbol: DEFAULT_NOTE_SYMBOL },
  { line: Line.LOW_TOM, value: DrumNote.LOW_TOM, symbol: DEFAULT_NOTE_SYMBOL },
  { line: Line.SNARE, value: DrumNote.SNARE, symbol: DEFAULT_NOTE_SYMBOL },
  { line: Line.SNARE, value: DrumNote.SNARE, attributes: [ ATTR_GHOST ], symbol: '(●)' },
  { line: Line.SNARE, value: DrumNote.SNARE, attributes: [ ATTR_ACCENT ], symbol: '>' },
  { line: Line.SNARE, value: DrumNote.SNARE, attributes: [ ATTR_FLAM ], symbol: SvgFlam }, // 𝆔
  { line: Line.SNARE, value: DrumNote.SNARE, attributes: [ ATTR_DRAG ], symbol: SvgDrag }, // ♫
  { line: Line.SNARE, value: DrumNote.SIDE_STICK, symbol: '🗙' },
  { line: Line.FLOOR_TOM, value: DrumNote.FLOOR_TOM, symbol: DEFAULT_NOTE_SYMBOL },
  { line: Line.BASSDRUM, value: DrumNote.BASSDRUM, symbol: DEFAULT_NOTE_SYMBOL },
  { line: Line.HIHAT_PEDAL, value: DrumNote.HIHAT_PEDAL, symbol: '🗙' },
];

export type AnnotationTemplate = {
  value: string,
  attributes?: string[],
}
export const ANNOT_TEMPLATE: AnnotationTemplate[] = [
  { value: 'K' },
  { value: 'S' },
  { value: 'flam', attributes: [ ATTR_ANNOT_BORDER, ATTR_ANNOT_SMALLER ] },
  { value: 'H' },
  { value: 'OH' },
  { value: 'FHH' },
  { value: '○' },
  { value: '+' },
  { value: 'UP', attributes: [ ATTR_ANNOT_SMALLER ] },
  { value: 'DOWN', attributes: [ ATTR_ANNOT_SMALLER ] },
  { value: 'TAP', attributes: [ ATTR_ANNOT_SMALLER ] },
  { value: 'FULL', attributes: [ ATTR_ANNOT_SMALLER ] },
  { value: 'T1' },
  { value: 'T2' },
  { value: 'FT' },
  { value: 'CRC' },
  { value: 'RC' },
  { value: 'H/K' },
  { value: 'H/S' },
  { value: 'OH/K' },
  { value: 'OH/S' },
];

export type AutofillTemplate = {
  name: string,
  measure: Measure,
  effectiveMeasure: Measure,
  each: number,
  skip?: number,
}
export const AUTOFILL_TEMPLATES: AutofillTemplate[] = [
  {
    name: MEASURE_NAMES[4],
    measure: 4,
    effectiveMeasure: 4,
    each: 1,
  },
  {
    name: MEASURE_NAMES[4] + ' offbeat',
    measure: 4,
    effectiveMeasure: 8,
    each: 2,
    skip: 1,
  },
  {
    name: MEASURE_NAMES[8],
    measure: 8,
    effectiveMeasure: 8,
    each: 1,
  },
  {
    name: MEASURE_NAMES[8] + ' offbeat',
    measure: 8,
    effectiveMeasure: 16,
    each: 2,
    skip: 1,
  },
  {
    name: MEASURE_NAMES[16],
    measure: 16,
    effectiveMeasure: 16,
    each: 1,
  },
  {
    name: MEASURE_NAMES[16] + ' offbeat',
    measure: 16,
    effectiveMeasure: 32,
    each: 2,
    skip: 1,
  },
];

export type Tick = {
  position: Position,
  noteMap: Map<Line, { note: Note, symbol: string }>,
}
export type Part = {
  index: number,
  measure: Measure,
  tuplet?: Tuplet,
  ticks: Tick[],
  hash: string,
}

export function calculatePartSize(meter: Meter, measure: Measure): number {
  return measure * (meter[0] % 3 === 0 ? 3 : 1) / meter[1];
}

export function createParts(notes: Note[], bar: number, meter: Meter, prevParts?: Part[]): Part[] {
  const DEFAULT_MEASURE: Measure = 8;

  function maxOf<T extends number>(...values: [T, ...T[]]): T {
    return values.reduce((r, v) => v > r ? v : r, values[0]);
  }

  const result: Part[] = [];

  // Compound meter support, 6/4 divided into 3/4 + 3/4
  const partsCount = meter[0] % 3 === 0 ? meter[0] / 3 : meter[0];

  for (let i = 0; i < partsCount; i++) {
    const partNotes = notes
      .filter(n => n.position.bar === bar)
      .filter(n => Math.floor(Noted.createDecimalPosition(n.position)[1] / calculatePartSize(meter, 1)) === i);

    // Take existing or detect measure
    const measure = prevParts?.[i]
      ? prevParts?.[i].measure
      : partNotes.reduce((r: Measure, n) => maxOf('offset' in n.position ? n.position.measure : 1, r), DEFAULT_MEASURE);

    // Take existing or detect tuplet
    let tuplet = prevParts?.[i]
      ? prevParts?.[i].tuplet
      : partNotes.reduce((r: Tuplet | undefined, n) => r ?? ('offset' in n.position ? n.position.tuplet : undefined), undefined);

    if (tuplet !== undefined && tuplet[1] > calculatePartSize(meter, measure)) {
      tuplet = undefined;
    }

    const templatePosition = Noted.modifyPosition({ bar, offset: i * calculatePartSize(meter, meter[1]), measure: meter[1]}, measure, tuplet);

    const tickCount = calculatePartSize(meter, measure) * Noted.getTupletMultiplier(tuplet);

    const ticks: Tick[] = [];

    for (let j = 0; j < tickCount; j++) {
      const offset = ('offset' in templatePosition ? templatePosition.offset : 0) + j;
      const position = { ...templatePosition, offset };

      const tickNotes = partNotes.filter(n => Noted.comparePositions(n.position, position) === 0);
      const noteMap: Map<Line, { note: Note, symbol: string }> = new Map();

      for (const n of tickNotes) {
        if (n.type === undefined) {
          for (const template of TEMPLATES) {
            if (template.value === n.value && (template.attributes ?? []).every(a => n.attributes?.includes(a))) {
              noteMap.set(template.line, { note: n, symbol: template.symbol });
            }
          }
        }
        if (n.type === TYPE_ANNOT) {
          const line = n.attributes?.includes(ATTR_ANNOT_BELOW) ? Line.ANNOT_BTM : Line.ANNOT_TOP;

          noteMap.set(line, { note: n, symbol: n.value });
        }
      }

      ticks.push({ position, noteMap });
    }

    result.push({
      index: i,
      measure: measure,
      tuplet: tuplet,
      ticks: ticks,
      hash: `${i} ${measure} ${tuplet?.[0]}/${tuplet?.[1]} ${Noted.getNotesHash(partNotes)}`,
    });
  }

  return result;
}
