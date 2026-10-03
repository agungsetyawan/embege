import type { PublicCase } from "@/lib/public-cases";

export type CaseRow = PublicCase;

export type SummaryRow = {
  region_id: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
  count: number;
  victims: number;
};
