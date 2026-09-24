export type CaseRow = {
  id: string;
  occurred_on: string | null;
  victims: number | null;
  summary: string;
  school: string | null;
  sppg: string | null;
  source_url: string;
  source_media: string;
  region_id: string;
};

export type SummaryRow = {
  region_id: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
  count: number;
  victims: number;
};
