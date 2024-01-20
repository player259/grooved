import type {
  Position,
  Meter,
  DecimalPosition,
  Composition,
  TimeKey,
  Measure,
  Tuplet,
  Note,
  MeterChange,
  BpmChange,
  RegularPosition,
} from './types';

import { MAX_MEASURE, MEASURES, TUPLETS } from './types';

function throwError(message?: string): never {
  throw new Error(message);
}

/**
 * @see https://stackoverflow.com/a/8831937
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Greater common denominator
 */
function gcd(...args: number[]): number | undefined {
  if (args.filter(Number.isInteger).length !== args.length) {
    throw new Error(`Arguments expected to be integers: ${args.join(', ')}`);
  }
  if (args.length === 0) {
    throw new Error(`No arguments provided`);
  }

  args = [...new Set(args.filter(v => v !== 0))];

  if (args.length === 0) {
    return undefined;
  }
  if (args.length === 1) {
    return args[0];
  }
  if (args.length > 2) {
    const result = gcd(args[0], args[1]);
    return result !== undefined ? gcd(result, ...args.splice(2)) : gcd(...args.splice(2));
  }

  return args[0] === 0 ? args[1] : gcd(args[1] % args[0], args[0]);
}

function parseNumber(input: string | null | undefined): number {
  if (!input) {
    throw new Error(`Invalid number: ${input}`);
  }

  const value = +(input ?? '');

  if (String(input) !== String(value)) {
    throw new Error(`Invalid number: ${input}`);
  }

  return value;
}

