<script lang="ts">
	import type { Stats } from '#lib/game-state.js';
	import { getLocalDateKey } from '#lib/tracks.js';

	export let stats: Stats;
	export let nextLine = '';
	export let profileUrl = '';

	$: todayResult = stats.lastPlayedDate === getLocalDateKey() ? stats.lastResult : undefined;
	$: fails = Math.max(stats.played - stats.wins, 0);
	$: rows = [
		...stats.distribution.map((count, index) => ({
			label: String(index + 1),
			count,
			color: todayResult === index + 1 ? 'var(--good)' : '#0f6e9c',
			today: todayResult === index + 1
		})),
		{
			label: 'X',
			count: fails,
			color: todayResult === 0 ? 'var(--bad)' : '#c43a84',
			today: todayResult === 0
		}
	];
	$: top = Math.max(1, ...rows.map((row) => row.count));
	$: winPercent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
</script>

<div class="stats">
	<div class="tiles">
		<div class="sunk"><strong>{stats.played}</strong>played</div>
		<div class="sunk"><strong>{winPercent}%</strong>won</div>
		<div class="sunk"><strong>{stats.streak}</strong>streak</div>
		<div class="sunk"><strong>{stats.maxStreak}</strong>best</div>
	</div>
	<div class="sunk chart">
		<strong>Guess distribution</strong>
		{#each rows as row (row.label)}
			<div class="row" class:today={row.today}>
				<span class="row-label">{row.label}</span>
				<span class="row-track">
					<span
						class="row-bar"
						style:width="{Math.round((row.count / top) * 100)}%"
						style:background={row.color}
					></span>
				</span>
				<span class="row-count">{row.count}</span>
			</div>
		{/each}
	</div>
	{#if nextLine}<p>{nextLine}</p>{/if}
	{#if profileUrl}
		<a class="link" href={profileUrl} target="_blank" rel="external noopener noreferrer">
			Open SoundCloud profile
		</a>
	{/if}
</div>

<style>
	.stats {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 3px;
		text-align: center;
	}

	.tiles > div {
		padding: 5px 0;
	}

	.tiles strong {
		display: block;
		font-size: 19px;
	}

	.tiles strong,
	.row-count {
		font-variant-numeric: tabular-nums;
	}

	.today .row-label,
	.today .row-count {
		font-weight: bold;
	}

	.chart {
		padding: 7px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.row-label {
		width: 10px;
	}

	.row-track {
		flex: 1;
	}

	.row-bar {
		display: block;
		height: 14px;
		min-width: 3px;
	}

	.row-count {
		width: 22px;
		text-align: right;
	}

	@media (max-width: 900px) {
		.stats {
			padding: 10px;
			gap: 10px;
			font-size: 13px;
		}

		.tiles > div {
			padding: 8px 0;
		}

		.tiles strong {
			font-size: 22px;
		}

		.chart {
			padding: 10px;
			gap: 6px;
		}

		.row-bar {
			height: 18px;
		}
	}
</style>
