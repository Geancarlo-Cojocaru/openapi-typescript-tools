import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Returns the directory of the calling file.
 *
 * @param {string} metaUrl - Pass `import.meta.url` from the calling file.
 * @returns {string} Absolute path to the calling file's directory.
 *
 * @example
 * import { getFileDir } from './paths.mjs';
 *
 * const dir = getFileDir(import.meta.url);
 * // => '/home/user/app/src/utils'
 */
export function getFileDir(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl));
}

/**
 * Walks up the directory tree from `startDir` until a `package.json` is found,
 * then returns that directory as the project root.
 * Falls back to `startDir` if no `package.json` is found before the filesystem root.
 *
 * @param {string} [startDir=process.cwd()] - Directory to start walking up from.
 *   Defaults to the current working directory.
 *   Pass `getFileDir(import.meta.url)` to anchor to the calling file instead.
 * @returns {string} Absolute path to the project root directory.
 *
 * @example
 * import { getProjectRoot, getFileDir } from './paths.mjs';
 *
 * // Anchor to cwd (default)
 * const root = getProjectRoot();
 * // => '/home/user/app'
 *
 * // Anchor to the calling file's directory instead
 * const root = getProjectRoot(getFileDir(import.meta.url));
 * // => '/home/user/app'
 */
export function getProjectRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}
