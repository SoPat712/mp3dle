<script lang="ts">
	export let catalogLine = '';
</script>

<div class="menu-bar" aria-hidden="true">
	<span>File</span><span>Edit</span><span>Search</span><span>Help</span>
</div>
<div class="sunk notepad">
	<p>HOW TO PLAY</p>
	<p class="gap">1. Press play and identify the song from the unlocked snippet.</p>
	<p>2. A skip or wrong guess unlocks a longer clip from the start.</p>
	<p>3. Finish in as few attempts as possible and share your result.</p>
	<p class="gap">
		Press the star on the player to keep an artist on your desktop, or in the Start menu on a phone.
	</p>
	<p class="gap-wide">
		Your games, stats, favorites and settings stay in this browser. There are no accounts or
		analytics. Artist info and audio come from SoundCloud.
	</p>
	{#if catalogLine}<p class="gap-wide">{catalogLine}</p>{/if}
</div>

<style>
	.menu-bar {
		display: flex;
		gap: 12px;
		padding: 2px 6px;
		font-size: 12px;
	}

	.notepad {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 8px;
		font:
			13px/1.5 'Lucida Console',
			Consolas,
			Menlo,
			monospace;
	}

	.gap {
		margin-top: 8px;
	}

	.gap-wide {
		margin-top: 12px;
	}

	@media (max-width: 900px) {
		.menu-bar {
			display: none;
		}

		.notepad {
			padding: 10px;
			font-size: 14px;
		}
	}
</style>
