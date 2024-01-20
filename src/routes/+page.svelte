<script lang="ts">
  import { createSvg2png, initialize } from 'svg2png-wasm';
  import * as store from 'store';

  import { onMount } from 'svelte';

	import AbcSheet from '$components/AbcSheet/AbcSheet.svelte';
  import type { Composition, Meter, Note, Position } from '$lib/Noted/types';

  import { Noted } from '$lib/Noted/Noted';
  import {
    Button,
    Col,
    Container, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Icon,
    Input,
    InputGroup, Modal, ModalBody, ModalHeader,
    Nav, Navbar, NavItem, NavLink, Row
  } from '@sveltestrap/sveltestrap';
  import MusicSymbol from '$components/MusicSymbol/MusicSymbol.svelte';
  import CompositionBlock from '$components/CompositionBlock/CompositionBlock.svelte';
  import { DrumPlayer } from '$lib/DrumPlayer';
  import type { Layout, StaffStyle } from '$lib/Noted/AbcRenderer';

  import madeWaffleFont from '$assets/fonts/MADEWaffleSoft.otf';
  import musicFont from '$assets/fonts/music.ttf';
  import timesNewRomanItalicFont from '$assets/fonts/TimesNewRomanItalic.ttf';
  import timesNewRomanFont from '$assets/fonts/TimesNewRoman.ttf';
  import arialFont from '$assets/fonts/Arial.ttf';

  import { demoComposition } from '$lib/demoComposition';
  import { emptyComposition } from '$lib/emptyComposition';

  export function throwError(message?: string): never {
    throw new Error(message);
  }

  let highlight: Position | undefined = undefined;

  const staffStyleNames: { [key in StaffStyle]: string } = {
    'full': 'Full',
    'one_line': '1-line',
    'one_line_offset': '1-line (offset)',
    'three_line': '3-line',
    'three_line_offset': '3-line (offset)',
  }

  const layoutNames: { [key in Layout]: string } = {
    'full': 'Full',
    'normal': 'Normal',
    'minimal': 'Minimal',
  }

  type Settings = {
    scale: number,
    detectRepeats: boolean,
    staffStyle: StaffStyle,
    layout: Layout,
    useLowerVoice: boolean,
    multiline: boolean,
  }

  let settings: Settings = {
    scale: 1.5,
    detectRepeats: true,
    staffStyle: 'full',
    layout: 'normal',
    useLowerVoice: true,
    multiline: true,
  }

  let composition: Composition = store.get('composition') ?? demoComposition;

  let meter: Meter = composition.meter;
  let bpm: number = composition.bpm;

  let isPlaying = false;
  let playingBar: number | undefined = undefined;
  let lastPlayedParams: {
    barRange?: [number?, number?],
    onPlay?: (note: Note, time: number) => void,
    onStop?: (time: number) => void,
    repeat?: boolean,
  } | undefined;

  const playStop = async () => {
    if (isPlaying) {
      isPlaying = false;
      DrumPlayer.stop();
      return;
    }

    isPlaying = true;
    await DrumPlayer.play(composition, lastPlayedParams = {
      onPlay: (note: Note, time: number) => highlight = note.position,
      onStop: () => isPlaying = false,
      repeat: true,
    });
  };

  const playStopBar = async (bar: number, callback: (isPlaying: boolean) => void) => {
    if (isPlaying && playingBar === bar) {
      playingBar = undefined;
      isPlaying = false;
      callback(isPlaying);
      DrumPlayer.stop();
      return;
    }

    playingBar = bar;
    isPlaying = true;
    callback(isPlaying);

    await DrumPlayer.play(composition, lastPlayedParams = {
      barRange: [bar, bar + 1],
      onPlay: (note: Note, time: number) => highlight = note.position,
      onStop: () => { isPlaying = false; callback(isPlaying); },
      repeat: false,
    });
  };

  let editMeter = false;
  let editBpm = false;

  function updateMeter(meter: Meter): void {
    composition.meter = meter;
    delete composition.meterChanges;

    composition = composition;
    compositionTmp = composition;
  }

  function updateBpm(bpm: number): void {
    composition.bpm = bpm;
    delete composition.bpmChanges;

    composition = composition;
    compositionTmp = composition;
  }

  let compositionTmp = composition;
  let bpmTmp = bpm;
  let meterTmp = meter;

  $: updateMeter(meter);
  $: updateBpm(bpm);

  function onSetTmpMeter(a: number | undefined, b: number | undefined): void {
    meterTmp = [a ?? meterTmp[0], b !== undefined && Noted.isMeasure(b) ? b : meterTmp[1]];
  }

  function onSetTmpBpm(value: number | undefined, modify: number | undefined): void {
    if (value !== undefined) {
      bpmTmp = value;
    }
    if (modify !== undefined) {
      bpmTmp += modify;
    }

    bpmTmp = Math.min(Math.max(bpmTmp, 30), 300);
  }

  function onChangeComposition(updatedComposition: Composition): void {
    composition = updatedComposition;

    if (isPlaying) {
      DrumPlayer.play(composition, { ...lastPlayedParams, fromTime: DrumPlayer.getTime() });
    }
  }

  $: store.set('composition', composition);

  function loadComposition(newComposition: Composition): void {
    composition = compositionTmp = newComposition;
    meter = meterTmp = newComposition.meter;
    bpm = bpmTmp = newComposition.bpm;

    store.set('composition', newComposition);
  }

  function onChangeScale(e: Event, diff: number) {
    settings.scale = Math.floor(Math.min(Math.max(5, settings.scale * 10 + diff * 10), 20)) / 10;
    settings = settings;
  }

  let svgContainerEl: HTMLElement | undefined = undefined;
  let svgContent: string | undefined = undefined;
  let isSvgModalOpened: boolean = false;

  onMount(async () => {
    await initialize(fetch('https://unpkg.com/svg2png-wasm/svg2png_wasm_bg.wasm'));
  });

  async function onClickRender(): Promise<void> {
    isSvgModalOpened = true;

    if (!svgContainerEl) {
      return;
    }

    for (const svgEl of svgContainerEl.getElementsByTagName('svg')) {
      svgEl.classList.toggle('d-none', false);
      for (const el of svgEl.getElementsByClassName('position-cursor')) {
        const position = Noted.positionFromString(el.getAttribute('data-position') ?? '');
        el.classList.toggle('highlight', highlight !== undefined && Noted.comparePositions(position, highlight) === 0);
      }
    }

    const svgs = [...svgContainerEl.getElementsByTagName('svg')].map(el => el.outerHTML);
    const madeWaffleFontData = await fetch(madeWaffleFont).then((res) => res.arrayBuffer());
    const musicFontData = await fetch(musicFont).then((res) => res.arrayBuffer());
    const timesNewRomanFontData = await fetch(timesNewRomanFont).then((res) => res.arrayBuffer());
    const timesNewRomanItalicFontData = await fetch(timesNewRomanItalicFont).then((res) => res.arrayBuffer());
    const arialFontData = await fetch(arialFont).then((res) => res.arrayBuffer());

    const svg2png = createSvg2png({
      fonts: [
        new Uint8Array(musicFontData),
        new Uint8Array(madeWaffleFontData),
        new Uint8Array(timesNewRomanFontData),
        new Uint8Array(timesNewRomanItalicFontData),
        new Uint8Array(arialFontData),
      ],
      defaultFontFamily: {
        serifFamily: 'Times New Roman',
        sansSerifFamily: 'Arial',
        cursiveFamily: 'Times New Roman',
      },
    });

    /** @type {Uint8Array[]} */
    const pngs = await Promise.all(svgs.map(svg => svg2png(svg)));
    svg2png.dispose();

    for (const png of pngs) {
      const src = URL.createObjectURL(
        new Blob([png], { type: 'image/png' }),
      );
      const img = document.createElement('img');
      img.src = src;

      svgContainerEl.append(img);
    }

    for (const svgEl of svgContainerEl.getElementsByTagName('svg')) {
      svgEl.classList.toggle('d-none', true);
    }
  }
