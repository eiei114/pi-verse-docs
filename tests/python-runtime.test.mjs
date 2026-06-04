import assert from "node:assert/strict";
import test from "node:test";

const { probePythonRuntime } = await import("../lib/python-runtime.ts");

test("probePythonRuntime reports supported Python 3.12 on Windows", async () => {
  const status = await probePythonRuntime({
    platform: "win32",
    env: {
      PATH: "C:\\Windows;C:\\Python312",
      PATHEXT: ".EXE;.CMD",
    },
    exists: async (path) => path === "C:\\Windows\\py.exe",
    getVersion: async () => "Python 3.12.4",
  });

  assert.equal(status.found, true);
  assert.equal(status.supported, true);
  assert.equal(status.version, "3.12.4");
  assert.equal(status.command?.command, "C:\\Windows\\py.exe");
  assert.deepEqual(status.command?.args, ["-3"]);
});

test("probePythonRuntime reports unsupported Python 3.9", async () => {
  const status = await probePythonRuntime({
    platform: "darwin",
    env: {
      PATH: "/usr/bin:/opt/homebrew/bin",
    },
    exists: async (path) => path === "/usr/bin/python3",
    getVersion: async () => "Python 3.9.6",
  });

  assert.equal(status.found, true);
  assert.equal(status.supported, false);
  assert.match(status.message, /requires Python 3.10\+/i);
});

test("probePythonRuntime reports missing Python with install guidance", async () => {
  const status = await probePythonRuntime({
    platform: "linux",
    env: {
      PATH: "/usr/bin:/bin",
    },
    exists: async () => false,
  });

  assert.equal(status.found, false);
  assert.equal(status.supported, false);
  assert.match(status.message, /python\.org\/downloads/i);
});
