export const defaultGoogleSheetUrl = "";
export const defaultGoogleSheetGid = "0";

export function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) => {
    const record = {};
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]] = cells[i] ?? "";
    }
    return record;
  });
}

export function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeFieldKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const monthNameMap = {
  january: 1,
  feburary: 2,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export function resolveGoogleSheetCsvUrl(options = {}) {
  const explicitCsvUrl = normalizeString(options.explicitCsvUrl);
  if (explicitCsvUrl) {
    return explicitCsvUrl;
  }

  const sheetUrl = normalizeString(options.sheetUrl) || defaultGoogleSheetUrl;
  if (!sheetUrl) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(sheetUrl);
  } catch {
    throw new Error("GOOGLE_SHEET_URL is not a valid URL.");
  }

  const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) {
    throw new Error("GOOGLE_SHEET_URL must be a Google Sheets document URL.");
  }

  const sheetId = match[1];
  const configuredGid = normalizeString(options.gid) || defaultGoogleSheetGid;
  const gid = configuredGid || parsed.searchParams.get("gid") || "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function normalizeNumber(value) {
  const cleaned = normalizeString(value).replace(/[^\d.-]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMonthValue(value) {
  const direct = normalizeNumber(value);
  if (direct && direct >= 1 && direct <= 12) {
    return direct;
  }

  const normalized = normalizeString(value).toLowerCase();
  return monthNameMap[normalized] || null;
}

function normalizeBooleanish(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (["yes", "true", "ja", "y"].includes(normalized)) {
    return "yes";
  }
  if (["no", "false", "nein", "n"].includes(normalized)) {
    return "no";
  }
  return "unknown";
}

function normalizePublicFlag(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getRowValue(row, candidateKeys) {
  for (const key of candidateKeys) {
    if (Object.hasOwn(row, key)) {
      const value = row[key];
      if (normalizeString(value) !== "") {
        return value;
      }
    }
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeFieldKey(key), value]);
  for (const key of candidateKeys) {
    const normalizedCandidate = normalizeFieldKey(key);
    const match = normalizedEntries.find(([normalizedKey, value]) => {
      return normalizedKey === normalizedCandidate && normalizeString(value) !== "";
    });
    if (match) {
      return match[1];
    }
  }

  return "";
}

function extractModelHint(...values) {
  const source = values.map((value) => normalizeString(value)).filter(Boolean).join(" ").toLowerCase();
  if (!source) {
    return "";
  }

  const compact = source.replace(/[^a-z0-9]+/g, "");
  if (compact.includes("ioniq5") || compact.includes("ionq5")) {
    return "ioniq 5";
  }
  if (compact.includes("ioniq6") || compact.includes("ionq6")) {
    return "ioniq 6";
  }
  if (compact.includes("ev6")) {
    return "ev6";
  }

  return "";
}

function normalizeModel(rawModel, rawBrand) {
  const source = `${normalizeString(rawBrand)} ${normalizeString(rawModel)}`.toLowerCase();
  const compact = source.replace(/[^a-z0-9]+/g, "");

  if (source.includes("ioniq 5") || compact.includes("ioniq5") || compact.includes("ionq5")) {
    return { brand: "Hyundai", model: "Ioniq 5" };
  }
  if (source.includes("ioniq 6") || compact.includes("ioniq6") || compact.includes("ionq6")) {
    return { brand: "Hyundai", model: "Ioniq 6" };
  }
  if (compact.includes("ev6")) {
    return { brand: "Kia", model: "EV6" };
  }

  return {
    brand: normalizeString(rawBrand) || "Unknown",
    model: normalizeString(rawModel) || "Unknown",
  };
}

function inferFailureDateParts(row) {
  const rawDate = normalizeString(row.failure_date);
  const rawMonth = normalizeNumber(row.failure_month);
  const rawYear = normalizeNumber(row.failure_year);
  const precision = normalizeString(row.failure_date_precision) || "unknown";

  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return {
      failureDate: rawDate,
      failureYear: Number(rawDate.slice(0, 4)),
      failureMonth: Number(rawDate.slice(5, 7)),
      failureDatePrecision: precision === "unknown" ? "day_exact" : precision,
    };
  }

  if (rawDate && /^\d{4}-\d{2}$/.test(rawDate)) {
    return {
      failureDate: `${rawDate}-01`,
      failureYear: Number(rawDate.slice(0, 4)),
      failureMonth: Number(rawDate.slice(5, 7)),
      failureDatePrecision: precision === "unknown" ? "month_only" : precision,
    };
  }

  if (rawDate && /^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
    const [, day, month, year] = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) || [];
    return {
      failureDate: `${year}-${month}-${day}`,
      failureYear: Number(year),
      failureMonth: Number(month),
      failureDatePrecision: precision === "unknown" ? "day_exact" : precision,
    };
  }

  if (rawDate && /^\d{2}\/\d{4}$/.test(rawDate)) {
    const [, month, year] = rawDate.match(/^(\d{2})\/(\d{4})$/) || [];
    return {
      failureDate: `${year}-${month}-01`,
      failureYear: Number(year),
      failureMonth: Number(month),
      failureDatePrecision: precision === "unknown" ? "month_only" : precision,
    };
  }

  if (rawYear && rawMonth) {
    return {
      failureDate: `${String(rawYear).padStart(4, "0")}-${String(rawMonth).padStart(2, "0")}-01`,
      failureYear: rawYear,
      failureMonth: rawMonth,
      failureDatePrecision: precision === "unknown" ? "month_only" : precision,
    };
  }

  return {
    failureDate: null,
    failureYear: rawYear,
    failureMonth: rawMonth,
    failureDatePrecision: precision,
  };
}

