export type PosterTextKey =
  | "topic"
  | "topicEn"
  | "timeLabel"
  | "time"
  | "locationLabel"
  | "location"
  | "speakerLabel"
  | "speakerName"
  | "speakerIntro"
  | "contentLabel"
  | "content"
  | "organizerLabel"
  | "organizer";

export type PosterImageKey = "avatar" | "logo0" | "logo1";

export type PosterLayoutElement =
  | {
    id: string;
    type: "text";
    label: string;
    textKey: PosterTextKey;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    lineHeight: number;
    color: string;
    fontWeight: number;
    align?: "left" | "center" | "right";
    vertical?: boolean;
    sideways?: boolean;
    rotate?: number;
  }
  | {
    id: string;
    type: "image";
    label: string;
    imageKey: PosterImageKey;
    x: number;
    y: number;
    width: number;
    height: number;
    fit: "cover" | "contain";
  };

export type PosterLayout = PosterLayoutElement[];

export const defaultPosterLayout: PosterLayout = [
  textBox("timeLabel", "时间栏目", "timeLabel", 98, 154, 405, 62, 42, 1.15, "#22e9ff", 900),
  textBox("time", "讲座时间", "time", 98, 250, 520, 58, 38, 1.2, "#ffffff", 850),
  textBox("locationLabel", "地点栏目", "locationLabel", 98, 362, 430, 62, 42, 1.15, "#22e9ff", 900),
  textBox("location", "讲座地点", "location", 98, 460, 590, 58, 38, 1.2, "#ffffff", 850),
  textBox("speakerLabel", "主讲人栏目", "speakerLabel", 98, 592, 425, 62, 42, 1.15, "#22e9ff", 900),
  imageBox("avatar", "主讲人头像", "avatar", 96, 710, 175, 225, "cover"),
  textBox("speakerName", "主讲人姓名", "speakerName", 300, 710, 360, 76, 54, 1.15, "#ffffff", 950),
  textBox("speakerIntro", "主讲人介绍", "speakerIntro", 300, 800, 520, 250, 29, 1.52, "#ffffff", 760),
  textBox("contentLabel", "内容栏目", "contentLabel", 98, 1216, 430, 62, 42, 1.15, "#22e9ff", 900),
  textBox("content", "主讲内容", "content", 98, 1327, 1000, 330, 31, 1.68, "#ffffff", 740),
  textBox("organizerLabel", "主办单位标签", "organizerLabel", 98, 1654, 220, 44, 30, 1.2, "#ffffff", 740),
  textBox("organizer", "主办单位", "organizer", 98, 1700, 610, 48, 30, 1.2, "#ffffff", 740),
  textBox("topicEn", "英文副标题", "topicEn", 810, 108, 90, 834, 36, 1.05, "#ffffff", 900, {
    align: "center",
    sideways: true
  }),
  textBox("topic", "讲座主题", "topic", 905, 98, 120, 850, 82, 1.04, "#ffffff", 950, {
    align: "center",
    vertical: true
  }),
  imageBox("logo0", "Logo 1", "logo0", 908, 1662, 120, 120, "contain"),
  imageBox("logo1", "Logo 2", "logo1", 1036, 1662, 120, 120, "contain")
];

function textBox(
  id: string,
  label: string,
  textKey: PosterTextKey,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  lineHeight: number,
  color: string,
  fontWeight: number,
  options: Pick<Extract<PosterLayoutElement, { type: "text" }>, "align" | "vertical" | "sideways" | "rotate"> = {}
): Extract<PosterLayoutElement, { type: "text" }> {
  return {
    id,
    type: "text",
    label,
    textKey,
    x,
    y,
    width,
    height,
    fontSize,
    lineHeight,
    color,
    fontWeight,
    ...options
  };
}

function imageBox(
  id: string,
  label: string,
  imageKey: PosterImageKey,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: "cover" | "contain"
): Extract<PosterLayoutElement, { type: "image" }> {
  return {
    id,
    type: "image",
    label,
    imageKey,
    x,
    y,
    width,
    height,
    fit
  };
}

export function sanitizePosterLayout(layout: unknown): PosterLayout {
  if (!Array.isArray(layout)) {
    return defaultPosterLayout;
  }

  return defaultPosterLayout.map((fallback) => {
    const candidate = layout.find(
      (item) => item && typeof item === "object" && "id" in item && item.id === fallback.id
    );

    if (!candidate || typeof candidate !== "object") {
      return fallback;
    }

    if (fallback.type === "text") {
      const textCandidate = candidate as Partial<Extract<PosterLayoutElement, { type: "text" }>>;
      return {
        ...fallback,
        x: clampNumber(textCandidate.x, 0, 1209, fallback.x),
        y: clampNumber(textCandidate.y, 0, 1814, fallback.y),
        width: clampNumber(textCandidate.width, 40, 1209, fallback.width),
        height: clampNumber(textCandidate.height, 24, 1814, fallback.height),
        fontSize: clampNumber(textCandidate.fontSize, 10, 140, fallback.fontSize),
        lineHeight: clampNumber(textCandidate.lineHeight, 0.8, 2.4, fallback.lineHeight)
      };
    }

    const imageCandidate = candidate as Partial<Extract<PosterLayoutElement, { type: "image" }>>;
    return {
      ...fallback,
      x: clampNumber(imageCandidate.x, 0, 1209, fallback.x),
      y: clampNumber(imageCandidate.y, 0, 1814, fallback.y),
      width: clampNumber(imageCandidate.width, 24, 1209, fallback.width),
      height: clampNumber(imageCandidate.height, 24, 1814, fallback.height)
    };
  });
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
