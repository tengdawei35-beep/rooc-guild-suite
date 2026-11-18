import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

function extractSheetInfo(
  url: string
): {
  sheetId: string;
  gid: string;
} | null {
  try {
    const parsed = new URL(url);

    const match = parsed.pathname.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
    );

    if (!match?.[1]) {
      return null;
    }

    return {
      sheetId: match[1],
      gid: parsed.searchParams.get("gid") ?? "0",
    };
  } catch {
    return null;
  }
}

async function fetchCsv(
  url: string
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";
    const text = await response.text();
    const trimmed = text.trimStart();

    if (!text.trim()) {
      return null;
    }

    if (
      contentType.includes("text/html") ||
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html")
    ) {
      return null;
    }

    return text;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, "members.import")) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to import members.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const url =
      typeof body.url === "string"
        ? body.url.trim()
        : "";

    if (!url) {
      return NextResponse.json(
        { error: "Google Sheets URL is required." },
        { status: 400 }
      );
    }

    const sheetInfo = extractSheetInfo(url);

    if (!sheetInfo) {
      return NextResponse.json(
        { error: "Invalid Google Sheets URL." },
        { status: 400 }
      );
    }

    const gid =
      typeof body.gid === "string" && body.gid.trim()
        ? body.gid.trim()
        : sheetInfo.gid;

    const exportUrl =
      `https://docs.google.com/spreadsheets/d/${sheetInfo.sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;

    const gvizUrl =
      `https://docs.google.com/spreadsheets/d/${sheetInfo.sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;

    let csv = await fetchCsv(exportUrl);

    if (!csv) {
      csv = await fetchCsv(gvizUrl);
    }

    if (!csv) {
      return NextResponse.json(
        {
          error:
            "Unable to access the Google Sheet. Make sure the sheet is accessible without requiring a Google login.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      csv,
    });
  } catch (error) {
    console.error(
      "[GOOGLE SHEETS IMPORT]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read Google Sheet.",
      },
      { status: 500 }
    );
  }
}
