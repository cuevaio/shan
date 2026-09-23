import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ShanAgentActivity,
  ShanConversationMessage,
  ShanSession,
} from "../types";

export type ActivityUpdate = Omit<ShanAgentActivity, "turnId" | "createdAt">;

const STORE_KEY = Symbol.for("shan.session-store");
const QUEUE_KEY = Symbol.for("shan.session-queues");
type GlobalSessionStore = typeof globalThis & {
  [STORE_KEY]?: Map<string, ShanSession>;
  [QUEUE_KEY]?: Map<string, Promise<unknown>>;
};
const globalStore = globalThis as GlobalSessionStore;
if (!globalStore[STORE_KEY])
  globalStore[STORE_KEY] = new Map<string, ShanSession>();
if (!globalStore[QUEUE_KEY])
  globalStore[QUEUE_KEY] = new Map<string, Promise<unknown>>();
const sessions = globalStore[STORE_KEY];
const queues = globalStore[QUEUE_KEY];

function sessionKey(root: string, sessionId: string) {
  return `${root}\u0000${sessionId}`;
}

function storagePath(root: string, sessionId: string) {
  const projectId = createHash("sha256")
    .update(sessionKey(root, sessionId))
    .digest("hex");
  return join(tmpdir(), "shan", `${projectId}.session.json`);
}

function freshSession(id: string = crypto.randomUUID()): ShanSession {
  const now = new Date().toISOString();
  return {
    id,
    title: "New session",
    status: "idle",
    createdAt: now,
    updatedAt: now,
    messages: [],
    activities: [],
  };
}

async function persist(root: string, session: ShanSession) {
  const key = sessionKey(root, session.id);
  const path = storagePath(root, session.id);
  await mkdir(join(tmpdir(), "shan"), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(session), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, path);
  sessions.set(key, session);
}

function serialize<T>(
  root: string,
  sessionId: string,
  operation: () => Promise<T>,
) {
  const key = sessionKey(root, sessionId);
  const previous = queues.get(key) ?? Promise.resolve();
  const running = previous.catch(() => {}).then(operation);
  queues.set(key, running);
  return running.finally(() => {
    if (queues.get(key) === running) queues.delete(key);
  });
}

function validSession(value: unknown): value is ShanSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<ShanSession>;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    (session.status === "idle" || session.status === "working") &&
    Array.isArray(session.messages) &&
    Array.isArray(session.activities)
  );
}

export async function getSession(
  root: string,
  sessionId = "default",
): Promise<ShanSession> {
  const key = sessionKey(root, sessionId);
  const cached = sessions.get(key);
  if (cached) return cached;
  try {
    const parsed: unknown = JSON.parse(
      await readFile(storagePath(root, sessionId), "utf8"),
    );
    if (!validSession(parsed) || parsed.id !== sessionId)
      throw new Error("The saved Shan session is invalid.");
    sessions.set(key, parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const session = freshSession(sessionId);
    await persist(root, session);
    return session;
  }
}

function sessionTitle(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length <= 52
    ? normalized
    : `${normalized.slice(0, 49).trimEnd()}…`;
}

export function beginTurn(root: string, prompt: string, sessionId = "default") {
  return serialize(root, sessionId, async () => {
    const current = await getSession(root, sessionId);
    if (current.status === "working")
      throw new Error("The agent is already working on this session.");
    const turnId = crypto.randomUUID();
    const message: ShanConversationMessage = {
      id: crypto.randomUUID(),
      turnId,
      role: "user",
      text: prompt,
      createdAt: new Date().toISOString(),
    };
    const session: ShanSession = {
      ...current,
      title:
        current.messages.length === 0 ? sessionTitle(prompt) : current.title,
      status: "working",
      updatedAt: message.createdAt,
      messages: [...current.messages, message],
    };
    await persist(root, session);
    return { session, turnId, history: current.messages };
  });
}

export function recordActivity(
  root: string,
  turnId: string,
  update: ActivityUpdate,
  sessionId = "default",
) {
  return serialize(root, sessionId, async () => {
    const current = await getSession(root, sessionId);
    const existing = current.activities.find(
      (activity) => activity.id === update.id,
    );
    const activity: ShanAgentActivity = {
      ...update,
      turnId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const activities = existing
      ? current.activities.map((item) =>
          item.id === update.id ? activity : item,
        )
      : [...current.activities, activity];
    const session = {
      ...current,
      updatedAt: new Date().toISOString(),
      activities,
    };
    await persist(root, session);
    return session;
  });
}

export function completeTurn(
  root: string,
  turnId: string,
  text: string,
  proposalId: string,
  sessionId = "default",
) {
  return serialize(root, sessionId, async () => {
    const current = await getSession(root, sessionId);
    const now = new Date().toISOString();
    const message: ShanConversationMessage = {
      id: crypto.randomUUID(),
      turnId,
      role: "assistant",
      text: text.trim() || "The requested changes are ready to review.",
      createdAt: now,
      proposalId,
      proposalStatus: "previewing",
    };
    const session: ShanSession = {
      ...current,
      status: "idle",
      updatedAt: now,
      messages: [...current.messages, message],
    };
    await persist(root, session);
    return session;
  });
}

export function failTurn(
  root: string,
  turnId: string,
  message: string,
  sessionId = "default",
) {
  return serialize(root, sessionId, async () => {
    const current = await getSession(root, sessionId);
    const now = new Date().toISOString();
    const session: ShanSession = {
      ...current,
      status: "idle",
      updatedAt: now,
      messages: [
        ...current.messages,
        {
          id: crypto.randomUUID(),
          turnId,
          role: "assistant",
          text: message,
          createdAt: now,
        },
      ],
    };
    await persist(root, session);
    return session;
  });
}

export function setProposalStatus(
  root: string,
  proposalId: string,
  proposalStatus: "kept" | "discarded",
  sessionId = "default",
) {
  return serialize(root, sessionId, async () => {
    const current = await getSession(root, sessionId);
    const session: ShanSession = {
      ...current,
      updatedAt: new Date().toISOString(),
      messages: current.messages.map((message) =>
        message.proposalId === proposalId
          ? { ...message, proposalStatus }
          : message,
      ),
    };
    await persist(root, session);
    return session;
  });
}

export function startNewSession(root: string) {
  const session = freshSession();
  return serialize(root, session.id, async () => {
    await persist(root, session);
    return session;
  });
}
