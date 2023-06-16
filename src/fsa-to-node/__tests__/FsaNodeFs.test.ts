import { IFsWithVolume, NestedDirectoryJSON, memfs } from '../..';
import { nodeToFsa } from '../../node-to-fsa';
import { IDirent } from '../../node/types/misc';
import { FsaNodeFs } from '../FsaNodeFs';

const setup = (json: NestedDirectoryJSON | null = null) => {
  const mfs = memfs({ mountpoint: json }) as IFsWithVolume;
  const dir = nodeToFsa(mfs, '/mountpoint', { mode: 'readwrite', syncHandleAllowed: true });
  const fs = new FsaNodeFs(dir);
  return { fs, mfs, dir };
};

describe('.mkdir()', () => {
  test('can create a sub-folder', async () => {
    const { fs, mfs } = setup();
    await new Promise<void>((resolve, reject) =>
      fs.mkdir('/test', err => {
        if (err) return reject(err);
        return resolve();
      }),
    );
    expect(mfs.statSync('/mountpoint/test').isDirectory()).toBe(true);
  });

  test('throws when creating sub-sub-folder', async () => {
    const { fs } = setup();
    try {
      await new Promise<void>((resolve, reject) =>
        fs.mkdir('/test/subtest', err => {
          if (err) return reject(err);
          return resolve();
        }),
      );
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOENT');
    }
  });

  test('can create sub-sub-folder with "recursive" flag', async () => {
    const { fs, mfs } = setup();
    await new Promise<void>((resolve, reject) =>
      fs.mkdir('/test/subtest', { recursive: true }, err => {
        if (err) return reject(err);
        return resolve();
      }),
    );
    expect(mfs.statSync('/mountpoint/test/subtest').isDirectory()).toBe(true);
  });

  test('can create sub-sub-folder with "recursive" flag with Promises API', async () => {
    const { fs, mfs } = setup();
    await fs.promises.mkdir('/test/subtest', { recursive: true });
    expect(mfs.statSync('/mountpoint/test/subtest').isDirectory()).toBe(true);
  });

  test('cannot create a folder over a file', async () => {
    const { fs } = setup({ file: 'test' });
    try {
      await fs.promises.mkdir('/file/folder', { recursive: true });
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOTDIR');
    }
  });
});

describe('.mkdtemp()', () => {
  test('can create a temporary folder', async () => {
    const { fs, mfs } = setup();
    const dirname = (await fs.promises.mkdtemp('prefix--')) as string;
    expect(dirname.startsWith('prefix--')).toBe(true);
    expect(mfs.statSync('/mountpoint/' + dirname).isDirectory()).toBe(true);
  });
});

describe('.rmdir()', () => {
  test('can remove an empty folder', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    await fs.promises.rmdir('/empty-folder');
    expect(mfs.__vol.toJSON()).toStrictEqual({ '/mountpoint/folder/file': 'test' });
  });

  test('throws when attempts to remove non-empty folder', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    try {
      await fs.promises.rmdir('/folder');
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOTEMPTY');
      expect(mfs.__vol.toJSON()).toStrictEqual({
        '/mountpoint/folder/file': 'test',
        '/mountpoint/empty-folder': null,
      });
    }
  });

  test('can remove non-empty directory recursively', async () => {
    const { fs, mfs } = setup({ folder: { subfolder: { file: 'test' } }, 'empty-folder': null });
    await fs.promises.rmdir('/folder', { recursive: true });
    expect(mfs.__vol.toJSON()).toStrictEqual({
      '/mountpoint/empty-folder': null,
    });
  });
});

describe('.rm()', () => {
  test('can remove an empty folder', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    await fs.promises.rm('/empty-folder');
    expect(mfs.__vol.toJSON()).toStrictEqual({ '/mountpoint/folder/file': 'test' });
  });

  test('throws when attempts to remove non-empty folder', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    try {
      await fs.promises.rm('/folder');
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOTEMPTY');
      expect(mfs.__vol.toJSON()).toStrictEqual({
        '/mountpoint/folder/file': 'test',
        '/mountpoint/empty-folder': null,
      });
    }
  });

  test('can remove non-empty directory recursively', async () => {
    const { fs, mfs } = setup({ folder: { subfolder: { file: 'test' } }, 'empty-folder': null });
    await fs.promises.rm('/folder', { recursive: true });
    expect(mfs.__vol.toJSON()).toStrictEqual({
      '/mountpoint/empty-folder': null,
    });
  });

  test('throws if path does not exist', async () => {
    const { fs, mfs } = setup({ folder: { subfolder: { file: 'test' } }, 'empty-folder': null });
    try {
      await fs.promises.rm('/lala/lulu', { recursive: true });
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOENT');
      expect(mfs.__vol.toJSON()).toStrictEqual({
        '/mountpoint/folder/subfolder/file': 'test',
        '/mountpoint/empty-folder': null,
      });
    }
  });

  test('does not throw, if path does not exist, but "force" flag set', async () => {
    const { fs } = setup({ folder: { subfolder: { file: 'test' } }, 'empty-folder': null });
    await fs.promises.rm('/lala/lulu', { recursive: true, force: true });
  });
});

