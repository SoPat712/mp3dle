<script lang="ts">
	import ArtistPic from '#lib/retro/ArtistPic.svelte';
	import Icon from '#lib/retro/icons/Icon.svelte';
	import type { SoundCloudArtist } from '#lib/tracks.js';

	export let hasArtist = false;
	export let pageError = '';
	export let onChoose: (artist: SoundCloudArtist) => void;
	export let onCancel: () => void = () => {};

	let query = '';
	let searching = false;
	let error = '';
	let results: SoundCloudArtist[] = [];

	$: shownError = error || pageError;

	async function search() {
		const cleanQuery = query.trim();
		if (cleanQuery.length < 2) {
			error = 'Enter at least two characters.';
			return;
		}

		searching = true;
		error = '';
		results = [];
		try {
			const response = await fetch(`/api/soundcloud/artists?q=${encodeURIComponent(cleanQuery)}`);
			const data = (await response.json()) as {
				artists?: SoundCloudArtist[];
				error?: string;
			};
			if (!response.ok) throw new Error(data.error || 'Search failed.');
			results = data.artists ?? [];
			if (!results.length) error = 'No public artists with tracks found.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Search failed.';
		} finally {
			searching = false;
		}
	}
</script>

<div class="find">
	<div class="intro">
		<Icon name="folder" />
		<p>
			Pick any public artist on SoundCloud. Each day you get one of their original tracks to name
			from a short clip, and every miss plays a little more.
		</p>
	</div>

	<form on:submit|preventDefault={search} role="search" aria-busy={searching}>
		<label for="artist-search">Artist or profile name:</label>
		<div class="search-row">
			<input
				id="artist-search"
				class="sunk"
				bind:value={query}
				type="search"
				autocomplete="off"
				spellcheck="false"
			/>
			<button class="b95" type="submit" disabled={searching}>
				{searching ? 'Searching...' : 'Search'}
			</button>
		</div>
	</form>

	<div class="results sunk">
		{#if results.length}
			<ul aria-label="SoundCloud artist results">
				{#each results as artist (artist.id)}
					<li>
						<button
							type="button"
							class="menu-item result"
							aria-label={`Play ${artist.username} Heardle`}
							on:click={() => onChoose(artist)}
						>
							<ArtistPic username={artist.username} avatarUrl={artist.avatarUrl} />
							<span class="result-copy">
								<strong>{artist.username}</strong>
								<span class="result-meta">
									@{artist.permalink} · {artist.trackCount.toLocaleString()} tracks ·
									{artist.followersCount.toLocaleString()} followers
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if shownError}
			<p class="note error" role="alert">{shownError}</p>
		{:else}
			<p class="note">{searching ? 'Searching SoundCloud...' : 'Search for an artist.'}</p>
		{/if}
	</div>

	<div class="foot">
		<p>Tip: follower and upload counts help identify the official profile.</p>
		{#if hasArtist}
			<button type="button" class="b95" on:click={onCancel}>Cancel</button>
		{/if}
	</div>
</div>

<style>
	.find {
		flex: 1;
		min-height: 0;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}

	.intro {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.intro :global(svg) {
		flex-shrink: 0;
	}

	label {
		display: block;
		margin-bottom: 4px;
	}

	.search-row {
		display: flex;
		gap: 6px;
	}

	input {
		flex: 1;
		min-width: 0;
		height: 28px;
		padding: 0 6px;
		font-size: 16px;
		outline: none;
	}

	.results {
		height: 212px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result {
		min-height: 52px;
	}

	.result-copy {
		flex: 1;
		min-width: 0;
		font-size: 12px;
	}

	.result-copy strong {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
	}

	.result-meta {
		display: block;
		overflow-wrap: anywhere;
	}

	.note {
		margin: 8px;
	}

	.error {
		color: var(--bad);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.foot button {
		flex-shrink: 0;
	}

	@media (max-width: 900px) {
		.find {
			font-size: 13px;
		}

		.intro :global(svg) {
			display: none;
		}

		input {
			height: 44px;
			padding: 0 8px;
		}

		.results {
			flex: 1;
			min-height: 0;
			height: auto;
		}

		.result {
			min-height: 60px;
		}
	}
</style>
