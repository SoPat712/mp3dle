declare global {
	type SoundCloudSound = {
		artwork_url?: string;
	};

	type SoundCloudProgressEvent = {
		currentPosition: number;
	};

	type SoundCloudWidget = {
		bind: (eventName: string, handler: (event?: SoundCloudProgressEvent) => void) => void;
		unbind: (eventName: unknown) => void;
		getDuration: (callback: (duration: number) => void) => void;
		getCurrentSound: (callback: (sound: SoundCloudSound) => void) => void;
		play: () => void;
		pause: () => void;
		seekTo: (milliseconds: number) => void;
		setVolume: (volume: number) => void;
	};

	type SoundCloudApi = {
		Widget: ((element: HTMLIFrameElement) => SoundCloudWidget) & {
			Events: Record<string, string>;
		};
	};

	interface Window {
		SC?: SoundCloudApi;
	}
}

export {};
