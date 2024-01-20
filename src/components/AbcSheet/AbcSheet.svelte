<script lang="ts">
  import { tick, onMount, createEventDispatcher } from 'svelte';

  import { AbcRenderer, type Layout, type StaffStyle } from '$lib/Noted/AbcRenderer';
  import type { Composition, Position } from '$lib/Noted/types';
  import { Noted } from '$lib/Noted/Noted';

  export let composition: Composition;
  export let highlight: Position | undefined = undefined;

  export let pageScale: number = 1;
  export let staffStyle: StaffStyle = 'full';
  export let layout: Layout = 'normal';
  export let singleLine: boolean = false;
  export let useLowerVoice: boolean = true;
  export let detectRepeats: boolean = true;

  let paperEl: HTMLElement;
  let svgContent: string | undefined;

  const dispatch = createEventDispatcher();

  $: {
    if (paperEl && svgContent !== undefined) {
      for (const el of paperEl.getElementsByClassName('position-cursor')) {
        const position = Noted.positionFromString(el.getAttribute('data-position') ?? '');
        el.classList.toggle('highlight', highlight && Noted.comparePositions(position, highlight) === 0);
      }
    }
  }

  function render(): undefined {
    if (!composition || !paperEl) {
      return;
    }

    const abcSource = AbcRenderer.compositionToAbc(composition, {
      useLowerVoice,
      pageWidth: paperEl.clientWidth,
      pageScale,
      annotationFont: { name: 'MADE Waffle Soft', size: 14 },
      singleLine,
      staffStyle,
      layout,
      detectRepeats,
      stretch: false,
    });
    svgContent = AbcRenderer.render(abcSource);

    // dispatch('render', svgContent);

    tick().then(() => {
      highlight = highlight;

      for (const el of paperEl.getElementsByTagName('svg')) {

        // const styleEl = document.createElement('style');
        // styleEl.append(`
        //   @font-face {
        //     font-family: 'MADE Waffle Soft';
        //     src: url(${madeWaffleFontWoff2}) format('woff2'), url(${madeWaffleFontWoff}) format('woff');
        //     font-weight: 800;
        //     font-style: normal;
        //   }
        // `);
        //
        // el.getElementsByTagName('style')[0]?.append(`
        //   text {
        //     border: 1px solid black;
        //   }
        // `);

        [...el.getElementsByTagName('text')].forEach(el => el.style.fontSize = getComputedStyle(el).fontSize);
        [...el.getElementsByTagName('text')].forEach(el => el.style.fontFamily = getComputedStyle(el).fontFamily);
        [...el.getElementsByTagName('text')].forEach(el => el.style.fontStyle = getComputedStyle(el).fontStyle);

        // Workaround!
        // Rectangle box annotation
        [...el.getElementsByClassName('annotation')].forEach(el => {
          if (!el.classList.contains('box')) {
            return;
          }

          el.style.outline = 'none';
          el.parentElement?.style.setProperty('outline', 'none');

          const bbox = el.getBBox();

          let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', +bbox.x - 2);
          rect.setAttribute('y', +bbox.y - 2);
          rect.setAttribute('width', +bbox.width + 4);
          rect.setAttribute('height', +bbox.height + 4);
          rect.setAttribute('fill', 'transparent');
          rect.setAttribute('stroke', 'black');
          rect.setAttribute('stroke-width', '1px');

          el.parentElement?.after(rect);
        });

        dispatch('render', paperEl.innerHTML);
      }
    });
  }

  onMount(async () => {
    setTimeout(render, 100); // Timeout to fix clientWidth issue
  });

  $: composition && render() && pageScale && staffStyle && layout && singleLine && useLowerVoice && detectRepeats;

</script>

<style>
</style>

<div bind:this={paperEl}>{@html svgContent ?? ''}</div>
