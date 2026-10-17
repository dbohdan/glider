// Port: Standard File's choosers, as browser dialogs over the program's volume.

import type { GetFileRequest, PutFileRequest, StandardFileHost } from '../../mac/Toolbox.ts';

function dialog(build: (d: HTMLDialogElement, close: (value: string | null) => void) => void): Promise<string | null> {
	return new Promise((resolve) => {
		const d = document.createElement('dialog');
		d.className = 'standard-file';
		let settled = false;
		const close = (value: string | null): void => {
			if (!settled) {
				settled = true;
				d.close();
				d.remove();
				resolve(value);
			}
		};
		d.addEventListener('cancel', (e) => {
			e.preventDefault();
			close(null);
		});
		build(d, close);
		document.body.append(d);
		d.showModal();
	});
}

function button(label: string, onClick: () => void, isDefault = false): HTMLButtonElement {
	const b = document.createElement('button');
	b.type = 'button';
	b.textContent = label;
	if (isDefault) {
		b.classList.add('default');
	}
	b.addEventListener('click', onClick);
	return b;
}

export const browserFilePicker: StandardFileHost = {
	getFile(request: GetFileRequest): Promise<string | null> {
		return dialog((d, close) => {
			const title = document.createElement('p');
			title.textContent = request.title;
			const list = document.createElement('select');
			list.size = 8;
			for (const f of request.files) {
				const o = document.createElement('option');
				o.value = f.name;
				o.textContent = f.name;
				list.append(o);
			}
			if (list.options.length > 0) {
				list.selectedIndex = 0;
			}
			list.addEventListener('dblclick', () => close(list.value || null));
			const buttons = document.createElement('div');
			buttons.className = 'buttons';
			buttons.append(button('Cancel', () => close(null)), button('Open', () => close(list.value || null), true));
			d.append(title, list, buttons);
		});
	},

	putFile(request: PutFileRequest): Promise<string | null> {
		return dialog((d, close) => {
			const label = document.createElement('label');
			label.textContent = request.prompt;
			const input = document.createElement('input');
			input.value = request.defaultName;
			input.maxLength = 31;
			label.append(input);
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					close(input.value);
				}
			});
			const buttons = document.createElement('div');
			buttons.className = 'buttons';
			buttons.append(button('Cancel', () => close(null)), button('Save', () => close(input.value), true));
			d.append(label, buttons);
			queueMicrotask(() => input.focus());
		});
	},
};
