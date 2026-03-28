const VIN_LENGTH = 17;

const TRANSLITERATION = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const MODEL_YEAR_BY_CODE = {
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  V: 2027,
  W: 2028,
  X: 2029,
  Y: 2030,
};

const KNOWN_WMI_PREFIXES = [
  { prefix: "KMH", manufacturer: "Hyundai" },
  { prefix: "KMH", manufacturer: "Hyundai Motor Company" },
  { prefix: "KNA", manufacturer: "Kia" },
  { prefix: "KND", manufacturer: "Kia" },
  { prefix: "KNE", manufacturer: "Kia" },
  { prefix: "TMA", manufacturer: "Hyundai" },
];

function transliterate(char) {
  if (/[0-9]/.test(char)) {
    return Number(char);
  }

  return TRANSLITERATION[char] ?? null;
}

export function sanitizeVin(input) {
  return String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isVinFormatValid(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export function computeCheckDigit(vin) {
  if (!isVinFormatValid(vin)) {
    return null;
  }

  const total = vin.split("").reduce((sum, char, index) => {
    return sum + transliterate(char) * POSITION_WEIGHTS[index];
  }, 0);

  const remainder = total % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function isCheckDigitValid(vin) {
  const sanitized = sanitizeVin(vin);
  if (!isVinFormatValid(sanitized)) {
    return false;
  }

  return computeCheckDigit(sanitized) === sanitized[8];
}

export function decodeModelYear(modelYearCode) {
  return MODEL_YEAR_BY_CODE[modelYearCode] ?? null;
}

export function bucketSerialNumber(serial) {
  if (!/^\d+$/.test(serial)) {
    return null;
  }

  const numeric = Number(serial);
  const bucketStart = Math.floor(numeric / 1000);
  return `${String(bucketStart).padStart(3, "0")}k`;
}

export function guessManufacturerFromWmi(wmi) {
  const match = KNOWN_WMI_PREFIXES.find((entry) => wmi.startsWith(entry.prefix));
  return match?.manufacturer ?? null;
}

export function decodeVin(input) {
  const vin = sanitizeVin(input);
  const formatValid = isVinFormatValid(vin);

  if (!formatValid) {
    return {
      vin,
      formatValid: false,
      checkDigitValid: false,
      errors: ["VIN must be 17 characters and must not contain I, O, or Q."],
    };
  }

  const wmi = vin.slice(0, 3);
  const vds = vin.slice(3, 9);
  const vis = vin.slice(9);
  const modelYearCode = vin[9];
  const plantCode = vin[10];
  const serial = vin.slice(11);
  const computedCheckDigit = computeCheckDigit(vin);
  const checkDigitValid = computedCheckDigit === vin[8];
  const modelYear = decodeModelYear(modelYearCode);
  const serialBucket = bucketSerialNumber(serial);

  return {
    vin,
    formatValid: true,
    checkDigitValid,
    errors: checkDigitValid ? [] : ["VIN checksum does not match. Check for a typo."],
    wmi,
    vds,
    vis,
    manufacturerGuess: guessManufacturerFromWmi(wmi),
    modelYearCode,
    modelYear,
    plantCode,
    serial,
    serialBucket,
  };
}

export function derivePublicVinFields(input) {
  const decoded = decodeVin(input);

  if (!decoded.formatValid) {
    return {
      valid: false,
      errors: decoded.errors,
      publicFields: null,
    };
  }

  return {
    valid: decoded.checkDigitValid,
    errors: decoded.errors,
    publicFields: {
      vin_model_year_local: decoded.modelYear,
      vin_plant_code_local: decoded.plantCode,
      vin_sequence_bucket: decoded.serialBucket,
      vin_wmi_local: decoded.wmi,
    },
  };
}
