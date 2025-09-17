import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://shriharijadhav.vercel.app"
];

const getCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true"
});

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 60; // Max requests per window per IP
const rateLimitStore = new Map();

// Security configuration
const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_ITEMS = 10;
const MAX_CONTEXT_ITEM_LENGTH = 1000;

// Rate limiting function
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];
  
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  
  return true;
}

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

// Simple language detection
function detectNonEnglish(text) {
  const nonEnglishPatterns = [
    /[\u0900-\u097F]/, // Hindi/Devanagari
    /[\u0600-\u06FF]/, // Arabic
    /[\u4E00-\u9FFF]/, // Chinese
    /\b(kya|hai|ke|ka|ki|mein|batao|sunao|kaise|kahan)\b/i // Hinglish
  ];
  
  return nonEnglishPatterns.some(pattern => pattern.test(text));
}

// Simple input validation
function validateQuestion(question) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }
  
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    throw new Error('Question cannot be empty');
  }
  
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question too long. Maximum ${MAX_QUESTION_LENGTH} characters allowed`);
  }
  
  return trimmed;
}

function validateContext(context) {
  if (!context) return [];
  
  if (!Array.isArray(context)) {
    throw new Error('Context must be an array');
  }
  
  if (context.length > MAX_CONTEXT_ITEMS) {
    throw new Error(`Too many context items. Maximum ${MAX_CONTEXT_ITEMS} allowed`);
  }
  
  return context.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Context item ${index} must be an object`);
    }
    
    if (!item.question || !item.answer) {
      throw new Error(`Context item ${index} must have question and answer properties`);
    }
    
    if (typeof item.question !== 'string' || typeof item.answer !== 'string') {
      throw new Error(`Context item ${index} question and answer must be strings`);
    }
    
    return {
      question: item.question.trim(),
      answer: item.answer.trim()
    };
  });
}

