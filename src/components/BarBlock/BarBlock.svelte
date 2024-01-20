<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownToggle,
    Input,
    InputGroup,
    ListGroup,
    ListGroupItem,
    Modal,
    ModalBody,
    ModalHeader,
  } from '@sveltestrap/sveltestrap';

  import { default as DropdownMenu } from '$components/FixedDropdownMenu/FixedDropdownMenu.svelte';

  import type { Measure, Meter, Note, Position, Tuplet } from '$lib/Noted/types';
  import { Noted } from '$lib/Noted/Noted';
  import {
    Line,
    ANNOT_TEMPLATE,
    LINE_LABELS,
    TEMPLATES,
    createParts,
    MEASURE_SYMBOLS,
    calculatePartSize,
    AUTOFILL_TEMPLATES,
    DEFAULT_LINE_SET, LINE_EMPTY_SYMBOL, type AutofillTemplate
  } from '$components/BarBlock/utils';
  import type { Part } from '$components/BarBlock/utils';

  import {
    ATTR_ANNOT_ABOVE,
    ATTR_ANNOT_BELOW,
    ATTR_ANNOT_BORDER,
    ATTR_ANNOT_LARGER,
    ATTR_ANNOT_SMALLER,
    TYPE_ANNOT
  } from '$lib/Noted/NotedDrums';

  import { computePosition, type ComputePositionConfig, offset } from '@floating-ui/dom';
  import { shift, flip } from 'svelte-floating-ui/dom';
  import MusicSymbol from '$components/MusicSymbol/MusicSymbol.svelte';

  const dispatch = createEventDispatcher();

  function throwError(message?: string): never {
    throw new Error(message);
  }

  function isNoteEqual(a: Note, b: Note): boolean {
    return a.value === b.value && a.type === b.type && Noted.comparePositions(a.position, b.position) === 0;
  }

  function isTupletEqual(a: Tuplet | undefined, b: Tuplet | undefined): boolean {
    return a?.[0] === b?.[0] && a?.[1] === b?.[1];
  }

  let classes = '';
  export {classes as class};

  export let notes: Note[];
  export let bar: number;
  export let meter: Meter;
  export let bpm: number;
  export let highlight: Position | undefined = undefined;
  export let repeat = 1;
  export let lines: Line[] = DEFAULT_LINE_SET;

  export let hideLineNames = false;

  const ALLOWED_MEASURES: Measure[] = [4, 8, 16, 32, 64];
  const ALLOWED_TUPLETS: Tuplet[] = [[3, 2], [5, 4], [6, 4], [7, 4], [5, 3]];

  let contextLine: Line | undefined = undefined;
  let contextNote: Note | undefined = undefined;
  let contextPosition: Position | undefined = undefined;
  let contextPartIndex: number | undefined = undefined;

  type ClickNoteContext = {
    line: Line,
    position: Position,
    note?: Note,
  }

  let parts: Part[] = [];

  $: repeat = Math.min(Math.max(repeat, 1), 99);

  // Hardcode limitation
  $: meter = meter[1] === 4 ? meter : throwError(`Only 4th note based meters supported, e.g. 4/4, 6/4`);

  // $: bpm = Math.min(Math.max(bpm, 30), 300);

  // Validate notes
  $: {
    if (notes.map(n => 'offset' in n.position ? n.position.tuplet : undefined).filter(t => !!t).some((t, i, arr) => !isTupletEqual(t, arr[0]))) {
      throw new Error(`Notes can't have different tuplets in one bar`);
    }
    if (notes.some(n => n.position.bar !== bar)) {
      throw new Error(`Notes can't have different tuplets in one bar`);
    }
  }

  $: dispatch('changeNotes', notes);
  $: dispatch('changeMeter', meter);
  $: dispatch('changeBpm', bpm);
  $: dispatch('changeRepeat', repeat);

  function updateParts(): undefined {
    parts = createParts(notes, bar, meter, parts);
  }

  $: updateParts() && notes && bar && meter;

  let tableEl: HTMLElement;
  let highlightIndex: number | undefined = undefined;

  $: {
    if (highlight) {
      highlightIndex = 0;
      for (const tick of parts.map(p => p.ticks).flat()) {
        if (Noted.comparePositions(tick.position, highlight) === 0) {
          break;
        }
        highlightIndex++;
      }
    } else {
      highlightIndex = undefined;
    }
  }
  $: {
    if (tableEl) {
      for (const el of tableEl.getElementsByClassName('cell-note')) {
        const index = +(el.getAttribute('data-index') ?? 0);
        el.classList.toggle('highlight', index === highlightIndex);
      }
    }
  }

  const DEFAULT_FLOATING_CONFIG: Partial<ComputePositionConfig> = {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      flip(),
      shift(),
    ]
  }

  function showFloating(ref: Element | EventTarget | null, content: HTMLElement, options?: Partial<ComputePositionConfig>): void {
    dismissFloatings();

    content.style.position = 'fixed';
    content.style.left = `0px`;
    content.style.top = `0px`;
    content.style.visibility = 'hidden';
    content.style.setProperty('display', 'initial', 'important');

    if (ref instanceof Element) {
      computePosition(ref, content, { ...DEFAULT_FLOATING_CONFIG, ...options}).then(({x, y}) => {
        content.style.visibility = 'visible';
        content.style.left = `${x}px`;
        content.style.top = `${y}px`;
        content.style.setProperty('display', 'inherit', 'important');
      });
    }
  }

  let lineOptionsFloating: HTMLElement;
  let noteOptionsFloating: HTMLElement;
  let noteOptions: ContextMenuItem[] = [];
  let annotationOptions: ContextMenuItem[] = [];
  let lineActionOptionsFloating: HTMLElement;
  let partOptionsFloating: HTMLElement;
  let partMeasureOptions: ChangeMeasureOption[] = [];
  let partTupletOptions: ChangeTupletOption[] = [];
  let barOptionsFloating: HTMLElement;
  let barMeasureOptions: ChangeMeasureOption[] = [];
  let barTupletOptions: ChangeTupletOption[] = [];

  $: partMeasureOptions = contextPartIndex !== undefined ? getPartMeasureOptions(parts[contextPartIndex]) : [];
  $: partTupletOptions = contextPartIndex !== undefined ? getPartTupletOptions(parts[contextPartIndex]) : [];

  $: { barMeasureOptions = getBarMeasureOptions(); parts; }
  $: { barTupletOptions = getBarTupletOptions(); parts; }

  function dismissFloatings(): void {
    for (const el of [lineOptionsFloating, noteOptionsFloating, lineActionOptionsFloating, partOptionsFloating, barOptionsFloating]) {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  let isAnnotationOpened = false;

  function dismissModals(): void {
    isAnnotationOpened = false;
  }

  const handleDocumentClick: EventListener = function (e: Event): void {
    const isInFloating = [lineOptionsFloating, noteOptionsFloating, lineActionOptionsFloating, partOptionsFloating, barOptionsFloating]
      .some(el => (e.target instanceof Element) && el?.contains(e.target));

    if (!isInFloating) {
      dismissFloatings();
      return;
    }
  }

  onMount(() => {
    if (typeof document !== 'undefined') {
      for (const e of ['click', 'touchstart', 'keyup']) {
        document.addEventListener(e, handleDocumentClick, true);
      }
    }
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      for (const e of ['click', 'touchstart', 'keyup']) {
        document.removeEventListener(e, handleDocumentClick, true);
      }
    }
  });

  let customAnnotationValue: string = '';
  let customAnnotationSmaller: boolean = false;
  let customAnnotationLarger: boolean = false;
  let customAnnotationBorder: boolean = false;

  function showAnnotationModal(line: Line, position: Position, note?: Note) {
    customAnnotationValue = note?.value ?? '';
    customAnnotationSmaller = note?.attributes?.includes(ATTR_ANNOT_SMALLER) ?? false;
    customAnnotationLarger = note?.attributes?.includes(ATTR_ANNOT_LARGER) ?? false;
    customAnnotationBorder = note?.attributes?.includes(ATTR_ANNOT_BORDER) ?? false;

    annotationOptions = getAnnotationOptions(line, position, note);
    isAnnotationOpened = true;
  }

  function onClickNote(event: Event, line: Line, position: Position, note?: Note): void {
    if ([Line.ANNOT_TOP, Line.ANNOT_BTM].includes(line)) {
      showAnnotationModal(line, position, note);

      return;
    }

    if (note !== undefined) {
      replaceNotes([[note, undefined]]);
    } else {
      const template = TEMPLATES.find(t => t.line === line) ?? throwError(`Template note found for: ${line}`);
      replaceNotes([[note, { value: template.value, position, attributes: template.attributes }]]);
    }

    dismissFloatings();
  }

  function onContextMenuNote(event: Event, line: Line, position: Position, note?: Note) {
    event.preventDefault()

    if ([Line.ANNOT_TOP, Line.ANNOT_BTM].includes(line)) {
      showAnnotationModal(line, position, note);

      return;
    }

    noteOptions = getNoteOptions(line, position, note);

    showFloating(event.target, noteOptionsFloating, { placement: 'right-start', middleware: [ flip(), shift(), offset(-15) ] });
  }

  function onClickBarActions(event: Event): void {
    barMeasureOptions = getBarMeasureOptions();
    barTupletOptions = getBarTupletOptions();

    showFloating(event.target, barOptionsFloating);
  }

  function onClickPartActions(event: Event, partIndex: number): void {
    contextPartIndex = partIndex;

    showFloating(event.target, partOptionsFloating);
  }

  function onClickLineActions(event: Event, line: Line): void {
    if ([Line.ANNOT_TOP, Line.ANNOT_BTM].includes(line)) {
      return;
    }

    contextLine = line;

    showFloating(event.target, lineActionOptionsFloating);
  }

  function onClickChangePartMeasure(partIndex: number, measure: Measure): void {
    contextPartIndex = partIndex;

    changePartMeasure(partIndex, measure);

    parts = parts;
  }

  function onClickChangePartTuplet(partIndex: number, tuplet?: Tuplet): void {
    contextPartIndex = partIndex;

    changePartTuplet(partIndex, tuplet);

    parts = parts;
  }

  function onClickChangeBarMeasure(measure: Measure): void {
    parts.forEach(p => changePartMeasure(p.index, measure));

    parts = parts;
  }

  function onClickChangeBarTuplet(tuplet: Tuplet | undefined): void {
    parts.forEach(p => changePartTuplet(p.index, tuplet));

    parts = parts;
  }

  function onClickClearPart(partIndex: number): void {
    parts[partIndex].ticks.map(t => [...t.noteMap.values()]).flat().forEach(tv => replaceNotes([[tv.note, undefined]]));

    parts = parts;

    dismissFloatings();
  }

  function onClickClearBar(): void {
    notes = [];

    parts = parts;

    dismissFloatings();
  }

  function onClickLineAutofill(line: Line, template: AutofillTemplate): void {
    clearLine(line);

    for (let i = template.skip ?? 0; i < template.effectiveMeasure * meter[0] / meter[1]; i += template.each) {
      const position = {
        bar,
        offset: i,
        measure: template.effectiveMeasure,
      }

      const noteTemplate = TEMPLATES.find(t => t.line === line) ?? throwError(`Template note found for: ${line}`);

      replaceNotes([[undefined, { value: noteTemplate.value, position, attributes: noteTemplate.attributes }]]);
    }

    dismissFloatings();
  }

  function onClickLineMenu(event: Event) {
    showFloating(event.target, lineOptionsFloating);
  }

  function onClickLineMenuItem(event: Event, line: Line) {
    toggleLine(line);
  }

  function onClickClearLine(line: Line): void {
    clearLine(line);

    dismissFloatings();
  }

  function changePartMeasure(partIndex: number, measure: Measure): void {
    const part = parts[partIndex];

    // Drop conflicting tuplet
    const tuplet = isMeasureAllowedForPart(partIndex, measure) ? part.tuplet : undefined;

    const partNotes = part.ticks.map(t => [...t.noteMap.values()]).flat().map(tv => tv.note);

    const replacements: Array<[Note | undefined, Note | undefined]> = partNotes.map(n => {
      let replace: Note | undefined = undefined;
      try {
        replace = { ...n, position: Noted.modifyPosition(n.position, measure, tuplet) };
      } catch (e) {}

      return [n, replace];
    });

    replaceNotes(replacements);

    part.measure = measure;
    part.tuplet = tuplet;
  }

  function changePartTuplet(partIndex: number, tuplet?: Tuplet): void {
    // Skip inapplicable tuplet
    if (!isTupletAllowedForPart(partIndex, tuplet)) {
      return;
    }

    const part = parts[partIndex];

    const partNotes = part.ticks.map(t => [...t.noteMap.values()]).flat().map(tv => tv.note);

    const replacements: Array<[Note | undefined, Note | undefined]> = partNotes.map(n => {
      let replace: Note | undefined = undefined;
      try {
        replace = { ...n, position: Noted.changePositionTuplet(n.position, tuplet) };
      } catch (e) {}

      return [n, replace];
    });

    replaceNotes(replacements);

    part.tuplet = tuplet;
  }

  function isMeasureAllowedForPart(partIndex: number, measure: Measure): boolean {
    const part = parts[partIndex];

    return part.tuplet === undefined || calculatePartSize(meter, measure) % part.tuplet[1] === 0;
  }

  function isTupletAllowedForPart(partIndex: number, tuplet: Tuplet | undefined): boolean {
    if (tuplet === undefined) {
      return true;
    }

    const part = parts[partIndex];

    if (calculatePartSize(meter, part.measure) % tuplet[1] !== 0) {
      return false;
    }

    if (parts.map(p => p.tuplet).every(t => !t || isTupletEqual(t, tuplet))) {
      return true;
    }

    return parts.map(p => p.tuplet).filter(t => !!t).length === 1 && part.tuplet !== undefined;
  }

  function toggleLine(line: Line): void {
    if (lines.includes(line)) {
      lines = lines.filter(l => l !== line);

      clearLine(line);
    } else {
      lines.push(line);
    }

    lines = lines;
  }

  function clearLine(line: Line): void {
    const lineNotes = parts.map(p => p.ticks).flat().map(t => t.noteMap.get(line)?.note).filter(v => !!v);

    replaceNotes(lineNotes.map(n => [n, undefined]));
  }

  function replaceNotes(replacements: Array<[Note | undefined, Note | undefined]>): void {
    let newNotes = [...notes];
    for (const replacement of replacements) {
      if (replacement[0] !== undefined) {
        newNotes = newNotes.filter(n => replacement[0] === undefined || !isNoteEqual(n, replacement[0]));
      }
      if (replacement[1] !== undefined) {
        // Check if suits existing position
        for (const tick of parts.map(p => p.ticks).flat()) {
          if (Noted.comparePositions(tick.position, replacement[1]?.position) === 0) {
            newNotes.push(replacement[1]);
            break;
          }
        }
      }
    }

    notes = newNotes;
  }

  type ContextMenuItem = {
    context: ClickNoteContext,
    note?: Note;
    label: string,
  }

  function getNoteOptions(line: Line, position: Position, note?: Note): ContextMenuItem[] {
    return [
      {
        context: { line, position, note },
        note: undefined,
        label: 'None',
      },
      ...TEMPLATES.filter(t => t.line === line).map(t => ({
        context: { line, position, note },
        note: {
          value: t.value,
          position: position,
          attributes: t.attributes,
        },
        label: t.symbol,
      })),
    ];
  }

  function getAnnotationOptions(line: Line, position: Position, note?: Note): ContextMenuItem[] {
    return [
      {
        context: { line, position, note },
        note: undefined,
        label: 'None',
      },
      ...ANNOT_TEMPLATE.map(t => ({
        context: {line, position, note},
        note: {
          value: t.value,
          type: TYPE_ANNOT,
          position: position,
          attributes: [...t.attributes ?? [], line === Line.ANNOT_BTM ? ATTR_ANNOT_BELOW : ATTR_ANNOT_ABOVE],
        },
        label: t.value,
      })),
    ];
  }

  type ChangeMeasureOption = {
    partIndex?: number,
    measure: Measure,
    active: boolean,
    disabled: boolean,
  }

  type ChangeTupletOption = {
    partIndex?: number,
    tuplet?: Tuplet,
    active: boolean,
    disabled: boolean,
  }

  function getBarMeasureOptions(): ChangeMeasureOption[] {
    return ALLOWED_MEASURES.map(m => ({
      partIndex: undefined,
      measure: m,
      active: parts.every(p => m === p.measure),
      disabled: false,
    }));
  }

  function getBarTupletOptions(): ChangeTupletOption[] {
    return [
      {
        partIndex: undefined,
        tuplet: undefined,
        active: parts.every(p => isTupletEqual(undefined, p.tuplet)),
        disabled: false,
      },
      ...ALLOWED_TUPLETS.map(t => ({
        partIndex: undefined,
        tuplet: t,
        active: parts.every(p => isTupletEqual(t, p.tuplet)),
        disabled: parts.every(p => !isTupletAllowedForPart(p.index, t)),
      }))
    ];
  }

  function getPartMeasureOptions(part: Part): ChangeMeasureOption[] {
    return ALLOWED_MEASURES.map(m => ({
      partIndex: part.index,
      measure: m,
      active: m === part.measure,
      disabled: !isMeasureAllowedForPart(part.index, m),
    }));
  }

  function getPartTupletOptions(part: Part): ChangeTupletOption[] {
    return [
      {
        partIndex: part.index,
        tuplet: undefined,
        active: isTupletEqual(undefined, part.tuplet),
        disabled: !isTupletAllowedForPart(part.index, undefined),
      },
      ...ALLOWED_TUPLETS.map(t => ({
        partIndex: part.index,
        tuplet: t,
        active: isTupletEqual(t, part.tuplet),
        disabled: !isTupletAllowedForPart(part.index, t),
      }))
    ];
  }

  function toClasses(...values: Array<[string, boolean] | string | number | undefined | null>): string {
    return values
      .map(v => {
        if (Array.isArray(v)) {
          return v[1] ? v[0] : null;
        }
        return v;
      })
      .filter(v => v !== undefined && v !== null && v !== '')
      .map(v => String(v).replace(/\-+/, '-').replace(/\-+$/, '').replace('_', '-'))
      .map(v => v.toLowerCase())
      .join(' ');
  }

  const cellWidth = 2;
  const lineHeaderWidth = hideLineNames ? 0 : 5;
  const separatorWidth = 1;

  let totalWidth = 0;
  $: totalWidth = parts.reduce((r, p) => r + p.ticks.length, 0) * cellWidth + parts.length * separatorWidth + lineHeaderWidth;

</script>

<div class="d-flex">
  <div class="align-self-center text-end me-3" style="width: 5em">
    <Button size="lg" color="light" class="bg-transparent border-0 dropdown-toggle pe-0" on:click={(e) => onClickBarActions(e)}>
      <slot name="menu-toggle">{meter[0]}/{meter[1]}</slot>
    </Button>
  </div>
  <div class="align-self-center flex-fill">
    <slot name="header" meter={meter} bpm={bpm} repeat={repeat}>
      <span class="me-3"><MusicSymbol value="quarter-note"/> = {bpm}</span>
      <span class="me-3">&times; {repeat}</span>
    </slot>
  </div>
</div>

<table bind:this={tableEl} class={'bar-block table table-borderless text-center me-2 ' + classes} style="width: {totalWidth}em">
  <thead>
    <tr class="parts-row">
      <th class="text-end lines-cell" style="width: {lineHeaderWidth}em" class:d-none={hideLineNames}>
        <Button size="sm" class="btn-light bg-transparent border-0 dropdown-toggle pe-0" on:click={(e) => onClickLineMenu(e)}>Lines</Button>
      </th>
      {#each parts as part, i (part.hash)}
        <th class="separator" style="width: {separatorWidth}em"></th>
        <th class="p-0 part-header part-header-{i} part-header-{i % 2 === 0 ? 'even' : 'odd'}" colspan={part.ticks.length} style="width: {part.ticks.length * cellWidth}em">
          <Button class="btn-light bg-transparent border-0 dropdown-toggle" on:click={(e) => onClickPartActions(e, part.index)}>
            <MusicSymbol value={MEASURE_SYMBOLS[part.measure]} />
            <span class=""><sup>{part.measure}</sup></span>
            {#if part.tuplet !== undefined}
              <span class=""><i>┌{part.tuplet[0]}:{part.tuplet[1]}┐</i></span>
            {/if}
          </Button>
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each Object.values(Line) as line}
      {@const isAnnotation = [Line.ANNOT_TOP, Line.ANNOT_BTM].includes(line)}
      <tr class={toClasses(
        'line-row',
        ['d-none', !lines.includes(line)],
        'line-' + line,
      )}>
        <th scope="row" class="py-0 text-end label-cell {toClasses('label-cell-' + line)}" class:d-none={hideLineNames}>
          <button
              class={toClasses('label+' + line, 'cursor-pointer border-0 btn btn-light bg-transparent p-0')}
              on:click={(e) => onClickLineActions(e, line)}
          >
            {line.toUpperCase()}
          </button>
        </th>
        {#each parts as part, i (part.hash)}
          {@const partStart = parts.slice(0, i).reduce((r, p) => r + p.ticks.length, 0)}
          <td class="separator"></td>
          {#each part.ticks as tick, j}
            {@const index = partStart + j}
            {@const note = tick.noteMap.get(line)?.note }
            {@const symbol = tick.noteMap.get(line)?.symbol }
            <td
              id={toClasses(line + '-' + index)}
              class={toClasses(
                'p-0 user-select-none text-nowrap',
                'cell-' + line,
                'cell-note',
                ['annot', isAnnotation],
                ['annot-long', isAnnotation && symbol !== undefined && symbol.length > 2],
                'note-' + (note?.value ?? 'none'),
                ...note?.attributes?.map(v => 'attr-' + v) ?? [],
                'note-part-' + i,
                'note-part-' + (i % 2 === 0 ? 'even' : 'odd'),
              )}
              data-position={Noted.positionToString(tick.position)}
              data-index={index}
              on:click={(e) => onClickNote(e, line, tick.position, note)}
              on:contextmenu={(e) => onContextMenuNote(e, line, tick.position, note)}
            >
              {#if isAnnotation && !!symbol}
                <div class='d-inline-block' title={symbol}>
                  {@html symbol}
                </div>
              {:else}
                {@html symbol ?? LINE_EMPTY_SYMBOL[line]}
              {/if}
            </td>
          {/each}
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<Modal centered size='md' isOpen={isAnnotationOpened} toggle={dismissModals}>
  <ModalHeader>{LINE_LABELS[annotationOptions[0].context.line]}</ModalHeader>
  <ModalBody>
    <InputGroup>
      <Input bind:value={customAnnotationValue} />
      <Button color="light" class="border" on:click={() => {
        replaceNotes([
					[
            annotationOptions[0].context.note,
            {
              value: customAnnotationValue,
              type: TYPE_ANNOT,
              position: annotationOptions[0].context.position,
              attributes: [
                ...customAnnotationLarger ? [ATTR_ANNOT_LARGER] : [],
                ...customAnnotationSmaller ? [ATTR_ANNOT_SMALLER] : [],
                ...customAnnotationBorder ? [ATTR_ANNOT_BORDER] : [],
              ],
            },
          ],
				]);
        dismissModals();
      }}>Apply</Button>
    </InputGroup>
    <div class="my-2 d-flex justify-content-start">
      <Input label="Larger" type="checkbox" bind:checked={customAnnotationLarger} class="me-3" />
      <Input label="Smaller" type="checkbox" bind:checked={customAnnotationSmaller} class="me-3" />
      <Input label="Border" type="checkbox" bind:checked={customAnnotationBorder} class="me-3" />
    </div>
    {#if customAnnotationValue !== ''}
      <div class="mt-2 mb-3">
        Preview: <span
          class="annotation-preview"
          class:larger={customAnnotationLarger}
          class:smaller={customAnnotationSmaller}
          class:border={customAnnotationBorder}
        >{customAnnotationValue}</span>
      </div>
    {/if}
    {#each annotationOptions as option}
      <Button color="light" class="m-1 border" on:click={() => {
        replaceNotes([[option.context.note, option.note]]);
        dismissModals();
      }}>
        <span
          class="annotation-preview"
          class:larger={option.note?.attributes?.includes(ATTR_ANNOT_LARGER)}
          class:smaller={option.note?.attributes?.includes(ATTR_ANNOT_SMALLER)}
          class:border={option.note?.attributes?.includes(ATTR_ANNOT_BORDER)}
        >{@html option.label}</span>
      </Button>
    {/each}
  </ModalBody>
</Modal>

<div bind:this={lineOptionsFloating} class="floating d-none">
  <ListGroup>
    {#key lines}
      {#each Object.values(Line) as line}
        <button class="list-group-item list-group-item-action py-1" on:click={(e) => onClickLineMenuItem(e, line)}>
          <input
            class="form-check-input pe-none"
            id={line.toUpperCase() + ' (' + LINE_LABELS[line]  + ')'}
            type="checkbox"
            checked={lines.includes(line)}
          />
          <label
              class="form-check-label pe-none"
              for={line.toUpperCase() + ' (' + LINE_LABELS[line]  + ')'}
          >
            {line.toUpperCase() + ' (' + LINE_LABELS[line]  + ')'}
          </label>
        </button>
      {/each}
    {/key}
  </ListGroup>
</div>

<div bind:this={noteOptionsFloating} class="floating d-none">
  <ListGroup>
    {#each noteOptions as option}
      <ListGroupItem class="text-center" tag="button" action on:click={() => {
          replaceNotes([[option.context.note, option.note]]);

          dismissFloatings();
        }}>{@html option.label}</ListGroupItem>
    {/each}
  </ListGroup>
</div>

<div bind:this={lineActionOptionsFloating} class="floating d-none">
  <ListGroup>
    {#each [...new Set(AUTOFILL_TEMPLATES.map(t => t.measure))] as measure}
      <ListGroupItem class="d-flex">
        <MusicSymbol class="align-self-center" value={MEASURE_SYMBOLS[measure]} />&nbsp;
        <InputGroup class="align-self-center d-inline-block">
          {#each AUTOFILL_TEMPLATES.filter(t => t.measure === measure) as template}
            <Button size="sm" color="light" class="border" on:click={() => contextLine !== undefined && onClickLineAutofill(contextLine, template) }>{template.name}</Button>
          {/each}
        </InputGroup>
      </ListGroupItem>
    {/each}
    <ListGroupItem>
      <Button color="light" class="border" on:click={() => contextLine !== undefined && onClickClearLine(contextLine) }>Clear</Button>
    </ListGroupItem>
  </ListGroup>
</div>

<div bind:this={barOptionsFloating} class="floating d-none">
  <ListGroup>
    <ListGroupItem>
      <div class="d-flex">
        <span class="me-3 align-self-center">Meter</span>
        <Dropdown class="align-self-center">
          <DropdownToggle caret color="light" class="border">{meter[0]}</DropdownToggle>
          <DropdownMenu>
            {#each { length: 12 } as _, i}
              <DropdownItem on:click={() => meter = [i + 1, meter[1]]}>{i + 1}</DropdownItem>
            {/each}
          </DropdownMenu>
        </Dropdown>
        <div class='align-self-center mx-1'>/</div>
        <Dropdown>
          <DropdownToggle caret color="light" class="border">{meter[1]}</DropdownToggle>
          <DropdownMenu>
            {#each [4] as i}
              <DropdownItem on:click={() => meter = [meter[0], i]}>{i}</DropdownItem>
            {/each}
          </DropdownMenu>
        </Dropdown>
      </div>
    </ListGroupItem>
    <ListGroupItem>
      <div class="d-flex">
        <span class="me-3 align-self-center">BPM</span>
        <span class="me-1 align-self-center"><MusicSymbol value="quarter-note" /></span>
        <span class="me-1 align-self-center">= </span>
        <InputGroup class="align-self-center">
          <Button addon color="light" class="border" on:click={() => bpm = Math.min(Math.max(bpm - 5, 30), 300)}>-5</Button>
<!--          <Button addon color="light" class="border" on:click={() => bpm -= 1}>-1</Button>-->
          <Input bind:value={bpm} class="text-center" style="max-width: 70px" on:change={() => bpm = Math.min(Math.max(bpm, 30), 300)}/>
<!--          <Button addon color="light" class="border" on:click={() => bpm += 1}>+1</Button>-->
          <Button addon color="light" class="border" on:click={() => bpm = Math.min(Math.max(bpm + 5, 30), 300)}>+5</Button>
        </InputGroup>
      </div>
    </ListGroupItem>
    <ListGroupItem>
      <div class="d-flex">
        <span class="me-3 align-self-center">Repeat</span>
        <span class="me-1 align-self-center">&times;</span>
        <InputGroup class="align-self-center">
          <Button addon color="light" class="border" on:click={() => repeat -= 1}>-</Button>
          <Input bind:value={repeat} readonly class="text-center" style="max-width: 3em" />
          <Button addon color="light" class="border" on:click={() => repeat += 1}>+</Button>
        </InputGroup>
      </div>
    </ListGroupItem>
    <ListGroupItem>
      {#each barMeasureOptions as option}
        <Button size="sm" color="light" class="me-1 border" active={option.active} disabled={option.disabled} on:click={() => onClickChangeBarMeasure(option.measure)}>
          <MusicSymbol value={MEASURE_SYMBOLS[option.measure]} />
          <span class="small">{option.measure}</span>
        </Button>
      {/each}
    </ListGroupItem>
    <ListGroupItem>
      {#each barTupletOptions as option}
        <Button size="sm" color="light" class="me-1 border" active={option.active} disabled={option.disabled} on:click={() => onClickChangeBarTuplet(option.tuplet)}>
          <span class=""><i>
            {#if option.tuplet !== undefined}
              {option.tuplet[0]}:{option.tuplet[1]}
            {:else}
              None
            {/if}
          </i></span>
        </Button>
      {/each}
    </ListGroupItem>
    <ListGroupItem>
      <Button color="light" class="border" on:click={() => onClickClearBar()}>Clear</Button>
    </ListGroupItem>
  </ListGroup>
</div>

<div bind:this={partOptionsFloating} class="floating d-none">
  <ListGroup>
    <ListGroupItem>
      {#each partMeasureOptions as option}
      <Button size="sm" color="light" class="me-1 border" active={option.active} disabled={option.disabled} on:click={() => contextPartIndex !== undefined && onClickChangePartMeasure(contextPartIndex, option.measure)}>
        <MusicSymbol value={MEASURE_SYMBOLS[option.measure]} />
        <span class="small">{option.measure}</span>
      </Button>
      {/each}
    </ListGroupItem>
    <ListGroupItem>
      {#each partTupletOptions as option}
        <Button size="sm" color="light" class="me-1 border" active={option.active} disabled={option.disabled} on:click={() => contextPartIndex !== undefined && onClickChangePartTuplet(contextPartIndex, option.tuplet)}>
          <span class=""><i>
            {#if option.tuplet !== undefined}
              {option.tuplet[0]}:{option.tuplet[1]}
            {:else}
              None
            {/if}
          </i></span>
        </Button>
      {/each}
    </ListGroupItem>
    <ListGroupItem>
      <Button color="light" class="border" on:click={() => contextPartIndex !== undefined && onClickClearPart(contextPartIndex)}>Clear</Button>
    </ListGroupItem>
  </ListGroup>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=swap');

  th, td {
    padding: 0;
    vertical-align: middle;
  }
  .cell-note {
    cursor: pointer;
    font-size: 1.2em;
    vertical-align: middle;
    font-family: 'Noto Sans Symbols 2', sans-serif;
  }
  .label-cell {
    font-weight: normal;
    vertical-align: text-bottom;
    line-height: 1.2em;
    height: 1.2em;
  }
  .label-hh, .label-sn, .label-bd {
    font-weight: bold;
  }
  .cell-note.note-none:not(.cell-hh, .cell-sn, .cell-bd) {
    color: var(--bs-gray-500) !important;
  }
  .cell-hh, .cell-sn, .cell-bd {
    /*color: var(--bs-gray-300) !important;*/
  }
  .label-top, .cell-top, .label-btm, .cell-btm {
    vertical-align: middle;
  }
  .label-cell-top, .label-cell-btm, .cell-top, .cell-btm {
    line-height: 3em;
    height: 2em;
  }
  .header-row {
    height: 3em;
  }
  .parts-row {
    height: 2em;
  }
  .line-row {
    line-height: 1.8em;
    height: 1.8em;
  }
  .cell-top.attr-smaller, .cell-btm.attr-smaller {
    font-size: smaller;
  }
  .cell-top.attr-larger, .cell-btm.attr-larger {
    font-size: larger;
  }
  .cell-top.attr-border > *, .cell-btm.attr-border > * {
    border: 2px black solid;
    padding-top: 0.5em;
    padding-bottom: 0.5em;
  }
  .cell-top.annot-long, .cell-btm.annot-long {
    writing-mode: vertical-rl;
    text-align: center;
    line-height: 2em;
  }
  .cell-top.annot-long > div, .cell-btm.annot-long > div {
    transform: scale(-1, -1);
    overflow: hidden;
    vertical-align: text-top;
    line-height: 1.5em;
    height: 100%;
    box-sizing: border-box;
    text-overflow: clip;
  }
  tr.actions, tr.actions > td, tr.actions:hover, tr.actions > td:hover {
    /* background-color: transparent !important; */
    box-shadow: none !important;
  }
  th.highlight, td.highlight {
    /*background-color: var(--bs-info) !important;*/
    background-color: #97d7ff !important;
  }
  .annotation-preview {
    padding-left: 1em;
    padding-right: 1em;
  }
  .annotation-preview.smaller {
    font-size: smaller;
  }
  .annotation-preview.larger {
    font-size: larger;
  }
  .annotation-preview.border {
    border: 2px black solid !important;
  }
  .note-part-odd, .part-header-odd {
    /*background-color: var(--bs-gray-200) !important;*/
  }
  .note-part-odd, .part-header-odd, .note-part-even, .part-header-even {
    /*background-color: var(--bs-gray-200) !important;*/
  }
  .cursor-pointer, .cursor-pointer * {
    cursor: pointer !important;
  }
  .floating {
    z-index: 9999;
  }
  .bar-block {
    table-layout:fixed;
    height: fit-content;
  }

</style>
