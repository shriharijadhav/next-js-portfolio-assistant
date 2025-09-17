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
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const { question, context } = await request.json();
    const info = process.env.USER_INFO || "No information provided.";

    // Keep your messages array exactly the same
    const messages = [
      {
        role: "system",
        content: `You are a warm, professional, and friendly assistant called "Shrihari’s Assistant".

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