describe('.unlink()', () => {
  test('can remove a file', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const res = await fs.promises.unlink('/folder/file');
    expect(res).toBe(undefined);
    expect(mfs.__vol.toJSON()).toStrictEqual({
      '/mountpoint/folder': null,
      '/mountpoint/empty-folder': null,
    });
  });

  test('cannot delete a folder', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    try {
      await fs.promises.unlink('/folder');
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('EISDIR');
      expect(mfs.__vol.toJSON()).toStrictEqual({
        '/mountpoint/folder/file': 'test',
        '/mountpoint/empty-folder': null,
      });
    }
  });

  test('throws when deleting non-existing file', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    try {
      await fs.promises.unlink('/folder/not-a-file');
      throw new Error('Expected error');
    } catch (error) {
      expect(error.code).toBe('ENOENT');
      expect(mfs.__vol.toJSON()).toStrictEqual({
        '/mountpoint/folder/file': 'test',
        '/mountpoint/empty-folder': null,
      });
    }
  });
});

describe('.readFile()', () => {
  test('can read file contents', async () => {
    const { fs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const data = await fs.promises.readFile('/folder/file');
    expect(data.toString()).toBe('test');
  });

  test('can read file by file handle', async () => {
    const { fs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const handle = await fs.promises.open('/folder/file');
    expect(typeof handle).toBe('object');
    const data = await fs.promises.readFile(handle);
    expect(data.toString()).toBe('test');
  });

  test('can read file by file descriptor', async () => {
    const { fs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const fd = await new Promise<number>(resolve => {
      fs.open('/folder/file', 'r', (err, fd) => resolve(fd!));
    });
    expect(typeof fd).toBe('number');
    const data = await new Promise<string>(resolve => {
      fs.readFile(fd, { encoding: 'utf8' }, (err, data) => resolve(data as string));
    });
    expect(data).toBe('test');
  });

  test('cannot read from closed file descriptor', async () => {
    const { fs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const fd = await new Promise<number>(resolve => {
      fs.open('/folder/file', 'r', (err, fd) => resolve(fd!));
    });
    expect(typeof fd).toBe('number');
    await new Promise<void>(resolve => {
      fs.close(fd, () => resolve());
    });
    try {
      await new Promise<string>((resolve, reject) => {
        fs.readFile(fd, { encoding: 'utf8' }, (err, data) => reject(err));
      });
      throw new Error('Expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('EBADF');
    }
  });
});

describe('.truncate()', () => {
  test('can truncate a file', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const res = await new Promise<unknown>((resolve, reject) => {
      fs.truncate('/folder/file', 2, (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(res).toBe(undefined);
    expect(mfs.readFileSync('/mountpoint/folder/file', 'utf8')).toBe('te');
  });
});

describe('.ftruncate()', () => {
  test('can truncate a file', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null });
    const handle = await fs.promises.open('/folder/file');
    const res = await new Promise<unknown>((resolve, reject) => {
      fs.ftruncate(handle.fd, 3, (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(res).toBe(undefined);
    expect(mfs.readFileSync('/mountpoint/folder/file', 'utf8')).toBe('tes');
  });
});

describe('.readdir()', () => {
  test('can read directory contents as strings', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null, 'f.html': 'test' });
    const res = (await fs.promises.readdir('/')) as string[];
    expect(res.length).toBe(3);
    expect(res.includes('folder')).toBe(true);
    expect(res.includes('empty-folder')).toBe(true);
    expect(res.includes('f.html')).toBe(true);
  });

  test('can read directory contents with "withFileTypes" flag set', async () => {
    const { fs, mfs } = setup({ folder: { file: 'test' }, 'empty-folder': null, 'f.html': 'test' });
    const list = (await fs.promises.readdir('/', { withFileTypes: true })) as IDirent[];
    expect(list.length).toBe(3);
    const names = list.map(item => item.name);
    expect(names).toStrictEqual(['empty-folder', 'f.html', 'folder']);
    expect(list.find(item => item.name === 'folder')?.isDirectory()).toBe(true);
    expect(list.find(item => item.name === 'empty-folder')?.isDirectory()).toBe(true);
    expect(list.find(item => item.name === 'f.html')?.isFile()).toBe(true);
    expect(list.find(item => item.name === 'f.html')?.isDirectory()).toBe(false);
  });
});

describe('.appendFile()', () => {
  test('can create a file', async () => {
    const { fs, mfs } = setup({});
    await fs.promises.appendFile('/test.txt', 'a');
    expect(mfs.readFileSync('/mountpoint/test.txt', 'utf8')).toBe('a');
  });

  test('can append to a file', async () => {
    const { fs, mfs } = setup({});
    await fs.promises.appendFile('/test.txt', 'a');
    await fs.promises.appendFile('/test.txt', 'b');
    expect(mfs.readFileSync('/mountpoint/test.txt', 'utf8')).toBe('ab');
  });

  test('can append to a file - 2', async () => {
    const { fs, mfs } = setup({ file: '123' });
    await fs.promises.appendFile('file', 'x');
    expect(mfs.readFileSync('/mountpoint/file', 'utf8')).toBe('123x');
  });
});
