"use client";

import { approveItem, rejectItem } from "./actions";

export type PendingItemData = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  media: string;
  published_at: string | null;
  guessed_region_id: string | null;
};

export type RegionOption = {
  id: string;
  province: string;
  district: string;
  centroid_ok: boolean;
};

export function PendingItem({
  item,
  regions,
}: {
  item: PendingItemData;
  regions: RegionOption[];
}) {
  const guessed = regions.find((r) => r.id === item.guessed_region_id);
  const dateDefault = item.published_at ? item.published_at.slice(0, 10) : "";

  return (
    <article className="flex flex-col gap-2 rounded border p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-zinc-100 px-2 py-0.5">{item.media}</span>
        {item.published_at && <span>{dateDefault}</span>}
        {guessed && (
          <span>
            Tebakan: {guessed.district}, {guessed.province}
            {!guessed.centroid_ok && " (koordinat perlu cek)"}
          </span>
        )}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline"
      >
        {item.title}
      </a>
      <form action={approveItem} className="flex flex-col gap-2">
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex flex-col gap-1 text-sm">
          Kabupaten/Kota
          <select
            name="regionId"
            required
            defaultValue={item.guessed_region_id ?? ""}
            className="rounded border px-2 py-1.5"
          >
            <option value="" disabled>
              — pilih daerah —
            </option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.district}, {r.province}
                {!r.centroid_ok ? " *" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Tanggal kejadian
            <input
              name="occurredOn"
              type="date"
              defaultValue={dateDefault}
              className="rounded border px-2 py-1.5"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-sm">
            Korban
            <input
              name="victims"
              type="number"
              min={0}
              placeholder="?"
              className="rounded border px-2 py-1.5"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Ringkasan kurasi
          <textarea
            name="summary"
            required
            rows={2}
            defaultValue={item.summary ?? ""}
            className="rounded border px-2 py-1.5"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-green-700 px-3 py-1.5 text-sm text-white"
          >
            Approve → jadi kasus
          </button>
        </div>
      </form>
      <form action={rejectItem}>
        <input type="hidden" name="itemId" value={item.id} />
        <button type="submit" className="rounded border px-3 py-1.5 text-sm">
          Reject
        </button>
      </form>
      <p className="text-xs text-zinc-400">
        * koordinat daerah ini belum terverifikasi
      </p>
    </article>
  );
}
