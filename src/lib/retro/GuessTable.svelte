<script lang="ts">
	import type { AttemptInfo } from '#lib/game-state.js';

	export let attempts: AttemptInfo[];
	export let clipLengths: number[];
	export let gameOver = false;
	export let playing = false;
</script>

<div class="log-table">
	<div class="log-row log-head">
		<span>#</span><span>Guess</span><span>Clip</span><span>Result</span>
	</div>
	<ol aria-label="Your guesses">
		{#each clipLengths as clip, i (clip)}
			{@const attempt = attempts[i]}
			{@const current = !gameOver && i === attempts.length}
			<li
				class="log-row"
				class:stripe={i % 2 === 0}
				class:muted={attempt ? attempt.status === 'skip' : !current}
				class:current
			>
				<span>{i + 1}</span>
				<span class="log-guess">
					{#if attempt}
						{attempt.status === 'skip' ? '[skipped]' : attempt.title}
					{:else if current}
						{playing ? '... listening' : 'your turn'}
					{/if}
				</span>
				<span>0:{String(clip).padStart(2, '0')}</span>
				<span class="log-result {attempt?.status ?? ''}">{attempt?.status ?? ''}</span>
			</li>
		{/each}
	</ol>
</div>

<style>
	.log-table {
		flex: 1;
		min-width: 0;
		max-height: max(70px, calc(100svh - 490px));
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--p-edge);
		background: var(--field);
	}
	.log-table ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.log-row {
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr) 62px 76px;
		align-items: center;
		column-gap: 8px;
		min-height: 25px;
		padding: 0 8px;
		font-size: 13px;
	}
	.log-row.stripe {
		background: var(--field-alt);
	}
	.log-row.muted {
		color: var(--p-muted);
	}
	.log-row.current {
		background: var(--select);
		color: #fff;
	}
	.log-head {
		position: sticky;
		top: 0;
		z-index: 1;
		border-bottom: 1px solid #a9aeb6;
		background: linear-gradient(180deg, #fafbfc, #dfe2e6);
		font-size: 12px;
		color: #3b4048;
	}
	.log-guess {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.log-result {
		font-weight: bold;
	}
	@media (max-width: 900px) {
		.log-table {
			position: absolute;
			inset: 0;
			max-height: none;
		}
		.log-row {
			grid-template-columns: 22px minmax(0, 1fr) 42px 58px;
			column-gap: 6px;
			min-height: 30px;
			padding: 0 7px;
		}
		.log-head {
			min-height: 24px;
		}
	}
	.log-result.skip {
		color: var(--p-muted);
	}
	.log-result.wrong {
		color: var(--bad);
	}
	.log-result.correct {
		color: var(--good);
	}
</style>