function kmBucket(km) {
  if (km == null) {
    return "unknown";
  }
  if (km < 10000) return "0-9,999";
  if (km < 20000) return "10,000-19,999";
  if (km < 30000) return "20,000-29,999";
  if (km < 40000) return "30,000-39,999";
  if (km < 50000) return "40,000-49,999";
  if (km < 60000) return "50,000-59,999";
  if (km < 80000) return "60,000-79,999";
  return "80,000+";
}

function ageBucket(buildYear, failureYear) {
  if (!buildYear || !failureYear) {
    return "unknown";
  }
  const age = Math.max(0, failureYear - buildYear);
  if (age === 0) return "<1 year";
  if (age === 1) return "1 year";
  if (age === 2) return "2 years";
  if (age === 3) return "3 years";
  return "4+ years";
}

function formatBuildCohort(buildYear, buildMonth) {
  if (!buildYear && !buildMonth) {
    return "unknown";
  }
  if (buildYear && buildMonth) {
    return `${buildYear}-${String(buildMonth).padStart(2, "0")}`;
  }
  if (buildYear) {
    return String(buildYear);
  }
  return `month-${String(buildMonth).padStart(2, "0")}`;
}

function parseMultiValueField(value) {
  return normalizeString(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInputRow(row) {
  const model = getRowValue(row, ["model", "Vehicle model"]);
  const noteModelHint = extractModelHint(
    model,
    row["Additional notes"],
    row["Additional notes (optional, public)"],
    row["Public notes"],
    row.public_comment,
    row.moderation_notes,
  );

  const km = normalizeNumber(
    getRowValue(row, [
      "odometer_km_at_failure",
      "Kilometers at failure (or skip to miles question)",
      "Kilometers at failure",
      "Kilometers",
    ]),
  );
  const miles = normalizeNumber(
    getRowValue(row, [
      "odometer_miles_at_failure",
      "Miles at failure  (or skip to kilometers question)",
      "Miles at failure (or skip to kilometers question)",
      "Miles at failure",
      "Miles",
    ]),
  );
  const permission = normalizeBooleanish(row["Permission to publish anonymized data"] || row.privacy_consent);
  const visibility =
    normalizeString(row.visibility) ||
    (permission === "yes" ? "anonymous_public" : permission === "no" ? "private" : "anonymous_public");
  const explicitPublicFlag = normalizeString(row.public || row.Public);
  const publishFlag = explicitPublicFlag || (permission === "yes" ? "yes" : permission === "no" ? "no" : "");

  return {
    ...row,
    submission_id: row.submission_id || row["Zeitstempel"] || row.Timestamp || "",
    model: normalizeString(model) || noteModelHint,
    brand: row.brand || "",
    region: row.region || row["Region"] || row["Region / Market"] || "",
    production_year_if_known: row.production_year_if_known || row["Build year"] || row.model_year || "",
    production_month_if_known: row.production_month_if_known || row["Build month"] || "",
    odometer_km_at_failure: km ?? (miles != null ? Math.round(miles * 1.60934) : null),
    failure_date: row.failure_date || row["Failure date or month"] || row["Approximately failure date or month"] || "",
    recall_41d033_done:
      row.recall_41d033_done || row["Was 41D033 (ICCU recall campaign) already installed before the failure?"] || "",
    visibility,
    privacy_consent: row.privacy_consent || row["Permission to publish anonymized data"] || "",
    public_comment: row.public_comment || row["Public notes"] || "",
    moderation_notes: row.moderation_notes || row["Additional notes"] || row["Additional notes (optional, public)"] || "",
    incident_sequence: row.incident_sequence || row["ICCU broken for the ... time:"] || row["ICCU issue for the ... time:"] || "",
    public: publishFlag,
    status: row.status || "pending",
    source_type: row.source_type || "sheet",
  };
}

function normalizeIncident(row, index) {
  const normalizedRow = normalizeInputRow(row);
  const incidentSequence = normalizeNumber(normalizedRow.incident_sequence) || 1;
  const visibility = normalizeString(normalizedRow.visibility) || "anonymous_public";
  const status = normalizeString(normalizedRow.status) || "pending";
  const publicFlag = normalizeString(normalizedRow.public);
  const isPublic = normalizePublicFlag(publicFlag);
  const modelInfo = normalizeModel(normalizedRow.model, normalizedRow.brand);
  const buildYear = normalizeNumber(normalizedRow.production_year_if_known || normalizedRow.model_year);
  const buildMonth = normalizeMonthValue(normalizedRow.production_month_if_known);
  const km = normalizeNumber(normalizedRow.odometer_km_at_failure);
  const { failureDate, failureYear, failureMonth, failureDatePrecision } = inferFailureDateParts(normalizedRow);
  const recall41d033 = normalizeBooleanish(normalizedRow.recall_41d033_done);
  const repeatedBefore = normalizeBooleanish(normalizedRow.replaced_iccu_before) === "yes";
  const failureMode =
    normalizeString(normalizedRow.failure_mode) || (incidentSequence > 1 ? "repeat_iccu_failure" : "full_iccu_failure");
  const publicComment = normalizeString(normalizedRow.public_comment);

  return {
    incidentSequence,
    status,
    visibility,
    sourceType: normalizeString(normalizedRow.source_type) || "sheet",
    hasPublishPermissionField: normalizeString(normalizedRow.privacy_consent) !== "",
    brand: modelInfo.brand,
    model: modelInfo.model,
    region: normalizeString(normalizedRow.region) || "unknown",
    batteryKwhNominal: normalizeNumber(normalizedRow.battery_kwh_nominal),
    buildYear,
    buildMonth,
    buildCohort: formatBuildCohort(buildYear, buildMonth),
    odometerKmAtFailure: km,
    failureDate,
    failureDatePrecision,
    failureYear,
    failureMonth,
    failureMode,
    failureSymptoms: parseMultiValueField(normalizedRow.failure_symptoms),
    chargingStateAtFailure: normalizeString(normalizedRow.charging_state_at_failure) || "unknown",
    recall41d033Done: recall41d033,
    daysSince41d033: normalizeNumber(normalizedRow.days_since_41d033),
    previousIccuFailureCount:
      normalizeNumber(normalizedRow.previous_iccu_failure_count) || (repeatedBefore ? incidentSequence - 1 : 0),
    publicComment,
    isConfirmed: status === "confirmed",
    isPublic,
    isAfter41d033: recall41d033 === "yes",
    isRepeatFailure: incidentSequence > 1 || repeatedBefore,
    kmBucket: kmBucket(km),
    ageBucket: ageBucket(buildYear, failureYear),
  };
}

function sortIncidents(incidents) {
  return [...incidents].sort((a, b) => {
    if (a.failureDate && b.failureDate) {
      const dateCompare = b.failureDate.localeCompare(a.failureDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }
    } else if (a.failureDate || b.failureDate) {
      return a.failureDate ? -1 : 1;
    }

    if (a.failureYear !== b.failureYear) {
      return (b.failureYear || 0) - (a.failureYear || 0);
    }

    if (a.failureMonth !== b.failureMonth) {
      return (b.failureMonth || 0) - (a.failureMonth || 0);
    }

    if (a.odometerKmAtFailure !== b.odometerKmAtFailure) {
      return (b.odometerKmAtFailure || 0) - (a.odometerKmAtFailure || 0);
    }

    return (b.incidentSequence || 0) - (a.incidentSequence || 0);
  });
}

function groupCounts(items, selector) {
  const counts = new Map();

  for (const item of items) {
    const key = selector(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function toPublicIncident(incident) {
  return {
    incidentSequence: incident.incidentSequence,
    brand: incident.brand,
    model: incident.model,
    region: incident.region,
    buildYear: incident.buildYear,
    buildMonth: incident.buildMonth,
    buildCohort: incident.buildCohort,
    odometerKmAtFailure: incident.odometerKmAtFailure,
    failureDate: incident.failureDate,
    failureDatePrecision: incident.failureDatePrecision,
    failureYear: incident.failureYear,
    failureMonth: incident.failureMonth,
    recall41d033Done: incident.recall41d033Done,
    incidentSequence: incident.incidentSequence,
    publicComment: incident.publicComment,
    isRepeatFailure: incident.isRepeatFailure,
    kmBucket: incident.kmBucket,
    ageBucket: incident.ageBucket,
  };
}

function toPublicSource(source) {
  return {
    type: normalizeString(source?.type) || "unknown",
  };
}

export function buildSnapshot(rows, source) {
  const normalized = rows.map(normalizeIncident);
  const workingSet = normalized.filter((incident) => incident.isPublic);
  const incidents = sortIncidents(workingSet).map(toPublicIncident);
  const formRows = workingSet.filter((incident) => incident.hasPublishPermissionField).length;
  const manualSheetRows = workingSet.length - formRows;
  const kmValues = incidents.map((incident) => incident.odometerKmAtFailure).filter((value) => value != null);
  const avgKm =
    kmValues.length > 0 ? Math.round(kmValues.reduce((sum, value) => sum + value, 0) / kmValues.length) : null;

  return {
    meta: {
      source: toPublicSource(source),
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      publishedRows: incidents.length,
      publishRule: "public_flag_or_publish_permission",
      averageKmAtFailure: avgKm,
      manualSheetRows,
      formRows,
    },
    incidents,
    summaries: {
      byModel: groupCounts(incidents, (incident) => incident.model),
      byBuildYear: groupCounts(incidents, (incident) => String(incident.buildYear || "unknown")),
      byBuildMonth: groupCounts(incidents, (incident) => String(incident.buildMonth || "unknown")),
      byBuildCohort: groupCounts(incidents, (incident) => incident.buildCohort),
      byKmBucket: groupCounts(incidents, (incident) => incident.kmBucket),
      byAgeBucket: groupCounts(incidents, (incident) => incident.ageBucket),
      byRecall41d033: groupCounts(incidents, (incident) => incident.recall41d033Done),
    },
  };
}
