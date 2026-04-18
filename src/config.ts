export enum Opacity {
  Max = "max",
  Mid = "mid",
  Min = "min",
}

export interface Rule {
  flags: string | undefined;
  opacity: string | undefined;
  pattern: string;
}

export interface File {
  rules: Rule[];
  valueForMaxTier: number;
  valueForMidTier: number;
  valueForMinTier: number;
  updatePeriod: number;
}
