/** Never turn interrupted, incomplete or failed inference into a successful assistant answer. */
export async function completedChatGPTMessage(response, signal) {
  if (!response.ok)
    throw new Error(
      `ChatGPT request failed (HTTP ${response.status}). Check your connection and ChatGPT plan limits.`,
    );
  if (!response.body) throw new Error('ChatGPT returned no response stream.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    completed,
    total = 0;
  const finishedItems = new Map();
  const textParts = new Map();
  function frame(text) {
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data);
    if (event.type === 'response.output_item.done' && event.item)
      finishedItems.set(event.output_index, event.item);
    if (
      [
        'response.output_text.delta',
        'response.output_text.done',
        'response.refusal.delta',
        'response.refusal.done',
      ].includes(event.type)
    ) {
      const key = `${event.output_index ?? 0}:${event.content_index ?? 0}`;
      const previous = textParts.get(key) || '';
      const value = event.type.endsWith('.done')
        ? (event.text ?? event.refusal ?? previous)
        : previous + (event.delta || '');
      if (typeof value === 'string') textParts.set(key, value);
    }
    if (event.type === 'response.completed' && event.response?.status === 'completed')
      completed = event.response;
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
      const code = event.response?.error?.code || event.error?.code || event.code;
      if (
        [
          'subscription_sharing_usage_limit_exceeded',
          'subscription_sharing_usage_unavailable',
        ].includes(code)
      )
        throw new Error(
          'ChatGPT plan usage is unavailable or its limit was reached. Review Daily Screen access and usage in ChatGPT Settings.',
        );
      throw new Error(
        'ChatGPT did not complete this response. Try again or check your plan access.',
      );
    }
  }
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 20 * 1024 * 1024)
        throw new Error('ChatGPT response exceeded the supported size.');
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        frame(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) frame(buffer);
    signal?.throwIfAborted();
    if (!completed)
      throw new Error('ChatGPT stream ended before completion. No reply was accepted.');
    // Some streams carry full items in output_item.done but omit them from the
    // terminal envelope. Prefer the final envelope for each index, without
    // duplicating items already seen in the stream. Never use these until the
    // completed event above has been verified.
    const items = new Map(finishedItems);
    for (const [index, item] of (completed.output || []).entries()) {
      if (item?.type === 'message' && !item.content?.length && items.has(index)) continue;
      items.set(index, item);
    }
    const output = [...items.entries()].sort(([a], [b]) => a - b).map(([, item]) => item);
    const itemText = output
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text' || part.type === 'refusal')
      .map((part) => part.text || part.refusal || '')
      .join('\n');
    const content = itemText || [...textParts.values()].join('\n');
    const calls = output
      .filter((item) => item.type === 'function_call')
      .map((item) => ({
        id: item.call_id,
        type: 'function',
        function: { name: item.name, arguments: item.arguments },
      }));
    if (!content && !calls.length)
      throw new Error(
        'ChatGPT returned an empty completed response. No changes were applied. Try sending the request again or choose another model.',
      );
    return { role: 'assistant', content, ...(calls.length ? { tool_calls: calls } : {}) };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