</script>

<svelte:head>
  <title>Grooved</title>
  <meta name="description" content="Grooved" />
</svelte:head>

<style>
  .bpm {
    line-height: 1em;
    height: 1em;
  }
</style>

<Navbar color="dark-subtle" expand="xs" container="lg">
  <div class="flex-grow-1">
    <Nav navbar class="d-flex">
      <NavItem>
        <Button color="secondary" class="me-3" on:click={playStop}><Icon name={isPlaying ? 'pause-fill' : 'play-fill'} /></Button>
      </NavItem>
      {#if editMeter}
        <Dropdown nav inNavbar>
          <DropdownToggle caret color="light" class="meter-edit">{meterTmp[0]}</DropdownToggle>
          <DropdownMenu class="meter-edit">
            {#each { length: 12 } as _, i}
              <DropdownItem class="meter-edit" on:click={() => onSetTmpMeter(i + 1, undefined)}>{i + 1}</DropdownItem>
            {/each}
          </DropdownMenu>
        </Dropdown>
        <div class="navbar-text">&nbsp;/&nbsp;</div>
        <Dropdown nav inNavbar>
          <DropdownToggle caret color="light" class="meter-edit">{meterTmp[1]}</DropdownToggle>
          <DropdownMenu class="meter-edit">
            {#each [4] as i}
              <DropdownItem class="meter-edit" on:click={() => onSetTmpMeter(undefined, i)}>{i}</DropdownItem>
            {/each}
          </DropdownMenu>
        </Dropdown>
        <NavItem>
          <Button color="secondary" class="ms-2 meter-edit" on:click={() => { editMeter = false; meter = meterTmp; }}><Icon name="check-lg" /></Button>
        </NavItem>
      {:else}
        <NavItem>
          <NavLink on:click={() => editMeter = true}>
            {meter[0]} / {meter[1]}
          </NavLink>
        </NavItem>
      {/if}

      <NavItem class="d-none d-sm-block">
        <NavLink class="px-3" on:click={() => editBpm = !editBpm}>
          <MusicSymbol value="quarter-note"/> = <span class:d-none={editBpm}>{bpmTmp}</span>
        </NavLink>
      </NavItem>

      {#if editBpm}
        <NavItem class="d-none d-sm-block">
          <InputGroup class="align-self-center">
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, -5)}>-5</Button>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, -1)}>-1</Button>
            <Input bind:value={bpmTmp} class="text-center bpm-edit" style="max-width: 70px"/>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, +1)}>+1</Button>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, +5)}>+5</Button>
          </InputGroup>
        </NavItem>
        <NavItem class="d-none d-sm-block flex-grow-1 text-start">
          <Button color="secondary" class="ms-2 bpm-edit" on:click={() => { editBpm = false; bpm = bpmTmp; }}><Icon name="check-lg" /></Button>
        </NavItem>
      {:else}
        <NavItem class="d-none d-sm-block flex-grow-1">
          <div class="navbar-text bpm">
            <input type="range" class="form-range" bind:value={bpmTmp} on:input={(e) => bpmTmp = +e.target.value} min={30} max={300} on:mouseup={() => bpm = bpmTmp } on:touchend={() => bpm = bpmTmp }>
          </div>
        </NavItem>
      {/if}

      <div class="ms-3 flex-grow-1 flex-sm-grow-0 text-end">
        <Dropdown nav inNavbar>
          <DropdownToggle color="secondary"><Icon name="gear-fill" /></DropdownToggle>
          <DropdownMenu class="dropdown-menu-end" style="min-width: 300px">
            <Container>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Scale</Col>
                <Col sm={8}>
                  <InputGroup class="flex-nowrap align-self-center" style="min-width: 200px">
                    <Button addon color="light" class="border" on:click={(e) => onChangeScale(e, -0.1)}>-0.1</Button>
                    <Input value={settings.scale} class="text-center" style="max-width: 60px"/>
                    <Button addon color="light" class="border" on:click={(e) => onChangeScale(e, +0.1)}>+0.1</Button>
                  </InputGroup>
                </Col>
              </Row>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Repeats</Col>
                <Col sm={8}>
                    <InputGroup class="flex-nowrap align-self-center">
                      <Button addon active={!settings.detectRepeats} color="light" class="border" on:click={(e) => settings.detectRepeats = false}>Off</Button>
                      <Button addon active={settings.detectRepeats} color="light" class="border" on:click={(e) => settings.detectRepeats = true}>On</Button>
                    </InputGroup>
                </Col>
              </Row>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Staff</Col>
                <Col sm={8}>
                  <Dropdown>
                    <DropdownToggle color="secondary" caret>{staffStyleNames[settings.staffStyle]}</DropdownToggle>
                    <DropdownMenu class="dropdown-menu-end">
                      {#each Object.entries(staffStyleNames) as item}
                        <DropdownItem on:click={() => settings.staffStyle = item[0]}>{item[1]}</DropdownItem>
                      {/each}
                    </DropdownMenu>
                  </Dropdown>
                </Col>
              </Row>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Layout</Col>
                <Col sm={8}>
                  <Dropdown>
                    <DropdownToggle color="secondary" caret>{layoutNames[settings.layout]}</DropdownToggle>
                    <DropdownMenu class="dropdown-menu-end">
                      {#each Object.entries(layoutNames) as item}
                        <DropdownItem on:click={() => settings.layout = item[0]}>{item[1]}</DropdownItem>
                      {/each}
                    </DropdownMenu>
                  </Dropdown>
                </Col>
              </Row>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Lower</Col>
                <Col sm={8}>
                  <InputGroup class="flex-nowrap align-self-center">
                    <Button addon active={!settings.useLowerVoice} color="light" class="border" on:click={(e) => settings.useLowerVoice = false}>Off</Button>
                    <Button addon active={settings.useLowerVoice} color="light" class="border" on:click={(e) => settings.useLowerVoice = true}>On</Button>
                  </InputGroup>
                </Col>
              </Row>
              <Row class="my-1">
                <Col sm={4} class="text-sm-end" style="line-height: 2.2em">Multiline</Col>
                <Col sm={8}>
                  <InputGroup class="flex-nowrap align-self-center">
                    <Button addon active={!settings.multiline} color="light" class="border" on:click={(e) => settings.multiline = false}>Off</Button>
                    <Button addon active={settings.multiline} color="light" class="border" on:click={(e) => settings.multiline = true}>On</Button>
                  </InputGroup>
                </Col>
              </Row>
              <Row class="my-1">
                <Col>
                  <Button color="light" class="border" on:click={() => isSvgModalOpened = true}>Render</Button>
                </Col>
              </Row>
            </Container>
          </DropdownMenu>
        </Dropdown>
      </div>
    </Nav>

    <Nav navbar class="d-sm-none d-flex">
      <NavItem class="">
        <NavLink class="px-3" on:click={() => editBpm = !editBpm}>
          <MusicSymbol value="quarter-note"/> = <span class:d-none={editBpm}>{bpm}</span>
        </NavLink>
      </NavItem>

      {#if editBpm}
        <NavItem class="">
          <InputGroup class="align-self-center">
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, -5)}>-5</Button>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, -1)}>-1</Button>
            <Input bind:value={bpmTmp} class="text-center bpm-edit" style="max-width: 70px"/>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, +1)}>+1</Button>
            <Button addon color="light" class="border bpm-edit" on:click={() => onSetTmpBpm(undefined, +5)}>+5</Button>
          </InputGroup>
        </NavItem>
        <NavItem class="flex-grow-1 text-start">
          <Button color="secondary" class="ms-2" on:click={() => { editBpm = false; bpm = bpmTmp; }}><Icon name="check-lg" /></Button>
        </NavItem>
      {:else}
        <NavItem class="flex-grow-1">
          <div class="navbar-text bpm">
            <input type="range" class="form-range" bind:value={bpmTmp} on:input={(e) => bpmTmp = +e.target.value} min={30} max={300} on:mouseup={() => bpm = bpmTmp } on:touchend={() => bpm = bpmTmp }>
          </div>
        </NavItem>
      {/if}
    </Nav>
  </div>
