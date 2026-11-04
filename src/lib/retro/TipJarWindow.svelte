<script lang="ts">
	import Icon from '#lib/retro/icons/Icon.svelte';

	export let onClose: () => void = () => {};

	const services = [
		{ name: 'Ko-fi', address: 'ko-fi.com/joshpatra' },
		{ name: 'Buy Me a Coffee', address: 'buymeacoffee.com/treeman183' },
		{ name: 'GitHub Sponsors', address: 'github.com/sponsors/SoPat712' }
	];
	let selected = services[0].address;
</script>

<div class="tip-jar">
	<div class="intro">
		<span class="jar"><Icon name="jar" /></span>
		<div class="copy">
			<strong>mp3dle is free and has no ads.</strong>
			<p>
				If it's become part of your day, you can leave me a tip. Nothing in the game changes either
				way.
			</p>
		</div>
	</div>
	<fieldset>
		<legend>Tip with</legend>
		{#each services as service (service.address)}
			<label class="service">
				<input type="radio" name="tip-service" value={service.address} bind:group={selected} />
				<span>{service.name}<small>{service.address}</small></span>
			</label>
		{/each}
	</fieldset>
	<p class="muted">
		You pick the amount on that page, in a new tab. Payment happens there, never in mp3dle.
	</p>
	<div class="buttons">
		<a class="b95 default" href={`https://${selected}`} target="_blank" rel="noopener noreferrer"
			>Leave a tip...</a
		>
		<button type="button" class="b95" on:click={onClose}>Close</button>
	</div>
</div>

<style>
	.tip-jar {
		min-height: 0;
		overflow-y: auto;
		padding: 16px 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		font-size: 13px;
		line-height: 1.4;
	}

	.intro {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.jar {
		flex-shrink: 0;
	}

	.jar :global(svg) {
		width: 64px;
		height: 64px;
	}

	.copy {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	fieldset {
		min-width: 0;
		margin: 0;
		padding: 8px 10px 10px;
		border: 2px groove var(--hi);
	}

	legend {
		padding: 0 4px;
		font-size: 12px;
	}

	.service {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
	}

	.service input {
		margin: 0;
	}

	.service > span {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
	}

	small {
		display: block;
		overflow-wrap: anywhere;
	}

	small,
	.muted {
		color: var(--p-muted);
		font-size: 12px;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}

	.b95 {
		min-width: 76px;
	}

	a.b95 {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
	}

	.default {
		outline: 1px solid var(--w-text);
		outline-offset: -1px;
	}

	@media (max-width: 900px) {
		.service {
			min-height: 52px;
		}

		.service > span {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
</style>
