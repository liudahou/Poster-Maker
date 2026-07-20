import { NextRequest, NextResponse } from "next/server";
import { generateBackground } from "@/lib/ai/background";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      content?: string;
      backgroundRequirement?: string;
      baseBackgroundDataUrl?: string;
    };
    const topic = body.topic?.trim();

    if (!topic) {
      return NextResponse.json({ error: "Please enter the lecture topic." }, { status: 400 });
    }

    const result = await generateBackground({
      topic,
      content: body.content?.trim() ?? "",
      backgroundRequirement: body.backgroundRequirement?.trim() ?? "",
      baseBackgroundDataUrl: body.baseBackgroundDataUrl
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
