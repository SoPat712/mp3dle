// only mp3dle's own code crashing is worth a blue screen. other sites' scripts, extensions,
// cancelled requests and navigations that a newer one replaced are just noise
export function isOwnError(error: unknown, origin: string, file = '') {
	if (error instanceof DOMException && error.name === 'AbortError') return false;
	const message = error instanceof Error ? error.message : '';
	if (/^navigation (aborted|cancelled)$/.test(message)) return false;
	const stack = error instanceof Error ? (error.stack ?? '') : '';
	return `${stack}\n${file}`.includes(`${origin}/`);
}

type Key = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

// the old "press any key". tab, enter and space work the buttons, escape is the desktop,
// and shortcuts like copy still do what they normally do
export function isRestartKey({ key, metaKey, ctrlKey, altKey }: Key) {
	if (metaKey || ctrlKey || altKey) return false;
	return !['Tab', 'Enter', ' ', 'Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(
		key
	);
}
