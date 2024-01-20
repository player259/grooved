import type { Tick } from '$components/BarBlock/utils';

export type Measure = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

export type Tuplet = [3, 2] | [5, 4] | [6, 4] | [5, 3] | [7, 4] | [7, 8];

export const MAX_MEASURE = 128;
export const TUPLETS: Tuplet[] = [[3, 2], [5, 4], [6, 4], [7, 4], [5, 3], [7, 8]];
export const MEASURES: Measure[] = [1, 2, 4, 8, 16, 32, 64, 128];

export type Meter = [number, Measure];

export type BarPosition = {
  bar: number;
}

export type RegularPosition = {
  bar: number;
  offset: number;
  measure: Measure;
  tuplet?: Tuplet;
}

export type Position = BarPosition | RegularPosition;

export type DecimalPosition = [number, number];

export type Note = {
  value: string;
  type?: string;
  position: Position;
  duration?: number;
  attributes?: string[];
}

export type BpmChange = {
  bpm: number;
  position: Position;
}

export type MeterChange = {
  meter: Meter;
  position: BarPosition;
}

export type Composition = {
  notes: Note[];
  bpm: number;
  meter: Meter;
  bpmChanges?: BpmChange[];
  meterChanges?: MeterChange[];
}

export type TimeKey = [DecimalPosition, number];
