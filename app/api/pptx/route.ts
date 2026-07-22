import { NextRequest, NextResponse } from "next/server";
import { getBackgroundDataUrl } from "@/lib/ai/backgroundJobs";
import { sanitizePosterLayout } from "@/lib/poster/layout";
import { renderPosterPptx, type PosterPptxInput } from "@/lib/poster/pptxPoster";

export const runtime = "nodejs";

const textFields = [
  "topic",
  "topicEn",
  "time",
  "location",
  "speakerName",
  "speakerIntro",
  "content",
  "organizer",
  "backgroundId",
  "backgroundDataUrl"
] as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const values = Object.fromEntries(
      textFields.map((field) => [field, String(formData.get(field) ?? "")])
    ) as Record<(typeof textFields)[number], string>;

    const missing = ["topic", "time", "location", "speakerName", "speakerIntro", "content", "organizer"].find(
      (field) => !values[field as keyof typeof values].trim()
    );

    if (missing) {
      return NextResponse.json({ error: "请填写所有必填字段。" }, { status: 400 });
    }

    const backgroundDataUrl = resolveBackgroundDataUrl(values.backgroundId, values.backgroundDataUrl);
    if (!backgroundDataUrl) {
      return NextResponse.json({ error: "背景图片缓存已失效，请重新生成背景后再导出。" }, { status: 400 });
    }

    const avatar = formData.get("avatar");
    const logoFiles = formData.getAll("logos");

    if (!isUploadedImage(avatar)) {
      return NextResponse.json({ error: "请上传主讲人头像。" }, { status: 400 });
    }

    const logos = logoFiles.filter(isUploadedImage).slice(0, 2);
    if (logos.length === 0) {
      return NextResponse.json({ error: "请至少上传一个 Logo。" }, { status: 400 });
    }

    const input: PosterPptxInput = {
      ...values,
      backgroundDataUrl,
      avatar: {
        buffer: Buffer.from(await avatar.arrayBuffer()),
        mimeType: avatar.type
      },
      logos: await Promise.all(
        logos.map(async (logo) => ({
          buffer: Buffer.from(await logo.arrayBuffer()),
          mimeType: logo.type
        }))
      ),
      layout: sanitizePosterLayout(parseJson(formData.get("layout")))
    };

    const pptx = await renderPosterPptx(input);

    return new NextResponse(new Uint8Array(pptx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": 'attachment; filename="lecture-poster-editable.pptx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PPTX 导出失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isUploadedImage(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "type" in value &&
    typeof value.type === "string" &&
    value.type.startsWith("image/")
  );
}

function resolveBackgroundDataUrl(backgroundId: string, fallbackDataUrl: string) {
  if (backgroundId.trim()) {
    const cached = getBackgroundDataUrl(backgroundId.trim());
    if (cached) {
      return cached;
    }
  }

  if (fallbackDataUrl.startsWith("data:image/")) {
    return fallbackDataUrl;
  }

  return "";
}
