import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export class StorageAccessError extends Error {}
export type StoragePrincipal = { id: string };
export type StorageAuthorization = (principal: StoragePrincipal, key: string) => Promise<boolean>;
const KeyPattern = /^[a-f0-9-]{36}\/[a-f0-9-]{36}$/;

/** Private binary store. The authorization callback must query persisted ownership. */
export class LocalPrivateStorage {
  private readonly root: string;
  constructor(root: string, private readonly authorize: StorageAuthorization) {
    this.root = path.resolve(root);
    if (this.root.split(path.sep).some(segment => segment.toLowerCase() === 'public')) throw new Error('Private storage cannot live under public/');
  }
  private async checkedPath(key: string): Promise<string> {
    if (!KeyPattern.test(key)) throw new StorageAccessError('Invalid storage key');
    const target = path.resolve(this.root, ...key.split('/'));
    if (!target.startsWith(this.root + path.sep)) throw new StorageAccessError('Invalid storage path');
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const rootReal = await realpath(this.root);
    const folder = path.dirname(target);
    try {
      if ((await lstat(folder)).isSymbolicLink()) throw new StorageAccessError('Symbolic link rejected');
      const folderReal = await realpath(folder);
      if (!folderReal.startsWith(rootReal + path.sep)) throw new StorageAccessError('Storage directory escaped root');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { if ((await lstat(target)).isSymbolicLink()) throw new StorageAccessError('Symbolic link rejected'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return target;
  }
  async put(principal: StoragePrincipal, bytes: Uint8Array): Promise<string> {
    if (!/^[a-f0-9-]{36}$/.test(principal.id)) throw new StorageAccessError('Authentication required');
    const key = `${principal.id}/${randomUUID()}`;
    const target = await this.checkedPath(key);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    return key;
  }
  private async authorizedPath(principal: StoragePrincipal, key: string): Promise<string> {
    if (!principal?.id || !(await this.authorize(principal, key))) throw new StorageAccessError('File access denied');
    return this.checkedPath(key);
  }
  async read(principal: StoragePrincipal, key: string): Promise<Buffer> { return readFile(await this.authorizedPath(principal, key)); }
  async remove(principal: StoragePrincipal, key: string): Promise<void> { await unlink(await this.authorizedPath(principal, key)); }
  /** Remove a just-uploaded file when parsing fails before its database record exists. */
  async discardUpload(principal: StoragePrincipal, key: string): Promise<void> {
    if (!principal?.id || key.split('/')[0] !== principal.id) throw new StorageAccessError('File access denied');
    await unlink(await this.checkedPath(key));
  }
}
