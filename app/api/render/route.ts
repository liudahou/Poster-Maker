import { NextRequest, NextResponse } from "next/server";
import { renderPoster, type PosterRenderInput } from "@/lib/poster/renderPoster";
import { sanitizePosterLayout } from "@/lib/poster/layout";

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

    if (!values.backgroundDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "背景图片数据无效。" }, { status: 400 });
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

    const input: PosterRenderInput = {
      ...values,
      avatar: Buffer.from(await avatar.arrayBuffer()),
      logos: await Promise.all(logos.map(async (logo) => Buffer.from(await logo.arrayBuffer()))),
      layout: sanitizePosterLayout(parseJson(formData.get("layout")))
    };

    const png = await renderPoster(input);

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="lecture-poster.png"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "海报合成失败。";
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
