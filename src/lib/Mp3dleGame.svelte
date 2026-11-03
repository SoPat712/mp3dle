<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { dragHandle } from '#lib/retro/drag.js';
	import GuessBox from '#lib/retro/GuessBox.svelte';
	import GuessTable from '#lib/retro/GuessTable.svelte';
	import Icon from '#lib/retro/icons/Icon.svelte';
	import MessageBox from '#lib/retro/MessageBox.svelte';
	import Turntable from '#lib/retro/Turntable.svelte';
	import { load, remove, save } from '#lib/storage.js';
	import {
		getDailyTrack,
		getGuessTracks,
		getLocalDateKey,
		getPracticeTrack,
		normalizeTrackTitle,
		type Track,
		type TrackCatalog
	} from '#lib/tracks.js';
	import {
		calculateNextStats,
		createEmptyStats,
		parseSavedGame,
		sanitizeStats,
		type AttemptInfo,
		type Stats
	} from '#lib/game-state.js';

	export let catalog: TrackCatalog;
	export let practiceKey = '';
	export let volume = 80;
	export let stats: Stats = createEmptyStats(6);
	export let timeLeft = '';

	// the desktop owns where the window is and what's open
	export let visible = true;
	export let mobile = false;
	export let x = 0;
	export let y = 0;
	export let z = 10;
	export let element: HTMLElement | undefined = undefined;
	export let onFocus: () => void = () => {};
	export let onMove: (x: number, y: number) => void = () => {};
	export let onMinimise: () => void = () => {};
	export let onClose: () => void = () => {};
	export let onOpenReadme: () => void = () => {};
	export let onOpenStats: () => void = () => {};
	export let onOpenFind: () => void = () => {};
	export let onNeedFinish: () => void = () => {};
	export let favorite = false;
	export let onToggleFavorite: () => void = () => {};

	// seconds of song you get on each try
	const clipLengths = [1, 2, 4, 7, 11, 16];
	const maxTries = clipLengths.length;
	const CANT_PLAY = "This song can't play in this browser.";

	const today = getLocalDateKey();
	const artistName = catalog.artist.username;
	const artistKey = catalog.artist.permalink;
	const initials = artistName.slice(0, 2).toUpperCase();
	const guessTracks = getGuessTracks(catalog.tracks);
	const practice = Boolean(practiceKey);
	const song = practice
		? getPracticeTrack(catalog.tracks, artistKey, practiceKey)
		: getDailyTrack(today, catalog.tracks, artistKey);

	// don't rename these, people's saved games and stats live under them
	const gameKey = `mp3dle:${artistKey}:game:${today}:${song.slug}`;
	const statsKey = `mp3dle:${artistKey}:stats:v1`;

	let attemptInfos: AttemptInfo[] = [];
	let gameOver = false;
	let won = false;
	let statsRecorded = false;
	let saveReady = false;

	let iframe: HTMLIFrameElement;
	let widget: SoundCloudWidget | undefined;
	let loading = true;
	let error = '';
	let errorHidden = false;
	let playing = false;
	let buffering = false;
	let pressedPlay = false;
	let heardPlay = false;
	let blockedOnce = false;
	let seeking = false;
	let position = 0; // ms
	let startedFrom = 0;
	let songLength = 0;
	let artwork = song.artworkUrl ?? '';

	let guessBox: GuessBox;
	let picked: Track | null = null;
	let note = '';
	let statusMessage = '';

	let loadTimer: ReturnType<typeof setTimeout>;
	let stallTimer: ReturnType<typeof setTimeout>;
	let messageTimer: ReturnType<typeof setTimeout>;
	let clock: ReturnType<typeof setInterval>;

	$: tries = attemptInfos.length;
	$: clipSeconds = clipLengths[tries] ?? 16;
	$: nextExtra = tries < maxTries - 1 ? clipLengths[tries + 1] - clipSeconds : 0;
	$: resultLabel = won ? `${tries}/${maxTries}` : `X/${maxTries}`;

	// each chunk of the clip bar fills up green as the song gets to it
	$: segments = clipLengths.map((end, i) => {
		const start = clipLengths[i - 1] ?? 0;
		const filled = Math.max(0, Math.min(1, (position / 1000 - start) / (end - start))) * 100;
		const color = i <= tries ? 'var(--unlock)' : 'var(--deck-edge)';
		return {
			end,
			size: end - start,
			background: filled
				? `linear-gradient(90deg, var(--lcd) ${filled}%, ${color} ${filled}%)`
				: color
		};
	});

	$: status = getStatus(error, loading, statusMessage, buffering, playing, gameOver, note, tries);

	$: if (saveReady && !practice) {
		save(gameKey, JSON.stringify({ attemptInfos, gameOver, won, statsRecorded }));
	}

	$: widget?.setVolume(volume);

	function getStatus(
		error: string,
		loading: boolean,
		statusMessage: string,
		buffering: boolean,
		playing: boolean,
		gameOver: boolean,
		note: string,
		tries: number
	) {
		if (error) return error;
		if (loading) return 'Loading...';
		if (statusMessage) return statusMessage;
		if (buffering) return 'Buffering...';
		if (playing) return gameOver ? 'Playing the full song...' : `Playing clip ${tries + 1}...`;
		return note || 'Ready';
	}

	onMount(() => {
		stats = loadStats();
		if (!practice) loadGame();
		saveReady = true;

		if (!practice) {
			tickClock();
			clock = setInterval(tickClock, 1000);
		}
		startWidget();
	});

	onDestroy(() => {
		clearTimeout(loadTimer);
		clearTimeout(stallTimer);
		clearTimeout(messageTimer);
		clearInterval(clock);
	});

	// soundcloud widget stuff

	function loadWidgetScript() {
		return new Promise<void>((done, fail) => {
			if (window.SC) return done();
			const script = document.createElement('script');
			script.src = 'https://w.soundcloud.com/player/api.js';
			script.onload = () => done();
			script.onerror = () => fail(new Error('Failed to load SoundCloud.'));
			document.head.appendChild(script);
		});
	}

	async function startWidget() {
		loadTimer = setTimeout(() => {
			loading = false;
			error = 'SoundCloud took too long to load. Please reload and try again.';
		}, 15_000);

		try {
			await loadWidgetScript();
			widget = window.SC!.Widget(iframe);
			listenToWidget(widget, window.SC!.Widget.Events);
		} catch (cause) {
			clearTimeout(loadTimer);
			loading = false;
			error = (cause as Error).message;
		}
	}

	function listenToWidget(widget: SoundCloudWidget, events: Record<string, string>) {
		widget.bind(events.READY, () => {
			clearTimeout(loadTimer);
			widget.setVolume(volume);
			// safari refuses the first play if the song isn't loaded yet, even on a real click.
			// seeking loads it without making any sound
			widget.seekTo(0);
			widget.getDuration((length) => {
				songLength = length;
				loading = false;
				if (!(length > 0)) error = 'SoundCloud did not return a playable song duration.';
			});
			widget.getCurrentSound((sound) => {
				if (sound?.artwork_url) artwork = sound.artwork_url;
			});
		});

		// that seek fires a play event too, so wait until someone has actually pressed play
		widget.bind(events.PLAY, () => {
			heardPlay = true;
			if (pressedPlay) playing = true;
		});

		widget.bind(events.PAUSE, () => {
			playing = false;
			// we didn't pause it and it never got going, so the browser blocked it.
			// pressing again works. if it happens twice, let the 15 seconds run out.
			// the pause from the end of the last clip can land late, so only count one after a play
			if (buffering && heardPlay && !blockedOnce) {
				blockedOnce = true;
				stopWaiting();
				note = 'The browser blocked that. Press play again.';
			}
		});

		widget.bind(events.FINISH, () => {
			playing = false;
			position = gameOver ? songLength : clipSeconds * 1000;
		});

		widget.bind(events.PLAY_PROGRESS, (event) => {
			if (!event || !playing || seeking) return;
			// only once the position really moves do we know the audio works
			if (event.currentPosition > startedFrom + 100) stopWaiting();

			const limit = gameOver ? songLength : clipSeconds * 1000;
			position = Math.min(event.currentPosition, limit);
			if (event.currentPosition >= limit) {
				pause();
				if (!gameOver) note = 'Clip finished. Guess or skip.';
			}
		});

		widget.bind(events.ERROR, () => {
			clearTimeout(loadTimer);
			stopWaiting();
			playing = false;
			loading = false;
			error = CANT_PLAY;
		});
	}

	function play(fromStart: boolean) {
		if (!widget || loading || error) return;
		if (fromStart) {
			position = 0;
			widget.seekTo(0);
		}
		note = '';
		statusMessage = '';
		startedFrom = position;
		pressedPlay = true;
		heardPlay = false;
		buffering = true;

		// nothing tells us a drm song failed, it just never starts. so give it 15 seconds
		clearTimeout(stallTimer);
		stallTimer = setTimeout(() => {
			stopWaiting();
			playing = false;
			error = CANT_PLAY;
			errorHidden = false;
		}, 15_000);

		widget.play();
	}

	function stopWaiting() {
		clearTimeout(stallTimer);
		buffering = false;
	}

	export function pause() {
		stopWaiting();
		playing = false;
		widget?.pause();
	}

	function playKey() {
		if (error) {
			errorHidden = false;
		} else if (playing) {
			pause();
			note = 'Paused';
		} else {
			// pressing while it's stuck buffering just tries again
			play(!gameOver || position >= songLength);
		}
	}

	function seekInput(event: Event) {
		seeking = true;
		position = Number((event.target as HTMLInputElement).value);
	}

	function seekDone() {
		seeking = false;
		widget?.seekTo(position);
	}

	// game stuff

	function skip() {
		if (gameOver || loading || error) return;
		attemptInfos = [...attemptInfos, { status: 'skip' }];
		guessBox?.clear();
		note = 'Skipped. Longer clip unlocked.';

		if (attemptInfos.length >= maxTries) finish(false);
		// if it's still going it just keeps going, otherwise the longer clip starts from the top
		else if (!playing && !buffering) play(true);
	}

	function guess() {
		if (gameOver || loading || error) return;
		if (!picked) {
			note = 'Pick a song from the list first.';
			return;
		}

		if (normalizeTrackTitle(picked.title) === normalizeTrackTitle(song.title)) {
			attemptInfos = [...attemptInfos, { status: 'correct', title: song.title }];
			finish(true);
			return;
		}

		attemptInfos = [...attemptInfos, { status: 'wrong', title: picked.title }];
		guessBox?.clear();
		note = 'Not that one. Longer clip unlocked.';

		if (attemptInfos.length >= maxTries) {
			finish(false);
		} else {
			pause();
			position = 0;
		}
	}

	function finish(didWin: boolean) {
		won = didWin;
		gameOver = true;
		guessBox?.clear();
		pause();
		position = 0;
		widget?.seekTo(0);
		note = didWin ? 'Solved.' : 'Out of tries.';

		if (!practice && !statsRecorded) {
			stats = recordStats(didWin, attemptInfos.length);
			statsRecorded = true;
		}
	}

	function loadGame() {
		const saved = load(gameKey);
		if (!saved) return;

		try {
			const game = parseSavedGame(JSON.parse(saved), maxTries);
			if (!game) throw new Error('bad save');
			// a win has to match today's song or the save is junk
			const lastTitle = game.attemptInfos.at(-1)?.title ?? '';
			if (game.won && normalizeTrackTitle(lastTitle) !== normalizeTrackTitle(song.title)) {
				throw new Error('bad save');
			}

			attemptInfos = game.attemptInfos;
			gameOver = game.gameOver;
			won = game.won;
			statsRecorded = game.statsRecorded;
			if (gameOver && !statsRecorded) {
				stats = recordStats(won, attemptInfos.length);
				statsRecorded = true;
			}
		} catch {
			remove(gameKey);
		}
	}

	function loadStats(): Stats {
		try {
			return sanitizeStats(JSON.parse(load(statsKey) ?? '{}'), maxTries);
		} catch {
			return createEmptyStats(maxTries);
		}
	}

	function recordStats(didWin: boolean, attempts: number) {
		const newStats = calculateNextStats(loadStats(), didWin, attempts, today, maxTries);
		save(statsKey, JSON.stringify(newStats));
		return newStats;
	}

	function tickClock() {
		// left the tab open past midnight, time for the new song
		if (getLocalDateKey() !== today) {
			window.location.reload();
			return;
		}
		const now = new Date();
		const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		const secondsLeft = Math.floor((midnight.getTime() - now.getTime()) / 1000);
		timeLeft = [secondsLeft / 3600, (secondsLeft / 60) % 60, secondsLeft % 60]
			.map((part) => String(Math.floor(part)).padStart(2, '0'))
			.join(':');
	}

	function formatTime(ms: number) {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
	}

	// moving between rounds

	function playAnother() {
		// keep rolling until it's a different song from this one
		let key: string;
		do {
			key = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
		} while (
			guessTracks.length > 1 &&
			getPracticeTrack(catalog.tracks, artistKey, key).slug === song.slug
		);

		goto(resolve(`/?artist=${encodeURIComponent(artistKey)}&practice=${key}`), { reset: false });
	}

	function backToDaily() {
		goto(resolve(`/?artist=${encodeURIComponent(artistKey)}`), { reset: false });
	}

	export function startPractice() {
		if (!practice && !gameOver) onNeedFinish();
		else playAnother();
	}

	function showMessage(message: string) {
		statusMessage = message;
		clearTimeout(messageTimer);
		messageTimer = setTimeout(() => (statusMessage = ''), 2000);
	}

	// phones have no desktop, their favorites live in the start menu
	function pressStar() {
		const place = mobile ? 'Start menu' : 'desktop';
		showMessage(favorite ? `Removed from ${place}.` : `Added to ${place}.`);
		onToggleFavorite();
	}

	// sharing

	function shareText() {
		const squares = { correct: '🟩', wrong: '🟥', skip: '🟦' };
		const rows = attemptInfos.map((attempt) => squares[attempt.status]).join('');
		const url = new URL(window.location.href);
		url.searchParams.delete('practice');
		return `mp3dle - ${artistName} ${practice ? 'Practice' : today} ${resultLabel}\n${rows}\n${url.href}`;
	}

	async function share() {
		try {
			if (navigator.share) {
				await navigator.share({ text: shareText() });
				showMessage('Shared.');
			} else {
				await navigator.clipboard.writeText(shareText());
				showMessage('Copied.');
			}
		} catch (cause) {
			// closing the share sheet counts as an error, that's not worth a message
			if ((cause as Error).name !== 'AbortError') {
				showMessage('Could not share from this browser.');
			}
		}
	}
