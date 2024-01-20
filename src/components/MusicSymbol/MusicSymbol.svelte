<script lang="ts">
  type Symbol = 'whole-note'
    | 'half-note'
    | 'quarter-note'
    | '8th-note'
    | '16th-note'
    | '32nd-note'
    | '64th-note'
    | '128th-note';

  const SYMBOL_MAP = new Map([
    ['whole-note', '𝅝'],
    ['half-note', '𝅗𝅥'],
    ['quarter-note', '𝅘𝅥'],
    ['8th-note', '𝅘𝅥𝅮'],
    ['16th-note', '𝅘𝅥𝅯'],
    ['32nd-note', '𝅘𝅥𝅰'],
    ['64th-note', '𝅘𝅥𝅱'],
    ['128th-note', '𝅘𝅥𝅲'],
  ]);

  let classes = '';
  export {classes as class};

  export let value: Symbol | string;
</script>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Music&family=Noto+Sans+Mono&display=swap');

  .music-symbol {
    font-family: 'Noto Music';
    line-height: 1em;
  }
</style>

<span class={'music-symbol ' + classes}>{SYMBOL_MAP.get(value) ?? value}</span>
