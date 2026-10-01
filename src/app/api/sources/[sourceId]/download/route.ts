import { z } from "zod";

import { getSourceDownloadUrl } from "@/services/download-source.server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  const { sourceId } = await context.params;
  const validSourceId = z.uuid().safeParse(sourceId);

  if (!validSourceId.success) {
    return Response.json({ error: { code: "invalid_source" } }, { status: 400, headers });
  }

  try {
    const url = await getSourceDownloadUrl(validSourceId.data);
    if (!url) {
      return Response.json({ error: { code: "source_not_found" } }, { status: 404, headers });
    }

    return Response.json({ url }, { headers });
  } catch {
    return Response.json({ error: { code: "download_unavailable" } }, { status: 503, headers });
  }
}
