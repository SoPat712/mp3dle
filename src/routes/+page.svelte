<script lang="ts">
	import { onMount } from 'svelte';
	import Desktop from '#lib/retro/Desktop.svelte';
	import { load, moveOldKeys, remove, save } from '#lib/storage.js';
	import { nextTheme, parseTheme, type Theme } from '#lib/theme.js';
	import type { TrackCatalog } from '#lib/tracks.js';
	import type { PageData } from './$types';

	export let data: PageData;

	let catalog: TrackCatalog | null = null;
	let practiceKey = '';
	let pageError = '';
	let pendingArtist = '';
	let catalogPending = true;

	function resolveCatalog(request: PageData) {
		catalogPending = true;
		pendingArtist =
			request.artist.toLowerCase() === catalog?.artist.permalink.toLowerCase()
				? ''
				: request.artist;
		pageError = '';
		request.catalog.then((result) => {
			// a newer navigation owns the page now
			if (data !== request) return;
			catalog = result.catalog;
			practiceKey = result.catalog ? request.practiceKey : '';
			pageError = result.error;
			pendingArtist = '';
			catalogPending = false;
		});
	}

	$: resolveCatalog(data);

	// before anything reads storage
	moveOldKeys();

	const THEME_KEY = 'mp3dle:theme';
	const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

	// auto follows the system, light and dark override it
	let theme: Theme = parseTheme(load(THEME_KEY));
	let systemIsDark = systemDark.matches;

	function cycleTheme() {
		theme = nextTheme(theme);
		if (theme === 'auto') remove(THEME_KEY);
		else save(THEME_KEY, theme);
	}

	$: darkMode = theme === 'auto' ? systemIsDark : theme === 'dark';
	$: {
		document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
		document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', darkMode ? '#10192e' : '#1f3561');
	}

	onMount(() => {
		const systemChanged = (event: MediaQueryListEvent) => {
			systemIsDark = event.matches;
		};
		systemDark.addEventListener('change', systemChanged);
		return () => systemDark.removeEventListener('change', systemChanged);
	});
</script>

<svelte:head>
	<title>{catalog ? `${catalog.artist.username} mp3dle` : 'mp3dle'}</title>
</svelte:head>

<div class:dark-mode={darkMode} class="app-shell">
	<Desktop
		{catalog}
		{practiceKey}
		{pageError}
		{pendingArtist}
		{catalogPending}
		{theme}
		onCycleTheme={cycleTheme}
	/>
</div>

<style>
	.app-shell {
		height: 100svh;
		overflow: hidden;
		font: 13px var(--ui-font);
	}
</style>
