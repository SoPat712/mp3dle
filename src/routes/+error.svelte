<script lang="ts">
	import { page } from '$app/state';
	import BlueScreen from '#lib/retro/BlueScreen.svelte';
</script>

<svelte:head>
	<title>mp3dle</title>
</svelte:head>

<!-- anything sveltekit catches while loading or drawing lands here, bad links too -->
<BlueScreen status={page.status} message={page.error?.message || 'Internal Error'} />
