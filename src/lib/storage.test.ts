import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveOldKeys } from './storage';

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
