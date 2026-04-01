import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { sendChatMessage, summarizeChat } from '../api/chat';
import { fetchScenarios } from '../api/network';
import type { ChatMessage, ChatThread } from '../types/chat';
import type { ScenarioSummary } from '../types/optimization';
import { loadThreads, saveThreads, generateThreadId } from '../utils/storage';

function renderMarkdownLine(line: string) {
  // Headings
  if (line.startsWith('### ')) {
    return <h4 className="text-white font-semibold mt-3 mb-1">{line.slice(4)}</h4>;
  }
  if (line.startsWith('## ')) {
    return <h3 className="text-white font-bold mt-3 mb-1">{line.slice(3)}</h3>;
  }

  // List items
  const isList = line.startsWith('- ');
  const content = isList ? line.slice(2) : line;

  // Bold: replace **text** with <strong>
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  const rendered = parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });

  if (isList) {
    return <li className="ml-4 list-disc">{rendered}</li>;
  }
  return <>{rendered}</>;
}

const SUGGESTED_QUESTIONS = [
  "Why are we moving stock from Atlanta to Chicago when Chicago is nearly full?",
  "What happens if we wait to ship until demand materializes?",
  "Why ship from Dallas instead of the closer Los Angeles?",
  "What is the carbon impact of this redeployment plan?",
  "How much would we save if we increased Chicago's capacity by 10%?",
];

const SCENARIO_NAMES: Record<string, string> = {
  early_bird: 'Early Bird',
  long_haul: 'Long Haul',
  overstock: 'Overstock',
};

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarioId, setScenarioId] = useState('overstock');
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads from localStorage on mount
  useEffect(() => {
    fetchScenarios().then(setScenarios);
    const saved = loadThreads();
    setThreads(saved);
    if (saved.length > 0) {
      setActiveThreadId(saved[0].id);
      setScenarioId(saved[0].scenarioId || 'overstock');
    }
  }, []);

  // Save threads to localStorage whenever they change
  const persistThreads = useCallback((updated: ChatThread[]) => {
    setThreads(updated);
    saveThreads(updated);
  }, []);

  // Scroll to bottom on new messages
  const activeThread = threads.find((t) => t.id === activeThreadId);
  const messages = activeThread?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const createNewThread = () => {
    const newThread: ChatThread = {
      id: generateThreadId(),
      title: 'New Chat',
      scenarioId,
      summary: '',
      messages: [],
      createdAt: Date.now(),
    };
    const updated = [newThread, ...threads];
    persistThreads(updated);
    setActiveThreadId(newThread.id);
  };

  const deleteThread = (threadId: string) => {
    const updated = threads.filter((t) => t.id !== threadId);
    persistThreads(updated);
    if (activeThreadId === threadId) {
      setActiveThreadId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const switchThread = (threadId: string) => {
    setActiveThreadId(threadId);
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      setScenarioId(thread.scenarioId || 'overstock');
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    // Create thread if none exists
    let currentThreadId = activeThreadId;
    let currentThreads = threads;
    if (!currentThreadId) {
      const newThread: ChatThread = {
        id: generateThreadId(),
        title: text.slice(0, 50),
        scenarioId,
        summary: '',
        messages: [],
        createdAt: Date.now(),
      };
      currentThreads = [newThread, ...threads];
      currentThreadId = newThread.id;
      setActiveThreadId(currentThreadId);
    }

    const userMsg: ChatMessage = { role: 'user', content: text };

    // Update thread with user message
    const updatedThreads = currentThreads.map((t) => {
      if (t.id !== currentThreadId) return t;
      const updated = {
        ...t,
        messages: [...t.messages, userMsg],
        title: t.messages.length === 0 ? text.slice(0, 50) : t.title,
        scenarioId,
      };
      return updated;
    });
    persistThreads(updatedThreads);
    setInput('');
    setLoading(true);

    const thread = updatedThreads.find((t) => t.id === currentThreadId)!;
    const allMessages = thread.messages;

    // Build context: summary + last 2 messages
    const recentMsgs = allMessages.slice(-2);

    try {
      const response = await sendChatMessage(
        text,
        scenarioId || undefined,
        undefined,
        [],
        thread.summary,
        recentMsgs,
      );

      const assistantMsg: ChatMessage = { role: 'assistant', content: response };

      // Update thread with assistant response
      const afterResponse = updatedThreads.map((t) => {
        if (t.id !== currentThreadId) return t;
        return { ...t, messages: [...t.messages, assistantMsg] };
      });
      persistThreads(afterResponse);

      // Request summary update (every 2 exchanges = 4 messages)
      const totalMsgs = allMessages.length + 1; // +1 for assistant
      if (totalMsgs >= 4 && totalMsgs % 2 === 0) {
        const fullMsgs = [...allMessages, assistantMsg];
        const newSummary = await summarizeChat(fullMsgs);
        if (newSummary) {
          const withSummary = afterResponse.map((t) => {
            if (t.id !== currentThreadId) return t;
            return { ...t, summary: newSummary };
          });
          persistThreads(withSummary);
        }
      }
    } catch {
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
      const afterError = updatedThreads.map((t) => {
        if (t.id !== currentThreadId) return t;
        return { ...t, messages: [...t.messages, errorMsg] };
      });
      persistThreads(afterError);
    }
    setLoading(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Thread Sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-slate-900 rounded-xl border border-slate-700">
        <div className="p-3 border-b border-slate-700">
          <button
            onClick={createNewThread}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {threads.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-4">
              No conversations yet
            </div>
          )}
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`group relative rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                activeThreadId === thread.id
                  ? 'bg-cyan-500/15 border border-cyan-500/30'
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
              onClick={() => switchThread(thread.id)}
            >
              <div className="flex items-start gap-2">
                <MessageSquare size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white font-medium truncate">
                    {thread.title}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {thread.scenarioId && (
                      <span className="text-[9px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded">
                        {SCENARIO_NAMES[thread.scenarioId] || thread.scenarioId}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500">{formatTime(thread.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteThread(thread.id); }}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="mb-3">
          <h2 className="text-2xl font-bold text-white">Explainability Bot</h2>
          <p className="text-slate-400 text-sm mt-1">
            Ask why the optimizer made a specific decision
          </p>
        </div>

        {/* Scenario selector */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-slate-400">Context:</span>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="">General</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {activeThread?.summary && (
            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded max-w-xs truncate">
              Context: {activeThread.summary}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-700 p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={32} className="text-cyan-400 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-4">
                Ask me about any optimization decision. I'll explain the business logic behind it.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={16} className="text-cyan-400" />
                </div>
              )}
              <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-500/20 text-white max-w-[75%]'
                  : 'bg-slate-800 text-slate-200 w-full'
              }`}>
                {msg.content.split('\n').map((line, li) => (
                  <div key={li} className={li > 0 && !line.startsWith('- ') ? 'mt-2' : ''}>
                    {renderMarkdownLine(line)}
                  </div>
                ))}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={16} className="text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-cyan-400" />
              </div>
              <div className="bg-slate-800 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Ask about an optimization decision..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || loading}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
