"use client";

import { useEffect } from "react";

type Props = {
  updates: Record<string, string>;
};

export default function MemberLastUpdateColumn({ updates }: Props) {
  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>("table");
    if (!table) return;

    const enhance = () => {
      const headRow = table.querySelector("thead tr");
      if (headRow && !headRow.querySelector("[data-rooc-last-update-header]")) {
        const actionsHeader = headRow.lastElementChild;
        const header = document.createElement("th");
        header.setAttribute("data-rooc-last-update-header", "true");
        header.className = "px-4 py-3 text-left font-medium text-zinc-400";
        header.textContent = "Last Update";
        if (actionsHeader) headRow.insertBefore(header, actionsHeader);
        else headRow.appendChild(header);
      }

      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
        const link = row.querySelector<HTMLAnchorElement>('a[href^="/guild/members/"]');
        if (!link) return;

        const memberId = link.getAttribute("href")?.split("/").pop();
        if (!memberId || !updates[memberId]) return;

        let cell = row.querySelector<HTMLTableCellElement>("[data-rooc-last-update-cell]");
        if (!cell) {
          cell = document.createElement("td");
          cell.setAttribute("data-rooc-last-update-cell", "true");
          cell.className = "px-4 py-3 text-zinc-400";
          const actionsCell = row.lastElementChild;
          if (actionsCell) row.insertBefore(cell, actionsCell);
          else row.appendChild(cell);
        }

        const date = new Date(updates[memberId]);
        cell.textContent = Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(table, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [updates]);

  return null;
}
