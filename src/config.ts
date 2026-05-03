export enum Opacity {
  Max = "max",
  Mid = "mid",
  Min = "min",
}

export function toOpacity(value: string): Opacity {
  switch (value) {
    case "max":
      return Opacity.Max;
    case "mid":
      return Opacity.Mid;
    case "min":
      return Opacity.Min;
    default:
      throw `expected either of '${Opacity.Min}', '${Opacity.Mid}' or '${Opacity.Max}' got '${value}'`;
  }
}

export function assertOpacity(value: unknown): asserts value is Opacity {
  if (value === Opacity.Min || value === Opacity.Mid || value === Opacity.Max) {
    return;
  }
  throw `expected either of '${Opacity.Min}', '${Opacity.Mid}' or '${Opacity.Max}' got '${value}'`;
}

export interface Rule {
  flags: string | undefined;
  opacity: string | undefined;
  pattern: string;
}

export function assertRule(value: unknown): asserts value is Rule {
  if (typeof value !== "object") throw "expected object";
  if (value === null) throw "empty";

  if (!("pattern" in value)) throw `'pattern': required`;
  if (typeof value.pattern !== "string") throw `'pattern': expected string`;
  if ("flags" in value && typeof value.flags !== "string") throw `'flags': non-string`;
  if ("opacity" in value)
    try {
      assertOpacity(value.opacity);
    } catch (e) {
      throw typeof e === "string" ? `'opacity': ${e}` : e;
    }
}

export function assertRuleArray(value: unknown): asserts value is Rule[] {
  if (!Array.isArray(value)) throw `expected a list`;
  for (const rule of value) {
    try {
      assertRule(rule);
    } catch (e) {
      throw typeof e === "string" ? `'${rule}': ${e}` : e;
    }
  }
}

export interface File {
  defaultFlags: string;
  defaultOpacityTier: Opacity;
  rules: Rule[];
  valueForMaxTier: number;
  valueForMidTier: number;
  valueForMinTier: number;
  updatePeriod: number;
}