function parseInteger(input: string | null | undefined): number {
  const value = parseNumber(input);

  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer: ${input}`);
  }

  return value;
}

export const Noted = {
  isMeasure(value: number): value is Measure {
    return (MEASURES as number[]).includes(value);
  },
  isTuplet(value: [number, number]): value is Tuplet {
    return (TUPLETS as [number, number][]).some(([a, b]) => a === value[0] && b === value[1]);
  },
  getTupletMultiplier(tuplet?: Tuplet) {
    return tuplet !== undefined ? tuplet[0] / tuplet[1] : 1;
  },
  createDecimalPosition(position: Position): DecimalPosition {
    return [position.bar, 'offset' in position ? position.offset / (position.measure * this.getTupletMultiplier(position.tuplet)) : 0];
  },
  compareDecimalPositions(a: DecimalPosition, b: DecimalPosition): number {
    return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
  },
  comparePositions(a: Position, b: Position): number {
    return this.compareDecimalPositions(this.createDecimalPosition(a), this.createDecimalPosition(b));
  },
  findCommonMeasure(positions: Position[]): [Measure, Tuplet | undefined] | undefined {
    const offsets = positions
      .map(p => 'offset' in p ? p.offset / (p.measure * this.getTupletMultiplier(p.tuplet)) : 0)
      .map(o => o * MAX_MEASURE);

    if (offsets.length === 0) {
      return undefined;
    }

    let result: [Measure, Tuplet | undefined] | undefined = undefined;

    // Workaround!
    // Probably resolved with divisor offset workaround below
    for (const measure of MEASURES) {
      if (offsets.map(o => o * measure / MAX_MEASURE).filter(Number.isInteger).length === offsets.length) {
        return [measure, undefined];
      }
    }

    for (const tuplet of [undefined, ...TUPLETS]) {
      if (offsets.map(o => o * this.getTupletMultiplier(tuplet)).filter(Number.isInteger).length === offsets.length) {
        const commonDivisor = gcd(...offsets.map(o => o * (tuplet?.[0] ?? 1)));
        if (commonDivisor === undefined) {
          continue;
        }

        let measure: Measure | undefined;

        // Workaround!
        // In some cases offset causes bigger divisor than needed (e.g. 3/16*7:4), then try to divide using this offset
        const offsetMultipliers = [1, ...new Set(positions.map(p => 'offset' in p ? p.offset : 0).filter(o => !!o))];
        for (const offsetMultiplier of offsetMultipliers) {
          const value = 1 / (commonDivisor / MAX_MEASURE / offsetMultiplier) * (tuplet?.[1] ?? 1);

          if (this.isMeasure(value)) {
            measure = value;
            break
          }
        }

        if (measure === undefined) {
          continue;
        }

        // Skip tuplets with smaller measure
        // But allow bigger tuplets
        if (result !== undefined && result[0] < measure) {
          continue;
        }

        result = [measure, tuplet];

        // Take tuplet, which is used in notes, if it matches found one
        if (tuplet !== undefined && positions.find(p => 'offset' in p && p.tuplet?.[0] === result?.[1]?.[0] && p.tuplet?.[1] === result?.[1]?.[1])) {
          break;
        }
      }
    }

    return result;
  },
  modifyPosition(position: Position, measure: Measure, tuplet?: Tuplet): Position {
    // TODO
    if (tuplet === undefined) {
      return this.changePositionMeasure(this.changePositionTuplet(position, tuplet), measure);
    }

    return this.changePositionTuplet(this.changePositionMeasure(position, measure), tuplet);
  },
  changePositionMeasure(position: Position, measure: Measure): Position {
    if (!('offset' in position)) {
      return {
        bar: position.bar,
      }
    }

    if (position.measure === measure) {
      return position;
    }

    const offset = position.offset * measure / position.measure;

    if (!Number.isInteger(offset)) {
      throw new Error(`Position ${this.positionToString(position)} measure couldn't be changed to ${measure}`);
    }

    const result = {
      bar: position.bar,
      offset: offset,
      measure: measure,
      tuplet: position.tuplet,
    };

    // Just in case
    if (this.createDecimalPosition(position)[1] !== this.createDecimalPosition(result)[1]) {
      throw new Error(`Error while changing position ${this.positionToString(position)} measure to ${measure}`);
    }

    return result;
  },
  changePositionTuplet(position: Position, tuplet?: Tuplet): Position {
    if (!('offset' in position)) {
      return {
        bar: position.bar,
      }
    }

    const currentTuplet = 'offset' in position ? (position.tuplet ?? undefined) : undefined;
    if (currentTuplet === tuplet) {
      return position;
    }

    const offset = position.offset * this.getTupletMultiplier(tuplet) / this.getTupletMultiplier(currentTuplet);
    if (!Number.isInteger(offset)) {
      throw new Error(`Position ${this.positionToString(position)} tuplet couldn't be changed to ${tuplet?.[0] ?? 'null'}:${tuplet?.[1] ?? ''}`);
    }

    const result = {
      bar: position.bar,
      offset: offset,
      measure: position.measure,
      tuplet: tuplet ?? undefined,
    };

    // Just in case
    if (this.createDecimalPosition(position)[1] !== this.createDecimalPosition(result)[1]) {
      throw new Error(`Position ${this.positionToString(position)} tuplet couldn't be changed to ${tuplet?.[0] ?? '1'}:${tuplet?.[1] ?? '1 (regular)'}`);
    }

    return result;
  },
  getBarCountFromComposition(composition: Composition): number {
    const notesLastBar = composition.notes.reduce((result, n) => Math.max(result, n.position.bar), 0);
    const meterChangesLastBar = composition.meterChanges?.reduce((result, c) => Math.max(result, c.position.bar), 0) ?? 0;
    const bpmChangesLastBar = composition.bpmChanges?.reduce((result, c) => Math.max(result, c.position.bar), 0) ?? 0;

    return Math.max(notesLastBar, meterChangesLastBar, bpmChangesLastBar) + 1;
  },
  getBarMeterFromComposition(composition: Composition, bar: number): Meter {
    return composition.meterChanges
      ?.filter((c) => c.position.bar <= bar)
      .sort((a, b) => this.comparePositions(a.position, b.position))
      .pop()
      ?.meter ?? composition.meter;
  },
  getPositionBpmFromComposition(composition: Composition, position: Position): number {
    return composition.bpmChanges
      ?.filter((c) => c.position.bar <= position.bar)
      .sort((a, b) => this.comparePositions(a.position, b.position))
      .pop()
      ?.bpm ?? composition.bpm;
  },
  getBarHashFromComposition(composition: Composition, bar: number, resetBar?: boolean): string {
    const targetBar = resetBar === true ? 0 : bar;

    const notesData = composition.notes
      .filter(n => n.position.bar === bar)
      .map(n => ({...n, position: {...n.position, bar: targetBar}}))
      .map(n => Noted.noteToString(n))
      .sort((a, b) => a.localeCompare(b))
      .join(' ');

    const meter = this.getBarMeterFromComposition(composition, bar);
    const bpm = this.getPositionBpmFromComposition(composition, { bar });

    const meterData = meter[0] + '/' + meter[1];
    const bpmData = String(bpm);

    const bpmChangesData = composition.bpmChanges
      ?.filter((c) => c.position.bar === bar && 'offset' in c.position)
      .map(c => ({...c, position: {...c.position, bar: targetBar}}))
      .map(c => Noted.bpmChangeToString(c))
      .sort((a, b) => a.localeCompare(b))
      .join(' ');

    return simpleHash([targetBar, notesData, meterData, bpmData, bpmChangesData].join(' ')).toString();
  },
  getNotesHash(notes: Note[]): string {
    const notesData = notes
      .map(n => Noted.noteToString(n))
      .sort((a, b) => a.localeCompare(b))
      .join(' ');

    return simpleHash(notesData).toString();
  },
  createTimeKeys(composition: Composition, barCount?: number): TimeKey[] {
    // 60 seconds in minute (BPM), 4 beats in one whole note
    const calculateTime = (bpm: number, decimalLength: number): number => 60 / bpm * 4 * decimalLength;

    const meters: Map<number, Meter> = new Map(composition.meterChanges?.map((v) => [v.position.bar, v.meter]));
    meters.set(0, composition.meter);

    barCount = barCount ?? this.getBarCountFromComposition(composition);

    let lastMeter = composition.meter;
    for (let i = 0; i < barCount; i++) {
      lastMeter = meters.get(i) ?? lastMeter;
      meters.set(i, lastMeter);
    }

    const bpms: Array<[DecimalPosition, number]> = composition.bpmChanges?.map((v) => [this.createDecimalPosition(v.position), v.bpm]) ?? [];
    bpms.sort((a, b) => this.compareDecimalPositions(a[0], b[0]));

    const result: TimeKey[] = [];

    let lastBpm = composition.bpm;
    let lastDecimalOffset = 0;
    let lastTime = 0;

    for (let i = 0; i < barCount; i++) {
      const meter = meters.get(i) ?? throwError();

      result.push([[i, 0], lastTime]);

      while (bpms.length > 0 && bpms[0][0][0] === i) {
        const [bpmDecimalPosition, bpm] = bpms.shift() ?? throwError();

        const deltaTime = calculateTime(lastBpm, bpmDecimalPosition[1] - lastDecimalOffset);

        lastBpm = bpm;
        lastDecimalOffset = bpmDecimalPosition[1];
        lastTime += deltaTime;

        // Drop key for the same offset
        if (deltaTime === 0) {
          result.pop();
        }

        result.push([[i, lastDecimalOffset], lastTime]);
      }

      // Add time for the end of the bar
      const barDecimalLength = meter[0] / meter[1]; // Meter multiplier
      const deltaTime = calculateTime(lastBpm, barDecimalLength - lastDecimalOffset);

      // Reset offset (it always bar-relative)
      lastDecimalOffset = 0;
      lastTime += deltaTime;

      result.push([[i, barDecimalLength], lastTime]);

      // Shortcut for composition duration
      // Next bar starts in same time
      if (i === barCount - 1) {
        result.push([[i + 1, 0], lastTime]);
      }
    }

    return result;
  },
  calculatePositionTime(position: Position, keys: TimeKey[]): number {
    const decimalPosition = this.createDecimalPosition(position);

    let firstKey: TimeKey | undefined;
    let secondKey: TimeKey | undefined;

    // Shortcut for bar start/end
    for (const key of keys) {
      if (this.compareDecimalPositions(decimalPosition, key[0]) === 0) {
        return key[1];
      }
    }

    const barKeys = keys.filter((k) => k[0][0] === position.bar).sort((a, b) => this.compareDecimalPositions(a[0], b[0]));
    if (barKeys.length < 2) {
      throwError('Position is out of bounds');
    }

    for (const key of barKeys) {
      if (key[0][1] > decimalPosition[1]) {
        secondKey = key;
        break;
      }
      firstKey = key;
    }

    firstKey = firstKey ?? throwError(`Position ${position.toString()} is out of meter bounds`);
    secondKey = secondKey ?? barKeys[barKeys.length - 1];

    if (firstKey[0][1] === decimalPosition[1] || firstKey[0][1] === secondKey[0][1]) {
      return firstKey[1];
    }

    const positionDecimalOffset = decimalPosition[1] - firstKey[0][1];
    const segmentDecimalLength = secondKey[0][1] - firstKey[0][1];
    const segmentTime = secondKey[1] - firstKey[1];

    return firstKey[1] + (positionDecimalOffset / segmentDecimalLength * segmentTime);
  },
  positionFromString(input: string): Position {
    const POSITION_REGEX = /^(\d+)(?:\.(\d+)\/(\d+)(?:\*(\d+):(\d+))?)?(?:~(\d+))?$/;

    const matches = input.match(POSITION_REGEX);
    if (matches === null) {
      throw new Error(`Invalid position format: ${input}`);
    }

    const [, bar, offset, measure, tupletP, tupletQ,] = matches;

    const parseMeasure = (v: number): Measure => this.isMeasure(v) ? v : throwError(`Invalid measure format: ${input}`);
    const parseTuplet = (v: [number, number]): Tuplet => this.isTuplet(v) ? v : throwError(`Invalid tuplet format: ${input}`);

    if (!offset) {
      return {
        bar: parseInteger(bar),
      };
    } else if (!tupletP) {
      return {
        bar: parseInteger(bar),
        offset: parseInteger(offset),
        measure: parseMeasure(parseInteger(measure)),
      };
    } else {
      return {
        bar: parseInteger(bar),
        offset: parseInteger(offset),
        measure: parseMeasure(parseInteger(measure)),
        tuplet: parseTuplet([parseInteger(tupletP), parseInteger(tupletQ)]),
      };
    }
  },
  noteFromString(input: string): Note {
    const NOTE_REGEX = /^(.+?)(?::(.+))?@(\d+(?:\.\d+\/\d+(?:\*\d+:\d+)?(?:~(\d+))?)?)(?:\?(.+))?$/;

    const matches = input.match(NOTE_REGEX);
    if (matches === null) {
      throw new Error(`Invalid record format: ${input}`);
    }

    const [, value, type, position, duration, attributes] = matches;

    return {
      value: value,
      type: type ?? undefined,
      position: this.positionFromString(position),
      duration: duration ? parseInteger(duration) : undefined,
      attributes: attributes?.split('&').filter((v) => !!v) ?? undefined,
    };
  },
  meterChangeFromString(input: string): MeterChange {
    const METER_CHANGE_REGEX = /^(\d+(?:\.\d+)?)\/(\d+):meter?@(\d+)$/;

    const matches = input.match(METER_CHANGE_REGEX);
    if (matches === null) {
      throw new Error(`Invalid meter change format: ${input}`);
    }

    const [, beats, measure, bar] = matches;

    const parseMeasure = (v: number): Measure => this.isMeasure(v) ? v : throwError(`Invalid meter format: ${input}`);

    return {
      meter: [parseNumber(beats), parseMeasure(parseInteger(measure))],
      position: this.positionFromString(bar),
    };
  },
  bpmChangeFromString(input: string): BpmChange {
    const BPM_CHANGE_REGEX = /^(\d+(?:\.\d+)?):bpm?@(\d+(?:\.\d+\/\d+(?:\*\d+:\d+)?)?)$/;

    const matches = input.match(BPM_CHANGE_REGEX);
    if (matches === null) {
      throw new Error(`Invalid BPM change format: ${input}`);
    }

    const [, bpm, position] = matches;

    return {
      bpm: parseFloat(bpm),
      position: this.positionFromString(position),
    };
  },
  positionToString(position: Position): string {
    let result = `${position.bar}`;

    if ('offset' in position) {
      result += `.${position.offset}`;
      result += `/${(position as RegularPosition).measure}`;

      if (position.tuplet !== undefined) {
        result += `*${position.tuplet[0]}:${position.tuplet[1]}`;
      }
    }

    return result;
  },
  noteToString(note: Note): string {
    let result = note.value;

    if (note.type !== undefined) {
      result += `:${note.type}`;
    }

    result += '@' + this.positionToString(note.position);

    if ('measure' in note.position && note.duration !== undefined) {
      result += `~${note.duration}`;
    }

    if (note.attributes !== undefined && note.attributes.length > 0) {
      result += `?${note.attributes.sort((a, b) => a.localeCompare(b)).join('&')}`;
    }

    return result;
  },
  meterChangeToString(meterChange: MeterChange): string {
    let result = meterChange.meter[0] + '/' + meterChange.meter[1];

    result += `:meter`;
    result += '@' + this.positionToString(meterChange.position);

    return result;
  },
  bpmChangeToString(bpmChange: BpmChange): string {
    let result = String(bpmChange.bpm);

    result += `:bpm`;
    result += '@' + this.positionToString(bpmChange.position);

    return result;
  }
}
