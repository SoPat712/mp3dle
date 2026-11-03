import { load, save } from '#lib/storage.js';

export type Favorite = {
	username: string;
	permalink: string;
	avatarUrl?: string;
};

const FAVORITES_KEY = 'soundcloud-heardle:favorites';

// someone could have edited this by hand, so only keep entries that make sense
export function parseFavorites(saved: string | null): Favorite[] {
	try {
		const list = JSON.parse(saved ?? '[]');
		if (!Array.isArray(list)) return [];
		return list
			.filter((item) => typeof item?.username === 'string' && typeof item?.permalink === 'string')
			.map(({ username, permalink, avatarUrl }) => ({
				username,
				permalink,
				avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : undefined
			}));
	} catch {
		return [];
	}
}

export function loadFavorites() {
	return parseFavorites(load(FAVORITES_KEY));
}

export function saveFavorites(favorites: Favorite[]) {
	save(FAVORITES_KEY, JSON.stringify(favorites));
}
