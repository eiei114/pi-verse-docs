import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, isAbsolute, posix, win32 } from "node:path";

export interface VerseMcpCommand {
  command: string;
  args: string[];
  source: string;
}

export type VerseMcpResolutionMode = "path" | "uvx";

export interface VerseMcpStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  found: boolean;
  mode?: VerseMcpResolutionMode;
  command?: VerseMcpCommand;
  checked: string[];
  message: string;
}

export interface ResolveVerseMcpOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => Promise<boolean>;
}

const UVX_SOURCE = "git+https://github.com/BurgersJackson/verse-mcp";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizePathEntry(entry: string): string {
  return entry.replace(/^"|"$/g, "").trim();
}

function getPathDirectories(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const rawPath = env.PATH ?? env.Path ?? env.path ?? "";
  if (!rawPath) return [];

  return rawPath
    .split(platform === "win32" ? ";" : ":")
    .map(normalizePathEntry)
    .filter(Boolean);
}

function joinPath(platform: NodeJS.Platform, directory: string, name: string): string {
  return platform === "win32" ? win32.join(directory, name) : posix.join(directory, name);
}

export function getVerseMcpCacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.VERSE_MCP_CACHE_DIR?.trim();
  if (override) return override;

  const baseDir = env.LOCALAPPDATA || env.XDG_CACHE_HOME || joinPath(platform, homedir(), ".cache");
  return joinPath(platform, baseDir, "verse-mcp");
}

function getWindowsPathExtensions(env: NodeJS.ProcessEnv): string[] {
  const rawPathExt = env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";

  return unique(
    rawPathExt
      .split(";")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getExecutableNames(commandName: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform !== "win32") return [commandName];
  if (extname(commandName)) return [commandName];

  const withExt = getWindowsPathExtensions(env).map((ext) => `${commandName}${ext}`);
  return unique([commandName, ...withExt]);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export function getPathCommandCandidates(
  commandName: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const names = getExecutableNames(commandName, platform, env);

  if (isAbsolute(commandName)) return names;

  const directories = getPathDirectories(platform, env);
  return directories.flatMap((directory) => names.map((name) => joinPath(platform, directory, name)));
}

async function resolveCommandOnPath(
  commandName: string,
  options: ResolveVerseMcpOptions,
  checked: string[],
): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? pathExists;
  const candidates = getPathCommandCandidates(commandName, platform, env);

  checked.push(...candidates);

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  return undefined;
}

export async function resolveVerseMcpCommand(options: ResolveVerseMcpOptions = {}): Promise<VerseMcpStatus> {
  const platform = options.platform ?? process.platform;
  const checked: string[] = [];

  const verseMcpPath = await resolveCommandOnPath("verse-mcp", options, checked);
  if (verseMcpPath) {
    return {
      supported: true,
      platform,
      found: true,
      mode: "path",
      command: {
        command: verseMcpPath,
        args: [],
        source: "PATH:verse-mcp",
      },
      checked,
      message: `Found verse-mcp on PATH at ${verseMcpPath}`,
    };
  }

  const uvxPath = await resolveCommandOnPath("uvx", options, checked);
  if (uvxPath) {
    return {
      supported: true,
      platform,
      found: true,
      mode: "uvx",
      command: {
        command: uvxPath,
        args: ["--from", UVX_SOURCE, "verse-mcp"],
        source: "PATH:uvx-fallback",
      },
      checked,
      message: `Found uvx on PATH at ${uvxPath}; using uvx fallback for verse-mcp`,
    };
  }

  return {
    supported: true,
    platform,
    found: false,
    checked,
    message: "verse-mcp was not found on PATH, and uvx fallback is unavailable. Install verse-mcp or uv.",
  };
}

export const VERSE_MCP_UVX_SOURCE = UVX_SOURCE;
