import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
import {
  behaviorAssertions,
  EXTENSION_LOAD_ERROR_PATTERN,
  parseJsonLines,
  SDK_NAMES,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";
import { redactRepositoryRootPaths, serializeRedactedReport, smokeReportPath } from "./pi-sdk-smoke-report.mjs";

const root = resolve(import.meta.dirname, "..");
const reportPath = smokeReportPath(root, process.argv.includes("--update-curated-report"));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(root, "package.json"));
const expectedVersions = Object.fromEntries(SDK_NAMES.map((name) => [name, "1.1.0"]));
const sdkVersions = Object.fromEntries(SDK_NAMES.map((name) => [
  name,
  readJson(resolve(root, "node_modules", name, "package.json")).version,
]));

for (const name of SDK_NAMES) {
  if (manifest.devDependencies?.[name] !== expectedVersions[name] || sdkVersions[name] !== expectedVersions[name]) {
    throw new Error(`Smoke requires the exact Pi SDK 1.1.0 dev/test pin for ${name}; manifest=${manifest.devDependencies?.[name]}, installed=${sdkVersions[name]}`);
  }
}

const piManifest = readJson(resolve(root, "node_modules/@earendil-works/pi-coding-agent/package.json"));
const piCli = resolve(root, "node_modules/@earendil-works/pi-coding-agent", piManifest.bin.pi);
const tempDir = mkdtempSync(resolve(tmpdir(), "pi-verse-docs-sdk-smoke-"));
const binDir = resolve(tempDir, "bin");
const agentDir = resolve(tempDir, "agent");
mkdirSync(binDir, { recursive: true });
const serverPath = resolve(binDir, "server.cjs");
const serverSource = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "pi-verse-docs-smoke-fixture", version: "1.0.0" } } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "search_verse_docs") {
    const query = message.params.arguments?.query;
    if (query === "smoke-error") {
      console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "controlled smoke error" } }));
      return;
    }
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "SMOKE_RESULT:decides — deterministic offline Verse docs fixture" }] } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;
writeFileSync(serverPath, serverSource, "utf8");

const mcpCommand = process.platform === "win32" ? resolve(binDir, "verse-mcp.cmd") : resolve(binDir, "verse-mcp");
if (process.platform === "win32") {
  writeFileSync(mcpCommand, '@echo off\r\nnode "%~dp0server.cjs"\r\n', "utf8");
} else {
  writeFileSync(mcpCommand, "#!/usr/bin/env node\nrequire('./server.cjs');\n", "utf8");
  chmodSync(mcpCommand, 0o755);
}

