<script lang="ts">
	import { onMount } from 'svelte';
	import MessageBox from '#lib/retro/MessageBox.svelte';
	import { summarizeSavedData } from '#lib/saved-data.js';
	import { listEntries, remove } from '#lib/storage.js';

	export let onClose: () => void = () => {};

	const tabs = ['General', 'Songs', 'Saved data'];
	const descriptions = {
		stats:
			"Played, won, streak and best for each artist you've played. Clearing it starts every streak again.",
		games:
			"Your guesses in each day's round. Clearing it lets you replay today's song, but it won't count again.",
		favorites: 'Artists you starred. Clearing it removes them from the desktop and Start menu.',
		settings: 'Light or dark display and volume. Clearing it puts both back to how they started.'
	};
	let activeTab = 0;
	let tabButtons: HTMLButtonElement[] = [];
	let groups = summarizeSavedData([]);
	let selectedGroup: keyof typeof descriptions = 'stats';
	let checked: string[] = [];
	let clearing: typeof groups = [];

	onMount(refresh);

	function refresh() {
		groups = summarizeSavedData(listEntries('mp3dle:'));
	}

	function selectTab(index: number) {
		activeTab = index;
		if (index === 2) refresh();
	}

	function tabKeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		selectTab(next);
		tabButtons[next]?.focus();
	}

	function confirmClear() {
		refresh();
		clearing = groups.filter((group) => checked.includes(group.id));
	}

	function clearSelected() {
		for (const group of clearing) {
			for (const key of group.keys) remove(key);
		}
		window.location.reload();
	}
</script>

