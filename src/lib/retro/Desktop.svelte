<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import Mp3dleGame from '#lib/Mp3dleGame.svelte';
	import { loadFavorites, saveFavorites, type Favorite } from '#lib/favorites.js';
	import { CLIP_LENGTHS, createEmptyStats, type Stats } from '#lib/game-state.js';
	import AboutWindow from '#lib/retro/AboutWindow.svelte';
	import ArtistPic from '#lib/retro/ArtistPic.svelte';
	import FindArtist from '#lib/retro/FindArtist.svelte';
	import Icon from '#lib/retro/icons/Icon.svelte';
	import MessageBox from '#lib/retro/MessageBox.svelte';
	import ReadmeWindow from '#lib/retro/ReadmeWindow.svelte';
	import StatsWindow from '#lib/retro/StatsWindow.svelte';
	import TipJarWindow from '#lib/retro/TipJarWindow.svelte';
	import Win95Window from '#lib/retro/Win95Window.svelte';
	import { load, save } from '#lib/storage.js';
	import type { Theme } from '#lib/theme.js';
	import type { SoundCloudArtist, TrackCatalog } from '#lib/tracks.js';

	export let catalog: TrackCatalog | null;
	export let practiceKey = '';
	export let pageError = '';
	export let pendingArtist = '';
	export let catalogPending = false;
	export let theme: Theme;
	export let onCycleTheme: () => void;

	type WindowId = 'player' | 'stats' | 'readme' | 'find' | 'about' | 'tipjar';
	type IconId = WindowId | 'practice';

	const VOLUME_KEY = 'mp3dle:volume';
	const widths = { player: 700, stats: 300, readme: 470, find: 480, about: 440, tipjar: 420 };
	const allWindows = Object.keys(widths) as WindowId[];
	const LOAD_BLOCKS = 20;
	const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
	const desktopIcons: {
		id: IconId;
		label: string;
		icon: 'record' | 'folder' | 'text' | 'sheet' | 'practice' | 'about' | 'jar';
	}[] = [
		{ id: 'player', label: 'mp3dle Player', icon: 'record' },
		{ id: 'find', label: 'Find Artist', icon: 'folder' },
		{ id: 'readme', label: 'readme.txt', icon: 'text' },
		{ id: 'stats', label: 'stats.xls', icon: 'sheet' },
		{ id: 'practice', label: 'practice.exe', icon: 'practice' },
		{ id: 'about', label: 'About mp3dle', icon: 'about' },
		{ id: 'tipjar', label: 'tipjar.exe', icon: 'jar' }
	];

	const phoneSize = window.matchMedia('(max-width: 900px)');
	let mobile = phoneSize.matches;

	// stats only starts open if it fits next to the player
	const statsFits = window.innerWidth >= 1170;
	let windows = {
		player: { open: Boolean(catalog), min: false, x: 124, y: 16 },
		stats: { open: Boolean(catalog) && statsFits, min: false, x: 854, y: 66 },
		readme: { open: false, min: false, x: 190, y: 90 },
		about: {
			open: false,
			min: false,
			x: Math.max(Math.round((window.innerWidth - widths.about) / 2), 124),
			y: 70
		},
		tipjar: {
			open: false,
			min: false,
			x: Math.max(Math.round((window.innerWidth - widths.tipjar) / 2), 124),
			y: 90
		},
		find: {
			open: !catalog && !pendingArtist,
			min: false,
			x: Math.max(Math.round((window.innerWidth - widths.find) / 2), 124),
			y: 70
		}
	};
	let order: WindowId[] = ['about', 'tipjar', 'readme', 'find', 'stats', 'player']; // last one is on top
	let focus: WindowId | null = catalog ? 'player' : pendingArtist ? null : 'find';
	let openedFrom: Partial<Record<WindowId, Element | null>> = {};
	let elements: Partial<Record<WindowId, HTMLElement>> = {};

	let selectedIcon: IconId | null = null;
	let favorites = loadFavorites();
	let selectedFavorite = '';
	let iconMenu: { favorite: Favorite; x: number; y: number; opener: HTMLElement } | null = null;
	let lastPointer = 'mouse';
	let startOpen = false;
	let volumeOpen = false;
	let notice: { title: string; text: string } | null = null;
	let chosenArtist: Favorite | null = null;
	let choiceReady = false;
	let previousPending = '';
	let initialLoad = Boolean(pendingArtist);
	let loadedBlocks = 0;
	let loadTimer: ReturnType<typeof setInterval>;
	let startButton: HTMLButtonElement;
	let volumeButton: HTMLButtonElement;

	let volume = Number(load(VOLUME_KEY) ?? 80);
	if (!(volume >= 0 && volume <= 100)) volume = 80;
	let clock = '';
	let game: Mp3dleGame | undefined;
	let stats: Stats = createEmptyStats(CLIP_LENGTHS.length);
	let timeLeft = '';

	$: loadingPermalink = pendingArtist || chosenArtist?.permalink || '';
	$: loadingArtist =
		favorites.find((item) => item.permalink === loadingPermalink)?.username ||
		(chosenArtist?.permalink === loadingPermalink
			? chosenArtist.username
			: loadingPermalink && `@${loadingPermalink}`);
	$: if (!chosenArtist) syncPending(pendingArtist);
	$: choiceDone = chosenArtist && choiceReady && !catalogPending;
	$: if (choiceDone) finishChoice();

	$: if (!catalog) stats = createEmptyStats(CLIP_LENGTHS.length);
	$: nextLine = !catalog
		? ''
		: practiceKey
			? 'Practice: stats not counted'
			: `Next song in ${timeLeft}`;
	$: catalogLine = catalog
		? `Catalog: ${catalog.tracks.length.toLocaleString()} cleaned tracks · refreshed ${new Date(catalog.updatedAt).toLocaleDateString()}`
		: '';
	$: statsTitle = catalog ? `stats.xls - ${catalog.artist.username}` : 'stats.xls';
	$: tasks = (
		[
			['player', 'mp3dle Player'],
			['find', 'Find Artist'],
			['stats', statsTitle],
			['readme', 'readme.txt - Notepad'],
			['about', 'mp3dle Properties'],
			['tipjar', 'tipjar.exe']
		] as [WindowId, string][]
	).filter(([id]) => windows[id].open);
	// phones only ever show the one on top
	$: shown = allWindows.filter(
		(id) => windows[id].open && !windows[id].min && (!mobile || focus === id)
	);

	function setWindow(id: WindowId, changes: Partial<(typeof windows)[WindowId]>) {
		windows = { ...windows, [id]: { ...windows[id], ...changes } };
	}

	function raise(id: WindowId) {
		if (focus === id && order.at(-1) === id) return;
		focus = id;
		order = [...order.filter((other) => other !== id), id];
	}

	function topWindow() {
		return order.findLast((id) => windows[id].open && !windows[id].min) ?? null;
	}

	async function openWindow(id: WindowId) {
		startOpen = false;
		openedFrom[id] = document.activeElement;
		setWindow(id, { open: true, min: false });
		raise(id);
		await tick();
		elements[id]?.focus({ preventScroll: true });
	}

	async function closeWindow(id: WindowId) {
		if (id === 'player') game?.pause();
		setWindow(id, { open: false });
		focus = topWindow();

		// no desktop on a phone to fall back to, so go back to the game
		if (mobile) {
			const home = catalog ? 'player' : 'find';
			setWindow(home, { open: true, min: false });
			raise(home);
		}

		await tick();
		(openedFrom[id] as HTMLElement | null | undefined)?.focus?.({ preventScroll: true });
	}

	function minimiseWindow(id: WindowId) {
		setWindow(id, { min: true });
		focus = topWindow();
	}

	// keep at least a bit of the title bar on screen so it can be dragged back
	function moveWindow(id: WindowId, x: number, y: number) {
		setWindow(id, {
			x: Math.min(Math.max(x, 80 - widths[id]), window.innerWidth - 80),
			y: Math.min(Math.max(y, 0), Math.max(window.innerHeight - 68, 0))
		});
	}

	function handleResize() {
		allWindows.forEach((id) => moveWindow(id, windows[id].x, windows[id].y));
	}

	function taskClick(id: WindowId) {
		if (windows[id].min || focus !== id) openWindow(id);
		else minimiseWindow(id);
	}

	function openIcon(id: IconId) {
		if (id === 'practice') startPractice();
		else openWindow(id);
	}

	function iconClick(id: IconId) {
		selectedIcon = id;
		// double click isn't a thing on touchscreens
		if (lastPointer === 'touch') openIcon(id);
	}

	function iconKeydown(event: KeyboardEvent, id: IconId) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		openIcon(id);
	}

	function startPractice() {
		startOpen = false;
		if (catalog) {
			openWindow('player');
			game?.startPractice();
		} else notice = { title: 'practice.exe', text: 'Pick an artist first.' };
	}

	function toggleStart() {
		startOpen = !startOpen;
		volumeOpen = false;
	}

	function toggleVolume() {
		volumeOpen = !volumeOpen;
		startOpen = false;
	}

	function handleVolume(event: Event) {
		volume = Number((event.target as HTMLInputElement).value);
		save(VOLUME_KEY, String(volume));
	}

	function toggleFavorite() {
		if (!catalog) return;
		const { username, permalink, avatarUrl } = catalog.artist;
		if (favorites.some((item) => item.permalink === permalink)) {
			removeFavorite(permalink);
		} else {
			favorites = [...favorites, { username, permalink, avatarUrl }];
			saveFavorites(favorites);
		}
	}

	function removeFavorite(permalink: string) {
		favorites = favorites.filter((item) => item.permalink !== permalink);
		saveFavorites(favorites);
	}

	function openFavorite(favorite: Favorite) {
		startOpen = false;
		iconMenu = null;
		// already loaded, no need to fetch it all again
		if (catalog?.artist.permalink === favorite.permalink) openWindow('player');
		else chooseArtist(favorite);
	}

	function favoriteClick(favorite: Favorite) {
		selectedFavorite = favorite.permalink;
		if (lastPointer === 'touch') openFavorite(favorite);
	}

	function favoriteKeydown(event: KeyboardEvent, favorite: Favorite) {
		if (event.key === 'Enter') {
			event.preventDefault();
			openFavorite(favorite);
		} else if (event.key === 'Delete') {
			removeFavorite(favorite.permalink);
		}
	}

	async function showIconMenu(event: MouseEvent, favorite: Favorite) {
		selectedFavorite = favorite.permalink;
		iconMenu = {
			favorite,
			// keep it on screen when the icon is right up against the edge
			x: Math.min(event.clientX, window.innerWidth - 190),
			y: Math.min(event.clientY, window.innerHeight - 80),
			opener: event.currentTarget as HTMLElement
		};
		await tick();
		document.querySelector<HTMLElement>('.icon-menu button')?.focus();
	}

	function removeFromMenu() {
		if (!iconMenu) return;
		removeFavorite(iconMenu.favorite.permalink);
		iconMenu = null;
	}

	function startLoading() {
		clearInterval(loadTimer);
		// we don't know how long this takes, so the bar just creeps up like the real thing did
		loadedBlocks = 1;
		loadTimer = setInterval(() => {
			loadedBlocks = Math.min(loadedBlocks + 1, LOAD_BLOCKS - 1);
		}, 350);
	}

	function showArtist(openStats = false) {
		// no catalog means it failed, find artist is where the error shows
		if (catalog) {
			setWindow('find', { open: false });
			if (openStats && statsFits) setWindow('stats', { open: true, min: false });
			openWindow('player');
		} else {
			openWindow('find');
		}
	}

	function syncPending(artist: string) {
		if (artist === previousPending) return;
		previousPending = artist;
		if (artist) startLoading();
		else {
			clearInterval(loadTimer);
			loadedBlocks = LOAD_BLOCKS;
			showArtist(initialLoad);
			initialLoad = false;
		}
	}

	async function chooseArtist(artist: Favorite) {
		if (chosenArtist || pendingArtist) return;
		chosenArtist = artist;
		startLoading();

		// cached artists load instantly, so let the bar get going before it closes
		await Promise.all([
			goto(resolve(`/?artist=${encodeURIComponent(artist.permalink)}`)),
			wait(750)
		]);
		choiceReady = true;
	}

	async function finishChoice() {
		choiceReady = false;
		clearInterval(loadTimer);
		loadedBlocks = LOAD_BLOCKS;
		await wait(250);
		if (catalogPending) {
			startLoading();
			choiceReady = true;
			return;
		}
		chosenArtist = null;
		showArtist();
	}

	function handlePointerDown(event: PointerEvent) {
		lastPointer = event.pointerType;
		const target = event.target as Element;
		if (!target.closest('.start-menu, .start-button')) startOpen = false;
		if (!target.closest('.volume-popup, .volume-button')) volumeOpen = false;
		if (!target.closest('.desk-icon')) {
			selectedIcon = null;
			selectedFavorite = '';
		}
		if (!target.closest('.icon-menu')) iconMenu = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (iconMenu) {
			iconMenu.opener.focus();
			iconMenu = null;
		} else if (startOpen) {
			startOpen = false;
			startButton.focus();
		} else if (volumeOpen) {
			volumeOpen = false;
			volumeButton.focus();
		}
	}

	function updateClock() {
		clock = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	function phoneSizeChanged(event: MediaQueryListEvent) {
		mobile = event.matches;
		if (mobile && !focus) focus = catalog ? 'player' : 'find';
	}

	onMount(() => {
		phoneSize.addEventListener('change', phoneSizeChanged);
		updateClock();
		const clockTimer = setInterval(updateClock, 1000);
		return () => {
			phoneSize.removeEventListener('change', phoneSizeChanged);
			clearInterval(clockTimer);
			clearInterval(loadTimer);
		};
	});
</script>

<svelte:window
	on:pointerdown|capture={handlePointerDown}
	on:keydown={handleKeydown}
	on:resize={handleResize}
/>

<div class="screen">
	<div class="wall-record" aria-hidden="true">
		<div class="wall-record-label"></div>
		<div class="wall-record-hole"></div>
	</div>

	<main class="desk">
		<nav class="desk-icons" aria-label="Desktop">
			{#each desktopIcons as item (item.id)}
				<button
					type="button"
					class="desk-icon"
					class:selected={selectedIcon === item.id}
					on:click={() => iconClick(item.id)}
					on:dblclick={() => openIcon(item.id)}
					on:keydown={(event) => iconKeydown(event, item.id)}
				>
					<Icon name={item.icon} />
					<span>{item.label}</span>
				</button>
			{/each}
		</nav>

		{#if favorites.length}
			<nav class="fav-icons" aria-label="Favorite artists">
				{#each favorites as item (item.permalink)}
					<button
						type="button"
						class="desk-icon"
						class:selected={selectedFavorite === item.permalink}
						on:click={() => favoriteClick(item)}
						on:dblclick={() => openFavorite(item)}
						on:keydown={(event) => favoriteKeydown(event, item)}
						on:contextmenu|preventDefault={(event) => showIconMenu(event, item)}
					>
						<span class="fav-pic">
							<ArtistPic username={item.username} avatarUrl={item.avatarUrl} size={34} />
							<span class="fav-arrow"><Icon name="shortcut" /></span>
						</span>
						<span class="fav-name">{item.username}</span>
					</button>
				{/each}
			</nav>
		{/if}

		{#if shown.includes('stats')}
			<Win95Window
				label="Stats"
				title={statsTitle}
				width={widths.stats}
				x={windows.stats.x}
				y={windows.stats.y}
				z={10 + order.indexOf('stats')}
				focused={focus === 'stats'}
				{mobile}
				closeLabel="Close stats"
				minimiseLabel="Minimise stats"
				bind:element={elements.stats}
				onFocus={() => raise('stats')}
				onMove={(x, y) => moveWindow('stats', x, y)}
				onClose={() => closeWindow('stats')}
				onMinimise={() => minimiseWindow('stats')}
			>
				<StatsWindow {stats} {nextLine} profileUrl={catalog?.artist.profileUrl ?? ''} />
			</Win95Window>
		{/if}

		{#if shown.includes('readme')}
			<Win95Window
				label="How to play"
				title="readme.txt - Notepad"
				width={widths.readme}
				x={windows.readme.x}
				y={windows.readme.y}
				z={10 + order.indexOf('readme')}
				focused={focus === 'readme'}
				{mobile}
				closeLabel="Close readme"
				minimiseLabel="Minimise readme"
				bind:element={elements.readme}
				onFocus={() => raise('readme')}
				onMove={(x, y) => moveWindow('readme', x, y)}
				onClose={() => closeWindow('readme')}
				onMinimise={() => minimiseWindow('readme')}
			>
				<ReadmeWindow {catalogLine} />
			</Win95Window>
		{/if}

		{#if shown.includes('about')}
			<Win95Window
				label="mp3dle Properties"
				title="mp3dle Properties"
				width={widths.about}
				x={windows.about.x}
				y={windows.about.y}
				z={10 + order.indexOf('about')}
				focused={focus === 'about'}
				{mobile}
				closeLabel="Close mp3dle Properties"
				minimiseLabel="Minimise mp3dle Properties"
				bind:element={elements.about}
				onFocus={() => raise('about')}
				onMove={(x, y) => moveWindow('about', x, y)}
				onClose={() => closeWindow('about')}
				onMinimise={() => minimiseWindow('about')}
			>
				<AboutWindow onClose={() => closeWindow('about')} />
			</Win95Window>
		{/if}

		{#if shown.includes('tipjar')}
			<Win95Window
				label="tipjar.exe"
				title="tipjar.exe"
				width={widths.tipjar}
				x={windows.tipjar.x}
				y={windows.tipjar.y}
				z={10 + order.indexOf('tipjar')}
				focused={focus === 'tipjar'}
				{mobile}
				closeLabel="Close tipjar.exe"
				minimiseLabel="Minimise tipjar.exe"
				bind:element={elements.tipjar}
				onFocus={() => raise('tipjar')}
				onMove={(x, y) => moveWindow('tipjar', x, y)}
				onClose={() => closeWindow('tipjar')}
				onMinimise={() => minimiseWindow('tipjar')}
			>
				<TipJarWindow onClose={() => closeWindow('tipjar')} />
			</Win95Window>
		{/if}

		{#if shown.includes('find')}
			<Win95Window
				label="Find Artist"
				title="Find Artist"
				width={widths.find}
				x={windows.find.x}
				y={windows.find.y}
				z={10 + order.indexOf('find')}
				focused={focus === 'find'}
				{mobile}
				closeLabel={!mobile || catalog ? 'Close Find Artist' : ''}
				minimiseLabel="Minimise Find Artist"
				bind:element={elements.find}
				onFocus={() => raise('find')}
				onMove={(x, y) => moveWindow('find', x, y)}
				onClose={() => closeWindow('find')}
				onMinimise={() => minimiseWindow('find')}
			>
				<FindArtist
					hasArtist={Boolean(catalog)}
					{pageError}
					onChoose={chooseArtist}
					onCancel={() => closeWindow('find')}
				/>
			</Win95Window>
		{/if}

		{#if catalog}
			{#key `${catalog.artist.id}:${practiceKey || 'daily'}`}
				<Mp3dleGame
					bind:this={game}
					bind:stats
					bind:timeLeft
					bind:element={elements.player}
					{catalog}
					{practiceKey}
					{volume}
					{mobile}
					favorite={favorites.some((item) => item.permalink === catalog?.artist.permalink)}
					onToggleFavorite={toggleFavorite}
					visible={shown.includes('player')}
					x={windows.player.x}
					y={windows.player.y}
					z={10 + order.indexOf('player')}
					onFocus={() => raise('player')}
					onMove={(x, y) => moveWindow('player', x, y)}
					onMinimise={() => minimiseWindow('player')}
					onClose={() => closeWindow('player')}
					onOpenReadme={() => openWindow('readme')}
					onOpenStats={() => openWindow('stats')}
					onOpenFind={() => openWindow('find')}
					onNeedFinish={() => {
						openWindow('player');
						notice = { title: 'practice.exe', text: "Finish today's song first." };
					}}
				/>
			{/key}
		{/if}
	</main>

	{#if startOpen}
		<div class="start-menu w95">
			<div class="start-side" aria-hidden="true">mp3dle</div>
			<div class="start-items">
				{#if !mobile}
					<button type="button" class="menu-item" on:click={() => openWindow('player')}>
						mp3dle Player
					</button>
				{/if}
				<button type="button" class="menu-item" on:click={() => openWindow('find')}>
					Find Artist...
				</button>
				{#if !mobile}
					<button type="button" class="menu-item" on:click={() => openWindow('readme')}>
						readme.txt
					</button>
					<button type="button" class="menu-item" on:click={() => openWindow('stats')}>
						stats.xls
					</button>
				{/if}
				<button type="button" class="menu-item" on:click={startPractice}>practice.exe</button>
				{#if favorites.length}
					<div class="start-rule" aria-hidden="true"></div>
					<div class="start-favs">
						{#each favorites as item (item.permalink)}
							<div class="start-fav">
								<button type="button" class="menu-item" on:click={() => openFavorite(item)}>
									<ArtistPic username={item.username} avatarUrl={item.avatarUrl} size={20} />
									<span class="start-fav-name">{item.username}</span>
								</button>
								<button
									type="button"
									class="start-fav-remove"
									aria-label={`Remove ${item.username} from favorites`}
									on:click={() => removeFavorite(item.permalink)}
								>
									<span class="start-fav-x"><Icon name="close" /></span>
								</button>
							</div>
						{/each}
					</div>
				{/if}
				<div class="start-rule" aria-hidden="true"></div>
				<button type="button" class="menu-item" on:click={() => openWindow('about')}>
					About mp3dle...
				</button>
				<button type="button" class="menu-item" on:click={() => openWindow('tipjar')}>
					Tip jar...
				</button>
				{#if mobile}
					<div class="start-volume">
						<label for="start-volume">Volume</label>
						<input
							id="start-volume"
							class="trackbar"
							type="range"
							min="0"
							max="100"
							value={volume}
							on:input={handleVolume}
						/>
					</div>
				{/if}
				<div class="start-rule" aria-hidden="true"></div>
				<button type="button" class="menu-item" on:click={onCycleTheme}>
					Display: {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
				</button>
				{#if catalog}
					<a
						class="menu-item"
						href={catalog.artist.profileUrl}
						target="_blank"
						rel="external noopener noreferrer"
						on:click={() => (startOpen = false)}
					>
						Open SoundCloud profile
					</a>
				{/if}
			</div>
		</div>
	{/if}

	{#if iconMenu}
		<div class="icon-menu w95" style:left="{iconMenu.x}px" style:top="{iconMenu.y}px">
			<button
				type="button"
				class="menu-item"
				on:click={() => iconMenu && openFavorite(iconMenu.favorite)}
			>
				Open
			</button>
			<button type="button" class="menu-item" on:click={removeFromMenu}>Remove from desktop</button>
		</div>
	{/if}

	{#if volumeOpen}
		<div class="volume-popup w95">
			<label for="tray-volume">Volume</label>
			<div class="tray-track">
				<input
					id="tray-volume"
					class="trackbar"
					type="range"
					min="0"
					max="100"
					value={volume}
					on:input={handleVolume}
				/>
			</div>
		</div>
	{/if}

	<footer class="taskbar w95">
		<button
			bind:this={startButton}
			type="button"
			class="b95 start-button"
			class:on={startOpen}
			aria-expanded={startOpen}
			on:click={toggleStart}
		>
			<Icon name="start" />Start
		</button>
		{#if mobile}
			{#if catalog}
				<button
					type="button"
					class="b95 mobile-tab"
					class:on={focus === 'player'}
					on:click={() => openWindow('player')}
				>
					Player
				</button>
			{:else}
				<button
					type="button"
					class="b95 mobile-tab"
					class:on={focus === 'find'}
					on:click={() => openWindow('find')}
				>
					Find
				</button>
			{/if}
			<button
				type="button"
				class="b95 mobile-tab"
				class:on={focus === 'stats'}
				disabled={!catalog}
				on:click={() => openWindow('stats')}
			>
				Stats
			</button>
			<button
				type="button"
				class="b95 mobile-tab"
				class:on={focus === 'readme'}
				on:click={() => openWindow('readme')}
			>
				Help
			</button>
		{:else}
			<span class="taskbar-rule" aria-hidden="true"></span>
			{#each tasks as [id, text] (id)}
				<button
					type="button"
					class="b95 task"
					class:on={focus === id && !windows[id].min}
					aria-pressed={focus === id && !windows[id].min}
					on:click={() => taskClick(id)}
				>
					{text}
				</button>
			{/each}
			<span class="taskbar-gap"></span>
			<span class="sunk tray">
				<button
					bind:this={volumeButton}
					type="button"
					class="volume-button"
					aria-label="Volume"
					aria-expanded={volumeOpen}
					on:click={toggleVolume}
				>
					<Icon name="speaker" />
				</button>
				{clock}
			</span>
		{/if}
	</footer>
</div>

{#if loadingArtist}
	<MessageBox title="Loading songs" dismissable={false}>
		Loading {loadingArtist}'s songs...
		<div slot="extra" class="sunk load-bar" role="img" aria-label="Loading">
			{#each { length: LOAD_BLOCKS } as _, index (index)}
				<span class:filled={index < loadedBlocks}></span>
			{/each}
		</div>
	</MessageBox>
{/if}

{#if notice}
	<MessageBox title={notice.title} icon="info" onDismiss={() => (notice = null)}>
		{notice.text}
		<svelte:fragment slot="buttons">
			<button type="button" class="b95" on:click={() => (notice = null)}>OK</button>
		</svelte:fragment>
	</MessageBox>
{/if}

<style>
	.screen {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background-color: var(--wall);
		background-image: repeating-linear-gradient(
			45deg,
			var(--wall-stripe) 0 6px,
			transparent 6px 12px
		);
		color: var(--w-text);
	}

	.wall-record {
		position: absolute;
		right: -150px;
		bottom: -110px;
		width: 640px;
		height: 640px;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, rgb(0 0 0 / 34%) 0 1px, rgb(0 0 0 / 18%) 1px 4px);
	}

	.wall-record-label {
		position: absolute;
		inset: 222px;
		border-radius: 50%;
		background: rgb(196 58 132 / 55%);
	}

	.wall-record-hole {
		position: absolute;
		inset: 312px;
		border-radius: 50%;
		background: var(--wall);
	}

	.desk {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.desk-icons {
		position: absolute;
		left: 14px;
		top: 14px;
		bottom: 14px;
		display: flex;
		flex-flow: column wrap;
		align-content: flex-start;
		gap: 10px;
	}

	.desk-icon {
		width: 90px;
		padding: 5px 2px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		border: 1px solid transparent;
		background: none;
		font-size: 12px;
		text-align: center;
		text-shadow: 1px 1px 0 #000;
		color: #fff;
	}

	.desk-icon.selected {
		border: 1px dotted #fff;
		background: rgb(15 110 156 / 75%);
	}

	/* favorites start on the right and wrap inwards */
	.fav-icons {
		position: absolute;
		inset: 14px;
		display: flex;
		flex-flow: column wrap-reverse;
		align-content: flex-start;
		gap: 10px;
		pointer-events: none;
	}

	.fav-icons .desk-icon {
		pointer-events: auto;
	}

	.fav-pic {
		position: relative;
		display: block;
		outline: 1px solid rgb(0 0 0 / 60%);
	}

	.fav-arrow {
		position: absolute;
		left: -2px;
		bottom: -2px;
		display: flex;
	}

	.fav-name {
		max-width: 100%;
		display: -webkit-box;
		overflow: hidden;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.icon-menu {
		position: fixed;
		z-index: 900;
		width: 180px;
	}

	.start-favs {
		max-height: 150px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.start-fav {
		display: flex;
	}

	.start-fav:hover,
	.start-fav:has(.menu-item:focus-visible) {
		background: var(--select);
	}

	.start-fav:hover .menu-item,
	.start-fav .menu-item:focus-visible {
		color: #fff;
	}

	.start-fav-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.start-fav .menu-item {
		min-width: 0;
		flex: 1;
		padding-right: 4px;
		background: none;
	}

	.start-fav .start-fav-remove {
		flex: 0 0 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		background: none;
	}

	.start-fav-x {
		width: 18px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid;
		border-color: var(--hi) var(--dark) var(--dark) var(--hi);
		background: var(--face);
		color: var(--w-text);
	}

	.start-fav-remove:active .start-fav-x {
		border-color: var(--dark) var(--hi) var(--hi) var(--dark);
	}

	.start-fav-remove:active .start-fav-x :global(svg) {
		transform: translate(1px, 1px);
	}

	.start-fav .start-fav-remove:focus-visible {
		outline: none;
	}

	.start-fav-remove:focus-visible .start-fav-x {
		outline: 1px dotted var(--w-text);
		outline-offset: -4px;
	}

	.start-menu {
		position: absolute;
		left: 3px;
		bottom: 38px;
		z-index: 900;
		width: 250px;
		max-height: calc(100% - 42px);
		display: flex;
	}

	.start-side {
		width: 28px;
		padding: 8px 0;
		background: linear-gradient(0deg, #0b4f75, #127fb3);
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font: italic 900 18px var(--logo-font);
		color: #fff;
	}

	.start-items {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	.start-rule {
		margin: 3px 2px;
		border-top: 1px solid var(--shade);
		border-bottom: 1px solid var(--hi);
	}

	.start-volume {
		padding: 6px 12px 10px;
		font-size: 14px;
	}

	.trackbar {
		appearance: none;
		-webkit-appearance: none;
		height: 21px;
		background: transparent;
		margin: 0;
		cursor: pointer;
	}

	.trackbar::-webkit-slider-runnable-track {
		box-sizing: border-box;
		height: 4px;
		border: 1px solid;
		border-color: var(--shade) var(--hi) var(--hi) var(--shade);
		border-radius: 0;
		box-shadow: inset 1px 1px 0 var(--dark);
		background: var(--face);
	}

	.trackbar::-moz-range-track {
		box-sizing: border-box;
		height: 4px;
		border: 1px solid;
		border-color: var(--shade) var(--hi) var(--hi) var(--shade);
		border-radius: 0;
		box-shadow: inset 1px 1px 0 var(--dark);
		background: var(--face);
	}

	.trackbar::-moz-range-progress {
		background: transparent;
	}

	.trackbar::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 11px;
		height: 21px;
		margin-top: -9.5px;
		border: 0;
		border-radius: 0;
		background: var(--face);
		box-shadow:
			inset -1px -1px 0 var(--dark),
			inset 1px 1px 0 var(--hi),
			inset -2px -2px 0 var(--shade),
			inset 2px 2px 0 var(--lite);
	}

	.trackbar::-moz-range-thumb {
		width: 11px;
		height: 21px;
		border: 0;
		border-radius: 0;
		background: var(--face);
		box-shadow:
			inset -1px -1px 0 var(--dark),
			inset 1px 1px 0 var(--hi),
			inset -2px -2px 0 var(--shade),
			inset 2px 2px 0 var(--lite);
	}

	.trackbar:focus-visible {
		outline: 1px dotted var(--w-text);
		outline-offset: 2px;
	}

	.start-volume .trackbar {
		display: block;
		width: 100%;
		height: 28px;
	}

	.start-volume .trackbar::-webkit-slider-thumb {
		width: 16px;
		height: 28px;
		margin-top: -13px;
	}

	.start-volume .trackbar::-moz-range-thumb {
		width: 16px;
		height: 28px;
	}

	.volume-popup {
		position: absolute;
		right: 4px;
		bottom: 38px;
		z-index: 900;
		width: 74px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}

	.tray-track {
		position: relative;
		width: 21px;
		height: 110px;
		flex-shrink: 0;
	}

	.tray-track .trackbar {
		position: absolute;
		width: 110px;
		height: 21px;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) rotate(-90deg);
	}

	.taskbar {
		position: relative;
		z-index: 950;
		flex-shrink: 0;
		height: 38px;
		display: flex;
		align-items: center;
		gap: 3px;
		border-left: 0;
		border-right: 0;
		border-bottom: 0;
	}

	.start-button {
		height: 30px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: bold;
	}

	.taskbar-rule {
		height: 26px;
		margin: 0 2px;
		border-left: 1px solid var(--shade);
		border-right: 1px solid var(--hi);
	}

	.task {
		flex: 0 1 170px;
		min-width: 0;
		height: 30px;
		padding: 0 8px;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.taskbar-gap {
		flex: 1;
	}

	.tray {
		flex-shrink: 0;
		height: 30px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		font-size: 12px;
	}

	.volume-button {
		display: flex;
		padding: 0;
		border: 0;
		background: none;
	}

	.load-bar {
		height: 20px;
		padding: 2px;
		display: flex;
		gap: 2px;
	}

	.load-bar span {
		flex: 1;
	}

	.load-bar span.filled {
		background: #0f6e9c;
	}

	@media (max-width: 900px) {
		.wall-record,
		.desk-icons,
		.fav-icons {
			display: none;
		}

		.start-fav .start-fav-remove {
			flex-basis: 46px;
		}

		.start-fav-x {
			width: 30px;
			height: 26px;
		}

		.start-fav-x :global(svg) {
			width: 16px;
			height: 14px;
		}

		.desk {
			display: flex;
			flex-direction: column;
		}

		.start-menu {
			bottom: calc(50px + env(safe-area-inset-bottom));
			width: 260px;
			max-height: calc(100% - 54px - env(safe-area-inset-bottom));
		}

		.start-side {
			flex-shrink: 0;
		}

		.taskbar {
			height: calc(50px + env(safe-area-inset-bottom));
			padding-bottom: calc(2px + env(safe-area-inset-bottom));
		}

		.start-button {
			height: auto;
			padding: 0 7px;
			gap: 5px;
		}

		.mobile-tab {
			flex: 1;
			min-width: 0;
			padding: 0 3px;
		}
	}
</style>
