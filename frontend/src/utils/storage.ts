import type { ChatThread } from '../types/chat';

const STORAGE_KEY = 'chat_threads';

export function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveThreads(threads: ChatThread[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function generateThreadId(): string {
  return crypto.randomUUID();
}
