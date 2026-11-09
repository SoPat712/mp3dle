import { describe, expect, it } from 'vitest';
import { isOwnError, isRestartKey } from './crash';

const origin = 'https://mp3dle.joshpatra.me';

function errorFrom(file: string, message = 'boom') {
	const error = new Error(message);
	error.stack = `Error: ${message}\n    at click (${file}:1:200)`;
	return error;
}

describe('isOwnError', () => {
	it('counts an error thrown in our own code', () => {
		expect(isOwnError(errorFrom(`${origin}/_app/immutable/nodes/2.abc.js`), origin)).toBe(true);
	});

	it('counts a firefox style stack from our code', () => {
		const error = new Error('boom');
		error.stack = `click@${origin}/_app/immutable/nodes/2.abc.js:1:200`;
		expect(isOwnError(error, origin)).toBe(true);
	});

	it('counts a soundcloud error when our code made the call', () => {
		const error = new Error("Cannot read properties of null (reading 'postMessage')");
		error.stack = `TypeError: ${error.message}\n    at y (https://w.soundcloud.com/player/api.js:1:1571)\n    at pause (${origin}/_app/immutable/nodes/2.abc.js:1:33587)`;
		expect(isOwnError(error, origin)).toBe(true);
	});

	it('falls back to the file when there is no stack', () => {
		expect(isOwnError('thrown string', origin, `${origin}/_app/immutable/nodes/2.abc.js`)).toBe(
			true
		);
	});

	it("ignores other sites' scripts", () => {
		expect(isOwnError(errorFrom('https://w.soundcloud.com/player/api.js'), origin)).toBe(false);
	});

	it('ignores browser extensions', () => {
		expect(isOwnError(errorFrom('moz-extension://1234/background.js'), origin)).toBe(false);
	});

	it('ignores cross origin script errors with nothing to go on', () => {
		expect(isOwnError(null, origin, '')).toBe(false);
	});

	it('ignores cancelled requests', () => {
		const error = new DOMException('signal is aborted without reason', 'AbortError');
		expect(isOwnError(error, origin, `${origin}/_app/immutable/nodes/2.abc.js`)).toBe(false);
	});

	it('ignores navigations a newer one replaced', () => {
		const file = `${origin}/_app/immutable/entry/start.abc.js`;
		expect(isOwnError(errorFrom(file, 'navigation aborted'), origin)).toBe(false);
		expect(isOwnError(errorFrom(file, 'navigation cancelled'), origin)).toBe(false);
	});

	it("doesn't match an origin that only starts the same", () => {
		expect(isOwnError(errorFrom(`${origin}.evil.example/x.js`), origin)).toBe(false);
	});
});

describe('isRestartKey', () => {
	const key = (key: string, mods: Partial<KeyboardEvent> = {}) => ({
		key,
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		...mods
	});

	it('restarts on an ordinary key', () => {
		expect(isRestartKey(key('a'))).toBe(true);
		expect(isRestartKey(key('ArrowDown'))).toBe(true);
	});

	it('leaves tab, enter and space to the buttons', () => {
		expect(isRestartKey(key('Tab'))).toBe(false);
		expect(isRestartKey(key('Enter'))).toBe(false);
		expect(isRestartKey(key(' '))).toBe(false);
	});

	it('leaves escape to the desktop button', () => {
		expect(isRestartKey(key('Escape'))).toBe(false);
	});

	it('ignores modifiers on their own and shortcuts', () => {
		expect(isRestartKey(key('Shift'))).toBe(false);
		expect(isRestartKey(key('Meta'))).toBe(false);
		expect(isRestartKey(key('c', { metaKey: true }))).toBe(false);
		expect(isRestartKey(key('c', { ctrlKey: true }))).toBe(false);
		expect(isRestartKey(key('Tab', { altKey: true }))).toBe(false);
	});
});
