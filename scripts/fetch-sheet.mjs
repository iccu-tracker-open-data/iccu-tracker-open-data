import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshot, normalizeString, parseCsv, resolveGoogleSheetCsvUrl } from "../lib/incidents-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultSourcePath = path.join(projectRoot, "data", "incidents-empty-template.csv");
const outputPath = path.join(projectRoot, "data", "incidents.generated.json");

async function readBundledCsv(filePath = defaultSourcePath) {
  return {
    text: await readFile(filePath, "utf8"),
    source: {
      type: "local-file",
      path: path.relative(projectRoot, filePath),
    },
  };
}

async function readSource() {
  const explicitFile = normalizeString(process.env.ICCU_SOURCE_CSV);
  if (explicitFile) {
    return readBundledCsv(path.resolve(projectRoot, explicitFile));
  }

  const sheetCsvUrl = resolveGoogleSheetCsvUrl({
    explicitCsvUrl: process.env.GOOGLE_SHEET_CSV_URL,
    sheetUrl: process.env.GOOGLE_SHEET_URL,
    gid: process.env.GOOGLE_SHEET_GID,
  });

  if (sheetCsvUrl) {
    const response = await fetch(sheetCsvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet CSV: ${response.status} ${response.statusText}`);
    }
    return {
      text: await response.text(),
      source: {
        type: "google-sheet",
        url: sheetCsvUrl,
      },
    };
  }

  return readBundledCsv();
}

async function readExistingSnapshot() {
  try {
    const raw = await readFile(outputPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  let snapshot;

  try {
    const { text, source } = await readSource();
    const rows = parseCsv(text);
    snapshot = buildSnapshot(rows, source);
  } catch (error) {
    const existingSnapshot = await readExistingSnapshot();
    if (existingSnapshot) {
      console.warn(
        `Refresh failed, keeping existing ${path.relative(projectRoot, outputPath)} snapshot: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    console.warn(
      `Refresh failed and no existing snapshot was found, using ${path.relative(projectRoot, defaultSourcePath)}.`,
    );
    const fallbackSource = await readBundledCsv();
    snapshot = buildSnapshot(parseCsv(fallbackSource.text), fallbackSource.source);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  console.log(`Wrote ${snapshot.meta.publishedRows} incidents to ${path.relative(projectRoot, outputPath)}`);
  console.log(`Source: ${JSON.stringify(snapshot.meta.source)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
