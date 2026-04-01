import type { AgentEvent } from '../types/agents';
import type { Weights } from '../types/optimization';

export async function runPipeline(
  weights: Weights,
  onEvent: (event: AgentEvent) => void,
  scenarioId?: string,
  budgetCeiling: number = 100000,
): Promise<void> {
  const res = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: scenarioId,
      weights,
      budget_ceiling: budgetCeiling,
    }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as AgentEvent;
          onEvent(event);
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}
