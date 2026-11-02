<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/retro/icons/Icon.svelte';

	export let title: string;
	export let icon: 'error' | 'info' | '' = '';
	export let dismissable = true;
	export let onDismiss: () => void = () => {};

	let dialog: HTMLDialogElement;

	onMount(() => {
		dialog.showModal();
		return () => {
			if (dialog.open) dialog.close();
		};
	});

	function handleCancel(event: Event) {
		event.preventDefault();
		if (dismissable) onDismiss();
	}
</script>

<dialog bind:this={dialog} class="w95" aria-label={title} on:cancel={handleCancel}>
	<div class="title-bar on"><span class="title-bar-text">{title}</span></div>
	<div class="body">
		<div class="message">
			{#if icon}<Icon name={icon} />{/if}
			<div class="text"><slot /></div>
		</div>
		<slot name="extra" />
		<div class="buttons"><slot name="buttons" /></div>
	</div>
</dialog>

<style>
	dialog {
		width: 400px;
		max-width: calc(100vw - 24px);
		margin: auto;
		font: 13px var(--ui-font);
	}

	dialog::backdrop {
		background: transparent;
	}

	.body {
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.message {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.message :global(svg) {
		flex-shrink: 0;
	}

	.text {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
	}

	@media (max-width: 900px) {
		.buttons {
			flex-direction: column;
		}
	}
</style>