// Simple guardrail function
function inputGuardrail(question) {
  // 1. Language detection
  if (detectNonEnglish(question)) {
    return {
      allowed: false,
      reason: 'non_english_language',
      message: "I currently support only English queries. For questions in other languages, please reach out to Shrihari directly at mr.shrihari212@gmail.com or https://shriharijadhav.vercel.app/"
    };
  }
  
  // 2. Check for Shrihari-specific questions (must be ABOUT Shrihari)
  const normalizedQuestion = question.toLowerCase().trim();
  
  // Only allow questions that are specifically ABOUT Shrihari
  const shrhariSpecificPatterns = [
    // Direct name mentions
    /\b(shrihari|jadhav)\b/i,
    
    // Questions about HIS specific details
    /\b(his|he|him)\s+(experience|background|skills|projects|work|contact|email|linkedin)\b/i,
    
    // Questions about HIS work at specific companies
    /\b(his|shrihari'?s?)\s+(work|time|experience|role)\s+at\s+(pepsales|tcs|tata)\b/i,
    
    // Questions about HIS education/location
    /\b(his|shrihari'?s?)\s+(education|university|background)\b/i,
    
    // Contact questions specifically about Shrihari
    /\bhow\s+to\s+(contact|reach|hire)\s+(shrihari|him)\b/i,
    /\b(shrihari'?s?|his)\s+(contact|email|phone|linkedin)\b/i,
    
    // Questions about him as a developer
    /\b(is|do you think)\s+(shrihari|he)\s+.*(good|experienced|skilled|capable)\s*(developer|programmer|coder)/i,
    /\bwhat\s+(does|did)\s+(shrihari|he)\s+(do|work)/i,
    /\bwhere\s+(does|did)\s+(shrihari|he)\s+work/i,
    /\btell\s+me\s+about\s+(shrihari|him|his)/i,
    /\bdescribe\s+(shrihari|his|him)/i,
    /\bthink\s+(shrihari|he)\s+is/i
  ];
  
  const isAboutShrihari = shrhariSpecificPatterns.some(pattern => 
    pattern.test(normalizedQuestion)
  );
  
  // 3. Check for basic greetings
  const greetingPatterns = [
    /^(hi|hello|hey|greetings)$/i,
    /^who are you$/i,
    /^what do you do$/i
  ];
  
  const isGreeting = greetingPatterns.some(pattern => pattern.test(normalizedQuestion));
  
  if (isAboutShrihari || isGreeting) {
    return {
      allowed: true,
      reason: isAboutShrihari ? 'about_shrihari' : 'greeting'
    };
  }
  
  // Block everything else
  return {
    allowed: false,
    reason: 'not_about_shrihari',
    message: "Sorry, I can only assist you with learning more about Shrihari’s professional background. For anything else, please reach out to him directly at mr.shrihari212@gmail.com."
  };
}

// Handle preflight requests
export async function OPTIONS(request) {
  const origin = request.headers.get("origin");
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
  const startTime = Date.now();
  const origin = request.headers.get("origin");
  const clientIP = getClientIP(request);
  
  try {
    // 1. Origin validation (allow requests without Origin header for testing)
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`Blocked request from unauthorized origin: ${origin} (IP: ${clientIP})`);
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    // 2. Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new NextResponse(JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000 / 60)
      }), {
        status: 429,
        headers: {
          ...(origin ? getCorsHeaders(origin) : {}),
          'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
        }
      });
    }

    // 3. Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { 
        status: 400,
        headers: origin ? getCorsHeaders(origin) : {}
      });
    }

    const { question, context } = requestBody;

    // 4. Input validation
    const validatedQuestion = validateQuestion(question);
    const validatedContext = validateContext(context);

    // 5. INPUT GUARDRAIL: Check language and topic relevance
    const inputGuardrailResult = inputGuardrail(validatedQuestion);
    if (!inputGuardrailResult.allowed) {
      console.warn(`Input guardrail blocked question from ${clientIP}: "${validatedQuestion}" (${inputGuardrailResult.reason})`);
      return new NextResponse(JSON.stringify({ 
        choices: [{
          message: {
            role: "assistant",
            content: inputGuardrailResult.message
          }
        }]
      }), {
        status: 200,
        headers: origin ? getCorsHeaders(origin) : {}
      });
    }

    // 6. Prepare system prompt and user info
    const info = process.env.USER_INFO || "No information provided.";
    const systemPrompt = process.env.SYSTEM_PROMPT || `You are a warm, professional, and friendly assistant who introduces Shrihari and his work in a natural way.
When asked about yourself:
- Introduce yourself as "I'm Shrihari's Assistant here to help you out."
- Keep the tone friendly and approachable, e.g., "I'm Shrihari's Assistant here to help you out. If you'd like to know more about Shrihari, feel free to ask!
- Never ever reveal that you are ChatGPT or powered by ChatGPT or AI. Just say "I'm Shrihari's Assistant here to help you out. If you'd like to know more about Shrihari, feel free to ask!.

How to answer:
- Speak as if you personally know Shrihari's background and are describing it to someone.
- Use previous conversation context if available — treat it as information you can reference.
- Keep the tone conversational, smooth, and human — like a colleague recommending him.
- Keep responses concise and clear; always give concise and on point answers unless the user asks for more detail.
- Weave details into flowing sentences but keep it concise; don't dump lists unless the user explicitly asks.
- Use natural transitions (e.g., "these days…", "earlier he worked at…", "along the way he also…").
- If something truly isn't available anywhere in the info or context, respond politely: "Not something I can share — you may want to reach out to Shrihari directly."
- Do NOT create images, tables, or screenshots or any graphical information. Always use only plain text or Markdown as required.`;

    // 7. Build messages array
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Here is information about Shrihari:
${info}

Answer only using this information and any previous conversation context provided.`
      },
      ...validatedContext.flatMap(c => [
        { role: "user", content: c.question },
        { role: "assistant", content: c.answer }
      ]),
      { role: "user", content: validatedQuestion }
    ];

    // 8. Prepare API payload with safety limits
    const payload = { 
      model: "openai/gpt-oss-20b", 
      messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    // 9. Make API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error (${response.status}):`, errorText);
      throw new Error(`AI service temporarily unavailable (${response.status})`);
    }

    const data = await response.json();

    // 10. Validate AI response
    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('Invalid response from AI service');
    }

    // 11. Log successful request
    const duration = Date.now() - startTime;
    console.log(`Successful request from ${clientIP} (${duration}ms): "${validatedQuestion.substring(0, 50)}..."`);

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: origin ? getCorsHeaders(origin) : {}
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log security events
    if (error.message.includes('too long') || error.message.includes('too many')) {
      console.warn(`Security violation from ${clientIP} (${duration}ms):`, error.message);
      return new NextResponse(JSON.stringify({ 
        error: "Request blocked for security reasons",
        details: error.message
      }), {
        status: 400,
        headers: origin ? getCorsHeaders(origin) : {}
      });
    }
    
    // Log other errors
    console.error(`Error processing request from ${clientIP} (${duration}ms):`, error.message);
    
    return new NextResponse(JSON.stringify({ 
      error: "Sorry, I encountered an error. Please try again." 
    }), {
      status: 500,
      headers: origin ? getCorsHeaders(origin) : {}
    });
  }
}