<div class="properties">
	<div class="tabs" role="tablist" aria-label="mp3dle Properties">
		{#each tabs as tab, index (tab)}
			<button
				type="button"
				role="tab"
				id={`about-tab-${index}`}
				aria-selected={activeTab === index}
				aria-controls={`about-panel-${index}`}
				tabindex={activeTab === index ? 0 : -1}
				bind:this={tabButtons[index]}
				on:click={() => selectTab(index)}
				on:keydown={(event) => tabKeydown(event, index)}>{tab}</button
			>
		{/each}
	</div>
	{#each tabs as tab, index (tab)}
		<div
			class="panel"
			class:general={index === 0}
			role="tabpanel"
			id={`about-panel-${index}`}
			aria-labelledby={`about-tab-${index}`}
			tabindex="0"
			hidden={activeTab !== index}
		>
			{#if index === 0}
				<div class="brand">
					<svg aria-hidden="true" width="52" height="52" viewBox="0 0 64 64">
						<circle cx="32" cy="32" r="30" fill="var(--deck)" />
						<circle cx="32" cy="32" r="24" fill="none" stroke="var(--deck-edge)" stroke-width="2" />
						<circle cx="32" cy="32" r="17" fill="none" stroke="var(--deck-edge)" stroke-width="2" />
						<circle cx="32" cy="32" r="11" fill="var(--pink)" />
						<circle cx="32" cy="32" r="3" fill="var(--field)" />
					</svg>
					<div>
						<strong class="logo">MP3DLE</strong>
						<p>A daily song game for SoundCloud artists.</p>
					</div>
				</div>
				<div class="rule"></div>
				<dl>
					<dt>Made by:</dt>
					<dd>Josh Patra</dd>
					<dt>Source code:</dt>
					<dd>
						<a
							class="link"
							href="https://github.com/SoPat712/mp3dle"
							target="_blank"
							rel="noopener noreferrer">github.com/SoPat712/mp3dle</a
						>
					</dd>
					<dt>Songs and audio:</dt>
					<dd>SoundCloud's own player. mp3dle isn't part of SoundCloud.</dd>
					<dt>Accounts:</dt>
					<dd>None. Your games, stats and favorites stay in this browser.</dd>
				</dl>
				<div class="rule"></div>
				<p class="muted">A new song every day at midnight, your time.</p>
			{:else if index === 1}
				<fieldset>
					<legend>Today's song</legend>
					Every track gets a number from today's date and the highest one wins, so everyone playing an
					artist gets the same song.
				</fieldset>
				<div class="song-groups">
					<fieldset>
						<legend>Left out</legend>
						<ul>
							<li>Remixes and edits</li>
							<li>Live and concert recordings</li>
							<li>Acoustic and piano versions</li>
							<li>Instrumentals, a cappellas</li>
							<li>Sped up and slowed</li>
							<li>Commentary, voice memos, interviews</li>
							<li>Snippets and covers</li>
							<li>Anything under 17 seconds</li>
						</ul>
					</fieldset>
					<fieldset>
						<legend>Kept</legend>
						<ul>
							<li>Features and collabs</li>
							<li>Taylor's Version</li>
							<li>From The Vault</li>
							<li>Bonus tracks</li>
						</ul>
					</fieldset>
				</div>
				<p class="muted">
					Some artists only allow a 30 second preview on SoundCloud, so their full song stops early.
				</p>
			{:else}
				<div class="saved-intro">
					<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
						<rect x="3" y="9" width="28" height="17" fill="var(--face)" stroke="var(--p-muted)" />
						<rect x="5" y="11" width="24" height="6" fill="var(--shade)" />
						<circle cx="26" cy="22" r="1.6" fill="var(--good)" />
						<path d="M6 22h12" stroke="var(--p-muted)" />
					</svg>
					<p>mp3dle keeps these in this browser:</p>
				</div>
				<ul class="sunk saved-list" aria-label="Saved data groups">
					{#each groups as group (group.id)}
						<li class="row" class:selected={selectedGroup === group.id}>
							<label class="check-target">
								<input
									type="checkbox"
									aria-label={group.name}
									value={group.id}
									bind:group={checked}
									on:focus={() => (selectedGroup = group.id)}
									on:click={() => (selectedGroup = group.id)}
								/>
							</label>
							<button
								type="button"
								class="row-info"
								aria-pressed={selectedGroup === group.id}
								on:click={() => (selectedGroup = group.id)}
							>
								<span>{group.name}</span><span>{group.detail}</span><span class="size"
									>{group.size}</span
								>
							</button>
						</li>
					{/each}
				</ul>
				<div class="description" aria-live="polite">
					<strong>Description</strong>
					<p>{descriptions[selectedGroup]}</p>
				</div>
				<div class="clear-row">
					<p class="muted">
						Other browsers, phones and private windows keep their own copy. Nothing is sent
						anywhere.
					</p>
					<button type="button" class="b95" disabled={!checked.length} on:click={confirmClear}
						>Clear selected...</button
					>
				</div>
			{/if}
		</div>
	{/each}
	<div class="buttons">
		<button type="button" class="b95 default" on:click={onClose}>OK</button>
		<button type="button" class="b95" on:click={onClose}>Cancel</button>
		<button type="button" class="b95" disabled>Apply</button>
	</div>
</div>

{#if clearing.length}
	<MessageBox title="mp3dle Properties" onDismiss={() => (clearing = [])}>
		Clear {clearing.map((group) => group.name).join(', ')}? This can't be undone.
		<svelte:fragment slot="buttons">
			<button type="button" class="b95" on:click={clearSelected}>Clear</button>
			<button type="button" class="b95" on:click={() => (clearing = [])}>Cancel</button>
		</svelte:fragment>
	</MessageBox>
{/if}

<style>
	.properties {
		min-height: 0;
		overflow-y: auto;
		padding: 10px 8px 8px;
		font-size: 12px;
		line-height: 1.35;
	}

	.tabs {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		padding-left: 4px;
	}

	.tabs button {
		position: relative;
		min-height: 26px;
		padding: 3px 10px;
		border: 1px solid;
		border-color: var(--hi) var(--dark) var(--shade) var(--hi);
		border-radius: 3px 3px 0 0;
		background: var(--face);
		color: var(--w-text);
	}

	.tabs button[aria-selected='true'] {
		z-index: 1;
		min-height: 29px;
		margin-bottom: -2px;
		padding-bottom: 6px;
		border-bottom-color: var(--face);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 12px;
		border: 2px solid;
		border-color: var(--hi) var(--dark) var(--dark) var(--hi);
		box-shadow: inset -1px -1px 0 var(--shade);
	}

	.panel[hidden] {
		display: none;
	}

	.general {
		gap: 14px;
		padding: 16px 16px 18px;
		font-size: 13px;
	}

	.brand,
	.saved-intro {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	svg {
		flex-shrink: 0;
	}

	.logo {
		font: italic 900 24px var(--logo-font);
		letter-spacing: -0.5px;
	}

	.rule {
		border-top: 1px solid var(--shade);
		border-bottom: 1px solid var(--hi);
	}

	dl {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr);
		gap: 8px;
		margin: 0;
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	fieldset {
		min-width: 0;
		margin: 0;
		padding: 8px 10px 10px;
		border: 2px groove var(--hi);
	}

	legend {
		padding: 0 4px;
	}

	.song-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	ul {
		margin: 0;
		padding-left: 16px;
	}

	li {
		margin: 1px 0;
	}

	.muted {
		color: var(--p-muted);
	}

	.saved-intro {
		gap: 12px;
		font-size: 13px;
	}

	.saved-list {
		padding: 2px;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: stretch;
		margin: 0;
	}

	.row.selected {
		background: var(--select);
		color: white;
	}

	.check-target {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		flex-shrink: 0;
	}

	.check-target input {
		margin: 0;
	}

	.row-info {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 90px 44px;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		min-height: 24px;
		padding: 0 6px 0 0;
		border: 0;
		background: transparent;
		text-align: left;
		color: inherit;
	}

	.size {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.description {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.clear-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.clear-row p {
		flex: 1;
	}

	.clear-row button {
		flex-shrink: 0;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 10px;
	}

	.buttons .b95 {
		min-width: 76px;
	}

	.default {
		outline: 1px solid var(--w-text);
		outline-offset: -1px;
	}

	@media (max-width: 900px) {
		.tabs button,
		.tabs button[aria-selected='true'],
		.row-info,
		.check-target {
			min-height: 44px;
		}

		.check-target {
			width: 44px;
		}

		.row-info {
			grid-template-columns: minmax(0, 1fr) 44px;
			padding: 4px 6px 4px 0;
		}

		.row-info span:nth-child(2) {
			grid-column: 1;
			font-size: 11px;
		}

		.size {
			grid-column: 2;
			grid-row: 1 / 3;
		}

		.clear-row {
			flex-direction: column;
			align-items: stretch;
		}
	}

	@media (max-width: 420px) {
		dl {
			grid-template-columns: 88px minmax(0, 1fr);
		}

		.song-groups {
			grid-template-columns: 1fr;
		}
	}
</style>
