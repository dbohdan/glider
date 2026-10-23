// Serves a directory over HTTP for trying the build locally. Usage: node tools/serve.ts <dir> [port]

import { createServer, type Server } from 'node:http';
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

/** Serves a directory; port 0 takes any free one. */
export function serve(root: string, port: number, address: string, ready?: () => void): Server {
	return createServer((req, res) => {
		const path = normalize(decodeURIComponent(new URL(req.url ?? '/', `http://${address}`).pathname)).replace(/^(\.\.[/\\])+/, '');
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
	}).listen(port, ready); // on every interface, so that phones on the network can play; `address` names it in URLs
}

if (import.meta.main) {
	const [root, port, address] = [process.argv[2] ?? 'dist', Number(process.argv[3] ?? 8000), process.argv[4] ?? 'localhost'];
	serve(root, port, address, () => console.log(`Serving ${root} at http://${address}:${port}/`));
}
