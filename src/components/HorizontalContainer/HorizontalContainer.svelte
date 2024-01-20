<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  let classes = '';
  export {classes as class};

  let el: HTMLElement;
  let arrowLeftEl: HTMLElement;
  let arrowRightEl: HTMLElement;

  let showLeftArrow = false;
  let showRightArrow = false;

  let scrollDelay: number | undefined = undefined

  const SCROLL_DELAY = 200;

  let isWheelScroll = false;

  onMount(() => {
    el.addEventListener('scrollend', onScrollEnd);

    setTimeout(() => scrollTo(0), 100); // Timeout to fix clientWidth issue
  });

  onDestroy(() => {
    el.removeEventListener('scrollend', onScrollEnd);
  });

  function onWheel(event: WheelEvent): void {
    if (el.scrollWidth <= el.clientWidth) {
      showLeftArrow = false;
      showRightArrow = false;
      return;
    }

    el.scrollLeft += event.deltaY;

    // Prevent vertical scroll
    event.preventDefault();

    isWheelScroll = true;

    onScrollEnd();
  }

  function onScroll(): void {
    showLeftArrow = false;
    showRightArrow = false;

    clearTimeout(scrollDelay);
    if (isWheelScroll) {
      onScrollEnd();
    } else {
      // Hide arrows when dragging with touch
      scrollDelay = +setTimeout(onScrollEnd, SCROLL_DELAY);
    }

    isWheelScroll = false;
  }

  function onScrollEnd(): void {
    scrollTo(el.scrollLeft);
  }

  function scrollTo(scroll: number): void {
    if (!el) {
      return;
    }

    el.scrollLeft = scroll;

    const smallGap = el.scrollWidth - el.clientWidth < 50;

    showLeftArrow = !smallGap && scroll !== 0;
    showRightArrow = !smallGap && el.scrollWidth - scroll !== el.clientWidth;

    arrowLeftEl.style.left = `${scroll}px`;
    arrowRightEl.style.right = `-${scroll}px`;
  }

  function onClickLeft(): void {
    scrollTo(0);
  }

  function onClickRight(): void {
    scrollTo(el.scrollWidth - el.clientWidth);
  }
</script>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=swap');

  .arrow {
    font-family: 'Noto Sans Symbols 2', sans-serif;
    font-size: x-large;
    position: absolute;
    top: 50%;
    border-radius: 50%;
    transform: translateY(-50%);
  }
  .arrow-left {
    left: 0;
  }
  .arrow-right {
    right: 0;
  }
  .horizontal-scroll::-webkit-scrollbar {
    display: none;
  }
  .horizontal-scroll {
    position: relative;
    flex: 1;
    display: flex;
    overflow: auto;
  }
  .horizontal-scroll-content {
    display: flex;
    min-height: min-content;
  }
</style>

<div bind:this={el} class={'horizontal-scroll ' + classes} on:wheel={onWheel} on:scroll={onScroll}>
  <div class="horizontal-scroll-content">
    <slot/>
  </div>
  <button bind:this={arrowLeftEl} class:d-none={!showLeftArrow} class="btn btn-light shadow border arrow arrow-left" on:click={onClickLeft}>🡐</button>
  <button bind:this={arrowRightEl} class:d-none={!showRightArrow} class="btn btn-light shadow border arrow arrow-right" on:click={onClickRight}>🡒</button>
</div>
