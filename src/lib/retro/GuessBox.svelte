<script lang="ts">
	import { normalizeTrackTitle, type Track } from '$lib/tracks';

	export let tracks: Track[];
	export let onEnter: () => void;
	// whichever song the player has landed on, null until there is one
	export let picked: Track | null = null;

	let text = '';
	let clicked: Track | null = null;
	let open = false;
	let active = -1;
	let wrap: HTMLDivElement;
	let input: HTMLInputElement;
	let list: HTMLUListElement | undefined;

	$: search = normalizeTrackTitle(text);
	$: picked =
		clicked ?? tracks.find((track) => normalizeTrackTitle(track.title) === search) ?? null;
	$: suggestions =
		text && !clicked && open
			? tracks.filter((track) => normalizeTrackTitle(track.title).includes(search)).slice(0, 6)
			: [];
	$: if (active >= suggestions.length) active = -1;

	export function clear() {
		text = '';
		clicked = null;
		open = false;
		active = -1;
	}

	function choose(track: Track, fromKeyboard = false) {
		clicked = track;
		text = track.title;
		open = false;
		active = -1;
		// a tap should put the phone keyboard away, but from the keyboard enter again should guess
		if (!fromKeyboard) input.blur();
	}

	function typed() {
		clicked = null;
		open = true;
		active = -1;
	}

	function arrow(direction: number) {
		if (!suggestions.length) return;
		active = (active + direction + suggestions.length) % suggestions.length;

		// keep the highlighted one in view. not scrollIntoView, that scrolls the whole page on phones
		const option = list?.children[active] as HTMLElement | undefined;
		if (!option || !list) return;
		if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
		const bottom = option.offsetTop + option.offsetHeight;
		if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') arrow(1);
		else if (event.key === 'ArrowUp') arrow(-1);
		else if (event.key === 'Escape') open = false;
		else if (event.key === 'Enter') {
			if (suggestions[active]) choose(suggestions[active], true);
			else onEnter();
		} else return;
		event.preventDefault();
	}

	function focusOut(event: FocusEvent) {
		if (!wrap.contains(event.relatedTarget as Node | null)) open = false;
	}
</script>

<div class="guess-wrap" bind:this={wrap} on:focusout={focusOut} role="none">
	<input
		id="guess-input"
		class="field"
		bind:this={input}
		bind:value={text}
		type="text"
		placeholder="Start typing a title"
		autocomplete="off"
		spellcheck="false"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={suggestions.length > 0}
		aria-controls="song-suggestions"
		aria-activedescendant={active >= 0 ? `song-${active}` : undefined}
		on:input={typed}
		on:keydown={keydown}
		on:focus={() => {
			clicked = null;
			open = true;
		}}
	/>
	{#if suggestions.length}
		<!-- stopping mousedown keeps focus in the input, otherwise ios closes the list mid tap -->
		<ul
			id="song-suggestions"
			class="suggestions"
			role="listbox"
			aria-label="Song suggestions"
			bind:this={list}
			on:mousedown|preventDefault
		>
			{#each suggestions as track, i (track.slug)}
				<li id="song-{i}" role="option" aria-selected={i === active}>
					<button
						type="button"
						tabindex="-1"
						class="suggestion"
						class:active={i === active}
						on:click={() => choose(track)}
					>
						{track.title}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.guess-wrap {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.guess-wrap input {
		display: block;
		width: 100%;
		font-size: 16px;
		outline: none;
	}
	.guess-wrap input:focus {
		border-color: var(--select);
	}
	.suggestions {
		position: absolute;
		left: 0;
		right: 0;
		top: 31px;
		z-index: 6;
		max-height: 168px;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
		border: 1px solid var(--p-edge);
		background: var(--field);
		box-shadow: 2px 3px 0 rgb(0 0 0 / 25%);
	}
	.suggestion {
		width: 100%;
		min-height: 26px;
		padding: 3px 8px;
		border: 0;
		background: var(--field);
		font-size: 13px;
		text-align: left;
		color: var(--p-text);
	}
	.suggestion:hover,
	.suggestion.active {
		background: var(--select);
		color: #fff;
	}
	@media (max-width: 900px) {
		.guess-wrap {
			flex: 0 0 100%;
		}
		.guess-wrap input {
			height: 44px;
		}
		.suggestions {
			top: auto;
			bottom: 46px;
			max-height: 176px;
			box-shadow: 2px -2px 0 rgb(0 0 0 / 25%);
		}
		.suggestion {
			min-height: 44px;
			padding: 0 10px;
			font-size: 14px;
		}
	}
</style>
