import path from 'path';
import url from 'url';
import fs from 'fs';
import type { ServeOptions } from 'bun';

import { renderToReadableStream } from 'react-dom/server';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const PROJECT_ROOT = path.dirname(__dirname);
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, 'public');
const BUILD_DIR = path.resolve(PROJECT_ROOT, '.build');

const srcRouter = new Bun.FileSystemRouter({
  dir: path.join(__dirname, './pages'),
  style: 'nextjs',
});

async function browserRebuild() {
  await Bun.build({
    entrypoints: [
      path.join(__dirname, '/hydrate.tsx'),
      ...Object.values(srcRouter.routes),
    ],
    outdir: BUILD_DIR,
    target: 'browser',
    splitting: true,
  });
}

await browserRebuild();

const buildRouter = new Bun.FileSystemRouter({
  dir: path.join(BUILD_DIR, '/pages'),
  style: 'nextjs',
});

function serveFromDir(config: {
  directory: string;
  path: string;
}): Response | null {
  let basePath = path.join(config.directory, config.path);
  const suffixes = ['', '.html', 'index.html'];

  for (const suffix of suffixes) {
    try {
      const pathWithSuffix = path.join(basePath, suffix);
      const stat = fs.statSync(pathWithSuffix);
      if (stat && stat.isFile()) {
        return new Response(Bun.file(pathWithSuffix));
      }
    } catch (err) { }
  }

  return null;
}

export default {
  async fetch(request) {
    const match = srcRouter.match(request);
    if (match) {
      const builtMatch = buildRouter.match(request);
      if (!builtMatch) {
        return new Response('Unknown error', { status: 500 });
      }

      const Component = await import(match.filePath);
      const stream = await renderToReadableStream(<Component.default />, {
        bootstrapScriptContent: `globalThis.PATH_TO_PAGE = "/${builtMatch.src}";`,
        bootstrapModules: ['/hydrate.js'],
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    let reqPath = new URL(request.url).pathname;
    console.log(request.method, reqPath);
    if (reqPath === '/') reqPath = '/index.html';

    // check public
    const publicResponse = serveFromDir({
      directory: PUBLIC_DIR,
      path: reqPath,
    });
    if (publicResponse) return publicResponse;

    // check built assets
    const buildResponse = serveFromDir({ directory: BUILD_DIR, path: reqPath });
    if (buildResponse) return buildResponse;
    const pagesResponse = serveFromDir({
      directory: BUILD_DIR + '/pages',
      path: reqPath,
    });
    if (pagesResponse) return pagesResponse;

    return new Response('File not found', {
      status: 404,
    });
  },
} satisfies ServeOptions;
