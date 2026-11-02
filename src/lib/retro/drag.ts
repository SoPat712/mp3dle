type DragOptions = {
	enabled: boolean;
	getPosition: () => { x: number; y: number };
	onMove: (x: number, y: number) => void;
};

// put this on a title bar to drag the window around
export function dragHandle(bar: HTMLElement, startingOptions: DragOptions) {
	let options = startingOptions;
	let dragging = false;
	let offsetX = 0;
	let offsetY = 0;

	function down(event: PointerEvent) {
		if (!options.enabled || event.button !== 0) return;
		// the close and minimise buttons live on the bar too
		if ((event.target as Element).closest('button')) return;

		const { x, y } = options.getPosition();
		offsetX = event.clientX - x;
		offsetY = event.clientY - y;
		dragging = true;
		bar.setPointerCapture(event.pointerId);
	}

	function move(event: PointerEvent) {
		if (dragging) options.onMove(event.clientX - offsetX, event.clientY - offsetY);
	}

	function up() {
		dragging = false;
	}

	bar.addEventListener('pointerdown', down);
	bar.addEventListener('pointermove', move);
	bar.addEventListener('pointerup', up);
	bar.addEventListener('pointercancel', up);

	return {
		update(newOptions: DragOptions) {
			options = newOptions;
		},
		destroy() {
			bar.removeEventListener('pointerdown', down);
			bar.removeEventListener('pointermove', move);
			bar.removeEventListener('pointerup', up);
			bar.removeEventListener('pointercancel', up);
		}
	};
}
