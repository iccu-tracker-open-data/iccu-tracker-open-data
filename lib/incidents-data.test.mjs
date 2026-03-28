import test from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "./incidents-data.mjs";

test("buildSnapshot converts sheet miles columns into kilometers", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        "Miles at failure (or skip to kilometers question)": "100",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].odometerKmAtFailure, 161);
  assert.equal(snapshot.meta.averageKmAtFailure, 161);
});

test("buildSnapshot ignores legacy vehicle identifier columns", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:17:23",
        "Vehicle model": "Hyundai Ioniq 6",
        vehicle_public_id: "public-car-123",
        "Anonymous VIN Hash data (optional)": "vinh_23bcb0708c777913eb24543e",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal("vehiclePublicId" in snapshot.incidents[0], false);
  assert.equal("submissionId" in snapshot.incidents[0], false);
});

test("buildSnapshot normalizes model variants without spaces", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Ioniq5",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:01",
        "Vehicle model": "IONIQ 6",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.deepEqual(
    snapshot.incidents.map((incident) => [incident.brand, incident.model]),
    [
      ["Hyundai", "Ioniq 5"],
      ["Hyundai", "Ioniq 6"],
    ],
  );
});

test("buildSnapshot infers a missing model from public notes", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "",
        "Public notes": "Forum import from raw thread data. Raw entry: bendel80 Ionq 5 72kWh ca. 25000km und 38000km",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].brand, "Hyundai");
  assert.equal(snapshot.incidents[0].model, "Ioniq 5");
  assert.equal(snapshot.incidents[0].publicComment, "Forum import from raw thread data. Raw entry: bendel80 Ionq 5 72kWh ca. 25000km und 38000km");
});

test("buildSnapshot republishes moderated public comments", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        public_comment: "ICCU replaced after AC charging stop.",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents[0].publicComment, "ICCU replaced after AC charging stop.");
});

test("buildSnapshot splits form rows from manual sheet rows using publish permission field presence", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:01",
        "Vehicle model": "Hyundai Ioniq 5",
        "Permission to publish anonymized data": "Yes",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:02",
        "Vehicle model": "Hyundai Ioniq 6",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.meta.formRows, 2);
  assert.equal(snapshot.meta.manualSheetRows, 1);
});

test("buildSnapshot publishes rows with explicit public flags or fallback publish permission", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:01",
        "Vehicle model": "Hyundai Ioniq 6",
        public: "true",
      },
      {
        Timestamp: "2026-03-27 18:00:02",
        "Vehicle model": "Kia EV6",
        public: "yes",
      },
      {
        Timestamp: "2026-03-27 18:00:03",
        "Vehicle model": "Kia EV6",
        visibility: "public",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 3);
  assert.deepEqual(
    snapshot.incidents.map((incident) => incident.model),
    ["Ioniq 5", "Ioniq 6", "EV6"],
  );
  assert.equal(snapshot.meta.publishRule, "public_flag_or_publish_permission");
});

test("buildSnapshot falls back to publish permission when public flag is absent", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        "Permission to publish anonymized data": "Yes",
      },
      {
        Timestamp: "2026-03-27 18:00:01",
        "Vehicle model": "Hyundai Ioniq 6",
        "Permission to publish anonymized data": "No",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].model, "Ioniq 5");
});

test("buildSnapshot accepts the current live Google Sheet response headers", () => {
  const snapshot = buildSnapshot(
    [
      {
        Zeitstempel: "28.03.2026 11:39:09",
        "Vehicle model": "Hyundai Ioniq 5",
        Region: "Europe",
        "Build year": "2022",
        "Build month": "April",
        "ICCU issue for the ... time:": "2",
        "Was 41D033 (ICCU recall campaign) already installed before the failure?": "No",
        "Kilometers at failure (or skip to miles question)": "23222",
        "Approximately failure date or month": "20.05.2021",
        "Permission to publish anonymized data": "Yes",
        "Additional notes (optional, public)": "notes",
        Public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].incidentSequence, 2);
  assert.equal(snapshot.incidents[0].failureDate, "2021-05-20");
  assert.equal(snapshot.incidents[0].buildMonth, 4);
  assert.equal(snapshot.incidents[0].publicComment, "");
  assert.equal(snapshot.meta.formRows, 1);
});

test("buildSnapshot publishes Public notes instead of additional notes", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        "Additional notes (optional, public)": "raw submitter text",
        "Public notes": "moderated text",
        Public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].publicComment, "moderated text");
});

test("buildSnapshot tolerates the live sheet's misspelled February build month", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        "Build month": "Feburary",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.equal(snapshot.incidents.length, 1);
  assert.equal(snapshot.incidents[0].buildMonth, 2);
});

test("buildSnapshot sorts published incidents by failure date newest first", () => {
  const snapshot = buildSnapshot(
    [
      {
        Timestamp: "2026-03-27 18:00:00",
        "Vehicle model": "Hyundai Ioniq 5",
        failure_date: "2024-01-03",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:01",
        "Vehicle model": "Hyundai Ioniq 6",
        failure_date: "2025-05-20",
        public: "1",
      },
      {
        Timestamp: "2026-03-27 18:00:02",
        "Vehicle model": "Kia EV6",
        failure_date: "2023-11",
        public: "1",
      },
    ],
    { type: "google-sheet" },
  );

  assert.deepEqual(
    snapshot.incidents.map((incident) => incident.model),
    ["Ioniq 6", "Ioniq 5", "EV6"],
  );
});
