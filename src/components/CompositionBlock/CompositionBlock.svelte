<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  import type { Composition, Meter, Note, Position } from '$lib/Noted/types';

  import BarBlock from '$components/BarBlock/BarBlock.svelte';
  import { Noted } from '$lib/Noted/Noted';
  import HorizontalContainer from '$components/HorizontalContainer/HorizontalContainer.svelte';
  import {
    Button,
    Icon,
  } from '@sveltestrap/sveltestrap';
  import MusicSymbol from '$components/MusicSymbol/MusicSymbol.svelte';
  import { DEFAULT_LINE_SET, type Line } from '$components/BarBlock/utils';

  export let composition: Composition;
  export let highlight: Position | undefined = undefined;

  type BarData = {
    bar: number,
    notes: Note[],
    meter: Meter,
    bpm: number,
    repeat: number,
    hash: string,
  }

  let bars: BarData[] = [];
  let barCount: number | undefined = undefined;

  function createBars(composition: Composition, barCount: number | undefined, existingBars?: BarData[]): BarData[] {
    let bars: BarData[] = []

    let prevBarNotesHash: string | undefined = undefined;

    barCount = Math.max(barCount ?? 0, Noted.getBarCountFromComposition(composition));

    for (let i = 0; i < barCount; i++) {
      const notes = composition.notes.filter(n => n.position.bar === i).map(n => ({...n, position: {...n.position, bar: 0}}));
      const meter = Noted.getBarMeterFromComposition(composition, i);
      const bpm = Noted.getPositionBpmFromComposition(composition, { bar: i });
      const hash = Noted.getBarHashFromComposition(composition, i);

      const barNotesHash = Noted.getBarHashFromComposition(composition, i, true);

      const existingPrevBar = existingBars?.find(b => b.hash === Noted.getBarHashFromComposition(composition, i - 1));

      if (prevBarNotesHash === barNotesHash && (existingPrevBar === undefined || bars[bars.length - 1].repeat < existingPrevBar.repeat)) {
        bars[bars.length - 1].repeat++;
        continue;
      }

      bars.push({
        bar: i,
        notes: notes,
        meter: meter,
        bpm: bpm,
        repeat: 1,
        hash: hash,
      });

      prevBarNotesHash = barNotesHash;
    }

    return bars;
  }

  let lines: Line[] = DEFAULT_LINE_SET;

  function onClickDeleteBar(bar: BarData): void {
    bars = bars.filter(b => b.bar !== bar.bar);
    barCount = barCount !== undefined ? barCount - bar.repeat : undefined;

    updateComposition();
    updateBars();
  }

  function onClickAddBar(): void {
    barCount = (barCount ?? Noted.getBarCountFromComposition(composition)) + 1;

    updateBars();
  }

  function createComposition(bars: BarData[]): Composition {
    composition.meter = bars[0].meter ?? [4, 4];
    composition.bpm = bars[0].bpm ?? 60;

    composition.meterChanges = [];
    composition.bpmChanges = [];

    composition.notes = [];

    let i = 0;
    for (const bar of bars) {
      for (let j = 0; j < bar.repeat; j++) {
        composition.notes = [...composition.notes, ...bar.notes.map(n => ({...n, position: { ...n.position, bar: i }}))];
        composition.meterChanges.push({ meter: bar.meter, position: { bar: i } });
        composition.bpmChanges.push({ bpm: bar.bpm, position: { bar: i } });
        i++;
      }
    }

    return composition;
  }

  function updateComposition(): undefined {
    composition = createComposition(bars);
    dispatch('changeComposition', composition);
  }

  let barsCopy: BarData[] = [];

  function updateBars(): undefined {
    bars = createBars(composition, barCount, bars);
    barsCopy = bars;
  }

  onMount(() => {
    updateBars();
    composition = createComposition(bars);
  });

  let playingBar: number | undefined = undefined;

  function playBarCallback(bar: number) {
    return (isPlaying: boolean) => playingBar = isPlaying ? bar : undefined;
  }
</script>

<style>
  .outer {
    border-left: 3px solid black;
  }
  .outer.last {
    border-right: 3px solid black;
  }
  .inner {
    border-left: 1px solid black;
    border-right: 1px solid black;
  }
</style>

<HorizontalContainer class="pe-5">
  {#each barsCopy as bar, i (bar.hash)}
    <div class="outer py-0 px-1 align-top" class:last={ i === bars.length - 1}>
      <div class="inner py-1 ps-0 pe-3">
        <BarBlock
          notes={bar.notes}
          bar={0}
          meter={bar.meter}
          bpm={bar.bpm}
          highlight={ highlight !== undefined && highlight.bar >= bar.bar && highlight.bar < bar.bar + bar.repeat ? {...highlight, bar: 0} : undefined}
          repeat={bar.repeat}
          bind:lines={lines}
          on:changeNotes={(e) => { bars[i].notes = e.detail; updateComposition(); }}
          on:changeMeter={(e) => { bars[i].meter = e.detail; updateComposition(); }}
          on:changeBpm={(e) => { bars[i].bpm = e.detail; updateComposition(); }}
          on:changeRepeat={(e) => { bars[i].repeat = e.detail; updateComposition(); }}
        >
          <span slot="menu-toggle"><Icon name="list" /></span>
          <div slot="header" class="d-flex" let:meter let:bpm let:repeat>
            {#if meter[0] !== 4 || meter[1] !== 4 || meter[0] !== composition.meter[0] || meter[1] !== composition.meter[1]}
              <span class="me-3 align-self-center">{meter[0]}/{meter[1]}</span>
            {/if}
            {#if i === 0 || bpm !== composition.bpm}
              <span class="me-3 align-self-center"><MusicSymbol value="quarter-note"/> = {bpm}</span>
            {/if}
            {#if repeat > 1}
              <span class="me-3 align-self-center">&times; {repeat}</span>
            {/if}
            <Button color="light" size="sm" class="border me-3 align-self-center" on:click={() => dispatch('playBar', {bar: bar.bar, callback: playBarCallback(bar.bar)})}>
              <Icon name={playingBar === bar.bar ? 'pause-fill' : 'play-fill'} />
            </Button>
            <Button color="danger" size="sm" class="btn-close align-self-center ms-auto p-2" on:click={() => onClickDeleteBar(bar)} />
          </div>
        </BarBlock>
      </div>
    </div>
  {/each}

  <div class="d-block align-self-center mx-3">
    <Button size="lg" color="light" class="border" on:click={() => onClickAddBar()}>Add</Button>
  </div>
</HorizontalContainer>
