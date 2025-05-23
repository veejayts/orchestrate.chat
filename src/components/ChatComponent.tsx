import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';
import { 
  ChatMessage, 
  getAvailableModels, 
  OpenRouterModel, 
  getChatCompletionStream,
  WebSearchCitation, 
} from '@/lib/openrouter';
import { 
  createChat, 
  saveMessage, 
  getChatMessages, 
  getUserChats, 
  Chat,
  updateChatTitle, 
  supabase,
  saveStreamingMessage,
  updateStreamingMessage,
  deleteChat,
  deleteMessage,
  getUserDisplayName,
} from '@/lib/supabase';
import Sidebar from './Sidebar';

// OpenRouter import types
interface OpenRouterExport {
  version: string;
  characters: {
    [key: string]: {
      model: string;
      modelInfo: any;
      id: string;
      updatedAt: string;
      description: string;
    }
  };
  messages: {
    [key: string]: {
      characterId: string;
      content: string;
      id: string;
      updatedAt: string;
      isGenerating?: boolean;
      metadata?: any;
      citations?: any[];
      files?: any[];
      attachments?: any[];
    }
  }
}

// Sample suggestion questions
const SUGGESTIONS = [
  "How does AI work?",
  "How many Rs are in the word \"strawberry\"?",
  "Explain Descartes' 'I think, therefore I am' argument.",
  "Why is JavaScript the worst language?"
];

