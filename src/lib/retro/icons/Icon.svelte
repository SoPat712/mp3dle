<script lang="ts">
	export let name:
		| 'record'
		| 'folder'
		| 'text'
		| 'sheet'
		| 'practice'
		| 'about'
		| 'jar'
		| 'start'
		| 'speaker'
		| 'close'
		| 'error'
		| 'info'
		| 'play'
		| 'pause'
		| 'bars'
		| 'shortcut';
</script>

{#if name === 'record'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<circle cx="17" cy="17" r="15" fill="#111" />
		<circle cx="17" cy="17" r="11" fill="none" stroke="#3a3a3a" />
		<circle cx="17" cy="17" r="5.5" fill="#127fb3" />
		<circle cx="17" cy="17" r="1.5" fill="#fff" />
	</svg>
{:else if name === 'folder'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<path d="M2 8h11l3 3h16v19H2z" fill="#e8c25a" stroke="#7a5a12" />
		<path d="M2 13h30" stroke="#7a5a12" />
	</svg>
{:else if name === 'text'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<path d="M7 2h15l6 6v24H7z" fill="#fff" stroke="#333" />
		<path d="M11 12h13M11 16h13M11 20h13M11 24h9" stroke="#555" />
	</svg>
{:else if name === 'sheet'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<rect x="4" y="4" width="26" height="26" fill="#fff" stroke="#333" />
		<path d="M9 26V18M15 26V10M21 26V15M26 26V21" stroke="#c43a84" stroke-width="3" />
	</svg>
{:else if name === 'practice'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<circle cx="17" cy="17" r="14" fill="#111" />
		<circle cx="17" cy="17" r="5" fill="#c43a84" />
		<path d="M24 4l6 2-2 6" fill="none" stroke="#fff" stroke-width="2" />
	</svg>
{:else if name === 'about'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<circle cx="17" cy="17" r="14" fill="#127fb3" stroke="#0b4f75" />
		<circle cx="17" cy="10.5" r="2.3" fill="#fff" />
		<path d="M17 15v10" stroke="#fff" stroke-width="4" />
	</svg>
{:else if name === 'jar'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<path d="M9 2h16v6H9z" fill="#111" />
		<path d="M8 8h18l3 4v20H5V12z" fill="#fff" stroke="#333" />
		<circle cx="12" cy="26" r="3.8" fill="#e8c25a" stroke="#7a5a12" />
		<circle cx="22" cy="26" r="3.8" fill="#e8c25a" stroke="#7a5a12" />
		<circle cx="17" cy="19.5" r="3.8" fill="#e8c25a" stroke="#7a5a12" />
	</svg>
{:else if name === 'start'}
	<svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
		<circle cx="9" cy="9" r="8" fill="#111" />
		<circle cx="9" cy="9" r="3" fill="#c43a84" />
	</svg>
{:else if name === 'speaker'}
	<svg aria-hidden="true" width="15" height="13" viewBox="0 0 15 13">
		<path d="M1 4h3l4-3v11L4 9H1z" fill="currentColor" />
		<path d="M10 4c1.5 1.5 1.5 3.5 0 5" fill="none" stroke="currentColor" stroke-width="1.5" />
	</svg>
{:else if name === 'close'}
	<svg aria-hidden="true" width="8" height="7" viewBox="0 0 8 7" shape-rendering="crispEdges">
		<path
			d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z"
			fill="currentColor"
		/>
	</svg>
{:else if name === 'error'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<circle cx="17" cy="17" r="15" fill="#c9342f" stroke="#6b1512" />
		<path d="M11 11l12 12M23 11L11 23" stroke="#fff" stroke-width="4" />
	</svg>
{:else if name === 'info'}
	<svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
		<circle cx="17" cy="17" r="15" fill="#fff" stroke="#0b4f75" stroke-width="2" />
		<path d="M17 15v11M17 9v3" stroke="#0b4f75" stroke-width="4" />
	</svg>
{:else if name === 'play'}
	<svg aria-hidden="true" width="20" height="22" viewBox="0 0 20 22">
		<path d="M4 2 L18 11 L4 20 Z" fill="#fff" stroke="#05324a" />
	</svg>
{:else if name === 'pause'}
	<svg aria-hidden="true" width="20" height="22" viewBox="0 0 20 22">
		<path d="M4 3h4v16H4zM12 3h4v16h-4z" fill="#fff" stroke="#05324a" />
	</svg>
{:else if name === 'bars'}
	<svg aria-hidden="true" width="20" height="18" viewBox="0 0 20 18">
		<path d="M3 17V9M8 17V3M13 17V7M18 17v-5" stroke="#0f6e9c" stroke-width="3" />
	</svg>
{:else if name === 'shortcut'}
	<svg aria-hidden="true" width="13" height="13" viewBox="0 0 13 13">
		<rect x="0.5" y="0.5" width="12" height="12" fill="#fff" stroke="#000" />
		<path d="M3 10c0-4 2-5 5-5M6 2.5L8.5 5 6 7.5" fill="none" stroke="#000" stroke-width="1.5" />
	</svg>
{/if}
