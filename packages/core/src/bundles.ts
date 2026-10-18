import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { get, put } from "@vercel/blob";
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

export async function loadBundle(key: string): Promise<AppBundle | null> {
  try {
    if (useBlob()) {
      const result = await get(key, { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      return (await new Response(result.stream).json()) as AppBundle;
    }
    return JSON.parse(await readFile(join(localDataDir(), "bundles", key), "utf8")) as AppBundle;
  } catch {
    return null;
  }
}
