export enum Opacity {
  Max = "max",
  Mid = "mid",
  Min = "min",
}

export function isOpacity(value: unknown): value is Opacity {
  return typeof value === "string" && (value === Opacity.Min || value === Opacity.Mid || value === Opacity.Max);
}

export interface Rule {
  flags: string | undefined;
  opacity: string | undefined;
  pattern: string;
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
