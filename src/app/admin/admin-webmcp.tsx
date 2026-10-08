"use client";

import { useEffect } from "react";
import {
  applyItemUpdate,
  applyReportFix,
  approveItem,
  deleteReportedCase,
  dismissReport,
  moveReportCase,
  rejectItem,
  resolveReport,
  restoreCase,
  restoreItem,
} from "./actions";
import { deleteCase, getCaseHistory, updateCase } from "./cases/actions";
import { triggerCrawl, triggerEnrich } from "./pipeline-actions";
import {
  addKeyword,
  addSetting,
  applySchedules,
  deleteKeyword,
  toggleKeyword,
  updateSetting,
} from "./settings/actions";
import {
  findCases,
  findRegions,
  getSettings,
  listQueue,
} from "./webmcp-actions";

// Exposes the admin Server Actions as WebMCP tools for browser agents.
// Auth, validation and audit logging stay in the actions themselves.

type Input = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: object;
  execute: (input: Input) => Promise<unknown>;
};
type ModelContext = {
  registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void>;
};

const uuid = { type: "string", format: "uuid" };
const str = (description: string) => ({ type: "string", description });
const optDate = str("YYYY-MM-DD, string kosong untuk mengosongkan.");
const optVictims = {
  type: ["integer", "string"],
  description: "0-9999, string kosong untuk mengosongkan.",
};

// Booleans map to checkbox semantics: true -> "on", false -> absent.
function toForm(input: Input) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    fd.set(k, v === true ? "on" : String(v));
  }
  return fd;
}

function jsonTool(
  name: string,
  description: string,
  properties: object,
  run: (input: Input) => Promise<unknown>,
  annotations?: object,
): Tool {
  return {
    name,
    description,
    inputSchema: { type: "object", properties },
    annotations,
    // Drop execute's second arg ({ signal }): an AbortSignal can't be
    // serialized into a Server Action call.
    execute: (input) => run(input),
  };
}

const readOnly = { readOnlyHint: true };
// News text and public report notes are third-party content.
const readUntrusted = { readOnlyHint: true, untrustedContentHint: true };

// Writes that change public case data wait for the admin to confirm,
// so a human still signs off on everything that publishes.
// consequentialHint only asks the agent to confirm; window.confirm is the
// gate the page controls.
function formTool(
  name: string,
  description: string,
  properties: Record<string, object>,
  action: (fd: FormData) => Promise<void>,
  confirmText?: (input: Input) => string,
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(properties),
    },
    annotations: confirmText ? { consequentialHint: true } : undefined,
    execute: async (input) => {
      if (confirmText && !window.confirm(confirmText(input)))
        return { ok: false, message: "Dibatalkan admin." };
      await action(toForm(input));
      // ponytail: actions return void and drop invalid input silently;
      // return a result from each action if agents need real error codes.
      return {
        ok: true,
        message:
          "Terkirim. Input yang tidak valid diabaikan tanpa error, jadi cek ulang lewat tool baca.",
      };
    },
  };
}

