export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_NAMES = [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
];
export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

export function parseJsonLines(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function registeredCommand(responses) {
  const result = responses.find((row) => row?.command === "get_commands" && row.success === true);
  return result?.data?.commands?.find((command) => command.name === "verse-docs:search" && command.source === "extension");
}

function promptResponse(responses) {
  return responses.find((row) => row?.type === "response" && row.command === "prompt");
}

function notification(responses, prefix) {
  return responses.find(
    (row) => row?.type === "extension_ui_request" && row.method === "notify" &&
      typeof row.message === "string" && row.message.includes(prefix),
  );
}

export function behaviorAssertions(name, { responses = [], processes, fullOutput, exit_code, expectedVersion }) {
  const command = registeredCommand(responses);
  const prompt = promptResponse(responses);
  if (name === "extension_load") {
    return [assertion("extension_registered", "Actual Pi lists verse-docs:search as a registered extension command", command ?? null, !!command)];
  }
  if (name === "happy_path") {
    const result = notification(responses, "SMOKE_RESULT:decides");
    return [assertion("feature_response", "The actual Verse docs command returns its deterministic offline MCP result", {
      command: command ?? null, prompt: prompt ?? null, result: result ?? null,
    }, !!command && prompt?.success === true && prompt.data?.disposition === "handled" && !!result)];
  }
  if (name === "error_path") {
    const error = notification(responses, "verse-mcp search_verse_docs failed: MCP error -32000: controlled smoke error");
    return [assertion("handled_error", "An MCP failure is surfaced as an error notification while Pi handles the command", {
      command: command ?? null, prompt: prompt ?? null, error: error ?? null,
    }, !!command && prompt?.success === true && prompt.data?.disposition === "handled" && !!error)];
  }
  if (name === "reload_cleanup") {
    const firstProcess = processes?.[0];
    const secondProcess = processes?.[1];
    const processObservation = (process) => {
      if (!process) return null;
      const command = registeredCommand(process.responses);
      const prompt = promptResponse(process.responses);
      const result = notification(process.responses, "SMOKE_RESULT:decides");
      return {
        command: command ?? null,
        prompt: prompt ?? null,
        result: result ?? null,
        exit_code: process.exit_code,
        signal: process.signal ?? null,
        run_error: process.runError ?? null,
        errors: UNHANDLED_ERROR_PATTERN.test(process.fullOutput ?? ""),
      };
    };
    const first = processObservation(firstProcess);
    const second = processObservation(secondProcess);
    const hasFeatureResponse = (process) => {
      const prompt = promptResponse(process?.responses ?? []);
      return !!registeredCommand(process?.responses ?? []) &&
        prompt?.success === true && prompt.data?.disposition === "handled" &&
        !!notification(process?.responses ?? [], "SMOKE_RESULT:decides");
    };
    const allProcessesClean = processes?.length === 2 && processes.every((process) =>
      process.exit_code === 0 && !process.signal && !process.runError &&
      !UNHANDLED_ERROR_PATTERN.test(process.fullOutput ?? ""));
    return [
      assertion("reloaded_extension_registered", "After the first Pi process exits, a second actual Pi process registers verse-docs:search", {
        process_count: processes?.length ?? 0,
        first_command: first?.command ?? null,
        second_command: second?.command ?? null,
      }, !!first?.command && !!second?.command),
      assertion("reloaded_feature_response", "Both actual Pi processes handle the Verse docs command and return its MCP result, including the restarted second process", {
        first,
        second,
      }, hasFeatureResponse(firstProcess) && hasFeatureResponse(secondProcess)),
      assertion("clean_shutdown", "Both sequential Pi hosts exit successfully without unhandled or shutdown errors", {
        processes: processes?.map((process) => ({ exit_code: process.exit_code, signal: process.signal ?? null,
          run_error: process.runError ?? null, errors: UNHANDLED_ERROR_PATTERN.test(process.fullOutput ?? "") })) ?? [],
      }, allProcessesClean),
    ];
  }
  if (name === "host_shell") {
    return [assertion("native_shell_boundary", "The native host shell launches the locally pinned Pi CLI and returns its exact version", {
      exit_code, output: fullOutput.trim(), expectedVersion,
    }, exit_code === 0 && fullOutput.trim() === expectedVersion)];
  }
  throw new Error(`Unknown smoke case: ${name}`);
}
