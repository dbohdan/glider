// Serves a directory over HTTP for trying the build locally. Usage: node tools/serve.ts <dir> [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.bin': 'application/octet-stream',
	'.rsrc': 'application/octet-stream',
};

function main(root: string, port: number): void {
	createServer((req, res) => {
		const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
		const file = join(root, path.endsWith('/') ? join(path, 'index.html') : path);
		readFile(file)
			.then((body) => {
				res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
				res.end(body);
			})
			.catch(() => {
				res.writeHead(404);
				res.end('not found');
			});
	}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}/`));
}

if (import.meta.main) {
	main(process.argv[2] ?? 'dist', Number(process.argv[3] ?? 8000));
}
