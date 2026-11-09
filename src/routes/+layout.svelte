<script lang="ts">
	import { onMount } from 'svelte';
	import { isOwnError } from '#lib/crash.js';
	import BlueScreen from '#lib/retro/BlueScreen.svelte';
	import '../app.css';

	// sveltekit's error page only sees errors while loading or drawing. this catches
	// the rest, like a click handler or a timer throwing
	let crashed = false;

	onMount(() => {
		const crash = (error: unknown, file?: string) => {
			if (isOwnError(error, location.origin, file)) crashed = true;
		};
		const onError = (event: ErrorEvent) => crash(event.error, event.filename);
		const onRejection = (event: PromiseRejectionEvent) => crash(event.reason);

		window.addEventListener('error', onError);
		window.addEventListener('unhandledrejection', onRejection);
		return () => {
			window.removeEventListener('error', onError);
			window.removeEventListener('unhandledrejection', onRejection);
		};
	});
</script>

{#if crashed}
	<BlueScreen />
{:else}
	<slot />
{/if}
