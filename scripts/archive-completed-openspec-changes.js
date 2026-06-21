#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();
const changesDir = join(root, "openspec", "changes");
const dryRun = process.argv.includes("--dry-run");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function taskState(tasksPath) {
  const lines = readFileSync(tasksPath, "utf8").split(/\r?\n/);
  const boxes = lines
    .map((line) => line.match(/^\s*-\s+\[([ xX])\]/))
    .filter(Boolean)
    .map((match) => match[1]);

  return {
    hasTasks: boxes.length > 0,
    complete: boxes.length > 0 && boxes.every((box) => box.toLowerCase() === "x"),
  };
}

if (!existsSync(changesDir)) {
  console.log("No openspec/changes directory found.");
  process.exit(0);
}

const completedChanges = readdirSync(changesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "archive")
  .map((entry) => entry.name)
  .filter((change) => {
    const tasksPath = join(changesDir, change, "tasks.md");

    if (!existsSync(tasksPath)) {
      return false;
    }

    const state = taskState(tasksPath);
    return state.hasTasks && state.complete;
  });

if (completedChanges.length === 0) {
  console.log("No completed OpenSpec changes found.");
  process.exit(0);
}

console.log(`Completed OpenSpec changes: ${completedChanges.join(", ")}`);

if (dryRun) {
  process.exit(0);
}

for (const change of completedChanges) {
  run("openspec", ["archive", change, "--yes"]);
}

run("openspec", ["validate", "--all", "--strict", "--no-interactive"]);
