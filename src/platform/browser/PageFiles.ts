// Port: the page's file chooser and downloads, for the desktop's Import Files… and Export Files….

import type { Inflate, Upload } from '../Transfer.ts';

/** Asks the player for files; null if they cancel. Must be called while a click or key is being handled. */
export function pickFiles(): Promise<Upload[] | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.addEventListener('cancel', () => resolve(null));
		input.addEventListener('change', () => {
			const files = [...(input.files ?? [])];
			void Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))).then(resolve);
		});
		input.click();
	});
}

/** Saves bytes as a file in the player's downloads. */
export function download(name: string, bytes: Uint8Array, type: string): void {
	const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Inflates a deflated ZIP member with the browser's DecompressionStream. */
export const inflate: Inflate = async (raw) => {
	const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};