interface ChatComponentProps {
  userId: string | null;
  user: any;
  userDisplayName: string | null;
  onSignOut: () => Promise<void>;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ userId, user, userDisplayName, onSignOut }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-001');
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Add a ref to track scroll position
  const scrollPositionRef = useRef<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get user display name for messages
  const [userDisplayNameState, setUserDisplayNameState] = useState<string | null>(null);

  // Add this useEffect to handle auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear chat state on sign out
        setMessages([]);
        setActiveChatId(null);
        setUserChats([]);
        setInput('');
        // Note: The parent component (likely page.tsx or layout.tsx)
        // should handle redirecting the user after sign out.
      }
    });

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Load user display name
  useEffect(() => {
    const loadUserDisplayName = async () => {
      if (userId) {
        const displayName = await getUserDisplayName();
        setUserDisplayNameState(displayName);
      }
    };
    
    loadUserDisplayName();
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search query when closing dropdown
  useEffect(() => {
    if (!isModelDropdownOpen) {
      setModelSearchQuery('');
    }
  }, [isModelDropdownOpen]);

  // Load user chats
  useEffect(() => {
    if (userId) {
      loadUserChats();
    }
  }, [userId]);

  const loadUserChats = async () => {
    // Initial load of first 50 chats
    const chats = await getUserChats(50, 0);
    setUserChats(chats);
  };

  // Load available models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Error loading available models:', error);
      }
    };
    
    loadModels();
  }, []);

  // Load messages for active chat
  useEffect(() => {
    if (activeChatId && !isSubmitting) { // Skip loading during first message submission
      loadChatMessages(activeChatId);
    }
  }, [activeChatId, isSubmitting]);

  // Handle deleting a message
  const handleDeleteMessage = async (messageId: string) => {
    // Don't attempt to delete if messageId is undefined or empty
    if (!messageId || messageId === 'undefined') {
      console.error('Invalid message ID for deletion:', messageId);
      return;
    }

    try {
      // Store current scroll position before deletion
      const currentScrollTop = chatContainerRef.current?.scrollTop || 0;
      scrollPositionRef.current = currentScrollTop;
      
      // Delete the message from the database
      const success = await deleteMessage(messageId);
      
      if (success) {
        // Remove the message from the UI
        setMessages((prevMessages) => 
          prevMessages.filter(message => message.messageid !== messageId)
        );
        
        // Set a timeout to restore scroll position after the state update and re-render
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = scrollPositionRef.current;
          }
        }, 0);
      } else {
        console.error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Scroll to bottom of chat only when new messages are added, not during deletion
  useEffect(() => {
    // We'll use our direct scroll position management for deletions
    if (!chatContainerRef.current) return;
    
    // Scroll to bottom for new messages, but not when deleting
    const messageContainer = chatContainerRef.current;
    const shouldScrollToBottom = messageContainer.scrollHeight - messageContainer.scrollTop <= messageContainer.clientHeight * 1.2;
    
    if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const loadChatMessages = async (chatId: string) => {
    const chatMessagesDb = await getChatMessages(chatId);
    
    // Convert DB messages to the format we need, preserving the original messageid
    const enhancedMessages = chatMessagesDb.map(msg => ({
      role: msg.source === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: msg.message,
      model: msg.source !== 'user' ? msg.source : undefined,
      messageid: msg.messageid // Keep consistent with the property name used in the delete button
    }));
    
    setMessages(enhancedMessages);

    // Find the most recent assistant message to set the default model
    const assistantMessages = chatMessagesDb.filter(msg => msg.source !== 'user');
    if (assistantMessages.length > 0) {
      // Get the most recent assistant message (last one in the array since they're ordered by created_at)
      const mostRecentAssistantMsg = assistantMessages[assistantMessages.length - 1];
      // Set the selected model to the one used in the most recent assistant message
      if (mostRecentAssistantMsg.source) {
        setSelectedModel(mostRecentAssistantMsg.source);
      }
    }
    
    // Scroll to the latest message after loading the chat
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 100);
  };

  // Function to import OpenRouter conversations
  const importOpenRouterConversation = async (data: OpenRouterExport) => {
    try {
      // Validate the format
      if (!data.version || !data.messages || !data.characters) {
        throw new Error('Invalid OpenRouter conversation format');
      }

      // Get the messages in chronological order
      const messagesArray = Object.values(data.messages);
      
      // Sort by updatedAt timestamp
      messagesArray.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      });

      // Create a new chat
      const chatId = await createChat('Imported Conversation');
      if (!chatId) {
        throw new Error('Failed to create a new chat');
      }

      // Get the title from the first message (truncate if needed)
      if (messagesArray.length > 0) {
        const firstMessage = messagesArray[0];
        const chatTitle = firstMessage.content.length > 25
          ? firstMessage.content.substring(0, 25) + '...'
          : firstMessage.content;
        
        await updateChatTitle(chatId, chatTitle);
      }

      // Process and save each message
      for (const message of messagesArray) {
        // Determine if it's a user or assistant message
        const isUserMessage = message.characterId === 'USER';
        
        // Get the model information for assistant messages
        let modelName = 'assistant';
        if (!isUserMessage && message.characterId && data.characters[message.characterId]) {
          modelName = data.characters[message.characterId].model || 'assistant';
        }

        // Save the message to the database
        await saveMessage(
          chatId,
          message.content,
          isUserMessage ? 'user' : modelName
        );
      }

      // Refresh chat list and switch to the new chat
      await loadUserChats();
      setActiveChatId(chatId);
      
      return true;
    } catch (error) {
      console.error('Error importing conversation:', error);
      return false;
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as OpenRouterExport;
        
        const success = await importOpenRouterConversation(data);
        if (success) {
          alert('Conversation imported successfully!');
        } else {
          alert('Failed to import conversation. Check console for details.');
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Failed to parse file. Please make sure it\'s a valid JSON file.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  // Handle streaming submission
  const handleStreamingSubmit = async (e: React.FormEvent | null, submittedText: string = input) => {
    if (e) e.preventDefault();
    
    let messageText = submittedText.trim();
    if (!messageText || isLoading) return;

    // Check if this is a web search query
    const isWebSearch = messageText.startsWith('/websearch');
    if (isWebSearch) {
      // Remove the /websearch command from the message
      messageText = messageText.substring('/websearch'.length).trim();
      
      // If there's no query after the command, don't proceed
      if (!messageText) return;
    }

    // Set submitting state to true immediately to prevent UI flashing
    setIsSubmitting(true);
    
    // Create a new chat if one doesn't exist
    let currentChatId = activeChatId;
    let isNewChat = false;
    if (!currentChatId) {
      const chatId = await createChat();
      if (!chatId) {
        console.error('Failed to create a new chat');
        setIsSubmitting(false); // Reset state if creation fails
        return;
      }
      currentChatId = chatId;
      setActiveChatId(chatId);
      isNewChat = true;
      // Add the new chat to the user's chats
      loadUserChats();
    } else {
      // Update the local userChats to move the current chat to the top
      setUserChats(prevChats => {
        // Find the current chat in the array
        const updatedChats = [...prevChats];
        const currentChatIndex = updatedChats.findIndex(chat => chat.chatId === currentChatId);
        
        if (currentChatIndex !== -1) {
          // Create a copy of the current chat with updated timestamp
          const currentChat = { 
            ...updatedChats[currentChatIndex],
            latest_chat_timestamp: new Date().toISOString()
          };
          
          // Remove the chat from its current position
          updatedChats.splice(currentChatIndex, 1);
          
          // Add it back at the beginning of the array
          updatedChats.unshift(currentChat);
        }
        
        return updatedChats;
      });
    }

    // Store the original query for display and database storage
    const displayMessageText = isWebSearch ? `/websearch ${messageText}` : messageText;
    
    // Add user message to chat - modify this section to ensure UI consistency
    const userMessage: ChatMessage = { role: 'user', content: displayMessageText };
    
    // Update messages state immediately with the user message only
    // This ensures the messages array is not empty and prevents UI flashing
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await saveMessage(currentChatId, displayMessageText, 'user');

    // Update chat title if this is the first message in a new chat
    if (isNewChat || messages.length === 0) {
      // Get first 25 characters for title
      const chatTitle = displayMessageText.length > 25 
        ? displayMessageText.substring(0, 25) + '...' 
        : displayMessageText;
      
      await updateChatTitle(currentChatId, chatTitle);
      loadUserChats(); // Refresh chat list to show new title
    }

    try {
      // Format conversation history - pass the updated array with the new message
      // For web search, we use the actual search query without the command
      const conversationHistory = [...messages];
      
      // Add the user message with the actual query text for the API
      conversationHistory.push({ role: 'user', content: messageText });
      
      // Create initial message in UI
      const initialAssistantMessage: ChatMessage = { 
        role: 'assistant', 
        content: isWebSearch ? 'Searching the web...' : '', 
        model: selectedModel 
      };
      setMessages((prev) => [...prev, initialAssistantMessage]);
      
      // Create initial message in database
      const messageId = await saveStreamingMessage(currentChatId, '', selectedModel);
      setStreamingMessageId(messageId);
      
      // Accumulated content and citations for database updates
      let accumulatedContent = '';
      let collectedCitations: WebSearchCitation[] = [];
      
      // Create a new AbortController for this request
      const controller = new AbortController();
      setAbortController(controller);
      
      // Handle streaming chunks
      await getChatCompletionStream(
        conversationHistory,
        selectedModel,
        (chunk) => {
          // Update the message content as chunks arrive
          const contentDelta = chunk.choices[0]?.delta?.content || '';
          
          // Process both citation formats (annotations and previous format)
          const annotations = chunk.choices[0]?.delta?.annotations || [];
          const citationsDelta = chunk.choices[0]?.delta?.citations || [];
          
          // Process content and citations if they exist
          if (contentDelta || annotations.length > 0 || citationsDelta.length > 0) {
            if (contentDelta) {
              accumulatedContent += contentDelta;
            }
            
            // Process annotations (new format)
            if (annotations.length > 0) {
              annotations.forEach(annotation => {
                if (annotation.type === 'url_citation' && annotation.url_citation) {
                  // Convert URL citation to our WebSearchCitation format
                  const { title, url } = annotation.url_citation;
                  const existingIndex = collectedCitations.findIndex(c => c.url === url);
                  
                  if (existingIndex === -1) {
                    collectedCitations.push({
                      title: title,
                      url: url,
                      text: annotation.url_citation.content,
                      number: collectedCitations.length + 1
                    });
                  }
                }
              });
            }
            
            // Process citations (previous format)
            if (citationsDelta.length > 0) {
              citationsDelta.forEach(citation => {
                const existingIndex = collectedCitations.findIndex(c => c.url === citation.url);
                if (existingIndex === -1) {
                  collectedCitations.push(citation);
                }
              });
            }
            
            // Update UI with the latest content and citations
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              const lastMessageIndex = newMessages.length - 1;
              
              if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'assistant') {
                newMessages[lastMessageIndex] = {
                  ...newMessages[lastMessageIndex],
                  content: accumulatedContent,
                  model: chunk.model,
                  citations: collectedCitations.length > 0 ? collectedCitations : undefined,
                  messageid: messageId || undefined // Make sure the message ID is still attached
                };
              }
              
              return newMessages;
            });
            
            // Periodically update the message in the database
            // Only update every ~100 characters to reduce database writes
            if (accumulatedContent.length % 100 === 0 && messageId) {
              // We use a separate call to updateStreamingMessage to avoid race conditions
              updateStreamingMessage(messageId, accumulatedContent).catch(console.error);
            }
          }
        },
        () => {
          // When streaming is complete, format the message with citations if needed
          let finalContent = accumulatedContent;

          // Add citatio at the end of the message for display
          if (collectedCitations.length > 0 && isWebSearch) {
            // Format and append citations
            const sortedCitations = [...collectedCitations].sort((a, b) => a.number - b.number);
            finalContent += '\n\n**Citations:**\n';
            sortedCitations.forEach((citation, index) => {
              finalContent += `[${index + 1}] ${citation.title}: ${citation.url}\n`;
            });
          }

          // Save the final message to the database - store just the content, not JSON
          if (messageId && finalContent) {
            if (isWebSearch) {
              // For web search, store the content with citations already formatted in the text
              updateStreamingMessage(messageId, finalContent)
                .then(() => {
                  // Only after successfully updating the message in the database, reset states
                  setIsLoading(false);
                  setStreamingMessageId(null);
                  setAbortController(null);
                  setIsSubmitting(false); // Reset submitting state
                })
                .catch(error => {
                  console.error('Error updating final message:', error);
                  setIsLoading(false);
                  setStreamingMessageId(null);
                  setAbortController(null);
                  setIsSubmitting(false); // Reset submitting state even on error
                });
            } else {
              // For regular messages, store just the content, not JSON
              updateStreamingMessage(messageId, accumulatedContent)
                .then(() => {
                  setIsLoading(false);
                  setStreamingMessageId(null);
                  setAbortController(null);
                  setIsSubmitting(false);
                })
                .catch(error => {
                  console.error('Error updating final message:', error);
                  setIsLoading(false);
                  setStreamingMessageId(null);
                  setAbortController(null);
                  setIsSubmitting(false);
                });
            }
          } else {
            setIsLoading(false);
            setStreamingMessageId(null);
            setAbortController(null);
            setIsSubmitting(false); // Reset submitting state
          }
        },
        (error) => {
          console.error('Error during streaming:', error);
          
          // Check if this was an abort error (user canceled the request)
          const wasAborted = error.name === 'AbortError' || error.message === 'Request aborted';
          
          // Handle error in UI
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            const lastMessageIndex = newMessages.length - 1;
            
            if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'assistant') {
              if (accumulatedContent) {
                // Keep what we have so far and add error message if not aborted
                newMessages[lastMessageIndex].content = accumulatedContent + 
                  (wasAborted ? '\n\n_Generation stopped._' : '\n\n_Error: Message streaming was interrupted._');
              } else {
                // Replace empty message with error or abort message
                newMessages[lastMessageIndex].content = wasAborted 
                  ? 'Generation stopped.'
                  : 'Sorry, there was an error processing your request.';
              }
              // Make sure the message ID is still attached
              newMessages[lastMessageIndex].messageid = messageId || undefined;
            }
            
            return newMessages;
          });
          
          // Save error state to database
          if (messageId) {
            const errorMessage = accumulatedContent 
              ? accumulatedContent + (wasAborted 
                  ? '\n\n_Generation stopped._' 
                  : '\n\n_Error: Message streaming was interrupted._')
              : wasAborted 
                ? 'Generation stopped.'
                : 'Sorry, there was an error processing your request.';
                
            updateStreamingMessage(messageId, errorMessage).catch(console.error);
          }
          
          setIsLoading(false);
          setStreamingMessageId(null);
          setAbortController(null);
          setIsSubmitting(false); // Reset submitting state
        },
        controller.signal,
        isWebSearch, // Enable web search for this request
      );
    } catch (error) {
      console.error('Error setting up streaming:', error);
      const errorMessage = { role: 'assistant' as const, content: 'Sorry, there was an error processing your request.' };
      setMessages((prev) => [...prev, errorMessage]);
      
      // Save error message to database
      await saveMessage(currentChatId, errorMessage.content, 'system');
      setIsLoading(false);
      setAbortController(null);
      setIsSubmitting(false); // Reset submitting state
    }
  };

  // Modified handleSubmit to use streaming
  const handleSubmit = async (e: React.FormEvent | null, submittedText: string = input) => {
    return handleStreamingSubmit(e, submittedText);
  };

  // Handle retry message - regenerate AI response for a user message
  const handleRetryMessage = async (index: number) => {
    // Don't do anything if we're already loading
    if (isLoading) return;
    
    // Make sure this is a valid user message with a next message
    if (index < 0 || index >= messages.length - 1 || messages[index].role !== 'user') {
      return;
    }
    
    // Get the user message that we want to retry
    const userMessage = messages[index];
    
    // Get the current assistant message (the one that follows)
    const assistantMessage = messages[index + 1];
    
    // Make sure we have an active chat
    if (!activeChatId) {
      console.error('No active chat for retry');
      return;
    }
    
    // Set loading state
    setIsLoading(true);
    
    // If the assistant message has an ID, we'll update it instead of creating a new one
    const messageId = assistantMessage.messageid;
    
    try {
      // Format conversation history (including all messages up to the user message)
      const conversationHistory = messages.slice(0, index + 1);
      
      // Update the UI to show that the message is being regenerated
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        
        // Update the assistant message to show loading state
        if (index + 1 < newMessages.length && newMessages[index + 1].role === 'assistant') {
          newMessages[index + 1] = {
            ...newMessages[index + 1],
            content: 'Regenerating...',
          };
        }
        
        return newMessages;
      });
      
      // For streaming, we'll use the streaming approach
      setStreamingMessageId(messageId || null);
      
      // Accumulated content for database updates
      let accumulatedContent = '';
      
      // Create a new AbortController for this request
      const controller = new AbortController();
      setAbortController(controller);
      
      // Handle streaming chunks
      await getChatCompletionStream(
        conversationHistory,
        selectedModel,
        (chunk) => {
          // Update the message content as chunks arrive
          const contentDelta = chunk.choices[0]?.delta?.content || '';
          
          // Only add content if there's something to add
          if (contentDelta) {
            accumulatedContent += contentDelta;
            
            // Update UI
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              // We're specifically updating the message at index + 1
              if (index + 1 < newMessages.length && newMessages[index + 1].role === 'assistant') {
                newMessages[index + 1] = {
                  ...newMessages[index + 1],
                  content: accumulatedContent,
                  model: chunk.model,
                  messageid: messageId || undefined // Keep the message ID
                };
              }
              
              return newMessages;
            });
            
            // Periodically update the message in the database if we have a messageId
            if (messageId && accumulatedContent.length % 100 === 0) {
              updateStreamingMessage(messageId, accumulatedContent).catch(console.error);
            }
          }
        },
        () => {
          // When streaming is complete, save the final message to the database
          if (messageId && accumulatedContent) {
            updateStreamingMessage(messageId, accumulatedContent).catch(console.error);
          }
          setIsLoading(false);
          setStreamingMessageId(null);
          setAbortController(null);
        },
        (error) => {
          console.error('Error during streaming retry:', error);
          
          // Check if this was an abort error (user canceled the request)
          const wasAborted = error.name === 'AbortError' || error.message === 'Request aborted';
          
          // Handle error in UI
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            
            // Update the specific assistant message with an error
            if (index + 1 < newMessages.length && newMessages[index + 1].role === 'assistant') {
              if (accumulatedContent) {
                // Keep what we have so far and add error message if not aborted
                newMessages[index + 1].content = accumulatedContent + 
                  (wasAborted ? '\n\n_Generation stopped._' : '\n\n_Error: Message streaming was interrupted._');
              } else {
                // Replace loading message with error or abort message
                newMessages[index + 1].content = wasAborted 
                  ? 'Generation stopped.'
                  : 'Sorry, there was an error processing your request.';
              }
            }
            
            return newMessages;
          });
          
          // Save error state to database if we have a messageId
          if (messageId) {
            const errorMessage = accumulatedContent 
              ? accumulatedContent + (wasAborted 
                  ? '\n\n_Generation stopped._' 
                  : '\n\n_Error: Message streaming was interrupted._')
              : wasAborted 
                ? 'Generation stopped.'
                : 'Sorry, there was an error processing your request.';
                
            updateStreamingMessage(messageId, errorMessage).catch(console.error);
          }
          
          setIsLoading(false);
          setStreamingMessageId(null);
          setAbortController(null);
        },
        controller.signal
      );
    } catch (error) {
      console.error('Error retrying message:', error);
      
      // Check if this was an abort error
      const wasAborted = error instanceof Error && 
        (error.name === 'AbortError' || error.message === 'Request aborted');
      
      // Update the message in the UI with an error
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        if (index + 1 < newMessages.length && newMessages[index + 1].role === 'assistant') {
          newMessages[index + 1] = {
            ...newMessages[index + 1],
            content: wasAborted ? 'Generation stopped.' : 'Sorry, there was an error processing your request.',
          };
        }
        return newMessages;
      });
      
      // Update the message in the database with an error
      if (messageId) {
        const errorContent = wasAborted 
          ? 'Generation stopped.' 
          : 'Sorry, there was an error processing your request.';
        await updateStreamingMessage(messageId, errorContent);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  // Handle deleting a chat
  const handleDeleteChat = async (chatId: string) => {
    try {
      // Delete the chat from the database
      const success = await deleteChat(chatId);
      
      if (success) {
        // If we're deleting the active chat, clear the UI
        if (chatId === activeChatId) {
          setMessages([]);
          setActiveChatId(null);
        }
        
        // Refresh the chat list
        loadUserChats();
      } else {
        console.error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(null, suggestion);
    // Add this to scroll to bottom after clicking a suggestion
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 300); // Slightly longer timeout to account for message generation
  };

  // Handle Enter key for submission (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(null, input);
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setActiveChatId(null);
    setIsMobileSidebarOpen(false);
    
    // Add a small delay to ensure DOM updates before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 100);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const handleUpdateChatTitle = async (chatId: string, newTitle: string) => {
    const success = await updateChatTitle(chatId, newTitle);
    if (success) {
      loadUserChats(); // Refresh the chat list with updated titles
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
  };

  const getModelColor = (modelId: string) => {
    if (modelId.includes('microsoft')) return 'blue';
    if (modelId.includes('qwen')) return 'purple';
    return 'gray';
  };

  const formatModelName = (modelId: string) => {
    return modelId.split('/').pop() || 'Unknown Model';
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        onNewChat={handleNewChat} 
        user={user} 
        userDisplayName={userDisplayName}
        onSignOut={onSignOut}
        chats={userChats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onUpdateChatTitle={handleUpdateChatTitle}
        onDeleteChat={handleDeleteChat}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      
      <main className="flex-1 flex flex-col h-screen">
        {/* Mobile header with menu button */}
        <div className="md:hidden flex items-center h-14 px-4 border-b border-zinc-800">
          <button 
            onClick={toggleMobileSidebar}
            className="text-gray-400 hover:text-white mr-4 transition-colors duration-200"
            aria-label="Open sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-bold text-xl">Orchestrate</h1>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent w-[26rem] sm:w-auto" ref={chatContainerRef}>          {(messages.length === 0 && !activeChatId && !isSubmitting) ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <h1 className="text-2xl md:text-3xl font-semibold mb-8 text-center">How can I help you?</h1>              
              <div className="space-y-3 max-w-2xl w-full px-2">
                {SUGGESTIONS.map((suggestion, index) => (
                  <button 
                    key={index}
                    className="suggestion-button w-full text-left"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-4 md:py-8 px-3 md:px-4">
              <div className="flex flex-col space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    } animate-fade-in group`}
                  >
                    <div className="text-xs text-zinc-500 mb-1 px-1">
                      {message.role === 'user' ? userDisplayName || user.email : `AI (${formatModelName(message.model || selectedModel)})`}
                    </div>
                    <div
                      className={
                        message.role === 'user'
                          ? 'chat-message-user relative group'
                          : 'chat-message-assistant relative group'
                      }
                    >
                      <div className="message-content">
                        {editingMessageId === message.messageid ? (
                          <div className="edit-mode w-full">
                            <textarea
                              ref={editTextareaRef}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full bg-zinc-900 text-white p-2 rounded border border-zinc-700 min-h-[120px] text-base resize-vertical"
                              autoFocus
                              style={{ 
                                minWidth: "300px",
                                height: "300px",
                              }}
                            />
                            <div className="flex justify-end mt-2 space-x-2">
                              <button
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingContent('');
                                }}
                                className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  if (message.messageid && editingContent.trim()) {
                                    // Save the edited message to the database
                                    await updateStreamingMessage(message.messageid, editingContent.trim());
                                    
                                    // Update the message in the UI
                                    setMessages(messages.map(m => 
                                      m.messageid === message.messageid 
                                        ? { ...m, content: editingContent.trim() } 
                                        : m
                                    ));
                                    
                                    // Exit edit mode
                                    setEditingMessageId(null);
                                    setEditingContent('');
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-purple-700 hover:bg-purple-600 rounded-md transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <Markdown
                            options={{
                              overrides: {
                                p: {
                                  props: {
                                    style: { marginBottom: '0' }
                                  }
                                },
                                a: {
                                  component: ({ children, ...props }) => (
                                    <a {...props}>[{children}]</a>
                                  )
                                }
                              }
                            }}
                          >
                            {message.content}
                          </Markdown>
                        )}
                        
                        {/* Message action buttons - visible only on hover */}
                        {message.messageid && !editingMessageId && (
                          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 bg-zinc-800 rounded-md z-10">
                            {message.role === 'user' && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(message.messageid!);
                                  setEditingContent(message.content);
                                  setTimeout(() => {
                                    if (editTextareaRef.current) {
                                      editTextareaRef.current.focus();
                                    }
                                  }, 10);
                                }}
                                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                aria-label="Edit message"
                              >
                                ✏️
                              </button>
                            )}
                            {message.role === 'user' && (
                              <button
                                onClick={() => handleRetryMessage(index)}
                                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                aria-label="Retry message"
                              >
                                🔄
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(message.messageid!)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                              aria-label="Delete message"
                            >
                              🗑️
                            </button>
                            {/* Copy button for convenience */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(message.content);
                                // Show a temporary tooltip or notification
                                const tooltip = document.createElement('div');
                                tooltip.textContent = 'Copied!';
                                tooltip.style.position = 'absolute';
                                tooltip.style.right = '20px';
                                tooltip.style.top = '0';
                                tooltip.style.backgroundColor = '#3b82f6';
                                tooltip.style.color = 'white';
                                tooltip.style.padding = '2px 6px';
                                tooltip.style.borderRadius = '4px';
                                tooltip.style.fontSize = '12px';
                                tooltip.style.opacity = '0';
                                tooltip.style.transition = 'opacity 0.2s';
                                
                                const messageElement = document.activeElement?.closest('.message-content');
                                if (messageElement) {
                                  messageElement.appendChild(tooltip);
                                  // Fade in
                                  setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
                                  // Fade out and remove
                                  setTimeout(() => { 
                                    tooltip.style.opacity = '0';
                                    setTimeout(() => tooltip.remove(), 200);
                                  }, 1000);
                                }
                              }}
                              className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                              aria-label="Copy message"
                            >
                              📋
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-3 md:p-4 lg:p-6">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={(e) => handleSubmit(e)} className="chat-input-container">
              <div className="flex items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message here..."
                  className="flex-1 bg-transparent resize-none max-h-36 py-2 px-3 focus:outline-none dark:text-gray-100 text-gray-800 min-h-[44px]"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center pl-2 min-h-[44px]">
                  <div className="flex items-center border-l border-zinc-700/50">
                    <button
                      type={isLoading ? "button" : "submit"}
                      disabled={!isLoading && !input.trim()}
                      className="p-3 rounded-md text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:text-gray-300"
                      onClick={isLoading && abortController ? () => abortController.abort() : undefined}
                    >
                      {isLoading ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 hover:text-red-300 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 transform rotate-90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <div className="flex mt-2 justify-between items-center text-xs text-zinc-500">
              <div className="hidden sm:block">Press Enter to send</div>
              <div className="flex items-center gap-3">
                <div className="relative flex justify-end" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="hover:text-white cursor-pointer transition-colors"
                    aria-label="Select model"
                  >
                    {selectedModel.split('/').pop() || 'AI Model'} ▼
                  </button>
                  {isModelDropdownOpen && (
                    <div className="fixed sm:absolute bottom-16 sm:bottom-full right-3 sm:right-0 left-auto z-20 w-[calc(100%-24px)] sm:w-64 md:w-72 mb-0 sm:mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden">
                      <div className="p-2">
                        <input
                          type="text"
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          placeholder="Search models"
                          className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="max-h-60 md:max-h-80 overflow-y-auto">
                        {availableModels
                          .filter((model) => 
                            model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                            model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                          )
                          .map((model) => (
                            <div
                              key={model.id}
                              className={`px-3 py-2 text-sm hover:bg-zinc-700 cursor-pointer flex items-center ${
                                selectedModel === model.id ? 'bg-purple-900/40 font-medium' : ''
                              }`}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setIsModelDropdownOpen(false);
                              }}
                            >
                              <div className="mr-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center" 
                                  style={{
                                    backgroundColor: getModelColor(model.id)
                                  }}
                                >
                                  {model.id.split('/')[0]?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              </div>
                              <div className="font-medium text-white">
                                {model.name || formatModelName(model.id)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:hidden relative flex justify-end">
                  <label htmlFor="fileUpload" className="cursor-pointer hover:text-white transition-colors">
                    Import Conversation
                  </label>
                  <input
                    id="fileUpload"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatComponent;