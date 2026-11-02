<script lang="ts">
	import '../app.css';
</script>

<svelte:head>
	<title>SoundCloud Heardle</title>
	<meta
		name="description"
		content="Search for any public SoundCloud artist and guess their daily track from progressively longer clips."
	/>
	<meta name="theme-color" content="#1f3561" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="SoundCloud Heardle" />
	<meta property="og:title" content="SoundCloud Heardle" />
	<meta
		property="og:description"
		content="Search for an artist and play a daily Heardle from their public original tracks."
	/>
	<meta name="twitter:card" content="summary" />
</svelte:head>

<slot />
