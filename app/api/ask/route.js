import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://shriharijadhav.vercel.app"
];

const getCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true"
});

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 60; // Max requests per window per IP
const rateLimitStore = new Map();

// Rate limiting function
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];
  
  // Remove expired requests
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  
  // Clean up old entries periodically
  if (Math.random() < 0.1) { // 10% chance to cleanup
    cleanupRateLimitStore();
  }
  
  return true; // Request allowed
}

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (validRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, validRequests);
    }
  }
}

function getClientIP(request) {
  // Try various headers to get real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return 'unknown';
}

// Handle preflight requests
export async function OPTIONS(request) {
  const origin = request.headers.get("origin");
  if (ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
  try {
    const origin = request.headers.get("origin");
    const clientIP = getClientIP(request);
    
    // 1. Origin validation
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    // 2. Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new NextResponse(JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000 / 60) // minutes
      }), {
        status: 429,
        headers: {
          ...getCorsHeaders(origin),
          'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
        }
      });
    }

    const { question, context } = await request.json();
    const info = process.env.USER_INFO || "No information provided.";

    // Keep your messages array exactly the same
    const messages = [
      {
        role: "system",
        content: `You are a warm, professional, and friendly assistant called "Shrihari's Assistant".

IMPORTANT: You must ONLY answer questions specifically about Shrihari Jadhav. For any other topics, politely redirect users to contact Shrihari directly.
If a question is not about Shrihari's professional background, experience, projects, or contact information, respond: "I'm here specifically to help with questions about Shrihari. For other topics, please reach out to him directly at mr.shrihari212@gmail.com"

When asked about yourself:
- Introduce yourself as "I'm Shrihari's Assistant here to help you out."
- Keep the tone friendly and approachable, e.g., "I'm Shrihari's Assistant here to help you out. If you'd like to know more about Shrihari, feel free to ask!"
- Never reveal that you are ChatGPT or powered by ChatGPT.

How to answer:
- Speak as if you personally know Shrihari's background and are describing it to someone.
- Use previous conversation context if available — treat it as information you can reference.
- Keep the tone conversational, smooth, and human — like a colleague recommending him.
- Keep responses concise and clear; always give concise, on-point answers unless the user specifically asks for more detail.
- Weave details into flowing sentences; don't dump lists unless the user explicitly asks.
- Use natural transitions, e.g., "these days…", "earlier he worked at…", "along the way he also…".
- If something truly isn't available anywhere in the info or context, respond politely: "Not something I can share — you may want to reach out to Shrihari directly."
- Do NOT create images, tables, screenshots, or any graphical information. Always use only plain text or Markdown as required.`
      },
      {
        role: "user",
        content: `Here is information about Shrihari:
${info}

Answer only using this information and any previous conversation context provided.`
      },
      ...(context || []).flatMap(c => [
        { role: "user", content: c.question },
        { role: "assistant", content: c.answer }
      ]),
      { role: "user", content: question }
    ];

    const payload = { model: "openai/gpt-oss-20b", messages };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: getCorsHeaders(origin)
    });
  } catch (error) {
    console.error("Error in /ask route:", error);
    const origin = request.headers.get("origin");
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}
