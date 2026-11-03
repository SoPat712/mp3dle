<script lang="ts">
	import { dragHandle } from '#lib/retro/drag.js';

	export let label: string;
	export let title: string;
	export let width: number;
	export let x = 0;
	export let y = 0;
	export let z = 10;
	export let focused = false;
	export let mobile = false;
	export let closeLabel = '';
	export let minimiseLabel = '';
	export let element: HTMLElement | undefined = undefined;
	export let onFocus: () => void = () => {};
	export let onMove: (x: number, y: number) => void = () => {};
	export let onClose: () => void = () => {};
	export let onMinimise: () => void = () => {};
</script>

<section
	bind:this={element}
	class="window w95"
	aria-label={label}
	tabindex="-1"
	style:left="{x}px"
	style:top="{y}px"
	style:z-index={z}
	style:width="{width}px"
	on:pointerdown={onFocus}
	on:focusin={onFocus}
>
	<div
		class="title-bar"
		class:on={focused}
		use:dragHandle={{ enabled: !mobile, getPosition: () => ({ x, y }), onMove }}
	>
		<span class="title-bar-text">{title}</span>
		{#if minimiseLabel && !mobile}
			<button type="button" class="title-btn" aria-label={minimiseLabel} on:click={onMinimise}>
				_
			</button>
		{/if}
		{#if closeLabel}
			<button type="button" class="title-btn" aria-label={closeLabel} on:click={onClose}>x</button>
		{/if}
	</div>
	<slot />
</section>

<style>
	.window {
		position: absolute;
		max-width: 100vw;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		outline: none;
	}

	@media (max-width: 900px) {
		.window {
			position: static;
			flex: 1;
			min-height: 0;
			width: auto !important;
		}
	}
</style>
