import { spawn } from "node:child_process";
import type { ResolveVerseMcpOptions } from "./verse-mcp-locator.ts";
import { getPathCommandCandidates, pathExists } from "./verse-mcp-locator.ts";

export interface PythonCommand {
  command: string;
  args: string[];
  source: string;
}

export interface PythonStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  found: boolean;
  version?: string;
  command?: PythonCommand;
  checked: string[];
  message: string;
}

export interface ProbePythonOptions extends ResolveVerseMcpOptions {
  getVersion?: (command: PythonCommand) => Promise<string | undefined>;
}

const MIN_PYTHON_MAJOR = 3;
const MIN_PYTHON_MINOR = 10;

interface PythonCandidateSpec {
  name: string;
  args: string[];
}

function getPythonCandidateSpecs(platform: NodeJS.Platform): PythonCandidateSpec[] {
  const common: PythonCandidateSpec[] = [
    { name: "python", args: [] },
    { name: "python3", args: [] },
  ];

  if (platform === "win32") {
    return [{ name: "py", args: ["-3"] }, ...common];
  }

  return common;
}

function parsePythonVersion(versionText: string): { major: number; minor: number; patch: number; raw: string } | undefined {
  const match = versionText.match(/Python\s+(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return undefined;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

export async function runPythonVersion(command: PythonCommand): Promise<string | undefined> {
  return await new Promise<string | undefined>((resolve) => {
    const child = spawn(command.command, [...command.args, "--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let output = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.on("error", () => resolve(undefined));
    child.on("exit", () => resolve(output.trim() || undefined));
  });
}

export async function probePythonRuntime(options: ProbePythonOptions = {}): Promise<PythonStatus> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? pathExists;
  const getVersion = options.getVersion ?? runPythonVersion;
  const checked: string[] = [];

  for (const spec of getPythonCandidateSpecs(platform)) {
    const candidates = getPathCommandCandidates(spec.name, platform, env);
    checked.push(...candidates);

    for (const candidate of candidates) {
      if (!(await exists(candidate))) continue;

      const command: PythonCommand = {
        command: candidate,
        args: spec.args,
        source: `PATH:${spec.name}`,
      };

      const versionText = await getVersion(command);
      const version = versionText ? parsePythonVersion(versionText) : undefined;
      if (!version) {
        return {
          supported: false,
          platform,
          found: true,
          command,
          checked,
          message: `Found Python launcher at ${candidate}, but could not determine the version.`,
        };
      }

      const supported = version.major > MIN_PYTHON_MAJOR || (version.major === MIN_PYTHON_MAJOR && version.minor >= MIN_PYTHON_MINOR);
      return {
        supported,
        platform,
        found: true,
        version: version.raw,
        command,
        checked,
        message: supported
          ? `Found Python ${version.raw} at ${candidate}`
          : `Found Python ${version.raw} at ${candidate}, but verse-mcp requires Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+`,
      };
    }
  }

  return {
    supported: false,
    platform,
    found: false,
    checked,
    message: `Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+ was not found on PATH. Install from https://www.python.org/downloads/`,
  };
}