const tools: Tool[] = [
  jsonTool(
    "list_queue",
    "Daftar antrean admin, 5 per halaman. tab: pending (berita menunggu kurasi), rejected (berita ditolak), reports (laporan publik terbuka). enrich_source='rss' berarti LLM hanya membaca cuplikan RSS, jadi periksa artikelnya. duplicate_of_case_id terisi berarti berita ini kemungkinan update dari kasus yang sudah ada.",
    {
      tab: { type: "string", enum: ["pending", "rejected", "reports"] },
      page: { type: "integer", minimum: 1 },
    },
    ({ tab, page }) => listQueue(String(tab ?? "pending"), Number(page ?? 1)),
    readUntrusted,
  ),
  jsonTool(
    "find_regions",
    "Cari kabupaten/kota berdasarkan nama untuk mendapatkan regionId. centroid_ok=false berarti koordinatnya belum terverifikasi.",
    { q: str("Nama kabupaten/kota atau provinsi.") },
    ({ q }) => findRegions(String(q ?? "")),
    readOnly,
  ),
  jsonTool(
    "find_cases",
    "Cari kasus (maks 10) berdasarkan ringkasan, sekolah, SPPG, media, atau URL sumber.",
    {
      q: str("Kata kunci, boleh kosong."),
      deleted: { type: "boolean", description: "true untuk kasus terhapus." },
    },
    ({ q, deleted }) => findCases(String(q ?? ""), deleted === true),
    readUntrusted,
  ),
  jsonTool(
    "get_case_history",
    "Riwayat perubahan satu kasus dari audit log.",
    { caseId: uuid },
    ({ caseId }) => getCaseHistory(String(caseId)),
    readOnly,
  ),
  jsonTool(
    "get_settings",
    "Daftar pengaturan aplikasi dan kata kunci crawl.",
    {},
    getSettings,
    readOnly,
  ),

  formTool(
    "approve_item",
    "Setujui berita pending menjadi kasus baru. Ambil nilai dari llm_* di list_queue dan regionId dari find_regions. school/sppg hanya diisi jika disebut eksplisit di artikel.",
    {
      itemId: uuid,
      regionId: uuid,
      summary: str("Ringkasan kasus, maks 5000 karakter."),
      occurredOn: optDate,
      victims: optVictims,
      school: str("Maks 500 karakter, string kosong jika tidak disebut."),
      sppg: str("Maks 500 karakter, string kosong jika tidak disebut."),
    },
    approveItem,
    (i) => `Setujui berita sebagai kasus baru?\n\n${i.summary}`,
  ),
  formTool(
    "reject_item",
    "Tolak berita pending.",
    { itemId: uuid },
    rejectItem,
  ),
  formTool(
    "apply_item_update",
    "Terapkan berita pending yang ditandai duplikat sebagai update kasus yang sudah ada (duplicate_of_case_id).",
    { itemId: uuid },
    applyItemUpdate,
    () => "Terapkan berita ini sebagai update kasus yang sudah tayang?",
  ),
  formTool(
    "restore_item",
    "Kembalikan berita yang ditolak ke antrean pending.",
    { itemId: uuid },
    restoreItem,
  ),
  formTool(
    "resolve_report",
    "Tandai laporan publik selesai.",
    { reportId: uuid },
    resolveReport,
  ),
  formTool(
    "dismiss_report",
    "Abaikan laporan publik.",
    { reportId: uuid },
    dismissReport,
  ),
  formTool(
    "move_report_case",
    "Pindahkan kasus yang dilaporkan ke wilayah lain, lalu tandai laporan selesai.",
    { reportId: uuid, regionId: uuid },
    moveReportCase,
    () => "Pindahkan kasus ke wilayah yang diusulkan?",
  ),
  formTool(
    "apply_report_fix",
    "Terapkan koreksi jumlah korban dan tanggal dari laporan, lalu tandai laporan selesai. String kosong mengosongkan nilai.",
    { reportId: uuid, victims: optVictims, occurredOn: optDate },
    applyReportFix,
    (i) =>
      `Terapkan koreksi laporan? Korban: ${i.victims || "-"}, tanggal: ${i.occurredOn || "-"}`,
  ),
  formTool(
    "delete_reported_case",
    "Hapus (soft delete) kasus duplikat yang dilaporkan. reportId boleh string kosong.",
    { caseId: uuid, reportId: str("UUID laporan atau string kosong.") },
    deleteReportedCase,
    () => "Hapus kasus ini? Bisa dipulihkan dari Terhapus.",
  ),
  formTool(
    "update_case",
    "Ubah kasus. Semua field ditimpa, jadi ambil nilai lama dari find_cases lalu kirim semuanya.",
    {
      caseId: uuid,
      regionId: uuid,
      summary: str("Maks 5000 karakter."),
      sourceUrl: str("URL http/https sumber."),
      sourceMedia: str("Nama media, maks 200 karakter."),
      school: str("Maks 500 karakter, string kosong jika tidak ada."),
      sppg: str("Maks 500 karakter, string kosong jika tidak ada."),
      victims: optVictims,
      occurredOn: optDate,
      published: { type: "boolean" },
    },
    updateCase,
    (i) => `Simpan perubahan kasus?\n\n${i.summary}`,
  ),
  formTool(
    "delete_case",
    "Hapus (soft delete) kasus.",
    { caseId: uuid },
    deleteCase,
    () => "Hapus kasus ini? Bisa dipulihkan dari Terhapus.",
  ),
  formTool(
    "restore_case",
    "Pulihkan kasus yang terhapus.",
    { caseId: uuid },
    restoreCase,
    () => "Pulihkan kasus ini ke publik?",
  ),

  formTool(
    "update_setting",
    "Ubah nilai pengaturan: enrich_batch, crawl_schedule, enrich_schedule, enrich_max_text, enrich_max_html. Jadwal baru aktif setelah apply_schedules.",
    { key: str("Kunci pengaturan."), value: str("Nilai baru, maks 500.") },
    updateSetting,
  ),
  formTool(
    "add_setting",
    "Tambah pengaturan baru (kunci huruf kecil, angka, garis bawah).",
    { key: str("Kunci baru."), value: str("Nilai, maks 500.") },
    addSetting,
  ),
  formTool(
    "add_keyword",
    "Tambah kata kunci crawl. Kata kunci 5 huruf atau kurang hanya cocok kata utuh.",
    { keyword: str("Maks 200 karakter.") },
    addKeyword,
  ),
  formTool(
    "toggle_keyword",
    "Aktifkan atau nonaktifkan kata kunci crawl.",
    { id: uuid },
    toggleKeyword,
  ),
  formTool(
    "delete_keyword",
    "Hapus kata kunci crawl.",
    { id: uuid },
    deleteKeyword,
  ),
  jsonTool(
    "apply_schedules",
    "Terapkan crawl_schedule dan enrich_schedule ke pg_cron.",
    {},
    applySchedules,
  ),
  jsonTool("run_crawl", "Jalankan crawl berita sekarang.", {}, triggerCrawl),
  jsonTool(
    "run_enrich",
    "Jalankan enrich LLM untuk antrean sekarang.",
    {},
    triggerEnrich,
  ),
];

export function AdminWebMcp() {
  useEffect(() => {
    const mc = (document as unknown as { modelContext?: ModelContext })
      .modelContext;
    if (!mc) return;
    const controller = new AbortController();
    // Unmounting mid-registration (StrictMode, logout) rejects the pending
    // promise with AbortError; that is expected, anything else is not.
    for (const tool of tools)
      mc.registerTool(tool, { signal: controller.signal }).catch((e) => {
        if (e?.name !== "AbortError") console.error(e);
      });
    return () => controller.abort();
  }, []);
  return null;
}
