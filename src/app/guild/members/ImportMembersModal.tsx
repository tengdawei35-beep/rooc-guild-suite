"use client";

import {
  useMemo,
  useState,
} from "react";

type ImportRow = Record<
  string,
  string
>;

type PreviewRow = {
  rowNumber: number;
  data: ImportRow;
  errors: string[];
};

type ImportResult = {
  created: number;
  updated: number;
  total: number;
  errors: {
    row: number;
    displayName: string;
    errors: string[];
  }[];
};

type SourceType =
  | "csv"
  | "sheets";

// =============================================================
// HEADER ALIASES
// =============================================================

const FIELD_ALIASES: Record<
  string,
  string
> = {
  displayname:
    "displayName",

  discord:
    "displayName",

  discordname:
    "displayName",

  discordusername:
    "displayName",

  username:
    "displayName",

  character:
    "characterName",

  charactername:
    "characterName",

  charname:
    "characterName",

  job: "job",

  class: "job",

  active: "active",

  status: "active",

  eligible: "eligible",

  allocationeligible:
    "eligible",

  priority: "priority",

  rank: "priority",

  remarks: "remarks",

  remark: "remarks",

  notes: "remarks",

  note: "remarks",

  pdef: "pdef",

  pdefense: "pdef",

  physicaldefense:
    "pdef",

  mdef: "mdef",

  mdefense: "mdef",

  magicdefense:
    "mdef",

  pvpdamagebonus:
    "pvpDamageBonus",

  pvpdmgbonus:
    "pvpDamageBonus",

  pvpdamagereduction:
    "pvpDamageReduction",

  pvpdmgreduction:
    "pvpDamageReduction",

  pdmgpercent:
    "pdmgPercent",

  pdmg:
    "pdmgPercent",

  mdmgpercent:
    "mdmgPercent",

  mdmg:
    "mdmgPercent",

  pdmgreductionpercent:
    "pdmgReductionPercent",

  mdmgreductionpercent:
    "mdmgReductionPercent",

  critres:
    "critRes",

  critresistance:
    "critRes",

  ignorepdef:
    "ignorePdef",

  ignorepdefpercent:
    "ignorePdef",

  ignoremdef:
    "ignoreMdef",

  ignoremdefpercent:
    "ignoreMdef",

  damagevssmall:
    "damageVsSmall",

  dmgvssmall:
    "damageVsSmall",

  damagereductionvssmall:
    "damageReductionVsSmall",

  reductionvssmall:
    "damageReductionVsSmall",

  damagevsmedium:
    "damageVsMedium",

  dmgvsmedium:
    "damageVsMedium",

  damagereductionvsmedium:
    "damageReductionVsMedium",

  reductionvsmedium:
    "damageReductionVsMedium",

  damagevsdemihuman:
    "damageVsDemiHuman",

  dmgvsdemihuman:
    "damageVsDemiHuman",

  damagereductionvsdemihuman:
    "damageReductionVsDemiHuman",

  reductionvsdemihuman:
    "damageReductionVsDemiHuman",

  damagevsbrute:
    "damageVsBrute",

  dmgvsbrute:
    "damageVsBrute",

  damagereductionvsbrute:
    "damageReductionVsBrute",

  reductionvsbrute:
    "damageReductionVsBrute",

  equipmentpdefpercent:
    "equipmentPdefPercent",

  equipmentmdefpercent:
    "equipmentMdefPercent",

  patk: "patk",

  matk: "matk",

  hp: "hp",
};

// =============================================================
// HEADER NORMALISATION
// =============================================================

function normalizeHeader(
  header: string
) {
  return header
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(
      /[\s_\-./]+/g,
      ""
    );
}

// =============================================================
// CSV PARSER
// =============================================================

function parseCSV(
  text: string
): string[][] {
  const rows: string[][] = [];

  let row: string[] = [];
  let cell = "";

  let quoted = false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    const next =
      text[i + 1];

    if (char === '"') {
      if (
        quoted &&
        next === '"'
      ) {
        cell += '"';
        i++;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (
      char === "," &&
      !quoted
    ) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (char === "\n" ||
        char === "\r") &&
      !quoted
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        i++;
      }

      row.push(cell);
      cell = "";

      if (
        row.some(
          (value) =>
            value.trim() !== ""
        )
      ) {
        rows.push(row);
      }

      row = [];

      continue;
    }

    cell += char;
  }

  row.push(cell);

  if (
    row.some(
      (value) =>
        value.trim() !== ""
    )
  ) {
    rows.push(row);
  }

  return rows;
}

