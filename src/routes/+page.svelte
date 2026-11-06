<script lang="ts">
	import { onMount } from 'svelte';
	import Desktop from '#lib/retro/Desktop.svelte';
	import { load, moveOldKeys, remove, save } from '#lib/storage.js';
	import { nextTheme, parseTheme, type Theme } from '#lib/theme.js';
	import type { PageData } from './$types';

	export let data: PageData;

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
	<title>{data.catalog ? `${data.catalog.artist.username} mp3dle` : 'mp3dle'}</title>
</svelte:head>

<div class:dark-mode={darkMode} class="app-shell">
	<Desktop
		catalog={data.catalog}
		practiceKey={data.practiceKey}
		pageError={data.error}
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
