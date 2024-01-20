// @ts-ignore
import abc2svg from 'abc2svg/abc2svg-1';

import type {
  Composition, Measure,
  Meter,
  Note,
  Position, Tuplet
} from './types';

import { MEASURES, TUPLETS} from './types';

import { Noted } from './Noted';

import {
  DrumNote,
  TYPE_ANNOT,
  ATTR_ANNOT_BELOW,
  ATTR_ANNOT_BORDER,
  ATTR_ANNOT_LARGER,
  ATTR_ANNOT_SMALLER,
  ATTR_ACCENT,
  ATTR_DRAG,
  ATTR_FLAM,
  ATTR_GHOST,
} from './NotedDrums';
import { calculatePartSize } from '$components/BarBlock/utils';

const REST = 'z';
const EMPTY = 'x';

const enum AbcNote {
  HIHAT_ON_LINE = 'f',
  HIHAT_CLOSED = 'g',
  HIHAT_OPEN = 'g,,', // Replaced, conflicting with HIHAT_CLOSED
  HIHAT_PEDAL = 'd,',
  SNARE = 'c',
  SNARE_ON_LINE = 'B',
  SNARE_BELOW_LINE = 'A',
  SIDE_STICK = 'c,,', // Replaced, conflicting with SNARE
  BASSDRUM = 'F',
  BASSDRUM_ON_LINE = 'E',
  HIGH_TOM = 'e',
  LOW_TOM = 'd',
  FLOOR_TOM = 'A',
  RIDE = 'f',
  RIDE_BELL = 'f,,', // Replaced, conflicting with RIDE
  CRASH = 'a',
  COWBELL = '^D\'', // TODO
}

const enum HeadType {
  X = 'Xhead',
  TRI = 'Trihead',
  X_CIRCLE = 'CircleXhead',
}

type NoteMapEntry = {
  note: AbcNote,
  heads?: HeadType,
  print?: AbcNote,
}

export type StaffStyle = 'full' | 'one_line' | 'one_line_offset' | 'three_line' | 'three_line_offset';

export type Layout = 'full' | 'normal' | 'minimal';

type NoteMap = Map<DrumNote, NoteMapEntry>

const NOTE_MAP_FULL: NoteMap = new Map([
  [DrumNote.HIHAT_CLOSED, { note: AbcNote.HIHAT_CLOSED, heads: HeadType.X }],
  [DrumNote.HIHAT_OPEN, { note: AbcNote.HIHAT_OPEN, heads: HeadType.X_CIRCLE, print: AbcNote.HIHAT_CLOSED }],
  [DrumNote.HIHAT_PEDAL, { note: AbcNote.HIHAT_PEDAL, heads: HeadType.X }],
  [DrumNote.SNARE, { note: AbcNote.SNARE }],
  [DrumNote.SIDE_STICK, { note: AbcNote.SIDE_STICK, heads: HeadType.X, print: AbcNote.SNARE }],
  [DrumNote.BASSDRUM, { note: AbcNote.BASSDRUM }],
  [DrumNote.HIGH_TOM, { note: AbcNote.HIGH_TOM }],
  [DrumNote.LOW_TOM, { note: AbcNote.LOW_TOM }],
  [DrumNote.FLOOR_TOM, { note: AbcNote.FLOOR_TOM }],
  [DrumNote.RIDE, { note: AbcNote.RIDE, heads: HeadType.X }],
  [DrumNote.RIDE_BELL, { note: AbcNote.RIDE_BELL, heads: HeadType.TRI, print: AbcNote.RIDE }],
  [DrumNote.CRASH, { note: AbcNote.CRASH, heads: HeadType.X }],
]);

const NOTE_MAP_ONE_LINE: NoteMap = new Map([
  [DrumNote.SNARE, { note: AbcNote.SNARE_ON_LINE }],
]);

const NOTE_MAP_ONE_LINE_OFFSET: NoteMap = new Map([
  [DrumNote.SNARE, { note: AbcNote.SNARE }],
  [DrumNote.BASSDRUM, { note: AbcNote.SNARE_BELOW_LINE }],
]);

