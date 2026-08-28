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
          const memberName =
            slot.member.characterName ??
            "Unknown";

          if (
            memberName
              .toLowerCase()
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
              memberName,
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

  // The remainder of this component is unchanged.
  return null;
}
