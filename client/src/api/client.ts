import { useBoardStore } from "../state/boardStore";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const boardId = useBoardStore.getState().currentBoardId;
  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      // Omitted (rather than sent empty) before bootstrap resolves an
      // initial board — the server's requireBoard middleware falls back to
      // the "default" board in that case too, so this is only ever a
      // brief-instant fallback, not a real gap.
      ...(boardId ? { "X-Board-Id": boardId } : {}),
    },
    ...init,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
