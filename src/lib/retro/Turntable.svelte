<script lang="ts">
	export let spinning = false;
	export let artwork = '';
	export let label = '?';
</script>

<div class="panel-wrap" aria-hidden="true">
	<div class="panel">
		<div class="platter-ring"></div>
		<div class="record" class:spinning>
			<div class="record-label">
				{#if artwork}
					<img src={artwork} alt="" />
				{:else}
					{label}
				{/if}
			</div>
			<div class="record-hole"></div>
		</div>
		<svg class="tonearm" class:on-record={spinning} width="62" height="148" viewBox="0 0 62 148">
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
				x="12"
				y="116"
				width="15"
				height="9"
				rx="1"
				transform="rotate(-48 19 120)"
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
		transform: rotate(-6deg);
		transition: transform 300ms;
	}
	.tonearm.on-record {
		transform: rotate(14deg);
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
	.record {
		animation: spin 1.8s linear infinite paused;
	}
	.record.spinning {
		animation-play-state: running;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.record {
			animation: none;
		}
	}
</style>
