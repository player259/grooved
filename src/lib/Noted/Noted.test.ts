import { describe, test, expect } from 'vitest';
import type { Composition, Note, TimeKey } from './types';
import { Noted } from './Noted';

describe('create time keys', () => {
  test('one meter and bpm', async () => {
    const composition = {
      notes: [],
      meter: [4, 4],
      bpm: 60,
    } as Composition;

    expect(Noted.createTimeKeys(composition, 3)).toStrictEqual([
      [[0, 0], 0],
      [[0, 1], 4],
      [[1, 0], 4],
      [[1, 1], 8],
      [[2, 0], 8],
      [[2, 1], 12],
    ] as TimeKey[]);
  });

  test('with meter change', async () => {
    const composition = {
      notes: [],
      meter: [4, 4],
      bpm: 60,
      meterChanges: [
        {
          meter: [6, 4],
          position: {bar: 1}
        }
      ],
    } as Composition;

    expect(Noted.createTimeKeys(composition, 3)).toStrictEqual([
      [[0, 0], 0],
      [[0, 1], 4],
      [[1, 0], 4],
      [[1, 1.5], 10],
      [[2, 0], 10],
      [[2, 1.5], 16],
    ] as TimeKey[]);
  });

  test('with bpm change', async () => {
    const composition = {
      notes: [],
      meter: [4, 4],
      bpm: 60,
      bpmChanges: [
        {
          bpm: 120,
          position: {bar: 1}
        }
      ],
    } as Composition;

    expect(Noted.createTimeKeys(composition, 3)).toStrictEqual([
      [[0, 0], 0],
      [[0, 1], 4],
      [[1, 0], 4],
      [[1, 1], 6],
      [[2, 0], 6],
      [[2, 1], 8],
    ] as TimeKey[]);
  });

  test('with bpm change in the middle', async () => {
    const composition = {
      notes: [],
      meter: [4, 4],
      bpm: 60,
      bpmChanges: [
        {
          bpm: 120,
          position: {bar: 1, offset: 1, measure: 2}
        }
      ],
    } as Composition;

    expect(Noted.createTimeKeys(composition, 3)).toStrictEqual([
      [[0, 0], 0],
      [[0, 1], 4],
      [[1, 0], 4],
      [[1, 0.5], 6],
      [[1, 1], 7],
      [[2, 0], 7],
      [[2, 1], 9],
    ] as TimeKey[]);
  });
});

