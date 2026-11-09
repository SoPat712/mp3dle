<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { isAnyKey } from '#lib/crash.js';

	export let status = 500;
	export let message = 'Internal Error';

	let restartButton: HTMLButtonElement | undefined;
	let desktopButton: HTMLButtonElement;

	// the old ones ended in a memory address, this one ends in the status code
	$: address = `0028:C0DE${String(status).padStart(4, '0')}`;
	// a bad link just fails again on a reload, so the desktop is the only way out
	$: badLink = status === 404;

	function restart() {
		location.reload();
	}

	// a bad link or a broken artist could just fail again, so this starts from nothing
	function desktop() {
		location.assign(resolve('/'));
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || (badLink && isAnyKey(event))) desktop();
		else if (isAnyKey(event)) restart();
	}

	onMount(() => {
		(restartButton ?? desktopButton).focus();
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0000aa');
	});
</script>

<svelte:window on:keydown={keydown} />

<main class="bsod" aria-labelledby="bsod-title">
	<div class="screen">
		<h1 id="bsod-title"><span>mp3dle</span></h1>
		<p>
			A fatal exception {status} ({message}) has occurred at {address} in mp3dle Player. Any song that
			was playing has been stopped.
		</p>
		<ul>
			<!-- one span per line, a flex row would eat the space before "to" -->
			{#if badLink}
				<li>
					<span
						><span class="keys">Press any key or Desktop</span><span class="taps">Tap Desktop</span> to
						go to an empty desktop and pick an artist. You will not lose any saved games or stats.</span
					>
				</li>
			{:else}
				<li>
					<span
						><span class="keys">Press any key or Restart</span><span class="taps">Tap Restart</span> to
						load mp3dle again.</span
					>
				</li>
				<li>
					<span
						><span class="keys">Press Esc or Desktop</span><span class="taps">Tap Desktop</span> to go
						back to an empty desktop. You will not lose any saved games or stats.</span
					>
				</li>
			{/if}
		</ul>
		<div class="buttons">
			{#if !badLink}
				<button bind:this={restartButton} type="button" on:click={restart}>Restart</button>
			{/if}
			<button bind:this={desktopButton} type="button" on:click={desktop}>Desktop</button>
		</div>
		<p class="keys continue">Press any key to continue <span class="cursor">_</span></p>
	</div>
</main>

<style>
	.bsod {
		position: fixed;
		inset: 0;
		z-index: 1000;
		overflow-y: auto;
		padding: 24px 16px;
		display: flex;
		background: #0000aa;
		color: #fff;
		/* not var(--lcd-font), that lives on the desktop and this can show without one */
		font:
			30px/1.25 'VT323',
			monospace;
	}
	.screen {
		width: 100%;
		max-width: 860px;
		margin: auto;
		display: flex;
		flex-direction: column;
		gap: 30px;
	}
	h1 {
		margin: 0;
		text-align: center;
		font: inherit;
	}
	h1 span {
		padding: 0 12px;
		background: #aaa;
		color: #0000aa;
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
		list-style: none;
	}
	li {
		display: flex;
	}
	li::before {
		content: '*';
		flex: 0 0 3ch;
	}
	.buttons {
		margin-top: 18px;
		display: flex;
		justify-content: center;
		gap: 28px;
	}
	button {
		min-height: 44px;
		padding: 2px 22px;
		border: 0;
		background: #aaa;
		color: #0000aa;
		font: inherit;
		cursor: pointer;
	}
	button:hover,
	button:focus {
		background: #fff;
	}
	button:focus {
		outline: 2px dashed #fff;
		outline-offset: 4px;
	}
	.continue {
		text-align: center;
	}
	.cursor {
		animation: blink 1s steps(1) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	.taps {
		display: none;
	}
	/* phones have no keys to press */
	@media (max-width: 900px) {
		.bsod {
			font-size: 22px;
		}
		.screen {
			gap: 24px;
		}
		.keys {
			display: none;
		}
		.taps {
			display: inline;
		}
		.buttons {
			margin-top: 12px;
			gap: 20px;
		}
		button {
			min-width: 120px;
			padding: 2px 16px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cursor {
			animation: none;
		}
	}
</style>
