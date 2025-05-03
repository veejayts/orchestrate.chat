export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: ChatMessage;
    finish_reason: string;
  }[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  architecture?: {
    tokenizer?: string;
  };
}

export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Orchestrate Chat'
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  return data.data;
}

export async function getChatCompletion(
  messages: ChatMessage[],
  model: string = 'google/gemini-2.0-flash-001'
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Orchestrate Chat'
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  return await response.json();
}