const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/(API_KEY|TOKEN|OAUTH|BEARER)/i.test(name)) delete env[name];
}
env.PI_CODING_AGENT_DIR = agentDir;
env.PI_OFFLINE = "1";
env.PI_TELEMETRY = "0";
env.VERSE_MCP_CACHE_DIR = resolve(tempDir, "cache");
env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ""}`;

const rpcArgs = [piCli, "--offline", "--no-session", "--no-tools", "--no-extensions", "--no-skills",
  "--no-context-files", "-e", ".", "--mode", "rpc"];
const request = (type, fields = {}) => JSON.stringify({ type, ...fields });
function notification(responses, prefix) {
  return responses.find((row) => row?.type === "extension_ui_request" && row.method === "notify" &&
    typeof row.message === "string" && row.message.includes(prefix));
}

function runPi(name, query) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, rpcArgs, { cwd: root, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let responses = [];
    let promptSent = false;
    let inputEnded = false;
    let runError = "";
    let finished = false;
    let cleanupTimer;

    const endInput = () => {
      if (inputEnded) return;
      inputEnded = true;
      child.stdin.end();
    };

    const finish = (exitCode, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadlineTimer);
      clearTimeout(cleanupTimer);
      const fullOutput = `${stdout}${stderr}${runError ? `\n${runError}` : ""}`;
      const assertions = behaviorAssertions(name, {
        responses,
        fullOutput,
        exit_code: exitCode ?? 1,
        expectedVersion: sdkVersions["@earendil-works/pi-coding-agent"],
      });
      const hasUnhandledError = UNHANDLED_ERROR_PATTERN.test(fullOutput);
      const hasLoadError = EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput);
      resolveRun({
        name,
        command: "npm run smoke:pi",
        exit_code: exitCode ?? 1,
        passed: exitCode === 0 && !signal && !runError && !hasUnhandledError && !hasLoadError && assertions.every((item) => item.passed),
        evidence: redactRepositoryRootPaths(fullOutput.slice(-6000) || "No output captured", root),
        assertions,
        hasUnhandledError,
        hasLoadError,
      });
    };

    const timeoutPi = () => {
      runError = "Pi RPC exceeded its 15000ms deadline; shutdown could not be confirmed.";
      child.kill();
      cleanupTimer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(null, "deadline");
      }, 1000);
    };
    const deadlineTimer = setTimeout(timeoutPi, 15_000);

    const checkCompletion = () => {
      if (name === "extension_load") {
        if (responses.some((row) => row?.command === "get_commands" && row.success === true)) endInput();
        return;
      }
      const commands = responses.find((row) => row?.command === "get_commands" && row.success === true);
      if (!promptSent && commands) {
        const command = commands.data?.commands?.find((item) => item.name === "verse-docs:search" && item.source === "extension");
        if (!command) {
          runError = "Pi did not register verse-docs:search in the live extension list.";
          endInput();
          return;
        }
        promptSent = true;
        child.stdin.write(`${request("prompt", { message: `/verse-docs:search ${query}` })}\n`);
      }
      const promptResponse = responses.find((row) => row?.type === "response" && row.command === "prompt");
      if (promptResponse && (promptResponse.success !== true || promptResponse.data?.disposition !== "handled")) {
        runError = "Pi did not handle the registered Verse docs slash command.";
        endInput();
      } else if (name === "happy_path" && promptResponse && notification(responses, "SMOKE_RESULT:decides")) {
        endInput();
      } else if (name === "error_path" && promptResponse && notification(responses, "verse-mcp search_verse_docs failed: MCP error -32000: controlled smoke error")) {
        endInput();
      } else if (name === "reload_cleanup" && promptResponse && notification(responses, "SMOKE_RESULT:decides")) {
        endInput();
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      stdoutBuffer += chunk;
      while (true) {
        const newline = stdoutBuffer.indexOf("\n");
        if (newline < 0) break;
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (!line) continue;
        try {
          responses.push(JSON.parse(line));
        } catch {
          // Non-protocol output is retained in evidence but cannot satisfy an assertion.
        }
        checkCompletion();
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { runError = `Failed to start actual Pi process: ${error.message}`; });
    child.on("close", finish);
    child.stdin.write(`${request("get_commands")}\n`);
  });
}

function runHostShell(shell, args) {
  const result = spawnSync(shell, args, {
    cwd: root, env, encoding: "utf8", timeout: 15_000, windowsHide: true,
  });
  const fullOutput = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
  const exit_code = result.status ?? 1;
  const assertions = behaviorAssertions("host_shell", {
    responses: [], fullOutput, exit_code, expectedVersion: sdkVersions["@earendil-works/pi-coding-agent"],
  });
  return {
    name: "host_shell",
    command: "npm run smoke:pi",
    exit_code,
    passed: exit_code === 0 && !result.error && assertions.every((item) => item.passed),
    evidence: redactRepositoryRootPaths(fullOutput.slice(-6000) || "No output captured", root),
    assertions,
    hasUnhandledError: false,
    hasLoadError: false,
  };
}

try {
  const cases = [
    await runPi("extension_load"),
    await runPi("happy_path", "decides"),
    await runPi("error_path", "smoke-error"),
    await runPi("reload_cleanup", "decides"),
  ];

  const expectedVersion = sdkVersions["@earendil-works/pi-coding-agent"];
  if (process.platform === "win32") {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const shell = resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    cases.push(runHostShell(shell, ["-NoProfile", "-NonInteractive", "-Command",
      `& ${quote(process.execPath)} ${quote(piCli)} --no-extensions --version; exit $LASTEXITCODE`]));
  } else {
    cases.push(runHostShell("/bin/sh", ["-c", '"$1" "$2" --no-extensions --version',
      "pi-host-shell", process.execPath, piCli]));
  }

  const report = {
    schema_version: 1,
    verification_contract: VERIFICATION_CONTRACT,
    sdk_versions: sdkVersions,
    platform: process.platform,
    model_inference: "none; actual Pi extension and command use a deterministic offline MCP stdio fixture",
    unhandled_errors: cases.filter((item) => item.hasUnhandledError).length,
    extension_load_errors: cases.filter((item) => item.hasLoadError || (item.name === "extension_load" && !item.passed)).length,
    cases: cases.map(({ hasUnhandledError, hasLoadError, ...item }) => item),
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${serializeRedactedReport(report, root)}\n`, "utf8");
  console.log(JSON.stringify({ verification_contract: VERIFICATION_CONTRACT, platform: process.platform,
    cases: cases.map(({ name, passed, exit_code }) => ({ name, passed, exit_code })) }));
  if (cases.some((item) => !item.passed)) process.exitCode = 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
