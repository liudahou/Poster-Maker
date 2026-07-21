"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/poster/constants";
import { defaultPosterLayout, type PosterLayout, type PosterLayoutElement, type PosterTextKey } from "@/lib/poster/layout";

type PosterFields = {
  topic: string;
  topicEn: string;
  backgroundRequirement: string;
  time: string;
  location: string;
  speakerName: string;
  speakerIntro: string;
  content: string;
  organizer: string;
};

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  initial: PosterLayoutElement;
};

type BackgroundHistoryItem = {
  id: string;
  dataUrl: string;
  mode: "generate" | "edit";
  requirement: string;
  createdAt: string;
};

const initialFields: PosterFields = {
  topic: "当机器学会策略思考",
  topicEn: "When Machines Learn Strategic Thinking",
  backgroundRequirement: "",
  time: "5月9日 18:30（本周六）",
  location: "东南大学九龙湖校区 J1-211",
  speakerName: "黄建伟",
  speakerIntro:
    "香港中文大学（深圳）校长讲席教授、协理副校长及理工学院院长\n深圳市人工智能与机器人研究院副院长\n深圳河套学院教授",
  content:
    "策略行为——讨价还价、竞争与谈判——贯穿于人类社会的方方面面，然而对其进行系统建模至今仍高度依赖领域专家，难以规模化。本次演讲阐述大语言模型如何推动一场根本性变革：策略得以成为可扩展、可解释、可审计的计算对象。",
  organizer: "东南大学信息科学与工程学院"
};

const requiredFields: Array<keyof PosterFields> = [
  "topic",
  "time",
  "location",
  "speakerName",
  "speakerIntro",
  "content",
  "organizer"
];

const editableTextKeys = new Set<PosterTextKey>([
  "topic",
  "topicEn",
  "time",
  "location",
  "speakerName",
  "speakerIntro",
  "content",
  "organizer"
]);

