import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/poster/constants";
import sharp from "sharp";

type GenerateBackgroundInput = {
  topic: string;
  content?: string;
  backgroundRequirement?: string;
  baseBackgroundDataUrl?: string;
  provider?: string;
};

type GenerateBackgroundResult = {
  backgroundDataUrl: string;
  provider: string;
  prompt: string;
};

export async function generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundResult> {
  const provider = (input.provider?.trim() || getEnv("AI_IMAGE_PROVIDER", "openai")).toLowerCase();
  const prompt = buildBackgroundPrompt(input);

  if (provider === "openai") {
    const backgroundDataUrl = input.baseBackgroundDataUrl
      ? await editWithOpenAI(prompt, input.baseBackgroundDataUrl)
      : await generateWithOpenAI(prompt);

    return {
      backgroundDataUrl,
      provider,
      prompt
    };
  }

  if (provider === "mock") {
    return {
      backgroundDataUrl: makeMockBackgroundDataUrl(),
      provider: "mock",
      prompt
    };
  }

  if (provider === "dashscope") {
    if (input.baseBackgroundDataUrl) {
      throw new Error("阿里云百炼 Qwen Image 当前只支持重新生成背景；如需基于当前背景微调，请选择 GPT Image。");
    }

    return {
      backgroundDataUrl: await generateWithDashScope(prompt),
      provider,
      prompt
    };
  }

  throw new Error(`Unsupported AI_IMAGE_PROVIDER "${provider}". Use "openai", "dashscope", or "mock".`);
}

export function buildBackgroundPrompt(input: GenerateBackgroundInput) {
  const context = [
    `Lecture topic: ${input.topic}.`,
    input.content ? `Lecture abstract: ${input.content.slice(0, 500)}.` : "",
    input.backgroundRequirement
      ? `User visual requirements, highest priority after mandatory no-text/no-logo/no-watermark rules: ${input.backgroundRequirement.slice(0, 500)}. If the user specifies a visual element, position, direction, or composition, follow it over the default layout suggestions below.`
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "Create a vertical campus technology lecture poster background for a fixed typography template.",
    context,
    "Priority order: 1) no text/logos/watermarks, 2) explicit user visual requirements, especially requested positions and composition, 3) clean readable typography-safe areas, 4) academic technology style, 5) lecture topic metaphors.",
    "The height percentage should be understood based on the overall size of the poster: 0% is the top edge, 100% is the bottom edge.",
    "Use the lecture context to choose relevant abstract visual metaphors. Reflect the theme through non-textual shapes and imagery only.",
    "Academic style, refined and restrained. Use subtle gradients, such as soft light trails, particles, grids, arcs, and abstract AI/technology motifs.",
    "Default layout guidance when the user does not specify a conflicting composition: reserve large smooth low-detail dark-blue negative space for poster text. The left column from top to middle should stay calm. The main paragraph area in the lower-left and lower-center, roughly 62% to 88% of poster height and 6% to 86% of poster width, should be especially plain, dark, low contrast, and free of detailed objects, bright lines, or high-frequency textures.",
    "Place stronger decorative motifs only in safe visual zones: right-middle illustration area, far edges, top edge, or very bottom margin. Avoid putting bright or complex details directly behind where body text will be placed.",
    "If the user asks for a theme, express it as subtle abstract background atmosphere while preserving the text-safe zones.",
    "No text, no letters, no numbers, no logo, no watermark, no signatures, no emblems.",
    `Aspect ratio close to ${POSTER_WIDTH}:${POSTER_HEIGHT}. Leave usable negative space for deterministic poster typography.`
  ].join(" ");
}

