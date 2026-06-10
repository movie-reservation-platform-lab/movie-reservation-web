/**
 * Plain JSON object used while validating untrusted GraphQL response data.
 */
export type JsonRecord = Record<string, unknown>;

/**
 * Reads an unknown value as a plain JSON object.
 */
export function readRecord(value: unknown, context: string): JsonRecord {
  if (isJsonRecord(value)) {
    return value;
  }

  throw new Error(`${context} was not an object`);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads an object field that must itself be a JSON object.
 */
export function readRecordField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): JsonRecord {
  return readRecord(record[fieldName], context);
}

/**
 * Reads an object field that must be a string.
 */
export function readStringField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): string {
  const value = record[fieldName];

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`${context} was not a string`);
}

/**
 * Reads an object field that may be either a string or null.
 */
export function readNullableStringField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): string | null {
  const value = record[fieldName];

  if (typeof value === "string" || value === null) {
    return value;
  }

  throw new Error(`${context} was not a string or null`);
}

/**
 * Reads an object field that must be a finite number.
 */
export function readNumberField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): number {
  const value = record[fieldName];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`${context} was not a finite number`);
}

/**
 * Reads an object field that must be an array.
 */
export function readArrayField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): readonly unknown[] {
  const value = record[fieldName];

  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`${context} was not an array`);
}

/**
 * Reads an object field that must be an array of strings.
 */
export function readStringArrayField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): readonly string[] {
  return readArrayField(record, fieldName, context).map((value) => {
    if (typeof value === "string") {
      return value;
    }

    throw new Error(`${context} contained a non-string value`);
  });
}