</script>

<!-- lives outside the window so minimising or closing it can't kill the audio -->
<iframe
	bind:this={iframe}
	src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(song.url)}&show_artwork=false&visual=false`}
	class="soundcloud-player"
	allow="autoplay; encrypted-media"
	title="SoundCloud preview player"
></iframe>

{#if error && !errorHidden && visible}
	<MessageBox title="mp3dle Player" icon="error" onDismiss={() => (errorHidden = true)}>
		{error}
		<svelte:fragment slot="buttons">
			<button type="button" class="b95" on:click={() => window.location.reload()}>Retry</button>
			<button type="button" class="b95" on:click={playAnother}>Play a practice song</button>
			<a class="b95 button-link" href={song.url} target="_blank" rel="external noopener noreferrer">
				Open on SoundCloud
			</a>
		</svelte:fragment>
	</MessageBox>
{/if}

<section
	bind:this={element}
	class="player"
	class:gone={!visible}
	aria-label="mp3dle Player"
	tabindex="-1"
	style:left="{x}px"
	style:top="{y}px"
	style:z-index={z}
	on:pointerdown={onFocus}
	on:focusin={onFocus}
>
	<div class="head" use:dragHandle={{ enabled: !mobile, getPosition: () => ({ x, y }), onMove }}>
		<svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30">
			<circle cx="15" cy="15" r="14" fill="#14171b" />
			<circle cx="15" cy="15" r="9" fill="none" stroke="#3a3f47" />
			<circle cx="15" cy="15" r="5" fill="#c43a84" />
			<circle cx="15" cy="15" r="1.5" fill="#fff" />
		</svg>
		<div class="logo">
			<span class="logo-name">MP3DLE</span>
			<span class="logo-version">PLAYER</span>
		</div>
		<span class="head-gap"></span>
		<button
			type="button"
			class="round-hit"
			aria-label={`Favorite ${artistName}`}
			aria-pressed={favorite}
			title={favorite
				? `Remove ${artistName} from favorites`
				: `Add ${artistName} to ${mobile ? 'the Start menu' : 'the desktop'}`}
			on:click={pressStar}
		>
			<span class="round" class:starred={favorite}>
				<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
					<path
						d="M7 1l1.8 3.8 4.2.5-3.1 2.9.8 4.1L7 10.3l-3.7 2 .8-4.1L1 5.3l4.2-.5z"
						fill={favorite ? '#fff' : 'none'}
						stroke="#fff"
						stroke-width="1.2"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
		</button>
		<button type="button" class="round-hit" aria-label="How to play" on:click={onOpenReadme}>
			<span class="round">?</span>
		</button>
		{#if mobile}
			<button type="button" class="round-hit" aria-label="Open stats" on:click={onOpenStats}>
				<span class="round">
					<svg aria-hidden="true" width="14" height="12" viewBox="0 0 14 12">
						<path d="M2 12V6M7 12V1M12 12V4" stroke="#fff" stroke-width="2.5" />
					</svg>
				</span>
			</button>
		{:else}
			<button type="button" class="round-hit" aria-label="Minimise player" on:click={onMinimise}>
				<span class="round">_</span>
			</button>
			<button type="button" class="round-hit" aria-label="Close player" on:click={onClose}>
				<span class="round">x</span>
			</button>
		{/if}
	</div>

	<div class="deck">
		<Turntable
			spinning={playing}
			label={gameOver ? initials : '?'}
			artwork={gameOver && artwork ? artwork.replace('-large', '-t200x200') : ''}
		/>

		<div class="readout">
			<div class="time">
				<span class="time-now">{formatTime(position)}</span>
				<span class="time-end">/ {formatTime(gameOver ? songLength : clipSeconds * 1000)}</span>
			</div>
			<div class="mode">
				<span>{practice ? 'PRACTICE' : 'DAILY'}</span>
				<span>
					{#if gameOver}
						{won ? 'SOLVED' : 'REVEALED'} {resultLabel}
					{:else}
						TRY {tries + 1} OF {maxTries}
					{/if}
				</span>
			</div>
			<div class="song-note">{artistName}, {practice ? 'practice song' : "today's song"}</div>
			{#if gameOver}
				<label class="seek-wrap">
					<span class="seek-label">Full song</span>
					<input
						class="seek"
						type="range"
						min="0"
						max={songLength}
						step="1000"
						value={position}
						disabled={loading || !songLength}
						aria-valuetext={formatTime(position)}
						on:input={seekInput}
						on:change={seekDone}
					/>
				</label>
			{:else}
				<div>
					<div
						class="clip-bar"
						role="img"
						aria-label="Clip length: {clipSeconds} of 16 seconds unlocked"
					>
						{#each segments as segment (segment.end)}
							<span style:flex={segment.size} style:background={segment.background}></span>
						{/each}
					</div>
					<div class="clip-labels" aria-hidden="true">
						{#each segments as segment (segment.end)}
							<span style:flex={segment.size}>{segment.end}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if gameOver}
		<div class="controls over">
			<div class="sleeve" aria-hidden={!artwork}>
				{#if artwork}
					<img src={artwork.replace('-large', '-t500x500')} alt="{song.title} cover" />
				{:else}
					<span class="sleeve-record"></span>
					<span class="sleeve-initials">{initials}</span>
				{/if}
			</div>
			<div class="result-text">
				<strong class:good={won} class:bad={!won}>
					{won ? 'Solved' : 'Revealed'}
					{resultLabel}
				</strong>
				<span class="result-title">{song.title}</span>
				<span>
					{won ? 'Correct.' : 'Out of tries.'}
					<a
						class="link"
						href={`https://song.link/${song.url}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						Open song links
					</a>
				</span>
			</div>
			<div class="result-buttons">
				<button type="button" class="gloss-pink" on:click={playAnother}>Play another</button>
				<button type="button" class="gloss-grey share-button" on:click={share}>
					{statusMessage === 'Copied.'
						? 'Copied!'
						: statusMessage === 'Shared.'
							? 'Shared!'
							: 'Share result'}
				</button>
				{#if practice}
					<button type="button" class="gloss-grey" on:click={backToDaily}>Daily puzzle</button>
				{/if}
			</div>
			{@render playButton()}
		</div>
	{:else}
		<div class="controls">
			<div class="row row-clip">
				<span class="bullet"></span><span class="row-label">Clip length</span>
				<div
					class="chips"
					role="img"
					aria-label="Clip length: {clipSeconds} of 16 seconds unlocked"
				>
					{#each clipLengths as seconds, i (seconds)}
						<span
							class="chip"
							class:now={i === tries}
							class:done={i < tries}
							class:locked={i > tries}
						>
							{seconds}s
						</span>
					{/each}
				</div>
			</div>
			<div class="row row-artist">
				<span class="bullet"></span><span class="row-label">Artist</span>
				<span class="field artist-field">
					<span class="artist-long">
						{artistName} (@{artistKey}), {catalog.tracks.length.toLocaleString()} tracks
					</span>
					<span class="artist-short">
						<strong>{artistName}</strong>, {catalog.tracks.length.toLocaleString()} tracks
					</span>
				</span>
				<button type="button" class="gloss-grey" on:click={onOpenFind}>Change...</button>
			</div>
			<div class="row row-guess">
				<span class="bullet"></span>
				<label class="row-label" for="guess-input">Your guess</label>
				<GuessBox bind:this={guessBox} bind:picked tracks={guessTracks} onEnter={guess} />
			</div>
			<button
				type="button"
				class="gloss-pink guess-button"
				disabled={loading || Boolean(error)}
				on:click={guess}
			>
				Guess
			</button>
			<button
				type="button"
				class="gloss-grey skip-button"
				disabled={loading || Boolean(error)}
				on:click={skip}
			>
				{nextExtra ? `Skip +${nextExtra}s` : "I don't know it"}
			</button>
			{@render playButton()}
		</div>
	{/if}

	<div class="log">
		<GuessTable attempts={attemptInfos} {clipLengths} {gameOver} {playing} />
		<div class="side-buttons">
			<button type="button" class="gloss-grey" aria-label="Open stats" on:click={onOpenStats}>
				<Icon name="bars" />
			</button>
		</div>
	</div>

	<div class="status" aria-live="polite">
		<span>{status}</span>
		<span class="status-next">
			{practice ? 'Practice: stats not counted' : `Next song in ${timeLeft}`}
		</span>
	</div>
</section>

{#snippet playButton()}
	<button
		type="button"
		class="play-key"
		aria-label={playing
			? 'Pause'
			: gameOver
				? 'Play the full song'
				: `Play ${clipSeconds} second clip`}
		disabled={loading}
		on:click={playKey}
	>
		<Icon name={playing ? 'pause' : 'play'} />
		<span>{playing ? 'PAUSE' : gameOver ? 'PLAY SONG' : `PLAY ${clipSeconds}s`}</span>
	</button>
{/snippet}

<style>
	.soundcloud-player {
		position: absolute;
		width: 0;
		height: 0;
		border: 0;
		overflow: hidden;
		visibility: hidden;
	}
	.button-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
	}
	.player {
		position: absolute;
		width: 700px;
		max-width: 100vw;
		max-height: calc(100% - 8px);
		padding: 9px 13px 8px;
		display: flex;
		flex-direction: column;
		gap: 9px;
		border: 1px solid var(--p-edge);
		border-radius: 9px;
		background: linear-gradient(180deg, var(--p-top) 0, var(--p-mid) 40%, var(--p-bot) 100%);
		box-shadow:
			inset 0 1px 0 var(--p-top),
			0 10px 24px rgb(0 0 0 / 45%);
		color: var(--p-text);
		outline: none;
	}
	.player.gone {
		display: none;
	}
	.head {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.logo {
		display: flex;
		flex-direction: column;
		line-height: 0.95;
	}
	.logo-name {
		font: italic 900 22px var(--logo-font);
		letter-spacing: -0.5px;
	}
	.logo-version {
		font:
			bold 11px Arial,
			sans-serif;
		color: var(--link);
		letter-spacing: 3px;
	}
	.head-gap {
		flex: 1;
	}
	.round-hit {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		background: none;
	}
	.round {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #2b2f36;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 30%, #8a9099, #3b4048 60%, #22262c);
		font:
			bold 12px/1 Tahoma,
			sans-serif;
		color: #fff;
	}
	.round.starred {
		border-color: #5a0f37;
		background: radial-gradient(circle at 50% 30%, #f6a8d2, #c43a84 60%, #93245f);
	}
	.deck {
		flex-shrink: 0;
		display: flex;
		gap: 16px;
		padding: 10px 12px;
		border: 1px solid var(--deck-edge);
		border-radius: 3px;
		background: var(--deck);
		box-shadow: inset 0 1px 4px #000;
	}
	.readout {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 6px;
	}
	.time {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 14px;
		font-family: var(--lcd-font);
		font-variant-numeric: tabular-nums;
	}
	.time-now {
		font-size: 56px;
		line-height: 0.9;
		color: var(--lcd);
	}
	.time-end {
		font-size: 30px;
		line-height: 1;
		color: var(--lcd-dim);
	}
	.mode {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font: 21px/1 var(--lcd-font);
		color: var(--lcd-dim);
	}
	.song-note {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		color: #d7dbe0;
	}
	.clip-bar {
		height: 13px;
		display: flex;
		gap: 2px;
	}
	.clip-labels {
		margin-top: 3px;
		display: flex;
		gap: 2px;
		font: 13px/1 var(--lcd-font);
		color: var(--lcd-dim);
	}
	.clip-labels span {
		min-width: 0;
		text-align: right;
	}
	.controls {
		position: relative;
		z-index: 3;
		flex-shrink: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 109px;
		grid-template-areas:
			'clip clip play'
			'artist artist play'
			'guess guess-button play'
			'skip skip play';
		align-items: center;
		column-gap: 9px;
		row-gap: 7px;
	}
	.row {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.row-clip {
		grid-area: clip;
	}
	.row-artist {
		grid-area: artist;
	}
	.row-guess {
		grid-area: guess;
	}
	.guess-button {
		grid-area: guess-button;
	}
	.skip-button {
		grid-area: skip;
		justify-self: start;
		margin-left: 124px;
	}
	.bullet {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		border: 1px solid #084465;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 30%, #bfe7fb, #3aa3d8 45%, #0c5f8b);
	}
	.row-label {
		flex-shrink: 0;
		width: 92px;
		font-size: 13px;
	}
	.chips {
		display: flex;
		gap: 3px;
	}
	.chip {
		min-width: 34px;
		height: 26px;
		padding: 0 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--p-edge);
		border-radius: 3px;
		font-size: 12px;
		font-weight: bold;
	}
	.chip.now {
		border-color: #084465;
		background: linear-gradient(180deg, #3aa3d8, #0f6e9c);
		color: #fff;
	}
	.chip.done {
		background: #b9bdc4;
		color: #33373d;
	}
	.chip.locked {
		border-style: dashed;
		color: var(--p-muted);
	}
	.artist-field {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		overflow: hidden;
		font-size: 13px;
		white-space: nowrap;
	}
	.artist-long,
	.artist-short {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.artist-short {
		display: none;
	}
	.play-key {
		grid-area: play;
		width: 104px;
		height: 76px;
		margin-left: 5px;
		padding: 0 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		border: 1px solid #05324a;
		border-radius: 3px;
		background: linear-gradient(180deg, #8fd3f5 0, #3aa3d8 48%, #127fb3 52%, #0c5f8b 100%);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 45%),
			0 2px 0 #05324a;
		font:
			bold 12px Tahoma,
			sans-serif;
		color: #fff;
		text-shadow: 0 1px 0 #05324a;
	}
	.play-key:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 25%);
	}
	.play-key:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.controls.over {
		grid-template-columns: 96px minmax(0, 1fr) 109px;
		grid-template-areas:
			'sleeve text play'
			'sleeve buttons play';
		column-gap: 12px;
		row-gap: 5px;
	}
	.sleeve {
		grid-area: sleeve;
		position: relative;
		width: 96px;
		height: 96px;
		overflow: hidden;
		border: 1px solid #084465;
		background: #127fb3;
		box-shadow: 2px 2px 0 rgb(0 0 0 / 25%);
		color: #fff;
	}
	.sleeve img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.sleeve-record {
		position: absolute;
		right: -28px;
		top: 18px;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #24272c 0 1px, #08090a 1px 3px);
	}
	.sleeve-initials {
		position: absolute;
		left: 7px;
		bottom: 6px;
		font: italic 900 13px/1 var(--logo-font);
	}
	.result-text {
		grid-area: text;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.good {
		color: var(--good);
	}
	.bad {
		color: var(--bad);
	}
	.result-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font: italic 900 20px/1.2 var(--logo-font);
	}
	.share-button {
		min-width: 92px;
	}
	.result-buttons {
		grid-area: buttons;
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.log {
		flex: 0 1 auto;
		min-height: 70px;
		display: flex;
		align-items: stretch;
		gap: 6px;
	}
	.side-buttons {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.side-buttons button {
		width: 44px;
		height: 44px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.status {
		flex-shrink: 0;
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 12px;
		color: var(--p-muted);
	}
	.status-next {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 900px) {
		.player {
			position: static;
			flex: 1;
			min-height: 0;
			width: auto;
			max-width: none;
			max-height: none;
			padding: 6px 10px;
			gap: 8px;
			overflow-y: auto;
			border: 0;
			border-radius: 0;
			box-shadow: none;
		}
		.head {
			min-height: 44px;
			gap: 8px;
			cursor: default;
			touch-action: auto;
		}
		.logo-name {
			font-size: 21px;
		}
		.logo-version {
			font-size: 10px;
		}
		.round-hit {
			width: 44px;
			height: 44px;
		}
		.round {
			width: 28px;
			height: 28px;
			font-size: 13px;
		}
		.deck {
			gap: 8px;
			padding: 8px;
		}
		.readout {
			gap: 3px;
		}
		.time {
			flex-wrap: nowrap;
			gap: 6px;
			white-space: nowrap;
		}
		.time-now {
			font-size: 44px;
			line-height: 0.85;
		}
		.time-end {
			font-size: 21px;
		}
		.mode {
			justify-content: flex-start;
			font-size: 19px;
		}
		.song-note {
			font-size: 12px;
		}
		.clip-bar {
			height: 12px;
		}
		.clip-labels {
			display: none;
		}
		.controls {
			grid-template-columns: minmax(0, 1fr) 118px;
			grid-template-areas:
				'artist artist'
				'guess guess'
				'guess-button play'
				'skip play';
			column-gap: 8px;
			row-gap: 6px;
		}
		.row-clip {
			display: none;
		}
		.row-artist {
			gap: 8px;
		}
		.artist-field {
			height: auto;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
		}
		.artist-long {
			display: none;
		}
		.artist-short {
			display: block;
		}
		.row-artist > .row-label {
			display: none;
		}
		.row-guess {
			flex-wrap: wrap;
			row-gap: 4px;
			column-gap: 8px;
		}
		.skip-button {
			justify-self: stretch;
			margin-left: 0;
		}
		.play-key {
			align-self: stretch;
			width: 118px;
			height: auto;
			min-height: 94px;
			margin-left: 0;
			font-size: 13px;
		}
		.controls.over {
			grid-template-columns: 84px minmax(0, 1fr) 118px;
			grid-template-areas:
				'sleeve text text'
				'buttons buttons play';
			column-gap: 10px;
			row-gap: 8px;
		}
		.sleeve {
			width: 84px;
			height: 84px;
		}
		.result-title {
			white-space: normal;
			font-size: 19px;
			line-height: 1.05;
		}
		.result-buttons {
			flex-direction: column;
			flex-wrap: nowrap;
			gap: 6px;
		}
		.log {
			position: relative;
			flex: 1 1 0;
			min-height: 90px;
		}
		.side-buttons,
		.status-next {
			display: none;
		}
	}
	.seek-wrap {
		display: block;
	}
	.seek-label {
		display: block;
		margin-bottom: 2px;
		font-size: 12px;
		color: #d7dbe0;
	}
	.seek {
		display: block;
		width: 100%;
		height: 16px;
		margin: 0;
		cursor: pointer;
	}
	@media (max-width: 900px) {
		.seek-label {
			display: none;
		}
		.seek {
			height: 26px;
		}
	}
</style>
