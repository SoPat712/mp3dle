import { parseFavorites } from '#lib/favorites.js';

export type SavedDataGroup = {
	id: 'stats' | 'games' | 'favorites' | 'settings';
	name: string;
	detail: string;
	size: string;
	keys: string[];
};

function formatSize(bytes: number): string {
	if (bytes === 0) return '0 KB';
	if (bytes < 1024) return '<1 KB';
	return `${Math.ceil(bytes / 1024)} KB`;
}

function countLabel(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function summarizeSavedData(entries: [string, string][]): SavedDataGroup[] {
	const groups: Record<SavedDataGroup['id'], [string, string][]> = {
		stats: [],
		games: [],
		favorites: [],
		settings: []
	};
	for (const entry of entries) {
		const [key] = entry;
		if (!key.startsWith('mp3dle:')) continue;
		if (/^mp3dle:[^:]+:stats:v1$/.test(key)) groups.stats.push(entry);
		else if (/^mp3dle:[^:]+:game:[^:]+:[^:]+$/.test(key)) groups.games.push(entry);
		else if (key === 'mp3dle:favorites') groups.favorites.push(entry);
		else if (key === 'mp3dle:theme' || key === 'mp3dle:volume') groups.settings.push(entry);
	}

	const names: Record<SavedDataGroup['id'], string> = {
		stats: 'Stats',
		games: 'Saved rounds',
		favorites: 'Favorites',
		settings: 'Settings'
	};
	return (['stats', 'games', 'favorites', 'settings'] as const).map((id) => {
		const saved = groups[id];
		const keys = saved.map(([key]) => key);
		let detail = 'none';
		if (saved.length > 0) {
			if (id === 'stats') detail = countLabel(saved.length, 'artist');
			else if (id === 'games') detail = countLabel(saved.length, 'round');
			else if (id === 'favorites')
				detail = countLabel(parseFavorites(saved[0][1]).length, 'artist');
			else detail = 'theme, volume';
		}
		return {
			id,
			name: names[id],
			detail,
			size: formatSize(
				saved.reduce((bytes, [key, value]) => bytes + (key.length + value.length) * 2, 0)
			),
			keys
		};
	});
}
