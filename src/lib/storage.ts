// localstorage can throw (private mode etc), and that should never break the game

export function load(key: string) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function save(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// oh well, it just won't be remembered
	}
}

export function remove(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// same as above
	}
}

// the app used to be called soundcloud heardle. move anything saved under the old name over, once
const OLD_PREFIX = 'soundcloud-heardle:';

export function moveOldKeys() {
	try {
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
		for (const key of keys) {
			if (!key.startsWith(OLD_PREFIX)) continue;
			const newKey = `mp3dle:${key.slice(OLD_PREFIX.length)}`;
			if (localStorage.getItem(newKey) === null) {
				localStorage.setItem(newKey, localStorage.getItem(key) ?? '');
			}
			localStorage.removeItem(key);
		}
	} catch {
		// private mode or full storage, the old keys just stay where they are
	}
}