async function generateWithOpenAI(prompt: string) {
  await enableProxyFromEnvIfNeeded();

  const apiKey = getFirstEnv(["OPENAI_IMAGE_API_KEY", "OPENAI_API_KEY", "AI_IMAGE_API_KEY"], "");
  const model = getFirstEnv(["OPENAI_IMAGE_MODEL", "AI_IMAGE_MODEL"], "gpt-image-2");
  const size = getFirstEnv(["OPENAI_IMAGE_SIZE", "AI_IMAGE_SIZE"], "512x768");
  const quality = getFirstEnv(["OPENAI_IMAGE_QUALITY", "AI_IMAGE_QUALITY"], "low");
  const outputFormat = getFirstEnv(["OPENAI_IMAGE_OUTPUT_FORMAT", "AI_IMAGE_OUTPUT_FORMAT"], "png");
  const apiBase = getFirstEnv(["OPENAI_IMAGE_API_BASE", "AI_IMAGE_API_BASE"], "https://api.openai.com/v1");
  const endpoint = `${apiBase.replace(/\/+$/, "")}/images/generations`;

  if (!apiKey) {
    throw new Error("AI_IMAGE_PROVIDER=openai requires AI_IMAGE_API_KEY. Please check Meoo Secrets or environment variables.");
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size
  };

  if (quality) {
    body.quality = quality;
  }

  if (outputFormat) {
    body.output_format = outputFormat;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(describeFetchFailure(error, endpoint));
  }

  if (!response.ok) {
    const problem = await response.text();
    throw new Error(`AI background generation failed (${response.status} ${response.statusText}): ${problem.slice(0, 320)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }

  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error("Failed to download the generated AI background image.");
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  throw new Error("The AI image API did not return image data.");
}

async function editWithOpenAI(prompt: string, baseBackgroundDataUrl: string) {
  await enableProxyFromEnvIfNeeded();

  const apiKey = getFirstEnv(["OPENAI_IMAGE_API_KEY", "OPENAI_API_KEY", "AI_IMAGE_API_KEY"], "");
  const model = getFirstEnv(["OPENAI_IMAGE_MODEL", "AI_IMAGE_MODEL"], "gpt-image-2");
  const size = getFirstEnv(["OPENAI_IMAGE_SIZE", "AI_IMAGE_SIZE"], "512x768");
  const quality = getFirstEnv(["OPENAI_IMAGE_QUALITY", "AI_IMAGE_QUALITY"], "low");
  const outputFormat = getFirstEnv(["OPENAI_IMAGE_OUTPUT_FORMAT", "AI_IMAGE_OUTPUT_FORMAT"], "png");
  const apiBase = getFirstEnv(["OPENAI_IMAGE_API_BASE", "AI_IMAGE_API_BASE"], "https://api.openai.com/v1");
  const endpoint = `${apiBase.replace(/\/+$/, "")}/images/edits`;

  if (!apiKey) {
    throw new Error("AI_IMAGE_PROVIDER=openai requires AI_IMAGE_API_KEY. Please check Meoo Secrets or environment variables.");
  }

  const baseImage = await normalizeDataUrlImage(baseBackgroundDataUrl);
  const editPrompt = [
    "Edit the provided poster background image. Keep it as a no-text background for the same fixed campus lecture poster template.",
    "Preserve the overall poster-like composition where possible, and apply the user's latest visual requirements as the main edit instruction.",
    "Do not add text, letters, numbers, logos, watermarks, signatures, or emblems.",
    prompt
  ].join(" ");
  const formData = new FormData();

  formData.append("model", model);
  formData.append("prompt", editPrompt);
  formData.append("image", new Blob([new Uint8Array(baseImage)], { type: "image/png" }), "background.png");
  formData.append("n", "1");
  formData.append("size", size);

  if (quality) {
    formData.append("quality", quality);
  }

  if (outputFormat) {
    formData.append("output_format", outputFormat);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });
  } catch (error) {
    throw new Error(describeFetchFailure(error, endpoint));
  }

  if (!response.ok) {
    const problem = await response.text();
    throw new Error(`AI background edit failed (${response.status} ${response.statusText}): ${problem.slice(0, 420)}`);
  }

  return readImageFromResponse(await response.json());
}

async function generateWithDashScope(prompt: string) {
  const apiKey = getFirstEnv(["DASHSCOPE_API_KEY", "DASHSCOPE_IMAGE_API_KEY"], "");
  const model = getEnv("DASHSCOPE_IMAGE_MODEL", "qwen-image-2.0");
  const size = normalizeDashScopeSize(getEnv("DASHSCOPE_IMAGE_SIZE", "512*768"));
  const apiBase = getEnv("DASHSCOPE_API_BASE", "https://dashscope.aliyuncs.com/api/v1");
  const endpoint = `${apiBase.replace(/\/+$/, "")}/services/aigc/multimodal-generation/generation`;

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is required for 阿里云百炼 Qwen Image.");
  }

  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            {
              text: prompt
            }
          ]
        }
      ]
    },
    parameters: {
      size,
      n: 1,
      watermark: false,
      negative_prompt: "text, letters, words, numbers, logo, watermark, signature, emblem, QR code"
    }
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(describeFetchFailure(error, endpoint));
  }

  const payload = await readJsonResponse(response, "DashScope background generation");
  const directImage = await readImageFromDashScopePayload(payload);
  if (directImage) {
    return directImage;
  }

  const taskId = getDashScopeTaskId(payload);
  if (!taskId) {
    throw new Error(`DashScope did not return an image or task id: ${JSON.stringify(payload).slice(0, 500)}`);
  }

  return pollDashScopeTask(apiBase, apiKey, taskId);
}

async function pollDashScopeTask(apiBase: string, apiKey: string, taskId: string) {
  const endpoint = `${apiBase.replace(/\/+$/, "")}/tasks/${encodeURIComponent(taskId)}`;
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(2500);
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });
    } catch (error) {
      throw new Error(describeFetchFailure(error, endpoint));
    }

    const payload = await readJsonResponse(response, "DashScope task polling");
    const image = await readImageFromDashScopePayload(payload);
    if (image) {
      return image;
    }

    const status = getDashScopeTaskStatus(payload);
    if (["FAILED", "UNKNOWN", "CANCELED", "REJECTED"].includes(status)) {
      throw new Error(`DashScope image task failed: ${JSON.stringify(payload).slice(0, 500)}`);
    }
  }

  throw new Error("DashScope image task timed out.");
}

async function readJsonResponse(response: Response, label: string) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status} ${response.statusText}): ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 500)}`);
  }
}

