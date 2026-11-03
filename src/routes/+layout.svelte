<script lang="ts">
	import '../app.css';
</script>

<svelte:head>
	<title>mp3dle</title>
	<meta
		name="description"
		content="Search for any public SoundCloud artist and guess their daily track from progressively longer clips."
	/>
	<meta name="theme-color" content="#1f3561" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="mp3dle" />
	<meta property="og:title" content="mp3dle" />
	<meta
		property="og:description"
		content="Search for an artist and guess a daily song from their public original tracks."
	/>
	<meta name="twitter:card" content="summary" />
</svelte:head>

<slot />
