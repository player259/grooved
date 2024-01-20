<script lang="ts">
	import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';

	const context: Writable<{ direction: string, isOpen: boolean, inNavbar: boolean, popperContent: Function }> = getContext('dropdownContext');

	let className = '';
	export { className as class };
	export let end = false;
	export let right = false;

	const popperPlacement = (direction: string, end: boolean) => {
		let prefix = direction;

		if (direction === 'up') {
			prefix = 'top';
		}

		if (direction === 'down') {
			prefix = 'bottom';
		}

		let suffix = end ? 'end' : 'start';
		return `${prefix}-${suffix}`;
	};

	$: popperOptions = {
		modifiers: [
			{ name: 'flip' },
			{
				name: 'offset',
				options: {
					offset: [0, 2]
				}
			}
		],
		placement: popperPlacement($context.direction, end || right),
    strategy: 'fixed',
	};

	$: classes = [
		className,
    'dropdown-menu',
		end || right ? 'dropdown-menu-end' : undefined,
		$context.isOpen ? 'show' : undefined,
	].filter(c => !!c).join(' ');
</script>

<ul
    {...$$restProps}
    class={classes}
    data-bs-popper={$context.inNavbar ? 'static' : undefined}
    use:$context.popperContent={popperOptions}
>
  <!--{#if $context.isOpen}-->
    <slot />
  <!--{/if}-->
</ul>
