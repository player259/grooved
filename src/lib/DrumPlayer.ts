import soundBassdrum from "$assets/kit/bd.wav";
import soundCrash from "$assets/kit/crash.wav";
import soundHihatClose from "$assets/kit/hh_close.wav";
import soundHihatOpen from "$assets/kit/hh_open.wav";
import soundHihatPedal from "$assets/kit/hh_pedal.wav";
import soundRide from "$assets/kit/ride.wav";
import soundRideBell from "$assets/kit/ride_bell.wav";
import soundSnareSideStick from "$assets/kit/sn_side_stick.wav";
import soundSnareDrag from "$assets/kit/sn_drag.wav";
import soundSnareFlam from "$assets/kit/sn_flam.wav";
import soundSnareGhost from "$assets/kit/sn_ghost.wav";
import soundSnare from "$assets/kit/sn.wav";
import soundHighTom from "$assets/kit/tom_ht.wav";
import soundLowTom from "$assets/kit/tom_lt.wav";
import soundFloorTom from "$assets/kit/tom_ft.wav";
import soundCowbell from "$assets/kit/cowbell.wav";

// import Bgm from "$assets/bgm/silencekills-last-breat-of-air-pad.wav";
// import Bgm2 from "$assets/bgm/chill-out-pad-theme.wav";

import * as Tone from 'tone';
import { ATTR_DRAG, ATTR_FLAM, ATTR_GHOST, DrumNote } from '$lib/Noted/NotedDrums';

import { Noted } from '$lib/Noted/Noted';
import type { Composition, Note } from '$lib/Noted/types';

const noteMap: Array<[DrumNote, string[], string, number, DrumNote[]]> = [
  [DrumNote.HIHAT_CLOSED, [], soundHihatClose, 0, []],
  [DrumNote.HIHAT_OPEN, [], soundHihatOpen, 0, [DrumNote.HIHAT_CLOSED, DrumNote.HIHAT_PEDAL]], // Do not stop on other open hi-hat
  [DrumNote.HIHAT_PEDAL, [], soundHihatPedal, 0, []],
  [DrumNote.SNARE, [], soundSnare, 0, []],
  [DrumNote.SIDE_STICK, [], soundSnareSideStick, 0, []],
  [DrumNote.SNARE, [ATTR_GHOST], soundSnareGhost, 0, []],
  [DrumNote.SNARE, [ATTR_DRAG], soundSnareDrag, -0.180, []],
  [DrumNote.SNARE, [ATTR_FLAM], soundSnareFlam, -0.040, []],
  [DrumNote.BASSDRUM, [], soundBassdrum, 0, []],
  [DrumNote.HIGH_TOM, [], soundHighTom, 0, []],
  [DrumNote.LOW_TOM, [], soundLowTom, 0, []],
  [DrumNote.FLOOR_TOM, [], soundFloorTom, 0, []],
  [DrumNote.RIDE, [], soundRide, 0, []], // Let it ring
  [DrumNote.RIDE_BELL, [], soundRideBell, 0, []], // Let it ring
  [DrumNote.CRASH, [], soundCrash, -0.010, []], // Let it ring
  [DrumNote.COWBELL, [], soundCowbell, 0, []],
];

const players = new Tone.Players({
  [soundHihatClose]: soundHihatClose,
  [soundHihatOpen]: soundHihatOpen,
  [soundHihatPedal]: soundHihatPedal,
  [soundSnare]: soundSnare,
  [soundSnareSideStick]: soundSnareSideStick,
  [soundSnareGhost]: soundSnareGhost,
  [soundSnareDrag]: soundSnareDrag,
  [soundSnareFlam]: soundSnareFlam,
  [soundBassdrum]: soundBassdrum,
  [soundHighTom]: soundHighTom,
  [soundLowTom]: soundLowTom,
  [soundFloorTom]: soundFloorTom,
  [soundRide]: soundRide,
  [soundRideBell]: soundRideBell,
  [soundCrash]: soundCrash,
  [soundCowbell]: soundCowbell,
}).toDestination();

