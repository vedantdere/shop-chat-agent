/**
 * Gemini Service
 * Manages interactions with the Gemini API
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

/**
 * Creates a Gemini service instance
 * @param {string} apiKey - Gemini API key
 * @returns {Object} Gemini service with methods for interacting with the Gemini API
 */
export function createGeminiService(apiKey = process.env.GEMINI_API_KEY) {
  // Initialize Gemini client
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: AppConfig.api.defaultModel,
    generationConfig: {
      maxOutputTokens: AppConfig.api.maxTokens,
      temperature: AppConfig.api.temperature ?? 0.7,
    }
  });

  /**
   * Streams a conversation with Gemini
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history (as array of { role, parts })
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Array} params.tools - Tools to use (not natively supported in Gemini, stub only)
   * @param {Object} streamHandlers - Handlers for streaming response
   * @param {Function} streamHandlers.onText - Handles streaming text chunks
   * @param {Function} streamHandlers.onMessage - Handles final message
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools
  }, streamHandlers) => {
    const systemInstruction = getSystemPrompt(promptType);

    // Insert system instruction as first message
    const chatHistory = [
      { role: "system", parts: [{ text: systemInstruction }] },
      ...messages
    ];

    // Start streaming the response
    const chat = model.startChat({ history: chatHistory });

    const result = await chat.sendMessageStream({
      contents: [{ role: "user", parts: messages[messages.length - 1].parts }]
    });

    let fullText = "";

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText && streamHandlers.onText) {
        streamHandlers.onText(chunkText);
      }
      fullText += chunkText;
    }

    if (streamHandlers.onMessage) {
      streamHandlers.onMessage({ role: "model", content: fullText });
    }

    // Gemini doesn't yet support tool_use callbacks natively, so tools are a placeholder
    if (streamHandlers.onToolUse) {
      // If you implement tool logic, do it here
    }

    return { role: "model", content: fullText };
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @returns {string} The system prompt content
   */
  const getSystemPrompt = (promptType) => {
    return systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}

export default {
  createGeminiService
};
