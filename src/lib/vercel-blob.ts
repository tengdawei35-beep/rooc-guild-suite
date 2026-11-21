import { randomUUID } from "node:crypto";

function credentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Private Vercel Blob is not configured. Connect a private Blob store and set BLOB_READ_WRITE_TOKEN.");
  const storeId = token.split("_")[3];
  if (!storeId) throw new Error("The Vercel Blob token does not contain a valid store ID.");
  return { token, storeId };
}

export async function putPrivateBlob(pathname: string, body: Buffer, contentType: string) {
  const { token, storeId } = credentials();
  const response = await fetch("https://vercel.com/api/blob/?pathname=" + encodeURIComponent(pathname), {
    method: "PUT",
    headers: {
      authorization: "Bearer " + token,
      "x-vercel-blob-store-id": storeId,
      "x-api-version": "13",
      "x-vercel-blob-access": "private",
      "x-content-type": contentType,
      "x-add-random-suffix": "1",
      "x-api-blob-request-id": randomUUID(),
      "x-api-blob-request-attempt": "0",
      "x-content-length": String(body.byteLength),
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Private screenshot upload failed (" + response.status + "). " + detail.slice(0, 300));
  }
  return await response.json() as { url: string; pathname: string; contentType: string };
}

export async function getPrivateBlob(pathname: string) {
  const { token, storeId } = credentials();
  const url = "https://" + storeId + ".private.blob.vercel-storage.com/" + pathname.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(url, { headers: { authorization: "Bearer " + token } });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Private screenshot retrieval failed (" + response.status + ").");
  }
  return response;
}