</Navbar>

<Container lg>
  <div class="my-3">
    <AbcSheet
      composition={composition}
      highlight={highlight}
      detectRepeats={settings.detectRepeats}
      useLowerVoice={settings.useLowerVoice}
      pageScale={settings.scale}
      singleLine={!settings.multiline}
      staffStyle={settings.staffStyle}
      layout={settings.layout}
      on:render={(e) => svgContent = e.detail}
    />
  </div>
</Container>
<Container lg class="mb-5">
  {#key compositionTmp}
    <CompositionBlock
      composition={ compositionTmp }
      highlight={ highlight }
      on:changeComposition={(e) => onChangeComposition(e.detail)}
      on:playBar={(e) => playStopBar(e.detail.bar, e.detail?.callback)}
    />
  {/key}
</Container>
<Container lg class="mb-5">
  <Button color="light" on:click={() => loadComposition(demoComposition)}>Load demo</Button>
  <Button color="light" on:click={() => loadComposition(emptyComposition)}>Clear</Button>
</Container>

<Modal on:open={() => onClickRender()} centered size='lg' isOpen={isSvgModalOpened} toggle={() => isSvgModalOpened = false}>
  <ModalBody class="overflow-hidden">
    <div class="" bind:this={svgContainerEl}>{@html svgContent ?? ''}</div>
  </ModalBody>
</Modal>
