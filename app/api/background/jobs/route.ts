import { NextRequest, NextResponse } from "next/server";
import { createBackgroundJob, getBackgroundDataUrl } from "@/lib/ai/backgroundJobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      content?: string;
      backgroundRequirement?: string;
      baseBackgroundId?: string;
      baseBackgroundDataUrl?: string;
      provider?: string;
    };
    const topic = body.topic?.trim();
    const baseBackgroundId = body.baseBackgroundId?.trim();

    if (!topic) {
      return NextResponse.json({ error: "Please enter the lecture topic." }, { status: 400 });
    }

    const baseBackgroundDataUrl = baseBackgroundId
      ? getBackgroundDataUrl(baseBackgroundId) ?? undefined
      : body.baseBackgroundDataUrl;

    if (baseBackgroundId && !baseBackgroundDataUrl) {
      return NextResponse.json(
        { error: "The selected background cache has expired. Please generate a new background before refining." },
        { status: 400 }
      );
    }

    const job = createBackgroundJob({
      topic,
      content: body.content?.trim() ?? "",
      backgroundRequirement: body.backgroundRequirement?.trim() ?? "",
      baseBackgroundDataUrl,
      provider: body.provider?.trim() ?? ""
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create background job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