// =============================================================
// MAP CSV TO IMPORT ROWS
// =============================================================

function mapCSVRows(
  rows: string[][]
): PreviewRow[] {
  if (
    rows.length < 2
  ) {
    throw new Error(
      "The CSV must contain a header row and at least one member."
    );
  }

  const headers =
    rows[0].map(
      (header) => {
        const normalized =
          normalizeHeader(
            header
          );

        return (
          FIELD_ALIASES[
            normalized
          ] ??
          header.trim()
        );
      }
    );

  if (
    !headers.includes(
      "displayName"
    )
  ) {
    throw new Error(
      "The CSV must contain a Display Name, Discord Name, or Discord column."
    );
  }

  return rows
    .slice(1)
    .map(
      (
        values,
        index
      ) => {
        const data: ImportRow =
          {};

        headers.forEach(
          (
            header,
            columnIndex
          ) => {
            if (
              !header
            ) {
              return;
            }

            data[header] =
              (
                values[
                  columnIndex
                ] ?? ""
              ).trim();
          }
        );

        return validatePreviewRow(
          data,
          index + 2
        );
      }
    );
}

// =============================================================
// PREVIEW VALIDATION
// =============================================================

function validatePreviewRow(
  data: ImportRow,
  rowNumber: number
): PreviewRow {
  const errors: string[] = [];

  if (
    !data.displayName?.trim()
  ) {
    errors.push(
      "Display name required"
    );
  }

  if (
    !data.characterName?.trim()
  ) {
    errors.push(
      "Character name required"
    );
  }

  if (!data.job?.trim()) {
    errors.push(
      "Job required"
    );
  }

  if (
    data.active &&
    parseBoolean(
      data.active
    ) === null
  ) {
    errors.push(
      "Invalid active value"
    );
  }

  if (
    data.eligible &&
    parseBoolean(
      data.eligible
    ) === null
  ) {
    errors.push(
      "Invalid eligible value"
    );
  }

  return {
    rowNumber,
    data,
    errors,
  };
}

// =============================================================
// BOOLEAN
// =============================================================

function parseBoolean(
  value: string
): boolean | null {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "y",
      "active",
      "eligible",
    ].includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "n",
      "inactive",
      "ineligible",
    ].includes(
      normalized
    )
  ) {
    return false;
  }

  return null;
}

// =============================================================
// COMPONENT
// =============================================================

