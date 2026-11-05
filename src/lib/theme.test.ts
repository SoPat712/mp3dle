import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme } from './theme';

describe('parseTheme', () => {
	it('reads a saved light theme', () => {
		expect(parseTheme('light')).toBe('light');
	});

	it('reads a saved dark theme', () => {
		expect(parseTheme('dark')).toBe('dark');
	});

	it('starts on auto when nothing is saved', () => {
		expect(parseTheme(null)).toBe('auto');
	});

	it('ignores junk', () => {
		expect(parseTheme('garbage')).toBe('auto');
	});
});

describe('nextTheme', () => {
	it('cycles from auto to light to dark and back', () => {
		const light = nextTheme('auto');
		expect(light).toBe('light');
		const dark = nextTheme(light);
		expect(dark).toBe('dark');
		expect(nextTheme(dark)).toBe('auto');
	});
});
