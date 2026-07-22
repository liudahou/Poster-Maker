import { NextRequest, NextResponse } from "next/server";
import { createBackgroundJob } from "@/lib/ai/backgroundJobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      content?: string;
      backgroundRequirement?: string;
      baseBackgroundDataUrl?: string;
      provider?: string;
    };
    const topic = body.topic?.trim();

    if (!topic) {
      return NextResponse.json({ error: "Please enter the lecture topic." }, { status: 400 });
    }

    const job = createBackgroundJob({
      topic,
      content: body.content?.trim() ?? "",
      backgroundRequirement: body.backgroundRequirement?.trim() ?? "",
      baseBackgroundDataUrl: body.baseBackgroundDataUrl,
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
