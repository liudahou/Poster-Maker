import type { PosterFieldsForRender } from "./renderPoster";
import { sanitizePosterLayout, type PosterLayout, type PosterTextKey } from "./layout";
import { POSTER_HEIGHT, POSTER_WIDTH } from "./constants";

const fontStack = "'Noto Sans SC','Noto Sans CJK SC','Microsoft YaHei','PingFang SC','SimHei',Arial,sans-serif";

export function makeTemplateSvg(input: PosterFieldsForRender, layoutInput?: PosterLayout) {
  const layout = sanitizePosterLayout(layoutInput);
  const textNodes = layout
    .filter((element) => element.type === "text")
    .map((element) => renderTextElement(element, getTextValue(input, element.textKey)))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    ${layout
      .filter((element) => element.type === "text")
      .map(
        (element) =>
          `<clipPath id="clip-${element.id}"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"/></clipPath>`
      )
      .join("")}
  </defs>
  <style>
    text { font-family: ${fontStack}; letter-spacing: 0; }
    .line { stroke: #ffffff; stroke-opacity: .68; stroke-width: 2.3; fill: none; }
    .chev { stroke: #ffffff; stroke-opacity: .75; stroke-width: 2.8; fill: none; stroke-linecap: round; }
  </style>
  ${cornerChevrons()}
  ${sectionRule(98, 218, 405)}
  ${sectionRule(98, 426, 405)}
  ${sectionRule(98, 656, 425)}
  ${sectionRule(98, 1280, 430)}
  ${textNodes}
</svg>`;
}

function renderTextElement(
  element: Extract<PosterLayout[number], { type: "text" }>,
  value: string
) {
  if (!value.trim()) {
    return "";
  }

  if (element.sideways) {
    return renderSidewaysText(element, value);
  }

  if (element.vertical) {
    return renderVerticalText(element, value);
  }

  const lines = wrapText(value, element.width, element.height, element.fontSize, element.lineHeight);
  const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
  const textX = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
  const transform = element.rotate ? ` transform="rotate(${element.rotate} ${element.x} ${element.y})"` : "";

  return `<text clip-path="url(#clip-${element.id})" x="${textX}" y="${element.y + element.fontSize}"${transform} text-anchor="${anchor}" fill="${element.color}" font-size="${element.fontSize}" font-weight="${element.fontWeight}">
    ${lines
      .map(
        (line, index) =>
          `<tspan x="${textX}" dy="${index === 0 ? 0 : element.fontSize * element.lineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>`;
}

function renderVerticalText(element: Extract<PosterLayout[number], { type: "text" }>, value: string) {
  const chars = Array.from(value.trim());
  const maxChars = Math.max(1, Math.floor(element.height / (element.fontSize * element.lineHeight)));
  const visibleChars = chars.slice(0, maxChars);
  const x = element.x + element.width / 2;

  return `<text clip-path="url(#clip-${element.id})" text-anchor="middle" fill="${element.color}" font-size="${element.fontSize}" font-weight="${element.fontWeight}">
    ${visibleChars
      .map(
        (char, index) =>
          `<tspan x="${x}" y="${element.y + element.fontSize + index * element.fontSize * element.lineHeight}">${escapeXml(char)}</tspan>`
      )
      .join("")}
  </text>`;
}

function renderSidewaysText(element: Extract<PosterLayout[number], { type: "text" }>, value: string) {
  const text = value.trim();
  const maxChars = Math.max(1, Math.floor(element.height / (element.fontSize * 0.54)));
  const visibleText = text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 3))}...` : text;
  const x = element.x + 55;
  const y = element.y + element.fontSize * 0.02 + 10;

  return `<text x="${x}" y="${y}" transform="rotate(90 ${x} ${y})" text-anchor="start" fill="${element.color}" font-size="${element.fontSize}" font-weight="${element.fontWeight}">
    ${escapeXml(visibleText)}
  </text>`;
}

function getTextValue(input: PosterFieldsForRender, textKey: PosterTextKey) {
  const fixed: Record<PosterTextKey, string> = {
    topic: input.topic,
    topicEn: input.topicEn,
    timeLabel: "讲座时间/DATE",
    time: input.time,
    locationLabel: "讲座地点/ADDRESS",
    location: input.location,
    speakerLabel: "主讲人/SPEAKER",
    speakerName: input.speakerName,
    speakerIntro: input.speakerIntro,
    contentLabel: "主讲内容/VERBIAGE",
    content: input.content,
    organizerLabel: "主办单位:",
    organizer: input.organizer
  };

  return fixed[textKey] ?? "";
}

function sectionRule(x: number, y: number, width: number) {
  return `<path class="line" d="M${x} ${y} H${x + 86} L${x + 122} ${y + 18} L${x + 158} ${y} H${x + width}"/>`;
}

function cornerChevrons() {
  return `
  <path class="chev" d="M102 66 L112 86 L122 66"/>
  <path class="chev" d="M102 98 L112 118 L122 98"/>
  <path class="chev" d="M102 130 L112 150 L122 130"/>`;
}

function wrapText(value: string, width: number, height: number, fontSize: number, lineHeight: number) {
  const maxUnits = Math.max(4, Math.floor(width / (fontSize * 0.54)));
  const maxLines = Math.max(1, Math.floor(height / (fontSize * lineHeight)));
  const rawLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = rawLines.flatMap((line) => wrapLine(line, maxUnits));

  if (lines.length <= maxLines) {
    return lines;
  }

  const clipped = lines.slice(0, maxLines);
  clipped[clipped.length - 1] = `${clipped[clipped.length - 1].replace(/[锛屻€傦紱銆?.!?锛侊紵;:锛歕s]+$/, "")}...`;
  return clipped;
}

function wrapLine(line: string, maxUnits: number) {
  const chunks: string[] = [];
  let current = "";
  let units = 0;

  for (const char of Array.from(line)) {
    const charUnits = /[\x00-\xff]/.test(char) ? 1 : 2;
    if (current && units + charUnits > maxUnits) {
      chunks.push(current.trim());
      current = char;
      units = charUnits;
    } else {
      current += char;
      units += charUnits;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
