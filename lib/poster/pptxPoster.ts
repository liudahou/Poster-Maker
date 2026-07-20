import pptxgen from "pptxgenjs";
import sharp from "sharp";
import { POSTER_HEIGHT, POSTER_WIDTH } from "./constants";
import { sanitizePosterLayout, type PosterLayout, type PosterTextKey } from "./layout";
import type { PosterFieldsForRender } from "./renderPoster";

export type PosterPptxInput = PosterFieldsForRender & {
  backgroundDataUrl: string;
  avatar: { buffer: Buffer; mimeType: string };
  logos: Array<{ buffer: Buffer; mimeType: string }>;
  layout?: PosterLayout;
};

const PX_PER_INCH = 100;
const SLIDE_WIDTH = POSTER_WIDTH / PX_PER_INCH;
const SLIDE_HEIGHT = POSTER_HEIGHT / PX_PER_INCH;
const FONT_FACE = "Microsoft YaHei";

export async function renderPosterPptx(input: PosterPptxInput) {
  const pptx = new pptxgen();
  pptx.author = "Campus AI Poster Generator";
  pptx.subject = "Editable campus lecture poster";
  pptx.title = input.topic || "Lecture Poster";
  pptx.company = "Campus AI Poster Generator";
  pptx.defineLayout({ name: "LECTURE_POSTER", width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  pptx.layout = "LECTURE_POSTER";
  pptx.theme = {
    headFontFace: FONT_FACE,
    bodyFontFace: FONT_FACE
  };

  const slide = pptx.addSlide();
  const layout = sanitizePosterLayout(input.layout);
  const background = await dataUrlToPngDataUrl(input.backgroundDataUrl);

  slide.addImage({ data: background, x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
    fill: { color: "00082C", transparency: 82 },
    line: { transparency: 100 }
  });

  addCornerChevrons(slide, pptx);
  addSectionRule(slide, pptx, 98, 218, 405);
  addSectionRule(slide, pptx, 98, 426, 405);
  addSectionRule(slide, pptx, 98, 656, 425);
  addSectionRule(slide, pptx, 98, 1280, 430);

  for (const element of layout) {
    if (element.type === "image") {
      const image =
        element.imageKey === "avatar"
          ? input.avatar
          : element.imageKey === "logo0"
            ? input.logos[0]
            : input.logos[1];

      if (!image) {
        continue;
      }

      const imagePng = await makePptxImageDataUrl(image.buffer, element.width, element.height, element.fit);

      slide.addImage({
        data: imagePng,
        x: px(element.x),
        y: px(element.y),
        w: px(element.width),
        h: px(element.height)
      });
      continue;
    }

    addTextElement(slide, element, getTextValue(input, element.textKey));
  }

  const output = await pptx.write({ outputType: "nodebuffer", compression: true });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}

function addTextElement(
  slide: pptxgen.Slide,
  element: Extract<PosterLayout[number], { type: "text" }>,
  value: string
) {
  if (!value.trim()) {
    return;
  }

  const base = {
    x: px(element.x),
    y: px(element.y),
    w: px(element.width),
    h: px(element.height),
    fontFace: FONT_FACE,
    fontSize: pt(element.fontSize),
    bold: element.fontWeight >= 700,
    color: cleanColor(element.color),
    margin: 0,
    fit: "shrink" as const,
    breakLine: false,
    valign: "top" as const,
    align: element.align ?? "left",
    lineSpacingMultiple: element.lineHeight
  };

  if (element.sideways) {
    slide.addText(value, {
      ...base,
      x: px(element.x - 370),
      y: px(element.y + 370),
      w: px(element.height),
      h: px(element.width),
      rotate: 90,
      align: "left"
    });
    return;
  }

  if (element.vertical) {
    addStackedText(slide, element, value);
    return;
  }

  slide.addText(value, base);
}

function addStackedText(slide: pptxgen.Slide, element: Extract<PosterLayout[number], { type: "text" }>, value: string) {
  const chars = Array.from(value.trim());
  const step = element.fontSize * element.lineHeight;
  const boxHeight = Math.max(element.fontSize * 1.05, step);

  chars.forEach((char, index) => {
    const y = element.y + index * step;
    if (y + boxHeight > element.y + element.height) {
      return;
    }

    slide.addText(char, {
      x: px(element.x),
      y: px(y),
      w: px(element.width),
      h: px(boxHeight),
      fontFace: FONT_FACE,
      fontSize: pt(element.fontSize),
      bold: element.fontWeight >= 700,
      color: cleanColor(element.color),
      margin: 0,
      fit: "shrink",
      valign: "middle",
      align: element.align ?? "center",
      breakLine: false
    });
  });
}

function addCornerChevrons(slide: pptxgen.Slide, pptx: pptxgen) {
  addLine(slide, pptx, 102, 66, 112, 86, 2.2);
  addLine(slide, pptx, 112, 86, 122, 66, 2.2);
  addLine(slide, pptx, 102, 98, 112, 118, 2.2);
  addLine(slide, pptx, 112, 118, 122, 98, 2.2);
  addLine(slide, pptx, 102, 130, 112, 150, 2.2);
  addLine(slide, pptx, 112, 150, 122, 130, 2.2);
}

function addSectionRule(slide: pptxgen.Slide, pptx: pptxgen, x: number, y: number, width: number) {
  addLine(slide, pptx, x, y, x + 86, y, 1.7);
  addLine(slide, pptx, x + 86, y, x + 122, y + 18, 1.7);
  addLine(slide, pptx, x + 122, y + 18, x + 158, y, 1.7);
  addLine(slide, pptx, x + 158, y, x + width, y, 1.7);
}

function addLine(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const shapeOptions: pptxgen.ShapeProps = {
    x: px(Math.min(x1, x2)),
    y: px(Math.min(y1, y2)),
    w: px(Math.max(Math.abs(dx), 0.01)),
    h: px(Math.max(Math.abs(dy), 0.01)),
    line: {
      color: "FFFFFF",
      transparency: 25,
      width
    }
  };

  if (dx < 0) {
    shapeOptions.flipH = true;
  }

  if (dy < 0) {
    shapeOptions.flipV = true;
  }

  slide.addShape(pptx.ShapeType.line, {
    ...shapeOptions
  });
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

async function dataUrlToPngDataUrl(dataUrl: string) {
  const source = dataUrlToBuffer(dataUrl);
  const png = await sharp(source).resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover" }).png().toBuffer();
  return bufferToDataUrl(png, "image/png");
}

async function makePptxImageDataUrl(input: Buffer, width: number, height: number, fit: "cover" | "contain") {
  const png = await sharp(input)
    .rotate()
    .resize(Math.round(width), Math.round(height), {
      fit,
      position: "attention",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return bufferToDataUrl(png, "image/png");
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("背景图片数据格式无效。");
  }
  return Buffer.from(match[1], "base64");
}

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType || "image/png"};base64,${buffer.toString("base64")}`;
}

function cleanColor(value: string) {
  return value.replace("#", "").toUpperCase();
}

function px(value: number) {
  return value / PX_PER_INCH;
}

function pt(value: number) {
  return value * 0.72;
}
