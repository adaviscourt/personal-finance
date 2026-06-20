import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const repoRoot = join(projectRoot, "..");
const port = Number(process.env.PR_SCREENSHOT_PORT ?? 4177);
const apiPort = Number(process.env.PR_SCREENSHOT_API_PORT ?? 4178);
const appUrl = `http://127.0.0.1:${port}`;
const branchName = getGitOutput(["branch", "--show-current"]);
const branchSlug = (branchName || "detached").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "detached";
const trackedOutput = branchName && !["main", "master"].includes(branchName);
const configuredOutputDir = process.env.PR_SCREENSHOT_OUTPUT_DIR;
const outDir = configuredOutputDir
  ? join(repoRoot, configuredOutputDir)
  : trackedOutput
    ? join(repoRoot, "docs", "pr-screenshots", branchSlug)
    : join(projectRoot, ".pr-screenshots", new Date().toISOString().replace(/[:.]/g, "-"));
const publicBaseUrl = process.env.PR_SCREENSHOT_BASE_URL?.replace(/\/+$/, "") ?? getPublicBaseUrl();

const routes = [
  { path: "/", name: "dashboard" },
  { path: "/import", name: "import" },
  { path: "/labeling", name: "labeling" },
  { path: "/accounts", name: "accounts" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 900 },
];

const apiFixtures = {
  "/health": { status: "ok", database: "ok" },
  "/accounts": [
    { id: 1, name: "Checking", institution: "Local Bank", account_type: "checking", created_at: "2026-01-01T00:00:00Z", transaction_count: 124 },
    { id: 2, name: "Credit Card", institution: "Local Bank", account_type: "credit", created_at: "2026-01-01T00:00:00Z", transaction_count: 88 },
  ],
  "/labels": [
    { id: 1, name: "Groceries", slug: "groceries" },
    { id: 2, name: "Utilities", slug: "utilities" },
    { id: 3, name: "Dining", slug: "dining" },
  ],
  "/transaction-label-rules": [
    { id: 1, match_field: "description", pattern: "market", label_id: 1, label_slug: "groceries", label_name: "Groceries", created_at: "2026-01-01T00:00:00Z" },
    { id: 2, match_field: "merchant", pattern: "electric", label_id: 2, label_slug: "utilities", label_name: "Utilities", created_at: "2026-01-01T00:00:00Z" },
  ],
  "/import-templates": [
    { id: 1, name: "Local Bank CSV", account_id: 1, config: { mappings: {} }, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ],
  "/dashboard/spending-by-label": {
    month: "2026-06",
    labels: [
      { label_slug: "groceries", label_name: "Groceries", amount: "412.18", transaction_count: 12 },
      { label_slug: "utilities", label_name: "Utilities", amount: "186.44", transaction_count: 4 },
      { label_slug: "dining", label_name: "Dining", amount: "143.90", transaction_count: 7 },
    ],
  },
  "/dashboard/transactions": {
    month: "2026-06",
    transactions: [
      { id: 1, transaction_date: "2026-06-02", description: "Neighborhood Market", merchant: "Neighborhood Market", amount: "84.21", direction: "debit", account: { id: 1, name: "Checking" }, label: { id: 1, name: "Groceries", slug: "groceries" }, source_type: null, source_category: null, check_number: null },
      { id: 2, transaction_date: "2026-06-05", description: "Electric Utility", merchant: "Electric Utility", amount: "126.10", direction: "debit", account: { id: 1, name: "Checking" }, label: { id: 2, name: "Utilities", slug: "utilities" }, source_type: null, source_category: null, check_number: null },
    ],
  },
};

function startStaticApi() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${apiPort}`);
    const body = apiFixtures[url.pathname] ?? {};
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify(body));
  });

  return new Promise((resolve) => {
    server.listen(apiPort, "127.0.0.1", () => resolve(server));
  });
}

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: projectRoot,
    env: { ...process.env, VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}` },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForApp() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${appUrl}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
      }
    });
  });
}

function getGitOutput(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function getGitHubRepo() {
  const remote = getGitOutput(["config", "--get", "remote.origin.url"]);
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match?.[1] ?? "";
}

function getPublicBaseUrl() {
  if (!trackedOutput) {
    return "";
  }
  const repo = getGitHubRepo();
  if (!repo || !branchName) {
    return "";
  }
  const relativeOutDir = relative(repoRoot, outDir).replaceAll("\\", "/");
  return `https://raw.githubusercontent.com/${repo}/${branchName}/${relativeOutDir}`;
}

function formatScreenshotPath(filePath) {
  const pathFromOutDir = relative(outDir, filePath).replaceAll("\\", "/");
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${pathFromOutDir}`;
  }
  return relative(repoRoot, filePath).replaceAll("\\", "/");
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) {
      throw error;
    }
    console.log("PR_SCREENSHOTS installing chromium");
    await run("npx", ["playwright", "install", "chromium"]);
    return chromium.launch();
  }
}

await mkdir(outDir, { recursive: true });
const api = await startStaticApi();
const vite = startVite();

try {
  await waitForApp();
  const browser = await launchChromium();
  const files = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    for (const route of routes) {
      await page.goto(`${appUrl}${route.path}`, { waitUntil: "networkidle" });
      const filePath = join(outDir, `${route.name}-${viewport.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      files.push(filePath);
    }
    await page.close();
  }

  await browser.close();
  const formattedFiles = files.map(formatScreenshotPath);
  const markdown = files.map((file, index) => {
    const route = routes[index % routes.length].name;
    const viewport = viewports[Math.floor(index / routes.length)].name;
    return `![${route} ${viewport}](${formattedFiles[index]})`;
  });
  await writeFile(join(outDir, "README.md"), markdown.join("\n\n") + "\n");

  console.log("PR_SCREENSHOTS ok");
  console.log(`PR_SCREENSHOTS dir ${relative(repoRoot, outDir).replaceAll("\\", "/")}`);
  console.log("PR_SCREENSHOTS_MARKDOWN_BEGIN");
  for (const line of markdown) {
    console.log(line);
  }
  console.log("PR_SCREENSHOTS_MARKDOWN_END");
  for (const file of formattedFiles) {
    console.log(file);
  }
} finally {
  vite.kill("SIGTERM");
  api.close();
}
