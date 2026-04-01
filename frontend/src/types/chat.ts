export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatThread {
  id: string;
  title: string;
  scenarioId: string;
  summary: string;
  messages: ChatMessage[];
  createdAt: number;
}
