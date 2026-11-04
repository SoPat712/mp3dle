<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	export let spinning = false;
	export let artwork = '';
	export let label = '?';
	export let position = 0;
	export let length = 0;

	let mounted = false;
	let reducedMotion = false;
	let displayedPosition = 0;
	let anchorPosition = 0;
	let anchorTime = 0;
	let frame: number | undefined;

	function stopAnimation() {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
	}

	function animate(now: number) {
		displayedPosition = anchorPosition + (now - anchorTime);
		frame = requestAnimationFrame(animate);
	}

	function updateMotion(
		position: number,
		spinning: boolean,
		reducedMotion: boolean,
		mounted: boolean
	) {
		if (!mounted || !spinning || reducedMotion) {
			stopAnimation();
			displayedPosition = position;
			return;
		}

		const now = performance.now();
		const predicted = anchorPosition + (now - anchorTime);
		// keep small timing corrections from nudging the record backwards
		anchorPosition =
			frame === undefined || Math.abs(predicted - position) > 300 ? position : predicted;
		anchorTime = now;
		displayedPosition = anchorPosition;
		if (frame === undefined) frame = requestAnimationFrame(animate);
	}

	$: updateMotion(position, spinning, reducedMotion, mounted);
	// 33 1/3 rpm is 200 degrees a second
	$: recordAngle = displayedPosition * 0.2;
	$: progress = length > 0 ? Math.max(0, Math.min(position / length, 1)) : 0;
	$: tonearmAngle = !spinning && position === 0 ? -6 : 3.4 + (26.4 - 3.4) * progress;

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateReducedMotion = () => (reducedMotion = media.matches);
		updateReducedMotion();
		media.addEventListener('change', updateReducedMotion);
		mounted = true;
		return () => media.removeEventListener('change', updateReducedMotion);
	});

	onDestroy(stopAnimation);
</script>

<div class="panel-wrap" aria-hidden="true">
	<div class="panel">
		<div class="platter-ring"></div>
		<div class="record" style:transform={`rotate(${recordAngle}deg)`}>
			<div class="record-label">
				{#if artwork}
					<img src={artwork} alt="" />
				{:else}
					{label}
				{/if}
			</div>
			<div class="record-hole"></div>
		</div>
		<svg
			class="tonearm"
			style:transform={`rotate(${tonearmAngle}deg)`}
			width="62"
			height="148"
			viewBox="0 0 62 148"
		>
			<circle cx="44" cy="18" r="11" fill="#5f646c" stroke="#22262c" />
			<circle cx="44" cy="18" r="4" fill="#15171a" />
			<path
				d="M44 18 L48 92 L22 122"
				fill="none"
				stroke="#22262c"
				stroke-width="6"
				stroke-linecap="round"
			/>
			<path
				d="M44 18 L48 92 L22 122"
				fill="none"
				stroke="#e8eaed"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<rect
				x="14.5"
				y="117.5"
				width="15"
				height="9"
				rx="1"
				transform="rotate(-49 22 122)"
				fill="#c43a84"
				stroke="#22262c"
			/>
		</svg>
	</div>
</div>

<style>
	.panel-wrap {
		flex-shrink: 0;
		width: 168px;
		height: 150px;
	}
	.panel {
		position: relative;
		width: 168px;
		height: 150px;
		transform-origin: 0 0;
		overflow: hidden;
		border: 1px solid #5f646c;
		border-radius: 3px;
		background:
			repeating-linear-gradient(
				0deg,
				rgb(255 255 255 / 30%) 0 1px,
				rgb(0 0 0 / 4%) 1px 2px,
				transparent 2px 3px
			),
			linear-gradient(180deg, #e8eaed, #b4b9c0);
		box-shadow: inset 0 1px 0 #fff;
	}
	.platter-ring {
		position: absolute;
		left: 3px;
		top: 1px;
		width: 146px;
		height: 146px;
		border-radius: 50%;
		background: #8b9099;
		box-shadow:
			inset 0 1px 0 #d7dbe0,
			0 1px 2px rgb(0 0 0 / 45%);
	}
	.record {
		position: absolute;
		left: 6px;
		top: 4px;
		width: 140px;
		height: 140px;
		border-radius: 50%;
		background:
			conic-gradient(
				rgb(255 255 255 / 0%) 0 30deg,
				rgb(255 255 255 / 20%) 52deg,
				rgb(255 255 255 / 0%) 76deg 210deg,
				rgb(255 255 255 / 16%) 232deg,
				rgb(255 255 255 / 0%) 256deg
			),
			repeating-radial-gradient(circle, #33373d 0 1px, #101114 1px 3px);
	}
	.record-label {
		position: absolute;
		inset: 47px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 50%;
		background: #c43a84;
		font:
			bold 15px Arial,
			sans-serif;
		color: #fff;
	}
	.record-label img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.record-hole {
		position: absolute;
		left: 67px;
		top: 67px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #d7dbe0;
	}
	.tonearm {
		position: absolute;
		right: 0;
		top: 0;
		transform-origin: 44px 18px;
		transition: transform 300ms;
	}
	@media (prefers-reduced-motion: reduce) {
		.tonearm {
			transition: none;
		}
	}
	@media (max-width: 900px) {
		.panel-wrap {
			width: 120px;
			height: 107px;
		}
		.panel {
			transform: scale(0.7143);
		}
	}
</style>
