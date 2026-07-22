import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { POSTER_HEIGHT, POSTER_WIDTH } from "./constants";
import { sanitizePosterLayout, type PosterLayout } from "./layout";
import { makeTemplateSvg } from "./templateSvg";

export type PosterFieldsForRender = {
  topic: string;
  topicEn: string;
  time: string;
  location: string;
  speakerName: string;
  speakerIntro: string;
  content: string;
  organizer: string;
};

export type PosterRenderInput = PosterFieldsForRender & {
  backgroundDataUrl: string;
  avatar: Buffer;
  logos: Buffer[];
  layout?: PosterLayout;
};

export async function renderPoster(input: PosterRenderInput) {
  ensureFontCache();

  const layout = sanitizePosterLayout(input.layout);
  const background = dataUrlToBuffer(input.backgroundDataUrl);
  const imageElements = layout.filter((element) => element.type === "image");
  const avatarElement = imageElements.find((element) => element.imageKey === "avatar");
  const logoElements = imageElements.filter((element) => element.imageKey === "logo0" || element.imageKey === "logo1");
  const avatar = avatarElement ? await makeImage(input.avatar, avatarElement.width, avatarElement.height, avatarElement.fit) : null;
  const logos = await Promise.all(
    input.logos.slice(0, 2).map(async (logo, index) => {
      const element = logoElements[index];
      return element ? { element, image: await makeImage(logo, element.width, element.height, element.fit) } : null;
    })
  );
  const textLayer = Buffer.from(makeTemplateSvg(input, layout));
  const backgroundTint = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}">
      <rect x="0" y="0" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="#00082c" opacity=".18"/>
    </svg>`
  );

  const composites: sharp.OverlayOptions[] = [
    {
      input: backgroundTint,
      left: 0,
      top: 0
    },
    ...(avatar && avatarElement
      ? [
          {
            input: avatar,
            left: Math.round(avatarElement.x),
            top: Math.round(avatarElement.y)
          }
        ]
      : []),
    ...logos.flatMap((item) =>
      item
        ? [
            {
              input: item.image,
              left: Math.round(item.element.x),
              top: Math.round(item.element.y)
            }
          ]
        : []
    ),
    {
      input: textLayer,
      left: 0,
      top: 0
    }
  ];

  return sharp(background)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "center" })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function ensureFontCache() {
  const cacheHome = process.env.XDG_CACHE_HOME ?? path.join(process.cwd(), ".cache");
  const fontConfigDir = path.join(cacheHome, "fontconfig");
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  const fontConfigFile = path.join(fontConfigDir, "fonts.conf");

  process.env.XDG_CACHE_HOME = cacheHome;
  process.env.FONTCONFIG_FILE = fontConfigFile;
  process.env.FONTCONFIG_PATH = fontConfigDir;

  fs.mkdirSync(fontConfigDir, { recursive: true });
  fs.writeFileSync(
    fontConfigFile,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${escapeFontConfigPath(fontDir)}</dir>
  <cachedir>${escapeFontConfigPath(fontConfigDir)}</cachedir>
  <config></config>
</fontconfig>
`,
    "utf8"
  );
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("背景图片数据格式无效。");
  }
  return Buffer.from(match[1], "base64");
}

function escapeFontConfigPath(value: string) {
  return value.replace(/\\/g, "/").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function makeImage(input: Buffer, width: number, height: number, fit: "cover" | "contain") {
  return sharp(input)
    .rotate()
    .resize(Math.round(width), Math.round(height), {
      fit,
      position: "attention",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}
