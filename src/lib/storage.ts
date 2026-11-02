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
