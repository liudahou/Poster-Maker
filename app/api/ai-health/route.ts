import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const defaultProvider = getEnv("AI_IMAGE_PROVIDER", "dashscope");
  const openai = {
    apiBase: getFirstEnv(["OPENAI_IMAGE_API_BASE", "AI_IMAGE_API_BASE"], "https://api.openai.com/v1"),
    model: getFirstEnv(["OPENAI_IMAGE_MODEL", "AI_IMAGE_MODEL"], "gpt-image-2"),
    size: getFirstEnv(["OPENAI_IMAGE_SIZE", "AI_IMAGE_SIZE"], "512x768"),
    quality: getFirstEnv(["OPENAI_IMAGE_QUALITY", "AI_IMAGE_QUALITY"], "low"),
    outputFormat: getFirstEnv(["OPENAI_IMAGE_OUTPUT_FORMAT", "AI_IMAGE_OUTPUT_FORMAT"], "png"),
    apiKeyConfigured: Boolean(getFirstEnv(["OPENAI_IMAGE_API_KEY", "OPENAI_API_KEY", "AI_IMAGE_API_KEY"], ""))
  };
  const dashscope = {
    apiBase: getEnv("DASHSCOPE_API_BASE", "https://dashscope.aliyuncs.com/api/v1"),
    model: getEnv("DASHSCOPE_IMAGE_MODEL", "qwen-image-2.0"),
    size: getEnv("DASHSCOPE_IMAGE_SIZE", "512*768"),
    apiKeyConfigured: Boolean(getFirstEnv(["DASHSCOPE_API_KEY", "DASHSCOPE_IMAGE_API_KEY"], ""))
  };

  const result: Record<string, unknown> = {
    ok: true,
    defaultProvider,
    providers: {
      openai,
      dashscope
    },
    node: process.version
  };

  const checks = await Promise.allSettled([
    checkOpenAI(openai.apiBase, getFirstEnv(["OPENAI_IMAGE_API_KEY", "OPENAI_API_KEY", "AI_IMAGE_API_KEY"], "")),
    checkDashScope(dashscope.apiBase, getFirstEnv(["DASHSCOPE_API_KEY", "DASHSCOPE_IMAGE_API_KEY"], ""))
  ]);

  result.connectivity = {
    openai: checks[0].status === "fulfilled" ? checks[0].value : { ok: false, error: checks[0].reason?.message ?? "Unknown error" },
    dashscope: checks[1].status === "fulfilled" ? checks[1].value : { ok: false, error: checks[1].reason?.message ?? "Unknown error" }
  };

  return NextResponse.json(result);
}

async function checkOpenAI(apiBase: string, apiKey: string) {
  if (!apiKey) {
    return { ok: false, error: "OPENAI_IMAGE_API_KEY is missing." };
  }

  return checkEndpoint(`${apiBase.replace(/\/+$/, "")}/models`, apiKey);
}

async function checkDashScope(apiBase: string, apiKey: string) {
  if (!apiKey) {
    return { ok: false, error: "DASHSCOPE_API_KEY is missing." };
  }

  return checkEndpoint(`${apiBase.replace(/\/+$/, "")}/models`, apiKey);
}

async function checkEndpoint(endpoint: string, apiKey: string) {
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

    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      bodyPreview: body.slice(0, 500)
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function getFirstEnv(names: string[], fallback: string) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return fallback;
}