async function readImageFromDashScopePayload(payload: unknown) {
  for (const value of collectStrings(payload)) {
    if (value.startsWith("data:image/")) {
      return value;
    }

    if (isLikelyBase64Image(value)) {
      return `data:image/png;base64,${value}`;
    }

    if (/^https?:\/\//i.test(value) && /\.(png|jpe?g|webp)(\?|$)/i.test(value)) {
      const imageResponse = await fetch(value);
      if (!imageResponse.ok) {
        throw new Error("Failed to download the DashScope generated image.");
      }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
  }

  return "";
}

function getDashScopeTaskId(payload: unknown) {
  const output = getObjectProperty(payload, "output");
  return getStringProperty(output, "task_id") || getStringProperty(payload, "task_id");
}

function getDashScopeTaskStatus(payload: unknown) {
  const output = getObjectProperty(payload, "output");
  return (getStringProperty(output, "task_status") || getStringProperty(payload, "task_status")).toUpperCase();
}

function getObjectProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return property && typeof property === "object" ? property : null;
}

function getStringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return "";
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : "";
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

function isLikelyBase64Image(value: string) {
  return value.length > 1000 && /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function normalizeDashScopeSize(value: string) {
  return value.replace(/x/i, "*");
}

async function normalizeDataUrlImage(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("当前背景图片数据格式无效，无法微调。");
  }

  const mimeSubtype = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  if (mimeSubtype === "png") {
    return buffer;
  }

  return sharp(buffer).resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "center" }).png().toBuffer();
}

async function readImageFromResponse(payload: { data?: Array<{ b64_json?: string; url?: string }> }) {
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }

  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error("Failed to download the edited AI background image.");
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  throw new Error("The AI image API did not return image data.");
}

let proxyFromEnvEnabled = false;

async function enableProxyFromEnvIfNeeded() {
  if (proxyFromEnvEnabled || !hasProxyEnv()) {
    return;
  }

  const http = (await import("node:http")) as typeof import("node:http") & {
    setGlobalProxyFromEnv?: () => void;
  };

  if (typeof http.setGlobalProxyFromEnv !== "function") {
    throw new Error("This Node.js version does not support proxy env for fetch. Please use Node.js 24.14 or newer.");
  }

  http.setGlobalProxyFromEnv();
  proxyFromEnvEnabled = true;
}

