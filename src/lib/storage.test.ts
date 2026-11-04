import { afterEach, describe, expect, it, vi } from 'vitest';
import { listEntries, moveOldKeys } from './storage';

// just enough of localStorage for moveOldKeys
function fakeStorage(entries: Record<string, string>) {
	const items = new Map(Object.entries(entries));
	return {
		items,
		get length() {
			return items.size;
		},
		key: (i: number) => [...items.keys()][i] ?? null,
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('moveOldKeys', () => {
	it('moves everything saved under the old name', () => {
		const storage = fakeStorage({
			'soundcloud-heardle:glaive:stats:v1': '{"played":3}',
			'soundcloud-heardle:favorites': '[]',
			'something-else': 'leave me'
		});
		vi.stubGlobal('localStorage', storage);
		moveOldKeys();
		expect(Object.fromEntries(storage.items)).toEqual({
			'mp3dle:glaive:stats:v1': '{"played":3}',
			'mp3dle:favorites': '[]',
			'something-else': 'leave me'
		});
	});

	it("doesn't overwrite something already saved under the new name", () => {
		const storage = fakeStorage({
			'soundcloud-heardle:theme': 'dark',
			'mp3dle:theme': 'light'
		});
		vi.stubGlobal('localStorage', storage);
		moveOldKeys();
		expect(Object.fromEntries(storage.items)).toEqual({ 'mp3dle:theme': 'light' });
	});

	it('does nothing when storage is off', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(() => moveOldKeys()).not.toThrow();
	});
});

describe('listEntries', () => {
	it('lists only matching keys and preserves empty values', () => {
		vi.stubGlobal(
			'localStorage',
			fakeStorage({
				'mp3dle:theme': 'dark',
				'mp3dle:favorites': '',
				'other:theme': 'light'
			})
		);
		expect(listEntries('mp3dle:')).toEqual([
			['mp3dle:theme', 'dark'],
			['mp3dle:favorites', '']
		]);
	});

	it('discards a partial listing if storage throws', () => {
		const storage = fakeStorage({ 'mp3dle:theme': 'dark', 'mp3dle:volume': '80' });
		vi.stubGlobal('localStorage', {
			...storage,
			getItem: (key: string) => {
				if (key === 'mp3dle:volume') throw new Error('storage unavailable');
				return storage.getItem(key);
			}
		});
		expect(listEntries('mp3dle:')).toEqual([]);
	});

	it('returns an empty list when storage is unavailable', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(listEntries('mp3dle:')).toEqual([]);
	});
});
