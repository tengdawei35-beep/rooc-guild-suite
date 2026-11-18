"use client";

import { useMemo, useState } from "react";

type Member = {
  id: string;
  characterName: string | null;
};

type Resource = {
  id: string;
  name: string;
  type: "FEATHER" | "CARD";
};

type Slot = {
  slotNumber: number;
  member: Member;
  resource: Resource;
};

type BidPage = {
  id: string;
  type: "FEATHER" | "CARD";
  pageNumber: number;
  slots: Slot[];
};

type Props = {
  feathers: BidPage[];
  cards: BidPage[];
};

type SearchResult = {
  type: "FEATHER" | "CARD";
  pageNumber: number;
  slotNumber: number;
  memberName: string;
  resourceName: string;
};

const EMPTY_SLOTS = 4;

export default function BidsClient({
  feathers,
  cards,
}: Props) {
  const [type, setType] =
    useState<"FEATHER" | "CARD">(
      feathers.length > 0
        ? "FEATHER"
        : "CARD"
    );

  const [pageNumber, setPageNumber] =
    useState(1);

  const [search, setSearch] =
    useState("");

  const pages =
    type === "FEATHER"
      ? feathers
      : cards;

  const currentPage =
    pages.find(
      (page) =>
        page.pageNumber ===
        pageNumber
    ) ?? pages[0];

  const normalizedSearch =
    search.trim().toLowerCase();

  const searchResults =
    useMemo<SearchResult[]>(() => {
      if (!normalizedSearch) {
        return [];
      }

      const results: SearchResult[] = [];

      for (const page of [
        ...feathers,
        ...cards,
      ]) {
        for (const slot of page.slots) {
          if (
            (slot.member.characterName ?? "").toLowerCase()
              .includes(
                normalizedSearch
              )
          ) {
            results.push({
              type: page.type,
              pageNumber:
                page.pageNumber,
              slotNumber:
                slot.slotNumber,
              memberName: slot.member.characterName ?? "Unknown",
              resourceName:
                slot.resource.name,
            });
          }
        }
      }

      return results;
    }, [
      normalizedSearch,
      feathers,
      cards,
    ]);

  function changeType(
    newType: "FEATHER" | "CARD"
  ) {
    setType(newType);
    setPageNumber(1);
    setSearch("");
  }

  function goToPage(
    newPage: number
  ) {
    if (
      newPage < 1 ||
      newPage > pages.length
    ) {
      return;
    }

    setPageNumber(newPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openSearchResult(
    result: SearchResult
  ) {
    setType(result.type);
    setPageNumber(
      result.pageNumber
    );
    setSearch("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="mt-8">
      {/* SEARCH */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <label
          htmlFor="member-search"
          className="block text-sm font-medium text-zinc-300"
        >
          Find your allocations
        </label>

        <div className="relative mt-2">
          <input
            id="member-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search your member name..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-400"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {search && (
          <div className="mt-4">
            {searchResults.length ===
            0 ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-500">
                No allocations found for "
                {search}".
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
                  {searchResults.length}{" "}
                  matching{" "}
                  {searchResults.length ===
                  1
                    ? "slot"
                    : "slots"}
                </p>

                <div className="grid gap-2">
                  {searchResults.map(
                    (result, index) => (
                      <button
                        key={`${result.type}-${result.pageNumber}-${result.slotNumber}-${index}`}
                        type="button"
                        onClick={() =>
                          openSearchResult(
                            result
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-zinc-600 hover:bg-zinc-900"
                      >
                        <div>
                          <p className="font-medium">
                            {
                              result.memberName
                            }
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {
                              result.resourceName
                            }
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400">
                            {result.type ===
                            "FEATHER"
                              ? "Feather"
                              : "Card"}
                          </span>

                          <span className="text-sm font-medium">
                            Page{" "}
                            {
                              result.pageNumber
                            }
                          </span>

                          <span className="text-xs text-zinc-500">
                            Slot{" "}
                            {
                              result.slotNumber
                            }
                          </span>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* TYPE SELECTOR */}

      <div className="mt-8 flex gap-2 border-b border-zinc-800">
        <TypeButton
          active={type === "FEATHER"}
          label="Feathers"
          count={feathers.length}
          onClick={() =>
            changeType("FEATHER")
          }
        />

        <TypeButton
          active={type === "CARD"}
          label="Cards"
          count={cards.length}
          onClick={() =>
            changeType("CARD")
          }
        />
      </div>

      {/* PAGE VIEW */}

      {pages.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
          <h2 className="text-lg font-semibold">
            No{" "}
            {type === "FEATHER"
              ? "Feather"
              : "Card"}{" "}
            allocations
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            This allocation did not generate any{" "}
            {type === "FEATHER"
              ? "Feather"
              : "Card"}{" "}
            bidding slots.
          </p>
        </section>
      ) : (
        <>
          {/* PAGE HEADER */}

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-zinc-600">
                {type === "FEATHER"
                  ? "Feathers"
                  : "Cards"}
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Page {currentPage.pageNumber}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {pages.length}{" "}
                {pages.length === 1
                  ? "page"
                  : "pages"}{" "}
                · 4 slots per page
              </p>
            </div>

            <PageSelector
              currentPage={
                currentPage.pageNumber
              }
              pageCount={
                pages.length
              }
              onChange={goToPage}
            />
          </div>

          {/* GAME-STYLE PAGE */}

          <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-600">
                    {type === "FEATHER"
                      ? "Feather"
                      : "Card"}{" "}
                    Bidding
                  </p>

                  <h3 className="mt-1 font-semibold">
                    Page{" "}
                    {
                      currentPage.pageNumber
                    }
                  </h3>
                </div>

                <span className="text-sm text-zinc-500">
                  {currentPage.slots.length}{" "}
                  / {EMPTY_SLOTS} slots
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-zinc-800 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {Array.from({
                length: EMPTY_SLOTS,
              }).map(
                (_, index) => {
                  const slot =
                    currentPage.slots.find(
                      (item) =>
                        item.slotNumber ===
                        index + 1
                    );

                  return (
                    <BidSlot
                      key={index + 1}
                      slotNumber={
                        index + 1
                      }
                      slot={slot}
                    />
                  );
                }
              )}
            </div>
          </section>

          {/* PAGE NAVIGATION */}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                goToPage(
                  currentPage.pageNumber -
                    1
                )
              }
              disabled={
                currentPage.pageNumber ===
                1
              }
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Previous
            </button>

            <span className="text-sm text-zinc-500">
              Page{" "}
              {currentPage.pageNumber}{" "}
              of {pages.length}
            </span>

            <button
              type="button"
              onClick={() =>
                goToPage(
                  currentPage.pageNumber +
                    1
                )
              }
              disabled={
                currentPage.pageNumber ===
                pages.length
              }
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BidSlot({
  slotNumber,
  slot,
}: {
  slotNumber: number;
  slot?: Slot;
}) {
  if (!slot) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-sm text-zinc-600">
          {slotNumber}
        </div>

        <p className="mt-4 text-sm text-zinc-700">
          Empty Slot
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-64 flex-col p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-600">
          Slot {slotNumber}
        </span>

        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-500">
          ×1
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-lg font-bold">
          {getInitials(slot.member.characterName ?? "Unknown")}
        </div>

        <h4 className="mt-4 text-lg font-semibold">
          {slot.member.characterName}
        </h4>

        <p className="mt-2 text-sm text-zinc-500">
          {slot.resource.name}
        </p>
      </div>
    </div>
  );
}

function TypeButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-white text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}

      <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
        {count}
      </span>
    </button>
  );
}

function PageSelector({
  currentPage,
  pageCount,
  onChange,
}: {
  currentPage: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const pages = getPageNumbers(
    currentPage,
    pageCount
  );

  return (
    <div className="flex flex-wrap gap-1">
      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-9 w-9 items-center justify-center text-sm text-zinc-700"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() =>
              onChange(page)
            }
            className={`h-9 min-w-9 rounded-lg px-2 text-sm transition ${
              page === currentPage
                ? "bg-white font-semibold text-black"
                : "border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-white"
            }`}
          >
            {page}
          </button>
        )
      )}
    </div>
  );
}

function getPageNumbers(
  currentPage: number,
  pageCount: number
): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from(
      { length: pageCount },
      (_, index) => index + 1
    );
  }

  const pages: (
    | number
    | "ellipsis"
  )[] = [1];

  if (currentPage > 4) {
    pages.push("ellipsis");
  }

  const start = Math.max(
    2,
    currentPage - 1
  );

  const end = Math.min(
    pageCount - 1,
    currentPage + 1
  );

  for (
    let page = start;
    page <= end;
    page++
  ) {
    pages.push(page);
  }

  if (currentPage < pageCount - 3) {
    pages.push("ellipsis");
  }

  pages.push(pageCount);

  return pages;
}

function getInitials(
  name: string
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}