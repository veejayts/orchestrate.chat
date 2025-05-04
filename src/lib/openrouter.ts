import { getUserOpenRouterApiKey } from './supabase';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  messageid?: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: ChatMessage;
    finish_reason: string;
  }[];
}

export interface ChatCompletionChunk {
  id: string;
  model: string;
  choices: {
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
    index: number;
  }[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  architecture?: {
    tokenizer?: string;
  };
}

export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  // Import the supabase client
  const { supabase } = await import('./supabase');
  
  try {
    const { data, error } = await supabase
      .from('avail_models')
      .select('model_id, model_name');

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    // Map the data from Supabase to the OpenRouterModel format
    return data.map(model => ({
      id: model.model_id,
      name: model.model_name,
    }));
  } catch (error) {
    console.error('Error fetching available models:', error);
    return [];
  }
}

export async function getChatCompletion(
  messages: ChatMessage[],
  model: string = 'google/gemini-2.0-flash-001',
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  // Get the user's API key from the database
  const apiKey = await getUserOpenRouterApiKey();
  
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set for this user');
  }

  // Format the request body exactly as specified
  const requestBody = {
    "model": model,
    "messages": messages
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Orchestrate Chat'
    },
    body: JSON.stringify(requestBody),
    signal, // Add the abort signal
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  
  // Ensure we're using the same model ID that we sent in the request
  // This ensures consistency between what's selected and what's returned
  return {
    ...data,
    model: model
  };
}

export async function getChatCompletionStream(
  messages: ChatMessage[],
  model: string = 'google/gemini-2.0-flash-001',
  onChunk: (chunk: ChatCompletionChunk) => void,
  onDone: () => void,
  onError: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  // Get the user's API key from the database
  const apiKey = await getUserOpenRouterApiKey();
  
  if (!apiKey) {
    onError(new Error('OpenRouter API key is not set for this user'));
    return;
  }

  // Format the request body with streaming enabled
  const requestBody = {
    "model": model,
    "messages": messages,
    "stream": true
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Orchestrate Chat'
      },
      body: JSON.stringify(requestBody),
      signal, // Add the abort signal
    });

    if (!response.ok) {
      const error = await response.text();
      onError(new Error(`OpenRouter API error: ${error}`));
      return;
    }

    if (!response.body) {
      onError(new Error('Response body is null'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Set up an abort handler if signal is provided
    if (signal) {
      signal.addEventListener('abort', () => {
        reader.cancel().catch(console.error);
        onError(new Error('Request aborted'));
      }, { once: true });
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onDone();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE lines
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            onDone();
            break;
          }
          
          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            // Ensure we're using the same model ID that we sent in the request
            chunk.model = model;
            onChunk(chunk);
          } catch (e) {
            // Ignore comments or malformed JSON
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}