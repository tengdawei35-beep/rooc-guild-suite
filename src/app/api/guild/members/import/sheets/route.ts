import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

function extractSheetId(
  url: string
): string | null {
  try {
    const parsed =
      new URL(url);

    const match =
      parsed.pathname.match(
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
      );

    return (
      match?.[1] ??
      null
    );
  } catch {
    return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.import"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to import members.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const url =
      typeof body.url ===
      "string"
        ? body.url.trim()
        : "";

    if (!url) {
      return NextResponse.json(
        {
          error:
            "Google Sheets URL is required.",
        },
        { status: 400 }
      );
    }

    const sheetId =
      extractSheetId(url);

    if (!sheetId) {
      return NextResponse.json(
        {
          error:
            "Invalid Google Sheets URL.",
        },
        { status: 400 }
      );
    }

    const gid =
      typeof body.gid ===
        "string" &&
      body.gid.trim()
        ? body.gid.trim()
        : "0";

    const csvUrl =
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;

    const response =
      await fetch(
        csvUrl,
        {
          cache: "no-store",
        }
      );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "Unable to access the Google Sheet. Make sure the sheet is accessible without requiring a Google login.",
        },
        { status: 400 }
      );
    }

    const csv =
      await response.text();

    if (!csv.trim()) {
      return NextResponse.json(
        {
          error:
            "The Google Sheet appears to be empty.",
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