export const DrumPlayer = {
  stop(): void {
    if (Tone.context.state !== 'running') {
      return;
    }

    Tone.Transport.stop();
    Tone.Transport.cancel(0);
  },
  async play(composition: Composition, params: {
    barRange?: [number?, number?],
    repeat?: boolean,
    onPlay?: (note: Note) => void,
    onStop?: () => void,
  }): Promise<void> {
    // const bgmAudio = await Tone.ToneAudioBuffer.fromUrl(bgmFile);
    // const bgmAudioPlayer = new Tone.GrainPlayer(bgmAudio).toDestination();
    // bgmAudioPlayer.playbackRate = 1;

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    Tone.Transport.stop();
    Tone.Transport.cancel(0);

    const timeKeys = Noted.createTimeKeys(composition);

    const sortedNotes = composition.notes
      .filter(n => {
        if (params?.barRange?.[0] !== undefined && n.position.bar < params?.barRange?.[0]) {
          return false;
        }
        if (params?.barRange?.[1] !== undefined && n.position.bar >= params?.barRange?.[1]) {
          return false;
        }

        return true;
      })
      .sort((a, b) => Noted.comparePositions(a.position, b.position));

    const startingTime = Noted.calculatePositionTime({bar: params?.barRange?.[0] ?? 0}, timeKeys);
    const endingTime = Noted.calculatePositionTime({bar: params?.barRange?.[1] ?? Noted.getBarCountFromComposition(composition)}, timeKeys);

    const playDuration = endingTime - startingTime;

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      const isLastNote = i === sortedNotes.length - 1;

      if (note.type !== undefined) {
        continue;
      }

      let match: (typeof noteMap[0]) | undefined = undefined;
      for (const item of noteMap) {
        if (item[0] !== note.value) {
          continue;
        }

        const attributes = note?.attributes ?? [];
        const attrIntersection = attributes.filter(v => item[1].includes(v)).length;
        const matchAttrIntersection = attributes.filter(v => (match?.[1] ?? []).includes(v)).length;

        match = match === undefined || (attrIntersection > 0 && attrIntersection >= matchAttrIntersection) ? item : match;
      }

      if (match === undefined) {
        continue;
      }

      const player = players.player(match[2]);

      const time = Noted.calculatePositionTime(note.position, timeKeys) + match[3];

      // TODO Optimize
      const nextConflictingNote = sortedNotes.find(n => match?.[4].includes(n.value as DrumNote) && Noted.comparePositions(n.position, note.position) > 0);
      const nextConflictingNoteTime = nextConflictingNote !== undefined ? Noted.calculatePositionTime(nextConflictingNote.position, timeKeys) : undefined;
      const duration = nextConflictingNoteTime !== undefined ? Math.max(nextConflictingNoteTime - time, 0.3) : undefined;

      // let bgmPrevTime: string;
      // Tone.Transport.scheduleOnce((time) => {
      //   // if (bgmPrevTime === time.toString()) {
      //   // 	return;
      //   // }
      //   // bgmPrevTime = time.toString();
      //
      //   // bgmAudioPlayer.start(time);
      //
      //   player.start(time, 0, duration);
      //   callback(note);
      // }, time + 0.2); // Offset for grace notes to be first

      if (params?.repeat === true) {
        Tone.Transport.scheduleRepeat((time) => {
          player.start(time, 0, duration);
          params?.onPlay?.(note);
        }, playDuration, time + 0.2); // Offset for grace notes to be first
      } else {
        Tone.Transport.scheduleOnce((time) => {
          player.start(time, 0, duration);
          params?.onPlay?.(note);

          if (isLastNote) {
            params?.onStop?.();
          }
        }, time + 0.2); // Offset for grace notes to be first
      }
    }

    Tone.Transport.start(`+0s`, startingTime);
  }
}