const NOTE_MAP_THREE_LINE: NoteMap = new Map([
  [DrumNote.HIHAT_CLOSED, { note: AbcNote.HIHAT_ON_LINE, heads: HeadType.X }],
  [DrumNote.HIHAT_OPEN, { note: AbcNote.HIHAT_OPEN, heads: HeadType.X_CIRCLE, print: AbcNote.HIHAT_ON_LINE }],
  [DrumNote.SNARE, { note: AbcNote.SNARE_ON_LINE }],
  [DrumNote.BASSDRUM, { note: AbcNote.BASSDRUM_ON_LINE }],
]);

const NOTE_MAP_THREE_LINE_OFFSET: NoteMap = new Map([
  [DrumNote.HIHAT_CLOSED, { note: AbcNote.HIHAT_CLOSED, heads: HeadType.X }],
  [DrumNote.HIHAT_OPEN, { note: AbcNote.HIHAT_OPEN, heads: HeadType.X_CIRCLE, print: AbcNote.HIHAT_CLOSED }],
  [DrumNote.SNARE, { note: AbcNote.SNARE }],
  [DrumNote.BASSDRUM, { note: AbcNote.BASSDRUM }],
]);

const GHOST = '!ghost!';
// const GHOST = '"<("">)"';
// const GHOST = '!(.!!).!';
const ACCENT = '!^accent!';
const OPEN = '!^open!';

const DEFAULT_ANNOTATION_FONT = 'sans-serif';
const DEFAULT_ANNOTATION_FONT_SIZE = 12;

const LOWER_NOTES = [
  DrumNote.HIHAT_PEDAL,
  DrumNote.BASSDRUM,
];

function throwError(message?: string): never {
  throw new Error(message);
}

function generateRandomString(length: number) {
  return [ ...Array(length) ].map(() => (~~(Math.random() * 36)).toString(36)).join('');
}

function renderAnnotation(note: Note, font: { name: string, size: number}) {
  const smallerX = note.attributes?.filter(v => v === ATTR_ANNOT_SMALLER).length ?? 0;
  const largerX = note.attributes?.filter(v => v === ATTR_ANNOT_LARGER).length ?? 0;

  const fontSize = Math.floor(font.size * (smallerX * 0.75 !== 0 ? smallerX * 0.75 : 1) * (largerX * 1.25 !== 0 ? largerX * 1.25 : 1));

  let result = `\n%%annotationfont * ${fontSize} ${note.attributes?.includes(ATTR_ANNOT_BORDER) ? 'box' : 'nobox'}\n`;

  result += `"${note.attributes?.includes(ATTR_ANNOT_BELOW) ? '_' : '^'}${note.value}"`;

  return result;
}

function optimizeDirectives(input: string): string {
  let lastDirective: Map<string, string> = new Map();

  return input.trim().split('\n').filter((l, i, arr) => {
    if (!l.startsWith('%%')) {
      return true;
    }

    const directive = l.split(' ')[0];
    const value = l.replace(directive, '').trim();

    // Forehead lookup for the same directive
    if (arr[i + 1]?.startsWith(directive)) {
      return false;
    }

    if (lastDirective.get(directive) === value) {
      return false;
    }

    lastDirective.set(directive, value);

    return true;
  }).join('\n');
}