export default function Home() {
  const [fields, setFields] = useState<PosterFields>(initialFields);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [logos, setLogos] = useState<File[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [backgroundPreview, setBackgroundPreview] = useState<string>("");
  const [backgroundHistory, setBackgroundHistory] = useState<BackgroundHistoryItem[]>([]);
  const [layout, setLayout] = useState<PosterLayout>(() => cloneLayout(defaultPosterLayout));
  const [selectedId, setSelectedId] = useState<string>("topic");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);

  const canGenerate = useMemo(() => {
    return requiredFields.every((name) => fields[name].trim()) && avatar && logos.length > 0;
  }, [avatar, fields, logos.length]);

  const selectedElement = layout.find((element) => element.id === selectedId) ?? layout[0];

  function updateField(name: keyof PosterFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatar(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  }

  function pickLogos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 2);
    setLogos(files);
    setLogoPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  async function exportImage() {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      const background = backgroundPreview || (await requestBackground());
      const posterBlob = await renderPoster(background);
      downloadBlob(posterBlob, "lecture-poster.png");
      setStatus("图片已导出。");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "图片导出失败，请重试。");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  }

  async function regenerateBackground() {
    if (!fields.topic.trim()) {
      setError("请先填写讲座主题，再重新生成背景。");
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await requestBackground("generate");
      setStatus("背景已重新生成，可继续调整元素或导出海报。");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "背景生成失败，请重试。");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  }

  async function refineBackground() {
    if (!fields.topic.trim()) {
      setError("请先填写讲座主题，再微调背景。");
      return;
    }

    if (!backgroundPreview) {
      setError("请先生成或选择一张背景图，再进行微调。");
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await requestBackground("edit");
      setStatus("背景已基于当前图微调，可继续调整元素或导出海报。");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "背景微调失败，请重试。");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  }

  async function requestBackground(mode: "generate" | "edit" = "generate") {
    const isEdit = mode === "edit";
    setStatus(isEdit ? "正在基于当前背景和背景要求进行微调..." : "正在根据主题和背景要求生成无文字科技风背景...");

    const backgroundResponse = await fetch("/api/background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: fields.topic,
        content: fields.content,
        backgroundRequirement: fields.backgroundRequirement,
        baseBackgroundDataUrl: isEdit ? backgroundPreview : undefined
      })
    });

    if (!backgroundResponse.ok) {
      const rawProblem = await backgroundResponse.text().catch(() => "");
      let problem: { error?: string } | null = null;

      try {
        problem = rawProblem ? (JSON.parse(rawProblem) as { error?: string }) : null;
      } catch {
        problem = null;
      }

      const detail = problem?.error ?? rawProblem.slice(0, 500);
      throw new Error(detail ? `背景生成失败 (${backgroundResponse.status})：${detail}` : `背景生成失败 (${backgroundResponse.status})。`);
    }

    const background = (await backgroundResponse.json()) as {
      backgroundDataUrl: string;
    };
    addBackgroundToHistory(background.backgroundDataUrl, mode);
    return background.backgroundDataUrl;
  }

  function addBackgroundToHistory(dataUrl: string, mode: "generate" | "edit") {
    const item: BackgroundHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dataUrl,
      mode,
      requirement: fields.backgroundRequirement.trim(),
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    };

    setBackgroundPreview(dataUrl);
    setBackgroundHistory((current) => [item, ...current.filter((entry) => entry.dataUrl !== dataUrl)].slice(0, 12));
  }

  function selectBackgroundFromHistory(item: BackgroundHistoryItem) {
    setBackgroundPreview(item.dataUrl);
    setStatus(`已切换到 ${item.createdAt} 的背景图。`);
  }

  async function renderPoster(backgroundDataUrl: string) {
    if (!avatar || logos.length === 0) {
      throw new Error("请上传主讲人头像和至少一个 Logo。");
    }

    setStatus("正在按当前画布合成讲座海报...");
    const renderForm = new FormData();
    Object.entries(fields).forEach(([key, value]) => renderForm.append(key, value));
    renderForm.append("backgroundDataUrl", backgroundDataUrl);
    renderForm.append("layout", JSON.stringify(layout));
    renderForm.append("avatar", avatar);
    logos.forEach((logo) => renderForm.append("logos", logo));

    const renderResponse = await fetch("/api/render", {
      method: "POST",
      body: renderForm
    });

    if (!renderResponse.ok) {
      const problem = await renderResponse.json().catch(() => null);
      throw new Error(problem?.error ?? "海报合成失败，请检查上传图片。");
    }

    return renderResponse.blob();
  }

  async function exportPptx() {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      const background = backgroundPreview || (await requestBackground());
      setStatus("正在导出可编辑 PPTX...");
      const renderForm = new FormData();
      Object.entries(fields).forEach(([key, value]) => renderForm.append(key, value));
      renderForm.append("backgroundDataUrl", background);
      renderForm.append("layout", JSON.stringify(layout));
      renderForm.append("avatar", avatar as File);
      logos.forEach((logo) => renderForm.append("logos", logo));

      const response = await fetch("/api/pptx", {
        method: "POST",
        body: renderForm
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.error ?? "PPTX 导出失败，请检查上传图片。");
      }

      const blob = await response.blob();
      downloadBlob(blob, "lecture-poster-editable.pptx");
      setStatus("PPTX 已导出，可在 PowerPoint 中编辑文字、图片和装饰元素。");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "PPTX 导出失败，请重试。");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  }

  function validateInputs() {
    if (!canGenerate || !avatar || logos.length === 0) {
      return "请填写所有必填字段，并上传主讲人头像和至少一个 Logo。";
    }

    if (![avatar, ...logos].every((file) => file.type.startsWith("image/"))) {
      return "头像和 Logo 必须是图片文件。";
    }

    return "";
  }

  function updateElement(id: string, patch: Partial<PosterLayoutElement>) {
    setLayout((current) =>
      current.map((element) => (element.id === id ? ({ ...element, ...patch } as PosterLayoutElement) : element))
    );
  }

  function resetLayout() {
    setLayout(cloneLayout(defaultPosterLayout));
    setSelectedId("topic");
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <form className="control-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="brand-block">
            <p className="eyebrow">AI Lecture Poster</p>
            <h1>校园科技讲座海报生成工具</h1>
            <p>填写讲座信息并上传头像与 Logo，在右侧画布中拖动文本框和图片后导出。</p>
          </div>

          <Field label="讲座主题" value={fields.topic} onChange={(value) => updateField("topic", value)} />
          <Field
            label="英文副标题（可选）"
            value={fields.topicEn}
            onChange={(value) => updateField("topicEn", value)}
          />
          <div className="form-grid">
            <Field label="讲座时间" value={fields.time} onChange={(value) => updateField("time", value)} />
            <Field label="讲座地点" value={fields.location} onChange={(value) => updateField("location", value)} />
          </div>
          <Field label="主讲人" value={fields.speakerName} onChange={(value) => updateField("speakerName", value)} />
          <TextArea
            label="主讲人介绍"
            value={fields.speakerIntro}
            rows={4}
            onChange={(value) => updateField("speakerIntro", value)}
          />
          <TextArea
            label="主讲内容"
            value={fields.content}
            rows={5}
            onChange={(value) => updateField("content", value)}
          />
          <Field label="主办单位" value={fields.organizer} onChange={(value) => updateField("organizer", value)} />

          <div className="upload-grid">
            <label className="upload-box">
              <span>主讲人头像</span>
              <input accept="image/*" type="file" onChange={pickAvatar} />
              <strong>{avatar?.name ?? "选择图片"}</strong>
            </label>
            <label className="upload-box">
              <span>主办方 Logo（1-2 个）</span>
              <input accept="image/*" multiple type="file" onChange={pickLogos} />
              <strong>{logos.length ? logos.map((logo) => logo.name).join("、") : "选择图片"}</strong>
            </label>
          </div>

          <TextArea
            label="背景要求（可选）"
            value={fields.backgroundRequirement}
            rows={3}
            placeholder="例如:深蓝色、科技风,在画面中间偏下(约65%高度)处生成一个发光地球表面的弧形分割线，有青蓝色光晕，画面衔接自然"
            onChange={(value) => updateField("backgroundRequirement", value)}
          />

          {error ? <p className="error">{error}</p> : null}
          {status ? <p className="status">{status}</p> : null}

          <div className="action-row">
            <button className="secondary-action" disabled={isWorking || !fields.topic.trim()} type="button" onClick={regenerateBackground}>
              生成新海报
            </button>
            <button className="secondary-action" disabled={isWorking || !backgroundPreview} type="button" onClick={refineBackground}>
              微调当前背景
            </button>
          </div>
        </form>

        <aside className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>可编辑海报预览</h2>
            </div>
            <div className="toolbar-actions">
              <button className="ghost-action" type="button" onClick={resetLayout}>
                重置布局
              </button>
              <button className="primary-action compact-action" disabled={!canGenerate || isWorking} type="button" onClick={exportImage}>
                导出图片
              </button>
              <button className="primary-action compact-action" disabled={!canGenerate || isWorking} type="button" onClick={exportPptx}>
                导出可编辑 PPTX
              </button>
            </div>
          </div>

          <ElementControls selectedElement={selectedElement} onChange={updateElement} />

          <div className="poster-frame">
            {backgroundPreview ? (
              <PosterEditor
                fields={fields}
                layout={layout}
                backgroundPreview={backgroundPreview}
                avatarPreview={avatarPreview}
                logoPreviews={logoPreviews}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updateField={updateField}
                updateElement={updateElement}
              />
            ) : (
              <div className="empty-preview">
                <span>1209 × 1814</span>
                <p>点击“重新生成背景”后，可在这里拖动文字和图片。</p>
              </div>
            )}
          </div>

          {backgroundHistory.length ? (
            <div className="background-history">
              <div className="history-heading">
                <strong>背景历史</strong>
                <span>点击缩略图切换当前背景</span>
              </div>
              <div className="history-grid">
                {backgroundHistory.map((item, index) => (
                  <button
                    className={`history-thumb ${item.dataUrl === backgroundPreview ? "active" : ""}`}
                    key={item.id}
                    type="button"
                    title={`${item.mode === "edit" ? "微调" : "生成"} · ${item.createdAt}${item.requirement ? ` · ${item.requirement}` : ""}`}
                    onClick={() => selectBackgroundFromHistory(item)}
                  >
                    <img alt={`背景历史 ${index + 1}`} src={item.dataUrl} />
                    <span>{item.mode === "edit" ? "微调" : "生成"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function PosterEditor({
  fields,
  layout,
  backgroundPreview,
  avatarPreview,
  logoPreviews,
  selectedId,
  setSelectedId,
  updateField,
  updateElement
}: {
  fields: PosterFields;
  layout: PosterLayout;
  backgroundPreview: string;
  avatarPreview: string;
  logoPreviews: string[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  updateField: (name: keyof PosterFields, value: string) => void;
  updateElement: (id: string, patch: Partial<PosterLayoutElement>) => void;
}) {
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / POSTER_WIDTH);
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  function startDrag(event: PointerEvent<HTMLElement>, element: PosterLayoutElement, mode: DragState["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    dragRef.current = {
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      initial: element
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;

    if (drag.mode === "move") {
      updateElement(drag.id, {
        x: clamp(drag.initial.x + dx, 0, POSTER_WIDTH - drag.initial.width),
        y: clamp(drag.initial.y + dy, 0, POSTER_HEIGHT - drag.initial.height)
      });
      return;
    }

    updateElement(drag.id, {
      width: clamp(drag.initial.width + dx, 24, POSTER_WIDTH - drag.initial.x),
      height: clamp(drag.initial.height + dy, 24, POSTER_HEIGHT - drag.initial.y)
    });
  }

  function stopDrag(event: PointerEvent<HTMLElement>) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="poster-editor" ref={stageRef} style={{ height: POSTER_HEIGHT * scale || undefined }}>
      <div
        className="poster-canvas"
        style={{
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
          transform: `scale(${scale})`
        }}
      >
        <img className="canvas-background" alt="无文字科技风背景" src={backgroundPreview} />
        <CanvasGuides />
        {layout.map((element) => {
          const isSelected = element.id === selectedId;
          if (element.type === "image") {
            const src =
              element.imageKey === "avatar"
                ? avatarPreview
                : element.imageKey === "logo0"
                  ? logoPreviews[0]
                  : logoPreviews[1];
            if (!src) return null;
            return (
              <div
                key={element.id}
                className={`editable-element image-element ${isSelected ? "selected" : ""}`}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height
                }}
                onPointerDown={() => setSelectedId(element.id)}
              >
                <img alt={element.label} src={src} style={{ objectFit: element.fit }} />
                <ElementHandles element={element} startDrag={startDrag} moveDrag={moveDrag} stopDrag={stopDrag} />
              </div>
            );
          }

          const value = getTextValue(fields, element.textKey);
          const editableKey = editableTextKeys.has(element.textKey);
          return (
            <div
              key={element.id}
              className={`editable-element text-element ${isSelected ? "selected" : ""}`}
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height
              }}
              onPointerDown={() => setSelectedId(element.id)}
            >
              <textarea
                readOnly={!editableKey}
                value={value}
                onChange={(event) => editableKey && updateField(element.textKey as keyof PosterFields, event.target.value)}
                style={{
                  color: element.color,
                  fontSize: element.fontSize,
                  lineHeight: element.lineHeight,
                  fontWeight: element.fontWeight,
                  textAlign: element.align ?? "left",
                  writingMode: element.vertical ? "vertical-rl" : "horizontal-tb",
                  textOrientation: element.vertical ? "mixed" : undefined,
                  transform: element.sideways ? `rotate(90deg) translateY(-${element.width}px)` : element.rotate ? `rotate(${element.rotate}deg)` : undefined,
                  transformOrigin: "left top",
                  width: element.sideways ? element.height : "100%",
                  height: element.sideways ? element.width : "100%"
                }}
              />
              <ElementHandles element={element} startDrag={startDrag} moveDrag={moveDrag} stopDrag={stopDrag} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElementHandles({
  element,
  startDrag,
  moveDrag,
  stopDrag
}: {
  element: PosterLayoutElement;
  startDrag: (event: PointerEvent<HTMLElement>, element: PosterLayoutElement, mode: DragState["mode"]) => void;
  moveDrag: (event: PointerEvent<HTMLElement>) => void;
  stopDrag: (event: PointerEvent<HTMLElement>) => void;
}) {
  return (
    <>
      <button
        className="move-handle"
        type="button"
        title="拖动位置"
        onPointerDown={(event) => startDrag(event, element, "move")}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
      >
        移动
      </button>
      <button
        className="resize-handle"
        type="button"
        title="拖动调整宽度和高度"
        onPointerDown={(event) => startDrag(event, element, "resize")}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
      />
    </>
  );
}

function CanvasGuides() {
  return (
    <>
      <div className="corner-chevrons">
        <span />
        <span />
        <span />
      </div>
      <div className="section-rule" style={{ left: 98, top: 218, width: 405 }} />
      <div className="section-rule" style={{ left: 98, top: 426, width: 405 }} />
      <div className="section-rule" style={{ left: 98, top: 656, width: 425 }} />
      <div className="section-rule" style={{ left: 98, top: 1280, width: 430 }} />
    </>
  );
}

function ElementControls({
  selectedElement,
  onChange
}: {
  selectedElement: PosterLayoutElement;
  onChange: (id: string, patch: Partial<PosterLayoutElement>) => void;
}) {
  return (
    <div className="element-controls">
      <strong>当前选中：{selectedElement.label}</strong>
      <NumberControl label="X" value={selectedElement.x} onChange={(value) => onChange(selectedElement.id, { x: value })} />
      <NumberControl label="Y" value={selectedElement.y} onChange={(value) => onChange(selectedElement.id, { y: value })} />
      <NumberControl
        label="宽"
        value={selectedElement.width}
        onChange={(value) => onChange(selectedElement.id, { width: value })}
      />
      <NumberControl
        label="高"
        value={selectedElement.height}
        onChange={(value) => onChange(selectedElement.id, { height: value })}
      />
      {selectedElement.type === "text" ? (
        <NumberControl
          label="字号"
          value={selectedElement.fontSize}
          onChange={(value) => onChange(selectedElement.id, { fontSize: value })}
        />
      ) : null}
    </div>
  );
}

function NumberControl({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  value,
  rows,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  rows: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getTextValue(fields: PosterFields, key: PosterTextKey) {
  const fixed: Record<PosterTextKey, string> = {
    topic: fields.topic,
    topicEn: fields.topicEn,
    timeLabel: "讲座时间/DATE",
    time: fields.time,
    locationLabel: "讲座地点/ADDRESS",
    location: fields.location,
    speakerLabel: "主讲人/SPEAKER",
    speakerName: fields.speakerName,
    speakerIntro: fields.speakerIntro,
    contentLabel: "主讲内容/VERBIAGE",
    content: fields.content,
    organizerLabel: "主办单位:",
    organizer: fields.organizer
  };

  return fixed[key] ?? "";
}

function cloneLayout(layout: PosterLayout) {
  return layout.map((element) => ({ ...element })) as PosterLayout;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
