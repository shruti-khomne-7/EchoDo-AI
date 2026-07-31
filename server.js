/**
 * EchoDo AI Backend Server
 * Secure Node.js & Express server.
 * Gemini API is the PRIMARY parser for all requests. Local rule parser is strictly a fallback.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '.')));

// API Status Check
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  res.json({
    status: 'online',
    isAiEnabled: hasKey,
    primaryParser: hasKey ? 'Gemini AI (Primary)' : 'Rule Engine (Fallback)'
  });
});

// Secure API Endpoint for Voice Task Parsing
app.post('/api/parse-task', async (req, res) => {
  const { speechText } = req.body;
  if (!speechText || typeof speechText !== 'string' || !speechText.trim()) {
    return res.status(400).json({ error: 'Speech text is required.' });
  }

  const rawText = speechText.trim();
  const apiKey = process.env.GEMINI_API_KEY;
  const now = new Date();

  // Local Rule Parser Fallback (ONLY used if Gemini request fails or no key exists)
  const parseLocally = (fallbackReason = 'Local fallback engine') => {
    let cleanText = rawText;
    let priority = 'medium';
    let category = 'Work';
    let dueDate = 'No due date';
    let dueTime = '';
    const lower = rawText.toLowerCase();

    // Priority inference
    const isNegatedUrgent = /(not\s+urgent|isn't\s+urgent|is\s+not\s+urgent|no\s+urgency|can\s+wait|no\s+rush|whenever|low\s+priority)/i.test(lower);
    const isHighPriority = /(urgent|asap|high\s+priority|critical|important|emergency|today|pay\s+bill|electricity)/i.test(lower);

    if (isNegatedUrgent) {
      priority = 'low';
    } else if (isHighPriority) {
      priority = 'high';
    } else {
      priority = 'medium';
    }

    // Dynamic Category inference
    if (/(milk|eggs|grocery|groceries|supermarket|bread|food)/i.test(lower)) category = 'Groceries';
    else if (/(dbms|assignment|homework|study|exam|education|lecture)/i.test(lower)) category = 'Education';
    else if (/(leetcode|interview|practice|algo|dsa)/i.test(lower)) category = 'Interview Prep';
    else if (/(dentist|doctor|appointment|health|clinic)/i.test(lower)) category = 'Healthcare';
    else if (/(passport|renew|license|document|visa|tax|bill)/i.test(lower)) category = 'Documents';
    else if (/(model|pytorch|tensorflow|deploy|api|code|bug|pr)/i.test(lower)) category = 'Development';
    else if (/(gym|workout|coffee|dinner|movie|family)/i.test(lower)) category = 'Personal';
    else category = 'Work';

    // Date calculation
    const isNegatedDate = /(don't\s+remind|do\s+not\s+remind|no\s+due\s+date|no\s+deadline)/i.test(lower);
    if (!isNegatedDate) {
      if (/\btomorrow\b/i.test(lower)) {
        const t = new Date(now);
        t.setDate(t.getDate() + 1);
        dueDate = t.toISOString().split('T')[0];
      } else if (/\btoday\b/i.test(lower)) {
        dueDate = now.toISOString().split('T')[0];
      } else if (/\bthis weekend\b/i.test(lower)) {
        const w = new Date(now);
        w.setDate(w.getDate() + (6 - w.getDay()));
        dueDate = w.toISOString().split('T')[0];
      } else if (/\bnext week\b/i.test(lower)) {
        const nw = new Date(now);
        nw.setDate(nw.getDate() + 7);
        dueDate = nw.toISOString().split('T')[0];
      }
    }

    // Time extraction
    const timeMatch = lower.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm)\b/i);
    if (timeMatch) {
      dueTime = `${timeMatch[2]}${timeMatch[3] || ':00'} ${timeMatch[4].toUpperCase()}`;
    }

    cleanText = cleanText
      .replace(/,?\s*(not\s+urgent|isn't\s+urgent|no\s+urgency|high\s+priority|medium\s+priority|low\s+priority|urgent|asap)\b/gi, '')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();

    if (cleanText.length > 0) {
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }

    return {
      text: cleanText,
      category,
      priority,
      dueDate,
      dueTime,
      suggestedSubtasks: [],
      tags: [category],
      reasoning: fallbackReason,
      isAiPowered: false
    };
  };

  // If no API key configured, use local fallback
  if (!apiKey || apiKey.length < 5) {
    console.log('[Backend] GEMINI_API_KEY not configured in .env. Using fallback parser.');
    return res.json(parseLocally('No API key configured in .env'));
  }

  // PRIMARY PARSER: GOOGLE GEMINI API
  try {
    const prompt = `You are an expert task parsing assistant for developers.
Analyze the voice-dictated task input: "${rawText}".
Current timestamp: ${now.toISOString()} (Current Date: ${now.toISOString().split('T')[0]}, Current Year: ${now.getFullYear()}).

INSTRUCTIONS FOR EXTRACTING FIELDS:
1. "cleanTitle": (string) Concise task title without command phrases ("not urgent", "remind me to", "please", "make sure to").
2. "category": (string) Generate a dynamic, natural category label based on task context (e.g. "Groceries", "Education", "Interview Prep", "Healthcare", "Documents", "Development", "Fitness", "Finances", "Entertainment"). Do NOT use a hardcoded list.
3. "priority": (string: "high", "medium", "low"). Infer priority naturally from meaning and negations.
   - Examples: "Pay electricity bill today" -> "high", "Watch a movie" -> "low", "Not urgent, finish report" -> "low".
4. "dueDate": (string) Extract and calculate exact date for ANY natural date expression (e.g. "next Monday", "next Friday", "this weekend", "next week", "in 2 days", "in 3 hours", "next month", "15th August", "August 15 at 5 PM", "tomorrow evening", "today at 4:30 PM"). Return ISO date YYYY-MM-DD (e.g. "2026-08-15") or "No due date".
5. "dueTime": (string) Extract time string in 12-hour format (e.g. "5:00 PM", "4:30 PM", "10:00 AM") or empty string if none.
6. "suggestedSubtasks": (array of strings) 2 short actionable subtasks.
7. "tags": (array of strings) 1-3 relevant tag strings.
8. "reasoning": (string) 1 brief sentence explaining the parsing.

Return ONLY a valid raw JSON object. Do NOT use markdown code block formatting.`;

    // 10-second timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[Backend] Gemini API error response:', errText);
      return res.json(parseLocally('Gemini API error (used local fallback)'));
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedJson = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    console.log('[Backend] Successfully parsed via PRIMARY Gemini API');

    return res.json({
      text: parsed.cleanTitle || rawText,
      category: parsed.category || 'General',
      priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
      dueDate: parsed.dueDate || 'No due date',
      dueTime: parsed.dueTime || '',
      suggestedSubtasks: parsed.suggestedSubtasks || [],
      tags: parsed.tags || [parsed.category || 'General'],
      reasoning: parsed.reasoning || 'Analyzed via Gemini AI primary engine.',
      isAiPowered: true
    });
  } catch (err) {
    console.error('[Backend] Gemini API request failed or timed out:', err.message);
    return res.json(parseLocally(`Gemini request failed: ${err.message}`));
  }
});

app.listen(PORT, () => {
  console.log(`[EchoDo AI] Server running on http://localhost:${PORT}`);
});
