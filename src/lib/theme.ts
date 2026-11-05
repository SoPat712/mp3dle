export type Theme = 'auto' | 'light' | 'dark';

export function parseTheme(saved: string | null): Theme {
	return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

export function nextTheme(theme: Theme): Theme {
	return theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
}
