import fs from 'fs';
import type { FSWatcher, WatchListener } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const PROJECT_ROOT = path.dirname(__dirname);
export const SRC_DIR = path.join(PROJECT_ROOT, "src");
export const PAGES_DIR = path.join(SRC_DIR, "pages");
export const COMPONENTS_DIR = path.join(SRC_DIR, "components");
export const PUBLIC_DIR = path.resolve(PROJECT_ROOT, 'public');
export const BUILD_DIR = path.resolve(PROJECT_ROOT, '.build');

export const srcRouter = new Bun.FileSystemRouter({
  dir: path.join(__dirname, './pages'),
  style: 'nextjs',
});

export const buildRouter = new Bun.FileSystemRouter({
  dir: path.join(BUILD_DIR, '/pages'),
  style: 'nextjs',
});

export async function rebuild() {
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

const watchCallback: WatchListener<string> = (event) => {
  if (event === 'change' || event === 'rename') {
    rebuild().then(() => {
      console.log('rebuild success');
    }).catch(err => {
      console.error('rebuild failed:', err);
    });
  }
};

const watchOptions = {
  recursive: true,
};

let pagesWatcher: FSWatcher
let componentsWatcher: FSWatcher
export async function devWatcher() {
  await rebuild();

  pagesWatcher = fs.watch(PAGES_DIR, watchOptions, watchCallback);
  componentsWatcher = fs.watch(COMPONENTS_DIR, watchOptions, watchCallback);
}
