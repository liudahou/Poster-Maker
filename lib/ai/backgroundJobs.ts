import { generateBackground } from "@/lib/ai/background";

type BackgroundJobInput = {
  topic: string;
  content?: string;
  backgroundRequirement?: string;
  baseBackgroundDataUrl?: string;
};

type BackgroundJobStatus = "queued" | "running" | "succeeded" | "failed";

export type BackgroundJob = {
  id: string;
  status: BackgroundJobStatus;
  createdAt: number;
  updatedAt: number;
  input: BackgroundJobInput;
  result?: Awaited<ReturnType<typeof generateBackground>>;
  error?: string;
};

const MAX_JOBS = 50;
const JOB_TTL_MS = 1000 * 60 * 60;

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __campusPosterBackgroundJobs?: Map<string, BackgroundJob>;
  };

  if (!globalStore.__campusPosterBackgroundJobs) {
    globalStore.__campusPosterBackgroundJobs = new Map();
  }

  return globalStore.__campusPosterBackgroundJobs;
}

export function createBackgroundJob(input: BackgroundJobInput) {
  cleanupJobs();

  const job: BackgroundJob = {
    id: crypto.randomUUID(),
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    input
  };

  getStore().set(job.id, job);
  setTimeout(() => {
    void runBackgroundJob(job.id);
  }, 0);

  return job;
}

export function getBackgroundJob(id: string) {
  return getStore().get(id) ?? null;
}

export function getBackgroundDataUrl(id: string) {
  const job = getBackgroundJob(id);

  if (job?.status !== "succeeded" || !job.result?.backgroundDataUrl) {
    return null;
  }

  return job.result.backgroundDataUrl;
}

async function runBackgroundJob(id: string) {
  const job = getStore().get(id);
  if (!job) {
    return;
  }

  job.status = "running";
  job.updatedAt = Date.now();

  try {
    job.result = await generateBackground(job.input);
    job.status = "succeeded";
  } catch (error) {
    job.error = error instanceof Error ? error.message : "Background generation failed.";
    job.status = "failed";
  } finally {
    job.updatedAt = Date.now();
  }
}

function cleanupJobs() {
  const store = getStore();
  const now = Date.now();

  for (const [id, job] of store) {
    if (now - job.createdAt > JOB_TTL_MS) {
      store.delete(id);
    }
  }

  while (store.size > MAX_JOBS) {
    const oldestId = store.keys().next().value as string | undefined;
    if (!oldestId) {
      return;
    }
    store.delete(oldestId);
  }
}