function hasProxyEnv() {
  return Boolean(
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  );
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeFetchFailure(error: unknown, endpoint: string) {
  const parts = [
    `Cannot connect to OpenAI image API: ${endpoint}.`
  ];

  if (error instanceof Error && error.message) {
    parts.push(`Fetch error: ${error.message}.`);
  }

  const cause = error && typeof error === "object" ? (error as { cause?: unknown }).cause : undefined;
  if (cause && typeof cause === "object") {
    const causeError = cause as { code?: unknown; message?: unknown; address?: unknown; port?: unknown };
    if (typeof causeError.code === "string") {
      parts.push(`Code: ${causeError.code}.`);
    }
    if (typeof causeError.message === "string") {
      parts.push(`Cause: ${causeError.message}.`);
    }
    if (typeof causeError.address === "string" || typeof causeError.port === "number") {
      parts.push(`Target: ${String(causeError.address ?? "")}:${String(causeError.port ?? "")}.`);
    }
  }

  parts.push("Please check VPN/proxy/firewall/DNS settings, API key billing, and AI_IMAGE_API_BASE.");
  return parts.join(" ");
}
function makeMockBackgroundDataUrl() {
  const variant = Math.floor(Math.random() * 5);
  const seed = Math.random();
  const accentHue = 178 + Math.round(seed * 42);
  const composition = [
    makeHorizonComposition(seed),
    makeCircuitComposition(seed),
    makeProfileComposition(seed),
    makeNetworkComposition(seed),
    makeTunnelComposition(seed)
  ][variant];

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    <radialGradient id="glowA" cx="${16 + variant * 7}%" cy="${8 + variant * 4}%" r="68%">
      <stop offset="0" stop-color="#0a63ff"/>
      <stop offset=".48" stop-color="#062789"/>
      <stop offset="1" stop-color="#031b63"/>
    </radialGradient>
    <radialGradient id="glowB" cx="${70 + Math.round(seed * 24)}%" cy="${32 + variant * 10}%" r="42%">
      <stop offset="0" stop-color="hsl(${accentHue}, 100%, 54%)" stop-opacity=".6"/>
      <stop offset=".42" stop-color="#0b7ae6" stop-opacity=".2"/>
      <stop offset="1" stop-color="#00113f" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="horizon" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#0cf4ff" stop-opacity=".1"/>
      <stop offset=".48" stop-color="#8ff8ff" stop-opacity=".95"/>
      <stop offset="1" stop-color="#168cff" stop-opacity=".22"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#glowA)"/>
  <rect width="100%" height="100%" fill="url(#glowB)"/>
  ${composition}
  <g opacity=".2" fill="#53f5ff">
    ${Array.from({ length: 120 }, (_, i) => {
    const x = (i * 97 + Math.round(seed * 431) + variant * 137) % POSTER_WIDTH;
    const y = (i * 173 + Math.round(seed * 619) + variant * 211) % POSTER_HEIGHT;
    const r = 1 + (i % 4);
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }).join("")}
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function makeHorizonComposition(seed: number) {
  const horizonY = 1180 + Math.round(seed * 150);
  const ringX = 860 + Math.round(seed * 140);
  const ringY = 1050 + Math.round((1 - seed) * 160);

  return `
  <g opacity=".16" stroke="#49dfff" fill="none">
    ${Array.from({ length: 26 }, (_, i) => `<path d="M-${260 + i * 18} ${360 + i * 35} C ${260 + i * 20} ${260 + i * 22}, ${620 + i * 14} ${520 + i * 20}, ${1240 + i * 3} ${430 + i * 32}"/>`).join("")}
  </g>
  <g opacity=".6" stroke="#19e8ff" fill="none" stroke-width="2">
    <path d="M-40 ${horizonY} C 275 ${horizonY - 112}, 620 ${horizonY - 124}, 1250 ${horizonY + 42}"/>
    <path d="M-50 ${horizonY + 22} C 278 ${horizonY - 88}, 650 ${horizonY - 92}, 1260 ${horizonY + 72}" stroke="#99fbff" stroke-width="5" filter="url(#soft)"/>
    <path d="M-70 ${horizonY + 38} C 260 ${horizonY - 66}, 638 ${horizonY - 68}, 1260 ${horizonY + 97}"/>
  </g>
  <g opacity=".34" stroke="#2df3ff" stroke-width="2" fill="none">
    <circle cx="${ringX}" cy="${ringY}" r="178"/>
    <circle cx="${ringX}" cy="${ringY}" r="228"/>
    <path d="M${ringX - 127} ${ringY - 34} L${ringX - 22} ${ringY - 106} L${ringX + 83} ${ringY - 16} L${ringX + 132} ${ringY - 68}"/>
    <path d="M${ringX - 137} ${ringY + 80} L${ringX - 37} ${ringY + 34} L${ringX + 65} ${ringY + 100} L${ringX + 153} ${ringY + 51}"/>
  </g>`;
}

function makeCircuitComposition(seed: number) {
  const startY = 260 + Math.round(seed * 160);
  const chipX = 720 + Math.round(seed * 130);
  const chipY = 760 + Math.round((1 - seed) * 170);

  return `
  <g opacity=".22" stroke="#49dfff" stroke-width="2" fill="none">
    ${Array.from({ length: 16 }, (_, i) => {
    const y = startY + i * 72;
    return `<path d="M0 ${y} H${250 + i * 18} V${y + 34} H${520 + (i % 4) * 90}"/>`;
  }).join("")}
    ${Array.from({ length: 14 }, (_, i) => {
    const x = 520 + (i % 5) * 130;
    const y = 280 + i * 82;
    return `<path d="M${x} ${y} V${y + 120} H${x + 180}"/>`;
  }).join("")}
  </g>
  <g transform="translate(${chipX} ${chipY}) rotate(-12)" opacity=".58">
    <rect x="-150" y="-150" width="300" height="300" rx="28" fill="none" stroke="#2df3ff" stroke-width="5"/>
    <rect x="-92" y="-92" width="184" height="184" rx="18" fill="rgba(20,240,255,.08)" stroke="#9bffff" stroke-width="3"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${-132 + i * 33} -190 V-150 M${-132 + i * 33} 150 V190 M-190 ${-132 + i * 33} H-150 M150 ${-132 + i * 33} H190" stroke="#2df3ff" stroke-width="3"/>`).join("")}
  </g>`;
}

function makeProfileComposition(seed: number) {
  const x = 790 + Math.round(seed * 120);
  const y = 860 + Math.round(seed * 140);

  return `
  <g opacity=".5" stroke="#2df3ff" stroke-width="4" fill="none" transform="translate(${x} ${y})">
    <path d="M105 -290 C-10 -255 -75 -158 -68 -34 C-64 32 -28 80 -52 145 C-16 147 19 148 52 146 C64 205 86 250 132 310"/>
    <path d="M20 -218 C90 -176 128 -105 126 -18 C124 65 84 114 36 150"/>
    <path d="M-16 -22 C42 -42 88 -39 138 -14"/>
    <circle cx="84" cy="-52" r="12" fill="#66ffff" stroke="none"/>
    <path d="M44 64 C86 92 130 98 174 70"/>
    ${Array.from({ length: 34 }, (_, i) => {
    const px = -20 + (i * 47) % 240;
    const py = -230 + (i * 83) % 470;
    return `<circle cx="${px}" cy="${py}" r="${2 + (i % 3)}" fill="#66ffff" stroke="none"/>`;
  }).join("")}
  </g>
  <g opacity=".18" stroke="#7ddcff" fill="none">
    ${Array.from({ length: 10 }, (_, i) => `<circle cx="${x + 70}" cy="${y - 20}" r="${120 + i * 38}"/>`).join("")}
  </g>`;
}

function makeNetworkComposition(seed: number) {
  const nodes = Array.from({ length: 34 }, (_, i) => ({
    x: 570 + ((i * 113 + Math.round(seed * 240)) % 560),
    y: 410 + ((i * 191 + Math.round(seed * 360)) % 830)
  }));

  return `
  <g opacity=".36" stroke="#30ecff" stroke-width="2" fill="none">
    ${nodes
      .map((node, i) => {
        const next = nodes[(i + 7) % nodes.length];
        return `<path d="M${node.x} ${node.y} L${next.x} ${next.y}"/>`;
      })
      .join("")}
  </g>
  <g opacity=".78" fill="#7ffcff">
    ${nodes.map((node, i) => `<circle cx="${node.x}" cy="${node.y}" r="${4 + (i % 4)}"/>`).join("")}
  </g>
  <g opacity=".12" stroke="#9bffff" fill="none">
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${-80 + i * 72} 250 C${180 + i * 24} ${560 + i * 18}, ${660 + i * 22} ${820 - i * 10}, 1320 ${760 + i * 42}"/>`).join("")}
  </g>`;
}

function makeTunnelComposition(seed: number) {
  const cx = 780 + Math.round(seed * 170);
  const cy = 840 + Math.round((1 - seed) * 160);

  return `
  <g opacity=".42" stroke="#2df3ff" fill="none">
    ${Array.from({ length: 28 }, (_, i) => {
    const r = 70 + i * 34;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.08}" ry="${r}" transform="rotate(${i * 5} ${cx} ${cy})"/>`;
  }).join("")}
  </g>
  <g opacity=".45" stroke="#8fffff" stroke-width="3" fill="none">
    ${Array.from({ length: 18 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 18;
    const x = cx + Math.cos(angle) * 560;
    const y = cy + Math.sin(angle) * 560;
    return `<path d="M${cx} ${cy} L${x} ${y}"/>`;
  }).join("")}
  </g>
  <circle cx="${cx}" cy="${cy}" r="70" fill="#14f0ff" opacity=".12"/>
  <circle cx="${cx}" cy="${cy}" r="18" fill="#9bffff" opacity=".8"/>`;
}
