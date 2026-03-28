import test from "node:test";
import assert from "node:assert/strict";

import {
  bucketSerialNumber,
  computeCheckDigit,
  decodeModelYear,
  decodeVin,
  derivePublicVinFields,
  isCheckDigitValid,
  sanitizeVin,
} from "./vin-helper.mjs";

test("sanitizeVin normalizes casing and whitespace", () => {
  assert.equal(sanitizeVin(" kmh12345678901234 "), "KMH12345678901234");
});

test("bucketSerialNumber returns thousand buckets", () => {
  assert.equal(bucketSerialNumber("000001"), "000k");
  assert.equal(bucketSerialNumber("059123"), "059k");
  assert.equal(bucketSerialNumber("145999"), "145k");
});

test("decodeModelYear maps current project cohort years", () => {
  assert.equal(decodeModelYear("M"), 2021);
  assert.equal(decodeModelYear("R"), 2024);
  assert.equal(decodeModelYear("T"), 2026);
  assert.equal(decodeModelYear("A"), null);
});

test("computeCheckDigit and isCheckDigitValid handle a known example", () => {
  const vin = "1HGCM82633A004352";
  assert.equal(computeCheckDigit(vin), "3");
  assert.equal(isCheckDigitValid(vin), true);
});

test("decodeVin exposes safe derived values", () => {
  const vin = "KMHM34AC1RA123456";
  const decoded = decodeVin(vin);

  assert.equal(decoded.formatValid, true);
  assert.equal(decoded.wmi, "KMH");
  assert.equal(decoded.modelYearCode, "R");
  assert.equal(decoded.modelYear, 2024);
  assert.equal(decoded.plantCode, "A");
  assert.equal(decoded.serial, "123456");
  assert.equal(decoded.serialBucket, "123k");
  assert.equal(decoded.manufacturerGuess, "Hyundai");
});

test("derivePublicVinFields returns only public-safe export values", () => {
  const result = derivePublicVinFields("KMHM34AC1RA123456");

  assert.deepEqual(result.publicFields, {
    vin_model_year_local: 2024,
    vin_plant_code_local: "A",
    vin_sequence_bucket: "123k",
    vin_wmi_local: "KMH",
  });
});

test("invalid VIN format is rejected", () => {
  const result = decodeVin("SHORTVIN");
  assert.equal(result.formatValid, false);
  assert.match(result.errors[0], /17 characters/);
});
