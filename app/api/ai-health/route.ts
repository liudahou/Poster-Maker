import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const provider = getEnv("AI_IMAGE_PROVIDER", "openai");
  const apiBase = getEnv("AI_IMAGE_API_BASE", "https://api.openai.com/v1");
  const model = getEnv("AI_IMAGE_MODEL", "gpt-image-2");
  const size = getEnv("AI_IMAGE_SIZE", "512x768");
  const quality = getEnv("AI_IMAGE_QUALITY", "low");
  const outputFormat = getEnv("AI_IMAGE_OUTPUT_FORMAT", "png");
  const apiKey = getEnv("AI_IMAGE_API_KEY", "");
  const apiKeyConfigured = Boolean(apiKey);

  const result: Record<string, unknown> = {
    ok: true,
    provider,
    apiBase,
    model,
    size,
    quality,
    outputFormat,
    sizeConfigured: Boolean(process.env.AI_IMAGE_SIZE),
    qualityConfigured: Boolean(process.env.AI_IMAGE_QUALITY),
    apiKeyConfigured,
    node: process.version
  };

  if (provider.toLowerCase() !== "openai") {
    result.note = "AI_IMAGE_PROVIDER is not openai, so background generation will use the mock fallback.";
    return NextResponse.json(result);
  }

  if (!apiKeyConfigured) {
    return NextResponse.json(
      {
        ...result,
        ok: false,
        error: "AI_IMAGE_API_KEY is missing."
      },
      { status: 500 }
    );
  }

  const endpoint = `${apiBase.replace(/\/+$/, "")}/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    });
    const body = await response.text();

    return NextResponse.json({
      ...result,
      connectivity: {
        endpoint,
        status: response.status,
        ok: response.ok,
        bodyPreview: body.slice(0, 500)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...result,
        ok: false,
        connectivity: {
          endpoint,
          error: error instanceof Error ? error.message : "Unknown fetch error"
        }
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

function getEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}
