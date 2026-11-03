<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import HeardleGame from '#lib/HeardleGame.svelte';
	import { loadFavorites, saveFavorites, type Favorite } from '#lib/favorites.js';
	import { createEmptyStats, type Stats } from '#lib/game-state.js';
	import ArtistPic from '#lib/retro/ArtistPic.svelte';
	import FindArtist from '#lib/retro/FindArtist.svelte';
	import Icon from '#lib/retro/icons/Icon.svelte';
	import MessageBox from '#lib/retro/MessageBox.svelte';
	import ReadmeWindow from '#lib/retro/ReadmeWindow.svelte';
	import StatsWindow from '#lib/retro/StatsWindow.svelte';
	import Win95Window from '#lib/retro/Win95Window.svelte';
	import { load, save } from '#lib/storage.js';
	import type { SoundCloudArtist, TrackCatalog } from '#lib/tracks.js';

	export let catalog: TrackCatalog | null;
	export let practiceKey = '';
	export let pageError = '';
	export let darkMode = false;
	export let onToggleTheme: () => void;

	type WindowId = 'player' | 'stats' | 'readme' | 'find';
	type IconId = WindowId | 'practice';

	const VOLUME_KEY = 'soundcloud-heardle:volume';
	const widths = { player: 700, stats: 300, readme: 470, find: 480 };
	const allWindows = Object.keys(widths) as WindowId[];
	const LOAD_BLOCKS = 20;
	const desktopIcons: {
		id: IconId;
		label: string;
		icon: 'record' | 'folder' | 'text' | 'sheet' | 'practice';
	}[] = [
		{ id: 'player', label: 'Heardle Player', icon: 'record' },
		{ id: 'find', label: 'Find Artist', icon: 'folder' },
		{ id: 'readme', label: 'readme.txt', icon: 'text' },
		{ id: 'stats', label: 'stats.xls', icon: 'sheet' },
		{ id: 'practice', label: 'practice.exe', icon: 'practice' }
	];

	const phoneSize = window.matchMedia('(max-width: 900px)');
	let mobile = phoneSize.matches;

	// stats only starts open if it fits next to the player
	const statsFits = window.innerWidth >= 1170;
	let windows = {
		player: { open: Boolean(catalog), min: false, x: 124, y: 16 },
		stats: { open: Boolean(catalog) && statsFits, min: false, x: 854, y: 66 },
		readme: { open: false, min: false, x: 190, y: 90 },
		find: {
			open: !catalog,
			min: false,
			x: Math.max(Math.round((window.innerWidth - widths.find) / 2), 124),
			y: 70
		}
	};
	let order: WindowId[] = ['readme', 'find', 'stats', 'player']; // last one is on top
	let focus: WindowId | null = catalog ? 'player' : 'find';
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
	let loadingArtist = '';
	let loadedBlocks = 0;
	let loadTimer: ReturnType<typeof setInterval>;
	let startButton: HTMLButtonElement;
	let volumeButton: HTMLButtonElement;

	let volume = Number(load(VOLUME_KEY) ?? 80);
	if (!(volume >= 0 && volume <= 100)) volume = 80;
	let clock = '';
	let game: HeardleGame | undefined;
	let stats: Stats = createEmptyStats(6);
	let timeLeft = '';

	$: if (!catalog) stats = createEmptyStats(6);
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
			['player', 'Heardle Player'],
			['find', 'Find Artist'],
			['stats', statsTitle],
			['readme', 'readme.txt - Notepad']
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
		if (catalog) game?.startPractice();
		else notice = { title: 'practice.exe', text: 'Pick an artist first.' };
	}

	function toggleStart() {
		startOpen = !startOpen;
		volumeOpen = false;
	}

	function toggleVolume() {
		volumeOpen = !volumeOpen;
		startOpen = false;
	}

	function toggleTheme() {
		startOpen = false;
		onToggleTheme();
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

	async function chooseArtist(artist: Favorite) {
		if (loadingArtist) return;
		loadingArtist = artist.username;

		// we don't know how long this takes, so the bar just creeps up like the real thing did
		loadedBlocks = 1;
		loadTimer = setInterval(() => {
			loadedBlocks = Math.min(loadedBlocks + 1, LOAD_BLOCKS - 1);
		}, 350);

		await goto(resolve(`/?artist=${encodeURIComponent(artist.permalink)}`));
		clearInterval(loadTimer);
		loadingArtist = '';

		// no catalog means it failed, find artist is where the error shows
		if (catalog) {
			setWindow('find', { open: false });
			openWindow('player');
		} else {
			openWindow('find');
		}
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
				closeLabel={catalog ? 'Close Find Artist' : ''}
				bind:element={elements.find}
				onFocus={() => raise('find')}
				onMove={(x, y) => moveWindow('find', x, y)}
				onClose={() => closeWindow('find')}
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
				<HeardleGame
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
					onNeedFinish={() =>
						(notice = { title: 'practice.exe', text: "Finish today's song first." })}
				/>
			{/key}
		{/if}
	</main>

	{#if startOpen}
		<div class="start-menu w95">
			<div class="start-side" aria-hidden="true">Heardle</div>
			<div class="start-items">
				{#if !mobile}
					<button type="button" class="menu-item" on:click={() => openWindow('player')}>
						Heardle Player
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
									class="menu-item start-fav-remove"
									aria-label={`Remove ${item.username} from favorites`}
									on:click={() => removeFavorite(item.permalink)}
								>
									x
								</button>
							</div>
						{/each}
					</div>
				{/if}
				{#if mobile}
					<div class="start-volume">
						<label for="start-volume">Volume</label>
						<input
							id="start-volume"
							type="range"
							min="0"
							max="100"
							value={volume}
							on:input={handleVolume}
						/>
					</div>
				{/if}
				<div class="start-rule" aria-hidden="true"></div>
				<button type="button" class="menu-item" on:click={toggleTheme}>
					Display: {darkMode ? 'Dark' : 'Light'}
				</button>
				{#if catalog}
					<a
						class="menu-item"
						href={catalog.artist.profileUrl}
						target="_blank"
						rel="external noopener noreferrer"
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
			<input
				id="tray-volume"
				type="range"
				min="0"
				max="100"
				value={volume}
				on:input={handleVolume}
			/>
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
			<button
				type="button"
				class="b95 mobile-tab"
				class:on={focus === 'player'}
				disabled={!catalog}
				on:click={() => openWindow('player')}
			>
				Player
			</button>
			<button
				type="button"
				class="b95 mobile-tab"
				class:on={focus === 'stats'}
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
		display: flex;
		flex-direction: column;
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

	.start-fav-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.start-fav .menu-item {
		min-width: 0;
		flex: 1;
		padding-right: 4px;
	}

	.start-fav .start-fav-remove {
		flex: 0 0 30px;
		justify-content: center;
		padding: 0;
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

	.start-volume input {
		display: block;
		width: 100%;
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

	.volume-popup input {
		width: 20px;
		height: 110px;
		writing-mode: vertical-lr;
		direction: rtl;
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