function buildAbcBar(notes: Note[], partSize: number, partOffset: number, measure: Measure, noteResolver: (note: Note) => string | undefined): string {
  // TODO Validate all notes relate to one bar

  let commonMeasure: Measure;
  let commonTuplet: Tuplet | undefined;
  if (notes.length === 1 && 'offset' in notes[0].position) {
    commonMeasure = notes[0].position.measure;
    commonTuplet = notes[0].position.tuplet;
  } else if (notes.length > 0) {
    const common = Noted.findCommonMeasure(notes.map(n => n.position));
    if (common === undefined) {
      throw new Error(`Couldn't find common measurement for provided notes: ` + notes.map(n => Noted.positionToString(n.position)).join(', '));
    }
    [commonMeasure, commonTuplet] = common;
  } else {
    commonMeasure = measure;
  }
  // Force quarter not minimum
  commonMeasure = commonMeasure < 4 ? 4 : commonMeasure;

  // Increase measure to fit into part with common tuplet
  while ((commonMeasure * Noted.getTupletMultiplier(commonTuplet)) % (partSize * measure) !== 0 && Noted.isMeasure(commonMeasure * 2)) {
    const value = commonMeasure * 2;
    commonMeasure = Noted.isMeasure(value) ? value : commonMeasure;
  }

  const offsetPosition = Noted.modifyPosition({bar: 0, offset: partOffset, measure: measure}, commonMeasure, commonTuplet);
  const offset = 'offset' in offsetPosition ? offsetPosition.offset : 0;

  const adjustedNotes = notes.map(n => ({
    ...n,
    position: Noted.modifyPosition(n.position, commonMeasure, commonTuplet),
  } as Note));

  const totalTicks = commonMeasure * Noted.getTupletMultiplier(commonTuplet) * partSize / measure;
  if (!Number.isInteger(totalTicks)) {
    throw new Error(`Common measure ${commonMeasure} and tuplet ${commonTuplet ? `${commonTuplet[0]}/${commonTuplet[1]}` : '-'} doesn't fit into: ${partSize}/${measure}`);
  }

  const noteMap: Array<string[]> = Array.from({length: totalTicks}).map(() => []);

  for (const note of adjustedNotes) {
    // Offset always there
    if ('offset' in note.position) {
      const value = (noteMap[note.position.offset - offset] ?? []).filter(v => v !== 'EMPTY');

      const resolved = noteResolver(note);
      if (resolved !== undefined) {
        value.push(resolved);
        noteMap[note.position.offset - offset] = value;
      } else if (value.length === 0) {
        value.push('EMPTY');
        noteMap[note.position.offset - offset] = value;
      }
    }
  }

  let result = '';
  for (let i = 0; i < totalTicks;) {
    // Select max possible grouping
    let grouping = 1;
    let resultMeasure = commonMeasure;

    while (true) {
      // Take tuplet first, then go x2 every time
      const multiplier = grouping === 1 && commonTuplet ? commonTuplet[0] : 2;
      // Out of bounds
      if (i + grouping * multiplier > totalTicks) {
        break;
      }
      // Grouping should start from first note of group
      if (i % (grouping * multiplier) !== 0) {
        break;
      }
      // Out of bounds
      if (noteMap.slice(i + 1, i + grouping * multiplier).length === 0) {
        break;
      }
      // Found other notes, grouping not possible
      if (noteMap.slice(i + 1, i + grouping * multiplier).filter(n => n.filter(v => v !== 'EMPTY').length > 0).length !== 0) {
        break;
      }

      let result = commonMeasure / (grouping * multiplier);
      if (grouping * multiplier > 1 && commonTuplet) {
        result *= Noted.getTupletMultiplier(commonTuplet);
        result *= commonTuplet[1] % 3 === 0 ? 3/2 : 1;
      }
      if (!Noted.isMeasure(result)) {
        break;
      }

      // Limit measure by quarter note (1/4), but always merge tuplets
      if (result < 4 && (grouping > 1 || commonTuplet === undefined)) {
        break;
      }

      grouping = grouping * multiplier;
      resultMeasure = result
    }

    const isDotted = grouping > 1 && commonTuplet !== undefined && commonTuplet[1] % 3 === 0;
    const isTuplet = grouping === 1 && commonTuplet !== undefined;

    if (!Noted.isMeasure(resultMeasure)) {
      throw new Error(`Not a valid Measure: ${resultMeasure}`);
    }

    // Tuplet marker (no grouping applied)
    // Disable flat slopes for tuplets (causes errors and missing brackets ┌X┐)
    if (isTuplet && commonTuplet !== undefined && i % commonTuplet[0] === 0) {
      result += '\n%%beamslope 1\n';
      result += ` (${commonTuplet[0]}:${commonTuplet[1]}`;
    }

    const isAccented = noteMap[i]
      .map(v => v.includes(ACCENT))
      .reduce((c, v) => c || v, false);
    const annotations = noteMap[i]
      .map(v => [...v.matchAll(/%%annotationfont[^"]*?"[\^_@].*?"/gm)])
      .flat()
      .filter(v => !!v)
      .map(v => v.map(vv => vv.startsWith('%%') ? `\n${vv}\n` : vv));
    const graceNotes = noteMap[i]
      .map(v => [...v.matchAll(/{.*}/g)])
      .flat()
      .filter(v => !!v);
    const regularNotes = [...new Set(noteMap[i]
      .map(v => `${v}${isDotted ? '3' : ''}/${isDotted ? resultMeasure * 2 : resultMeasure}`)
      .map(v => v
        .replaceAll(ACCENT, '')
        .replaceAll(/%%annotationfont[^"]*?"[\^_@].*?"/g, '')
        .replaceAll(/{.*?}/g, '')
        .trim()
      ))];

    // Separator (e.g. quarter for simple 4/4, 3 8th notes for 6/4)
    const isCompoundMeter = partSize % 3 === 0;
    const isStrongBeat = !isCompoundMeter
      ? i % (commonMeasure / measure * Noted.getTupletMultiplier(commonTuplet)) === 0
      : i % (commonMeasure / measure * 3 * Noted.getTupletMultiplier(commonTuplet)) === 0;

    // Order: <grace notes><chord symbols><annotations>/<decorations><accidentals><note><octave><note length>
    let renderedNotes = '';
    if (regularNotes.length === 0) {
      renderedNotes = (isStrongBeat && !isTuplet ? ' ' : '') + REST + `${isDotted ? '3' : ''}/${isDotted ? resultMeasure * 2 : resultMeasure}`;
    } else if (regularNotes.length === 1 && regularNotes[0].includes('EMPTY')) {
      renderedNotes = (isStrongBeat && !isTuplet ? ' ' : '') + EMPTY + `${isDotted ? '3' : ''}/${isDotted ? resultMeasure * 2 : resultMeasure}`;
    } else if (regularNotes.length === 1) {
      renderedNotes = graceNotes.join('') + annotations.join('') + (isStrongBeat && !isTuplet ? ' ' : '') + (isAccented ? ACCENT : '') + regularNotes[0].replaceAll('\n', '');
    } else {
      renderedNotes = graceNotes.join('') + annotations.join('') + (isStrongBeat && !isTuplet ? ' ' : '') + (isAccented ? ACCENT : '') + `[${regularNotes.join('').replaceAll('\n', '')}]`;
    }

    result += renderedNotes;

    // Re-enable flat beam slopes after tuplet
    if (isTuplet && commonTuplet !== undefined && i % commonTuplet[0] === commonTuplet[0] - 1) {
      result += '\n%%beamslope 0\n';
    }

    i = i + grouping;
  }

  return result.replaceAll('\n\n', '\n');
}

export const AbcRenderer = {
  compositionToAbc(composition: Composition, params?: {
    barRange?: [number?, number?],
    useLowerVoice?: boolean,
    pageWidth?: number,
    pageScale?: number,
    annotationFont?: { name: string, size: number},
    highlightColor?: string,
    singleLine?: boolean,
    staffStyle?: StaffStyle,
    layout?: Layout,
    detectRepeats?: boolean,
    stretch?: boolean,
  }): string {
    if (!Number.isInteger(composition.meter[0])) {
      throw new Error(`Non-integer meters not supported`);
    }

    const annotationFont = {
      name: params?.annotationFont?.name ?? DEFAULT_ANNOTATION_FONT,
      size: params?.annotationFont?.size ?? DEFAULT_ANNOTATION_FONT_SIZE,
    }

    const upper: string[] = [];
    const lower: string[] = [];

    const renderedCursors: Position[] = [];

    let noteMap = NOTE_MAP_FULL;
    let staffLines = '5';
    switch (params?.staffStyle) {
      case 'one_line':
        noteMap = NOTE_MAP_ONE_LINE;
        staffLines = '1';
        break;
      case 'one_line_offset':
        noteMap = NOTE_MAP_ONE_LINE_OFFSET;
        staffLines = '1';
        break;
      case 'three_line':
        noteMap = NOTE_MAP_THREE_LINE;
        staffLines = '|.|.|';
        break;
      case 'three_line_offset':
        noteMap = NOTE_MAP_THREE_LINE_OFFSET;
        staffLines = '|.|.|';
        break;
    }

    let hideFields = 'TQ';
    let clef = 'perc'
    switch (params?.layout) {
      case 'full':
        hideFields = 'T';
        break;
      case 'minimal':
        hideFields = 'TCOPQwWNHRBDFSZM';
        clef = 'none';
        break;
    }

    const startBar = params?.barRange?.[0] ?? 0;
    const endBar = params?.barRange?.[1] ?? Noted.getBarCountFromComposition(composition);
    const startMeter = Noted.getBarMeterFromComposition(composition, startBar);
    const startBpm = Noted.getPositionBpmFromComposition(composition, { bar: startBar });

    let meter = startMeter;
    let bpm = startBpm;
    let barHash: string | undefined;
    for (let i = startBar; i < endBar; i++) {
      const notes = composition.notes.filter(n => n.position.bar === i);

      let meterChange: Meter | undefined = Noted.getBarMeterFromComposition(composition, i);
      // Meter changes to same value, skipping
      if (meter[0] === meterChange[0] && meter[1] === meterChange[1]) {
        meterChange = undefined;
      }
      meter = meterChange ?? meter;

      // Last bpm change in bar
      let bpmChange: number | undefined = Noted.getPositionBpmFromComposition(composition, { bar: i, offset: meter[0], measure: meter[1]});
      // BPM changes to same value, skipping
      if (bpmChange !== undefined && bpm === bpmChange) {
        bpmChange = undefined;
      }
      bpm = bpmChange ?? bpm;
      composition.bpmChanges
        ?.filter(c => c.position.bar === i && 'offset' in c.position)
        .forEach((c) => console.warn(`Only straight bar positions (without offset) supported for bpm changes: ${Noted.bpmChangeToString(c)}`))

      // Detect repeats
      if (params?.detectRepeats === true) {
        const currentBarHash = Noted.getBarHashFromComposition(composition, i, true);

        if (currentBarHash === barHash) {
          upper[upper.length - 1] = upper[upper.length - 1].replace(/^(\|:*)\n/, '$1:\n') + ':';
          lower[lower.length - 1] = lower[lower.length - 1].replace(/^(\|:*)\n/, '$1:\n') + ':';
          // lower.push('');

          barHash = currentBarHash;

          continue;
        }

        barHash = currentBarHash;
      }

      const lowerNoteNames: string[] = params?.useLowerVoice ? LOWER_NOTES : [];
      const upperNoteNames: string[] = [...Object.values(DrumNote)].filter(v => !lowerNoteNames.includes(v));

      const upperNotes = notes.filter(n => upperNoteNames.includes(n.value) && n.type === undefined);
      const lowerNotes = notes.filter(n => lowerNoteNames.includes(n.value) && n.type === undefined);

      const annotationsData: Array<{note: Note, merge: boolean, rendered: boolean }> = notes.filter(n => n.type === TYPE_ANNOT).map(a => ({
        note: a,
        merge: [...upperNotes, ...lowerNotes].filter(n => Noted.comparePositions(n.position, a.position) === 0).length > 0,
        rendered: false,
      }));

      // Put the rest of annotations, which are not related to any real note
      upperNotes.push(...annotationsData.filter(v => !v.merge).map(v => v.note));

      const noteResolver = (note: Note) => {
        if (note.type === TYPE_ANNOT) {
          return renderAnnotation(note, annotationFont) + REST;
        }

        let value: string | undefined = noteMap.get(note.value as DrumNote)?.note;

        if (value === undefined) {
          console.warn(`Couldn't map note value: ${Noted.noteToString(note)}`);
          return undefined;
        }

        let result = value;

        // Order: <grace notes><chord symbols><annotations>/<decorations><accidentals><note><octave><note length>
        const isCursorRendered = renderedCursors.find(p => Noted.comparePositions(p, note.position) === 0) !== undefined;
        if (!isCursorRendered) {
          // result = renderCursorAnnotation(note.position) + result;
          renderedCursors.push(note.position);
        }
        if (note.attributes?.includes(ATTR_ACCENT)) {
          result = ACCENT + result;
        }
        if (note.attributes?.includes(ATTR_GHOST)) {
          result = GHOST + result;
        }
        if (note.attributes?.includes(ATTR_FLAM)) {
          result = `{${value}}` + result;
        }
        if (note.attributes?.includes(ATTR_DRAG)) {
          result = `{${value + value}}` + result;
        }

        for (const annotationItem of annotationsData.filter(v => v.merge && !v.rendered)) {
          if (Noted.comparePositions(note.position, annotationItem.note.position) === 0) {
            result = renderAnnotation(annotationItem.note, annotationFont) + result;
            annotationItem.rendered = true;
          }
        }

        return result;
      }

      const meterChangeDirective = meterChange !== undefined ? `M:${meterChange[0]}/${meterChange[1]}\n` : '';
      const tempoChangeDirective = bpmChange !== undefined ? `Q:1/4=${bpmChange}\n` : '';

      let upperBar = '|\n' + meterChangeDirective + tempoChangeDirective;
      let lowerBar = '|\n' + meterChangeDirective + tempoChangeDirective;

      // Compound meter support, 6/4 divided into 3/4 + 3/4
      const partsCount = meter[0] % 3 === 0 ? meter[0] / 3 : meter[0];
      for (let j = 0; j < partsCount; j++) {
        const partNotes = [...upperNotes, ...lowerNotes]
          .filter(n => n.position.bar === i)
          .filter(n => Math.floor(Noted.createDecimalPosition(n.position)[1] / calculatePartSize(meter, 1)) === j);

        upperBar += buildAbcBar(
          partNotes,
          meter[0] / partsCount,
          meter[0] / partsCount * j, meter[1],
          (n) => upperNotes.find(u => u.value === n.value && Noted.comparePositions(u.position, n.position) === 0) !== undefined ? noteResolver(n) : undefined,
        );
        lowerBar += buildAbcBar(
          partNotes,
          meter[0] / partsCount,
          meter[0] / partsCount * j, meter[1],
          (n) => lowerNotes.find(u => u.value === n.value && Noted.comparePositions(u.position, n.position) === 0) !== undefined ? noteResolver(n) : undefined,
        );
      }

      upper.push(upperBar);
      lower.push(lowerBar);
    }

    // Remove redundant | in the start of first bar
    upper[0] = upper[0].replace(/^\|([^:])/, '$1');
    lower[0] = lower[0].replace(/^\|([^:])/, '$1');

    // Add Play Nx anotation
    for (const i of upper.keys()) {
      const repeat = (upper[i].match(/:+$/)?.[0]?.length ?? 0) + 1;

      if (repeat > 1) {
        upper[i] = upper[i].replace(/^(\|:*)\n/, `$1"Play ${repeat}x"\n`)
      }
    }

    // annotationfont   annotation                                    sans-serif 12
    // capofont         capo                                          sans-serif 12
    // composerfont     composer field in tune header                 serifItalic 14
    // cstabfont        chord symbol in tablature                     gchordfont with size / 1.6
    // footerfont       page footer                                   serif 16
    // gchordfont       chord symbol                                  sans-serif 12
    // gridfont         grid                                          serif 16
    // headerfont       page header                                   serif 16
    // historyfont      history and other tune relative information   serif 16
    // infofont         info line (R: and A:) in tune header          serifItalic 14
    // measurefont      measure number                                serifItalic 10
    // partsfont        parts (P:)                                    serif 15
    // repeatfont       repeat sequence number/text                   serif 13
    // setfont-n        n ancillary fonts                             (none) 12
    // subtitlefont     subtitle                                      serif 16
    // tempofont        tempo (Q:)                                    serifBold 15
    // textfont         text                                          serif 16
    // titlefont        tune title                                    serif 20
    // tupletfont       text                                          serifItalic 12
    // vocalfont        lyrics under staff                            serifBold 13
    // voicefont        voice name                                    serifBold 13
    // wordsfont        lyrics under tune                             serif 16

    return `
%abc
%%fullsvg ${generateRandomString(15)}
%%pagewidth ${params?.pageWidth ?? 500}
%%leftmargin 0        % No margins  
%%rightmargin 0       % No margins  
%%topmargin 0         % No margins
%%botmargin 0         % No margins
%%topspace 0          % No margins between pages
%%maxshrink 0         % Do not shrink notes 
%%linewarn 0
%%singleline ${params?.singleLine ? '1' : '0'} % Render all in single line
%%stretchlast ${(params?.stretch ?? false) ? 1 : 0} % Stretch last bar to fit the page width
%%flatbeams 1         % Flat beam slopes for grace notes
%%beamslope 0         % Flat beam slopes
%%tuplets 2 0 2 1     % Always square ┌X┐ brackets with ratio value on top
%%equalbars 1         % Same bar width on different lines
%%notespacingfactor 2 % Spacing between notes depends on their duration
%%linebreak <none>
%%annotationfont ${params?.annotationFont?.name ?? DEFAULT_ANNOTATION_FONT} ${params?.annotationFont?.size ?? DEFAULT_ANNOTATION_FONT_SIZE}
%%pagescale ${params?.pageScale ?? 1}
%%beginsvg
<style>
  .position-cursor {
    fill: transparent;
  }
  .position-cursor.highlight {
    fill: ${params?.highlightColor ?? '#97d7ff'} !important;
  }
</style>
<defs>
  <path id="${HeadType.X}" d="m-3,-3 l6,6 m0,-6 l-6,6" class="stroke" style="stroke-width:1.2"/>
  <path id="${HeadType.TRI}" d="m-3,2 l 6,0 l-3,-6 l-3,6 l6,0" class="stroke" style="stroke-width:1.2"/>
  <path id="${HeadType.X_CIRCLE}" d="m-3,-3 l6,6 m0,-6 l-6,6 m3,-3 m5,0 a5,5 0 1 0 -10,0 a 3,3 0 1 0 10,0" class="stroke" style="stroke-width:1.2"/>
  <g id="GhostDeco">
    <text dx="-8" dy="4" font-size="14px" font-family="serif">(</text>
    <text dx="3" dy="4" font-size="14px" font-family="serif">)</text>
  </g>
  
</defs>
%%endsvg
%%deco ghost 3 GhostDeco 0 0 0
${[...noteMap.entries()].map(([note, params]) => `%%map drum ${params.note} ${params.heads ? `heads=${params.heads}` : ''} print=${params.print ?? params.note}`).join('\n')}
%%stafflines ${staffLines}
%%writefields ${hideFields} false
X:
T:
M:${startMeter[0]}/${startMeter[1]}
L:1/1
K:C clef=${clef}
Q:1/4=${startBpm}
%%score (upper lower)
V:upper stem=up
%%voicemap drum
${optimizeDirectives(upper.join('').replaceAll('\n\n', '\n').replaceAll(':|:', ':|[|:')) + '|'}
V:lower stem=down
%%voicemap drum
%%tuplets 2 0 2 2     % Always square ┌X┐ brackets with ratio value on bottom
${optimizeDirectives(lower.join('').replaceAll('\n\n', '\n').replaceAll(':|:', ':|[|:')) + '|'}
`
  },
  render(source: string): string {
    let result = '';

    type annotationType = 'annot' | 'bar' | 'beam' | 'deco' | 'clef' | 'meter' | 'note' | 'grace' | 'slur' | 'rest';

    // console.log(source);

    let abc: {
      out_svg: (v: string) => void,
      sx: (v: number) => number,
      sy: (v: number) => number,
    };

    const cursors: number[] = [];
    const bars: Map<number, number> = new Map();
    const repeats: Map<number, number> = new Map();

    abc = new abc2svg.Abc({
      errmsg(message: string, line_number: number, column_number: number) {
        console.error(message, 'line:' + line_number, 'column: ' + column_number);
      },
      img_out(svg: string) {
        result += svg;
      },
      anno_start(
        type: annotationType,
        start_offset: number,
        stop_offset: number,
        x: number,
        y: number,
        w: number,
        h: number,
        sym: {
          a_gch: Array<{ font: {box: boolean, size: number}, otext: string, text: String }>,
          time: number,
          dots: number,
          dur: number,
          dur_orig: number,
          in_tuplet: true | undefined,
          notes: Array<{
            pit: number,
            dur: number,
          }>,
          p_v: {
            wmeasure: number,
            meter: {
              a_meter: Array<{top: string, bot: string}>,
            }
          },
          bar_type?: string,
          bar_num?: number,
        },
      ) {
        if (type === 'bar') {
          const bar = sym?.bar_num === undefined ? 0 : sym.bar_num - 1;
          const repeat = (sym.bar_type?.match(/:+$/)?.[0]?.length ?? 0) + 1;

          bars.set(bar, sym.time);
          repeats.set(bar, repeat);
        }
        if (type === 'note' || type === 'rest') {
          for (const symNote of sym.notes) {
            if (cursors.includes(sym.time)) {
              continue;
            }
            cursors.push(sym.time);

            const FULL_NOTE = 1536;
            const dotX = sym.dots === 1 ? 1/3 : 1;

            if (sym.dots > 1) {
              console.warn(`Double dotted notes not supported`);
              continue;
            }
            if (sym.in_tuplet && sym.dots > 0) {
              console.warn(`Tuplet notes with dots not supported`);
              continue;
            }

            const tuplet = sym.in_tuplet
              ? TUPLETS.find(t => Math.abs(sym.dur - (sym.dur_orig / Noted.getTupletMultiplier(t))) < 1) ?? throwError(`Tuplet not detected, dur: ${sym.dur}, dur_orig: ${sym.dur_orig}`)
              : undefined;

            const measure = MEASURES.filter(m => sym.dur_orig * dotX === FULL_NOTE / m)?.[0] ?? throwError(`Measure not detected, dur_orig: ${sym.dur_orig}`);
            const offset = Math.round((sym.time % sym.p_v.wmeasure) / (sym.dur * dotX));
            // const bar = Math.floor(sym.time / sym.p_v.wmeasure);

            // Count all bars with repeats before current note
            const repeatModifier = [...bars.entries()]
              .filter(i => i[1] <= sym.time)
              .slice(0, -1)
              .map(i => (repeats.get(i[0]) ?? 1) - 1)
              .reduce((r, v) => r + v, 0);

            const relativeBar = [...bars.entries()]
              .sort((a, b) => a[1] - b[1])
              .reduce((r, i) => sym.time >= i[1] ? i[0] : r, 0);

            const bar = relativeBar + repeatModifier;

            const position: Position = {
              bar,
              offset,
              measure,
              tuplet,
            };

            for (let i = 0; i < (repeats.get(relativeBar) ?? 1); i++) {
              abc.out_svg(`<rect class="position-cursor" data-position="${Noted.positionToString({ ...position, bar: position.bar + i })}" x="${x}" y="0" width="${w}" height="100%"/>\n`);
            }
          }
        }

        if (type === 'annot' && 'a_gch' in sym) {
          for (const item of sym.a_gch) {
            const text = new String(`<tspan class="annotation ${item.font.box ? 'box' : ''}" data-time="${sym.time}">${item.otext}</tspan>`);
            // @ts-ignore
            text.wh = item.text.wh;

            item.text = text;
          }
        }
      },
    });

    // @ts-ignore
    abc.tosvg('SOURCE', source);

    const parser = new DOMParser();
    const html = parser.parseFromString(result, 'text/html');

    let output = '';

    for (const svgEl of html.getElementsByTagName('svg')) {
      // Align annotations
      let minY = 0;
      let maxY = 0;
      let timesUpper: string[] = [];
      let timesLower: string[] = [];
      for (const el of svgEl.getElementsByClassName('annotation')) {
        const y = Number.parseFloat(el.parentElement?.getAttribute('y') ?? '');
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        const time = el.getAttribute('data-time') ?? '';
        if (y < 0) {
          timesLower.push(time);
        } else {
          timesUpper.push(time);
        }
      }

      for (const el of svgEl.getElementsByClassName('annotation')) {
        const y = Number.parseFloat(el.parentElement?.getAttribute('y') ?? '');
        const time = el.getAttribute('data-time');

        // Ignore multiple annotations
        if (y < 0 && timesLower.filter(t => t === time).length > 1 || y >= 0 && timesUpper.filter(t => t === time).length > 1) {
          continue;
        }
        el.parentElement?.setAttribute('y', String(y < 0 ? minY : maxY));
      }

      // Move cursors to background
      for (const el of svgEl.getElementsByClassName('position-cursor')) {
        el.parentElement?.prepend(el);
      }

      output += svgEl.outerHTML;
    }

    return output;
  }
}
