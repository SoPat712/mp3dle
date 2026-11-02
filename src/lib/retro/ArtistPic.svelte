<script lang="ts">
	export let username: string;
	export let avatarUrl: string | undefined = undefined;
	export let size = 36;

	const colors = ['#0f6e9c', '#c43a84', '#33373d'];

	// avatar links go stale when an artist changes their picture
	let broken = false;
	$: color = colors[username.length % colors.length];
</script>

{#if avatarUrl && !broken}
	<img
		class="pic"
		src={avatarUrl}
		alt=""
		style:width="{size}px"
		style:height="{size}px"
		on:error={() => (broken = true)}
	/>
{:else}
	<span
		class="pic"
		aria-hidden="true"
		style:width="{size}px"
		style:height="{size}px"
		style:background={color}
	>
		{username.slice(0, 1).toUpperCase()}
	</span>
{/if}

<style>
	.pic {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		object-fit: cover;
		font-weight: bold;
		text-shadow: none;
		color: #fff;
	}
</style>
