export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
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
  model: string = 'google/gemini-2.0-flash-001'
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set');
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