describe('calculate position time', () => {
  const composition = {
    notes: [],
    meter: [4, 4],
    bpm: 60,
  } as Composition;

  const timeKeys = Noted.createTimeKeys(composition, 3);

  test('simple bars', async () => {
    expect(Noted.calculatePositionTime({bar: 0}, timeKeys)).toStrictEqual(0);
    expect(Noted.calculatePositionTime({bar: 1}, timeKeys)).toStrictEqual(4);
    expect(Noted.calculatePositionTime({bar: 2}, timeKeys)).toStrictEqual(8);
  });

  test('simple quarters', async () => {
    expect(Noted.calculatePositionTime({bar: 0, offset: 0, measure: 1}, timeKeys)).toStrictEqual(0);
    expect(Noted.calculatePositionTime({bar: 0, offset: 1, measure: 4}, timeKeys)).toStrictEqual(1);
    expect(Noted.calculatePositionTime({bar: 0, offset: 2, measure: 4}, timeKeys)).toStrictEqual(2);
    expect(Noted.calculatePositionTime({bar: 0, offset: 3, measure: 4}, timeKeys)).toStrictEqual(3);
    expect(Noted.calculatePositionTime({bar: 0, offset: 4, measure: 4}, timeKeys)).toStrictEqual(4);
  });

  test('quarter triplets', async () => {
    expect(Noted.calculatePositionTime({bar: 0, offset: 0, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(0);
    expect(Noted.calculatePositionTime({bar: 0, offset: 1, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(0.6666666666666666);
    expect(Noted.calculatePositionTime({bar: 0, offset: 2, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(1.3333333333333333);
    expect(Noted.calculatePositionTime({bar: 0, offset: 3, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(2);
    expect(Noted.calculatePositionTime({bar: 0, offset: 4, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(2.6666666666666666);
    expect(Noted.calculatePositionTime({bar: 0, offset: 5, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(3.3333333333333333);
    expect(Noted.calculatePositionTime({bar: 0, offset: 6, measure: 4, tuplet: [3, 2]}, timeKeys)).toStrictEqual(4);
  });

  test('bar count', async () => {
    expect(Noted.calculatePositionTime({bar: 2, offset: 1, measure: 1}, timeKeys)).toStrictEqual(12);
  });

  test('overtime error', async () => {
    expect(() => Noted.calculatePositionTime({bar: 5}, timeKeys)).toThrowError('Position is out of bounds');
  });

  test('halftime change bpm', async () => {
    const composition = {
      notes: [],
      meter: [4, 4],
      bpm: 60,
      bpmChanges: [
        {
          bpm: 120,
          position: {bar: 0, offset: 1, measure: 2},
        }
      ],
    } as Composition;

    const timeKeys = Noted.createTimeKeys(composition, 3);

    expect(Noted.calculatePositionTime({bar: 0, offset: 0, measure: 4}, timeKeys)).toStrictEqual(0);
    expect(Noted.calculatePositionTime({bar: 0, offset: 1, measure: 4}, timeKeys)).toStrictEqual(1);
    expect(Noted.calculatePositionTime({bar: 0, offset: 2, measure: 4}, timeKeys)).toStrictEqual(2);
    expect(Noted.calculatePositionTime({bar: 0, offset: 3, measure: 4}, timeKeys)).toStrictEqual(2.5);
    expect(Noted.calculatePositionTime({bar: 0, offset: 4, measure: 4}, timeKeys)).toStrictEqual(3);
  });
});

const dataset: Array<{ string: string, object: Note }> = [
	// Min
	{
		string: 'value@1',
		object: { value: 'value', position: { bar: 1 }},
	},
	// Full
	{
		string: 'value:type@1.17/16*3:2~2?aaa&bbb',
		object: { value: 'value', type: 'type', position: { bar: 1, offset: 17, measure: 16, tuplet: [3, 2] }, duration: 2, attributes: ['aaa', 'bbb']},
	},
	// Variants
	{
		string: 'value@1?aaa&',
    object: { value: 'value',position: { bar: 1 }, attributes: ['aaa']},
	},
	{
		string: 'value:type@1.17/16*3:2~2',
    object: { value: 'value', type: 'type', position: { bar: 1, offset: 17, measure: 16, tuplet: [3, 2] }, duration: 2},
	},
	{
		string: 'value:type@1.17/16*3:2?aaa&bbb',
    object: { value: 'value', type: 'type', position: { bar: 1, offset: 17, measure: 16, tuplet: [3, 2] }, attributes: ['aaa', 'bbb']},
	},
	{
		string: 'value:type@1.17/16~2?aaa&bbb',
    object: { value: 'value', type: 'type', position: { bar: 1, offset: 17, measure: 16 }, duration: 2, attributes: ['aaa', 'bbb']},
	},
	{
		string: 'value:type@1?aaa&bbb',
    object: { value: 'value', type: 'type', position: { bar: 1 }, attributes: ['aaa', 'bbb']},
	},
	{
		string: 'value@1.17/16*3:2~2?aaa&bbb',
    object: { value: 'value', position: { bar: 1, offset: 17, measure: 16, tuplet: [3, 2] }, duration: 2, attributes: ['aaa', 'bbb']},
	},
	// Most used cases
	{
		string: 'value@1.17/16*3:2',
    object: { value: 'value', position: { bar: 1, offset: 17, measure: 16, tuplet: [3, 2] }},
	},
	{
		string: 'value:type@1.17/16',
    object: { value: 'value', type: 'type', position: { bar: 1, offset: 17, measure: 16 }},
	}
];

describe.each(dataset)('from string', ({ string, object }) => {
	test(string, async () => {
		expect(Noted.noteFromString(string)).toEqual(object);
	});
});

describe.each(dataset)('to string', ({ string, object }) => {
	test(string, async () => {
		// Special case with trailing &
		expect(Noted.noteToString(object)).toStrictEqual(string.replace(/\&$/, ''));
	});
});

const invalidDataset = [
	{ string: 'value@' },
	{ string: 'value@1:2' },
	{ string: 'value:type@1.17^3:2' }
];

describe.each(invalidDataset)('from string invalid', ({ string }) => {
	test(string, async () => {
		expect(() => {
			Noted.noteFromString(string);
		}).toThrowError(new Error(`Invalid record format: ${string}`));
	});
});

const commonMeasureDataset = [
  {
    positions: [
      { bar: 2, offset: 0, measure: 8 },
      { bar: 2, offset: 3, measure: 8 },
      { bar: 2, offset: 6, measure: 8 },
    ],
    measure: 8,
    tuplet: undefined,
  },
  {
    positions: [
      { bar: 0, offset: 0, measure: 16, tuplet: [7, 4] },
      { bar: 0, offset: 3, measure: 16, tuplet: [7, 4] },
    ],
    measure: 16,
    tuplet: [7, 4],
  },
];

describe.each(commonMeasureDataset)('find common measure', ({ positions, measure, tuplet }) => {
  test('#1', async () => {
    expect(Noted.findCommonMeasure(positions)).toEqual([measure, tuplet]);
  });
});