export default function ImportMembersModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [source, setSource] =
    useState<SourceType>(
      "csv"
    );

  const [fileName, setFileName] =
    useState<string | null>(
      null
    );

  const [rows, setRows] =
    useState<PreviewRow[]>(
      []
    );

  const [fileError, setFileError] =
    useState<string | null>(
      null
    );

  const [importing, setImporting] =
    useState(false);

  const [result, setResult] =
    useState<ImportResult | null>(
      null
    );

  const [dragging, setDragging] =
    useState(false);

  const [sheetUrl, setSheetUrl] =
    useState("");

  const [sheetGid, setSheetGid] =
    useState("0");

  const [loadingSheet, setLoadingSheet] =
    useState(false);

  const validRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.errors
              .length === 0
        ),
      [rows]
    );

  const hasErrors =
    rows.some(
      (row) =>
        row.errors.length >
        0
    );

  // ===========================================================
  // RESET SOURCE
  // ===========================================================

  function changeSource(
    nextSource: SourceType
  ) {
    setSource(
      nextSource
    );

    setRows([]);

    setResult(null);

    setFileError(null);

    setFileName(null);
  }

  // ===========================================================
  // CHECK DUPLICATES
  // ===========================================================

  function checkDuplicates(
    preview: PreviewRow[]
  ) {
    const seen =
      new Map<
        string,
        number
      >();

    for (const row of preview) {
      const name =
        row.data.displayName
          ?.trim()
          .toLowerCase();

      if (!name) {
        continue;
      }

      const existing =
        seen.get(name);

      if (
        existing !==
        undefined
      ) {
        row.errors.push(
          `Duplicate display name; first appears on row ${existing}`
        );
      } else {
        seen.set(
          name,
          row.rowNumber
        );
      }
    }

    return preview;
  }

  // ===========================================================
  // PROCESS CSV FILE
  // ===========================================================

  async function processFile(
    file: File
  ) {
    setFileError(null);
    setResult(null);

    if (
      !file.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      setFileError(
        "Please select a CSV file."
      );

      return;
    }

    try {
      const text =
        await file.text();

      const csvRows =
        parseCSV(text);

      const preview =
        checkDuplicates(
          mapCSVRows(
            csvRows
          )
        );

      setFileName(
        file.name
      );

      setRows(preview);
    } catch (error) {
      setRows([]);

      setFileError(
        error instanceof Error
          ? error.message
          : "Failed to read CSV."
      );
    }
  }

  // ===========================================================
  // FILE CHANGE
  // ===========================================================

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (file) {
      processFile(file);
    }

    event.target.value = "";
  }

  // ===========================================================
  // DROP
  // ===========================================================

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragging(false);

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      processFile(file);
    }
  }

  // ===========================================================
  // LOAD GOOGLE SHEET
  // ===========================================================

  async function loadGoogleSheet() {
    if (
      !sheetUrl.trim()
    ) {
      setFileError(
        "Google Sheets URL is required."
      );

      return;
    }

    try {
      setLoadingSheet(true);

      setFileError(null);

      setResult(null);

      setRows([]);

      const response =
        await fetch(
          "/api/guild/members/import/sheets",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              url:
                sheetUrl.trim(),

              gid:
                sheetGid.trim() ||
                "0",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to read Google Sheet."
        );
      }

      if (
        typeof data.csv !==
        "string"
      ) {
        throw new Error(
          "The Google Sheet did not return CSV data."
        );
      }

      const csvRows =
        parseCSV(
          data.csv
        );

      const preview =
        checkDuplicates(
          mapCSVRows(
            csvRows
          )
        );

      setFileName(
        "Google Sheets"
      );

      setRows(preview);
    } catch (error) {
      setRows([]);

      setFileError(
        error instanceof Error
          ? error.message
          : "Failed to read Google Sheet."
      );
    } finally {
      setLoadingSheet(false);
    }
  }

  // ===========================================================
  // IMPORT MEMBERS
  // ===========================================================

  async function importMembers() {
    if (
      rows.length === 0 ||
      validRows.length !==
        rows.length
    ) {
      return;
    }

    try {
      setImporting(true);

      setFileError(null);

      const response =
        await fetch(
          "/api/guild/members/import",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                rows: validRows.map(
                  (row) =>
                    row.data
                ),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            data.message ??
            "Import failed."
        );
      }

      if (
        data.success ===
        false
      ) {
        throw new Error(
          data.message ??
            "Import validation failed."
        );
      }

      setResult({
        created:
          data.created ??
          0,

        updated:
          data.updated ??
          0,

        total:
          data.total ??
          0,

        errors:
          data.errors ??
          [],
      });

      await onImported();
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "Import failed."
      );
    } finally {
      setImporting(false);
    }
  }

  // ===========================================================
  // RENDER
  // ===========================================================

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 max-w-6xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Import Members
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Create or update
              guild members from
              CSV or Google Sheets.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="text-2xl leading-none text-zinc-500 transition hover:text-white disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* SOURCE SELECTOR */}

          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() =>
                changeSource(
                  "csv"
                )
              }
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                source ===
                "csv"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              CSV File
            </button>

            <button
              type="button"
              onClick={() =>
                changeSource(
                  "sheets"
                )
              }
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                source ===
                "sheets"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              Google Sheets
            </button>
          </div>

          {/* INSTRUCTIONS */}

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-medium text-zinc-200">
              Import behaviour
            </div>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Members are matched
              using their Discord
              name. New members
              are created and
              existing members are
              updated.
            </p>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Columns that are not
              included in the import
              are left unchanged on
              existing members.
            </p>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Common headers such
              as "Discord Name",
              "Character Name",
              "P.DEF" and "M.DEF"
              are automatically
              recognised.
            </p>
          </div>

          {/* ================================================= */}
          {/* CSV SOURCE */}
          {/* ================================================= */}

          {source === "csv" && (
            <div
              onDragOver={(
                event
              ) => {
                event.preventDefault();

                setDragging(
                  true
                );
              }}
              onDragLeave={() =>
                setDragging(
                  false
                )
              }
              onDrop={
                handleDrop
              }
              className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-zinc-300 bg-zinc-800"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <div className="text-sm font-medium text-zinc-200">
                Drop CSV here
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                or select a CSV file
              </div>

              <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200">
                Choose CSV

                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={
                    handleFileChange
                  }
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="mt-3 text-xs text-zinc-400">
                  {fileName}
                </div>
              )}
            </div>
          )}

          {/* ================================================= */}
          {/* GOOGLE SHEETS */}
          {/* ================================================= */}

          {source ===
            "sheets" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="text-sm font-medium text-zinc-200">
                Google Sheets URL
              </div>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Paste a Google
                Sheets URL containing
                your member data.
              </p>

              <input
                type="url"
                value={sheetUrl}
                onChange={(
                  event
                ) =>
                  setSheetUrl(
                    event.target
                      .value
                  )
                }
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-400">
                  Sheet tab ID (gid)
                </label>

                <input
                  type="text"
                  value={
                    sheetGid
                  }
                  onChange={(
                    event
                  ) =>
                    setSheetGid(
                      event.target
                        .value
                    )
                  }
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />

                <p className="mt-1 text-xs text-zinc-600">
                  Usually 0 for the
                  first tab.
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-500">
                The sheet must be
                accessible without
                requiring a Google
                login. You can set
                Google Sheets sharing
                to "Anyone with the
                link" as Viewer.
              </div>

              <button
                type="button"
                onClick={
                  loadGoogleSheet
                }
                disabled={
                  loadingSheet ||
                  !sheetUrl.trim()
                }
                className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingSheet
                  ? "Loading Sheet..."
                  : "Load Sheet"}
              </button>

              {fileName ===
                "Google Sheets" &&
                rows.length >
                  0 && (
                  <div className="mt-3 text-xs text-zinc-500">
                    Google Sheet
                    loaded successfully.
                  </div>
                )}
            </div>
          )}

          {/* ERROR */}

          {fileError && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
              {fileError}
            </div>
          )}

          {/* RESULT */}

          {result && (
            <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-5">
              <div className="text-sm font-semibold text-emerald-300">
                Import completed
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <ResultStat
                  label="Total"
                  value={
                    result.total
                  }
                />

                <ResultStat
                  label="Created"
                  value={
                    result.created
                  }
                />

                <ResultStat
                  label="Updated"
                  value={
                    result.updated
                  }
                />
              </div>
            </div>
          )}

          {/* PREVIEW */}

          {rows.length > 0 && (
            <div>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Preview
                  </h3>

                  <p className="mt-1 text-xs text-zinc-500">
                    {rows.length}{" "}
                    rows •{" "}
                    {
                      validRows.length
                    }{" "}
                    valid
                  </p>
                </div>

                {hasErrors && (
                  <div className="text-right text-xs text-red-400">
                    Fix validation
                    errors before
                    importing.
                  </div>
                )}
              </div>

              <div className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-950">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Row
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Character
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Discord
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Job
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        P.DEF
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        M.DEF
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Status
                      </th>

                      <th className="px-3 py-3 text-left font-medium text-zinc-500">
                        Validation
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map(
                      (row) => (
                        <tr
                          key={
                            row.rowNumber
                          }
                          className={`border-b border-zinc-800 ${
                            row.errors
                              .length >
                            0
                              ? "bg-red-950/20"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-zinc-500">
                            {
                              row.rowNumber
                            }
                          </td>

                          <td className="px-3 py-3 text-zinc-200">
                            {row.data
                              .characterName ||
                              "—"}
                          </td>

                          <td className="px-3 py-3 text-zinc-300">
                            {row.data
                              .displayName ||
                              "—"}
                          </td>

                          <td className="px-3 py-3 text-zinc-300">
                            {row.data
                              .job ||
                              "—"}
                          </td>

                          <td className="px-3 py-3 text-zinc-400">
                            {row.data
                              .pdef ||
                              "—"}
                          </td>

                          <td className="px-3 py-3 text-zinc-400">
                            {row.data
                              .mdef ||
                              "—"}
                          </td>

                          <td className="px-3 py-3">
                            <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-400">
                              {row.data
                                .active ||
                                "default"}
                            </span>
                          </td>

                          <td className="max-w-80 px-3 py-3">
                            {row.errors
                              .length ===
                            0 ? (
                              <span className="text-emerald-400">
                                Valid
                              </span>
                            ) : (
                              <span className="text-red-400">
                                {row.errors.join(
                                  "; "
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <div className="text-xs text-zinc-500">
            {rows.length > 0
              ? `${validRows.length} of ${rows.length} rows ready`
              : "No data loaded"}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                importing
              }
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            >
              {result
                ? "Close"
                : "Cancel"}
            </button>

            {!result && (
              <button
                type="button"
                onClick={
                  importMembers
                }
                disabled={
                  importing ||
                  rows.length ===
                    0 ||
                  validRows.length !==
                    rows.length
                }
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing
                  ? "Importing..."
                  : `Import ${validRows.length} Members`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// RESULT STAT
// =============================================================

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="text-xs text-zinc-500">
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold text-zinc-100">
        {value}
      </div>
    </div>
  );
}