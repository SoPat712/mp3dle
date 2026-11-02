<script lang="ts">
	import { onMount } from 'svelte';
	import Desktop from '$lib/retro/Desktop.svelte';
	import { load, save } from '$lib/storage';
	import type { PageData } from './$types';

	export let data: PageData;

	const THEME_KEY = 'soundcloud-heardle:theme';
	const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

	// picking a theme in the start menu beats whatever the system says
	let picked = load(THEME_KEY);
	let darkMode = picked ? picked === 'dark' : systemDark.matches;

	function toggleTheme() {
		darkMode = !darkMode;
		picked = darkMode ? 'dark' : 'light';
		save(THEME_KEY, picked);
	}

	$: document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';

	onMount(() => {
		const systemChanged = (event: MediaQueryListEvent) => {
			if (!picked) darkMode = event.matches;
		};
		systemDark.addEventListener('change', systemChanged);
		return () => systemDark.removeEventListener('change', systemChanged);
	});
</script>

<svelte:head>
	<title>{data.catalog ? `${data.catalog.artist.username} Heardle` : 'SoundCloud Heardle'}</title>
</svelte:head>

<div class:dark-mode={darkMode} class="app-shell">
	<Desktop
		catalog={data.catalog}
		practiceKey={data.practiceKey}
		pageError={data.error}
		{darkMode}
		onToggleTheme={toggleTheme}
	/>
</div>

<style>
	.app-shell {
		height: 100svh;
		overflow: hidden;
		font: 13px var(--ui-font);
	}
</style>
