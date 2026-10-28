import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { del, get, put } from "@vercel/blob";
import { localDataDir } from "./db-url";

/**
 * An app bundle is everything the desktop app needs to store and run an app
 * offline: the built `dist/` (served from disk) and the editable source (so
 * the builder can resume editing in a fresh sandbox).
 */
export interface AppBundle {
  appId: string;
  version: number;
  name: string;
  icon: string;
  connectors: string[];
  dataSchema: Record<string, string>;
  /** Built output, path → base64. Entry point is `index.html`. */
  dist: Record<string, string>;
  /** Source files, path → utf8 text. */
  source: Record<string, string>;
  /** Binary source files (images, fonts), path → base64. Missing in bundles made before it existed. */
  assets?: Record<string, string>;
}

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function bundleKey(appId: string, version: number) {
  return `apps/${appId}/v${version}.json`;
}

export async function saveBundle(bundle: AppBundle): Promise<string> {
  const key = bundleKey(bundle.appId, bundle.version);
  const body = JSON.stringify(bundle);
  if (useBlob()) {
    await put(key, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
  } else {
    const path = join(localDataDir(), "bundles", key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  return key;
}

export async function deleteBundles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (useBlob()) {
    await del(keys);
  } else {
    await Promise.all(keys.map((key) => rm(join(localDataDir(), "bundles", key), { force: true })));
  }
}

/** The bundle stored under `key`, or null if there is none. Storage failures throw, so they aren't mistaken for "not built". */
export async function loadBundle(key: string): Promise<AppBundle | null> {
  if (useBlob()) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return (await new Response(result.stream).json()) as AppBundle;
  }
  try {
    return JSON.parse(await readFile(join(localDataDir(), "bundles", key), "utf8")) as AppBundle;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
