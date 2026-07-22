import { NextResponse } from "next/server";
import { getBackgroundJob } from "@/lib/ai/backgroundJobs";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = getBackgroundJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Background job not found or expired." }, { status: 404 });
  }

  if (job.status === "succeeded") {
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      updatedAt: job.updatedAt,
      result: job.result
    });
  }

  if (job.status === "failed") {
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      updatedAt: job.updatedAt,
      error: job.error ?? "Background generation failed."
    });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    updatedAt: job.updatedAt
  });
}
