export function parseValueByType(type: string, rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new Error("Please fill in all required fields.");
  }

  switch (type) {
    case "u64":
      if (!/^\d+$/.test(trimmed)) {
        throw new Error("u64 fields must be non-negative whole numbers.");
      }
      return BigInt(trimmed);

    case "i64":
      if (!/^-?\d+$/.test(trimmed)) {
        throw new Error("i64 fields must be whole numbers.");
      }
      return BigInt(trimmed);

    case "bool":
      if (trimmed !== "true" && trimmed !== "false") {
        throw new Error('Boolean fields must be "true" or "false".');
      }
      return trimmed === "true";

    case "string":
    case "address":
    case "unknown":
    default:
      return trimmed;
  }
}