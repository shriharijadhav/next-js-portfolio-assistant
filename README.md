# Portfolio Assistant API

A secure Next.js API service that powers Shrihari's AI assistant for his portfolio website. This API provides conversational AI responses about Shrihari's professional background, experience, and projects.

## 🚀 Features

- **AI-Powered Responses**: Uses Groq's LLM to provide natural, conversational answers about Shrihari
- **Enterprise Security**: Comprehensive rate limiting and guardrails for production use
- **CORS Protection**: Configured for specific allowed origins
- **Content Moderation**: Optional OpenAI moderation for safety
- **Request Validation**: Input sanitization and prompt injection protection

## 🛡️ Security & Rate Limiting

### Rate Limiting
- **60 requests per IP** every 10 minutes
- **In-memory store** with automatic cleanup
- **429 status codes** with proper retry headers
- **Real IP detection** (supports proxies, Cloudflare, etc.)

### Input Validation & Guardrails
- **Question length limit**: 500 characters maximum
- **Context validation**: Maximum 10 items, 1000 characters each
- **Prompt injection detection**: Blocks common attack patterns:
  - "ignore previous instructions"
  - "system: you are"
  - "forget everything"
  - "act as if" / "pretend to be"

### Content Moderation (Optional)
- **OpenAI Moderation API** integration
- **Input & output filtering** for inappropriate content
- **Fail-open design**: Continues if moderation API is unavailable

### Additional Security
- **Origin validation**: Only allows requests from authorized domains
- **Request timeout**: 30-second limit on API calls
- **Response limits**: Maximum 1000 tokens per response
- **Comprehensive logging**: All security events tracked

## 🔧 API Endpoint

### POST `/api/ask`

**Request Body:**
```json
{
  "question": "What is Shrihari's experience?",
  "context": [
    {
      "question": "previous question",
      "answer": "previous answer"
    }
  ]
}
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Shrihari has 2.5 years of experience..."
      }
    }
  ]
}
```

**Error Responses:**
- `400` - Invalid input or security violation
- `429` - Rate limit exceeded
- `403` - Unauthorized origin
- `500` - Server error

## 🌐 Usage Examples

### JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:3000/api/ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    question: "Tell me about Shrihari's projects",
    context: []
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### cURL
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"question": "What technologies does Shrihari use?", "context": []}'
```

## ⚙️ Environment Variables

Create a `.env.local` file in the project root:

```env
# Required
GROQ_API_KEY=your_groq_api_key_here
USER_INFO=Information about Shrihari (professional summary, experience, etc.)

# Optional
SYSTEM_PROMPT=Custom system prompt for the AI assistant
OPENAI_API_KEY=your_openai_key_for_moderation
```

## 🚦 Getting Started

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your API keys and information
```

3. **Run the development server:**
```bash
npm run dev
```

4. **Test the API:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"question": "Hi, who are you?", "context": []}'
```

## 🔍 Monitoring & Logs

The API provides comprehensive logging for:
- **Successful requests**: Duration and question preview
- **Security violations**: Rate limits, input validation, content moderation
- **API errors**: Groq API failures and system errors
- **Performance metrics**: Request timing and IP tracking

Example log output:
```
Successful request from 127.0.0.1 (245ms): "What is Shrihari's experience?..."
Security violation from 127.0.0.1 (1ms): Question too long. Maximum 500 characters allowed
Rate limit exceeded for IP: 127.0.0.1
```

## 🏗️ Architecture

```
Frontend (localhost:5173 / shriharijadhav.vercel.app)
    ↓ HTTP POST
Next.js API Route (/api/ask)
    ↓ Security Checks
    ├── Rate Limiting
    ├── Input Validation
    ├── Content Moderation
    ↓ AI Processing
Groq API (openai/gpt-oss-20b)
    ↓ Response
Content Validation & Logging
    ↓ JSON Response
Frontend
```

## 📈 Production Deployment

For production deployments, consider:

1. **Redis-based rate limiting** for multi-instance deployments
2. **Database logging** for security event analysis
3. **Monitoring dashboards** for real-time metrics
4. **API key rotation** policies
5. **WAF integration** for additional protection

## 🔗 Related Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Groq API Documentation](https://console.groq.com/docs)
- [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

## 📄 License

This project is for portfolio purposes. Please contact Shrihari for usage permissions.
