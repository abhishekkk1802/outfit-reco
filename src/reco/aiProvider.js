const axios = require("axios");

/**
 * AI Provider Abstraction Layer
 * Allows switching between different AI providers (Gemini, OpenAI, Claude, DeepSeek, etc.)
 * without changing the main worker code.
 */

// Provider implementations
const providers = {
  gemini: {
    name: "Gemini",
    async call(prompt, config) {
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
      const model = config.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
      
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY in environment variables");
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 1024,
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      };

      try {
        const resp = await axios.post(url, body, { 
          timeout: 20000,
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!resp.data?.candidates || resp.data.candidates.length === 0) {
          throw new Error('No candidates in Gemini response');
        }
        
        let text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Check if response was finished or truncated
        const finishReason = resp.data?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== "STOP") {
          if (finishReason === "MAX_TOKENS") {
            throw new Error(`Gemini response was truncated (finishReason: ${finishReason}). Increase maxOutputTokens.`);
          } else if (finishReason === "SAFETY") {
            throw new Error(`Gemini response was blocked by safety filters.`);
          }
        }
        
        return parseResponse(text);
      } catch (error) {
        const status = error.response?.status;
        
        // Handle rate limiting (429)
        if (status === 429) {
          const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['Retry-After'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
          throw new Error(`Gemini API Rate Limit: Too many requests. Please wait ${Math.ceil(waitTime/1000)} seconds before retrying.`);
        }
        
        // Try alternative endpoint on 404
        if (status === 404) {
          const altUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
          try {
            const altResp = await axios.post(altUrl, body, { timeout: 20000 });
            const text = altResp.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return parseResponse(text);
          } catch (altError) {
            throw new Error(`Gemini API Error: ${altError.message}`);
          }
        }
        
        throw new Error(`Gemini API Error: ${error.message}`);
      }
    }
  },

  openai: {
    name: "OpenAI",
    async call(prompt, config) {
      const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
      const model = config.model || process.env.OPENAI_MODEL || "gpt-3.5-turbo";
      
      if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY in environment variables");
      }

      const url = "https://api.openai.com/v1/chat/completions";
      const body = {
        model: model,
        messages: [
          { role: "system", content: "You are a fashion stylist. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 250
      };

      try {
        const resp = await axios.post(url, body, {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const text = resp.data?.choices?.[0]?.message?.content || "";
        return parseResponse(text);
      } catch (error) {
        throw new Error(`OpenAI API Error: ${error.message}`);
      }
    }
  },

  claude: {
    name: "Claude (Anthropic)",
    async call(prompt, config) {
      const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      const model = config.model || process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
      
      if (!apiKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
      }

      const url = "https://api.anthropic.com/v1/messages";
      const body = {
        model: model,
        max_tokens: 250,
        messages: [
          { role: "user", content: prompt }
        ]
      };

      try {
        const resp = await axios.post(url, body, {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        });

        const text = resp.data?.content?.[0]?.text || "";
        return parseResponse(text);
      } catch (error) {
        throw new Error(`Claude API Error: ${error.message}`);
      }
    }
  },

  deepseek: {
    name: "DeepSeek",
    async call(prompt, config) {
      const apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY;
      const model = config.model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
      
      if (!apiKey) {
        throw new Error("Missing DEEPSEEK_API_KEY in environment variables");
      }

      const url = "https://api.deepseek.com/v1/chat/completions";
      const body = {
        model: model,
        messages: [
          { role: "system", content: "You are a fashion stylist. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 250
      };

      try {
        const resp = await axios.post(url, body, {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const text = resp.data?.choices?.[0]?.message?.content || "";
        return parseResponse(text);
      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          const errorData = error.response.data;
          
          if (status === 402) {
            const errorMsg = errorData?.error?.message || "Insufficient Balance";
            throw new Error(`DeepSeek API Error (402): ${errorMsg}. Please add credits to your DeepSeek account.`);
          } else if (status === 401) {
            throw new Error(`DeepSeek API Error (401): Invalid API key. Please check your DEEPSEEK_API_KEY in .env`);
          } else if (status === 429) {
            throw new Error(`DeepSeek API Error (429): Rate limit exceeded. Please wait before retrying.`);
          }
        }
        throw new Error(`DeepSeek API Error: ${error.message}`);
      }
    }
  }
};

/**
 * Parse AI response text and extract JSON
 * Works with responses from any provider
 */
function parseResponse(text) {
  // Strip markdown code blocks if present
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Check if text is suspiciously short (likely incomplete)
  if (text.length < 50) {
    const trimmedText = text.trim();
    if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
      const jsonStart = text.indexOf(trimmedText[0]);
      const jsonEnd = text.lastIndexOf(trimmedText[0] === "{" ? "}" : "]");
      
      if (jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error(`Incomplete JSON response from AI. Response was truncated at ${text.length} characters.`);
      }
    }
    throw new Error(`AI response too short (${text.length} chars). Expected complete JSON with paragraph and bullets.`);
  }

  // Check if text looks like incomplete JSON (starts with { but doesn't end with })
  const trimmedText = text.trim();
  if (trimmedText.startsWith("{") && !trimmedText.endsWith("}")) {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    
    if (jsonEnd < jsonStart || jsonEnd === -1) {
      throw new Error(`Incomplete JSON response from AI. Response was truncated.`);
    }
    
    if (jsonEnd - jsonStart < 20) {
      throw new Error(`Incomplete JSON response from AI. JSON object too short.`);
    }
  }

  try {
    // First try parsing the entire cleaned text
    try {
      const parsed = JSON.parse(text);
      
      // Ensure bullets is an array
      if (parsed.bullets && !Array.isArray(parsed.bullets)) {
        parsed.bullets = [];
      }
      
      return {
        paragraph: parsed.paragraph || "No explanation available.",
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : []
      };
    } catch (directParseErr) {
      // If direct parse fails, try to extract JSON object
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = text.slice(jsonStart, jsonEnd + 1);
        
        try {
          const parsed = JSON.parse(jsonStr);
          return {
            paragraph: parsed.paragraph || "No explanation available.",
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets : []
          };
        } catch (extractErr) {
          throw new Error(`Failed to parse extracted JSON: ${extractErr.message}`);
        }
      } else {
        throw new Error(`No valid JSON object found in AI response.`);
      }
    }
  } catch (parseErr) {
    // If it's our custom error, re-throw it
    if (parseErr.message.includes("Incomplete JSON") || parseErr.message.includes("No valid JSON")) {
      throw parseErr;
    }
    throw new Error(`Failed to parse AI response: ${parseErr.message}`);
  }
}

/**
 * Get the configured AI provider
 * Reads from AI_PROVIDER environment variable (default: gemini)
 */
function getProvider() {
  const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const provider = providers[providerName];

  if (!provider) {
    const available = Object.keys(providers).join(", ");
    throw new Error(
      `Unknown AI provider: ${providerName}. Available providers: ${available}`
    );
  }

  return provider;
}

/**
 * Call AI API with the configured provider
 * @param {string} prompt - The prompt to send to the AI
 * @param {Object} config - Optional provider-specific config (apiKey, model)
 * @returns {Promise<Object>} Parsed JSON response with paragraph and bullets
 */
async function callAI(prompt, config = {}) {
  const provider = getProvider();
  
  try {
    const result = await provider.call(prompt, config);
    return result;
  } catch (error) {
    // Only log actual errors, not expected retries
    if (!error.message.includes("Rate Limit") && !error.message.includes("Incomplete JSON")) {
      console.error(`[AI] Error: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  callAI,
  getProvider,
  providers: Object.keys(providers) // Export available provider names
};

