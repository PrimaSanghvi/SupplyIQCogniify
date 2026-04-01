import type { ChatMessage } from '../types/chat';

export async function sendChatMessage(
  message: string,
  scenarioId?: string,
  optimizationResult?: Record<string, unknown>,
  conversationHistory: ChatMessage[] = [],
  summary: string = '',
  recentMessages: ChatMessage[] = [],
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      scenario_id: scenarioId,
      optimization_result: optimizationResult,
      conversation_history: summary ? [] : conversationHistory,
      summary,
      recent_messages: recentMessages,
    }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'response') {
            fullResponse = data.content;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return fullResponse;
}

export async function summarizeChat(messages: ChatMessage[]): Promise<string> {
  try {
    const res = await fetch('/api/chat/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    return data.summary || '';
  } catch {
    return '';
  }
}
