/**
 * Smart Task Parser for EchoDo AI
 * Handles natural language negation, dynamic AI categories, and automatic date/time extraction.
 */

class SmartTaskParser {
  static parseSpeech(rawText) {
    let cleanText = rawText.trim();
    let priority = 'medium';
    let category = 'General';
    let dueDate = 'No due date';
    let dueTime = '';

    const lower = cleanText.toLowerCase();

    // 1. Priority Inference with Negation Awareness
    const isNegatedUrgent = /(not\s+urgent|isn't\s+urgent|is\s+not\s+urgent|no\s+urgency|can\s+wait|no\s+rush|whenever|low\s+priority)/i.test(lower);
    const isHighPriority = /(urgent|asap|high\s+priority|critical|important|emergency|today|pay\s+bill|electricity|deadline)/i.test(lower);
    const isLowPriority = /(this\s+weekend|movie|whenever|later|sometime|watch\s+movie)/i.test(lower);

    if (isNegatedUrgent || isLowPriority) {
      priority = 'low';
    } else if (isHighPriority) {
      priority = 'high';
    } else {
      priority = 'medium';
    }

    // 2. Dynamic Category Inference
    if (/(milk|eggs|grocery|groceries|supermarket|bread|fruit|food|store)/i.test(lower)) {
      category = 'Groceries';
    } else if (/(dbms|assignment|homework|study|exam|lecture|class|education|school|college|paper)/i.test(lower)) {
      category = 'Education';
    } else if (/(leetcode|interview|practice|algo|coding|dsa|problem)/i.test(lower)) {
      category = 'Interview Prep';
    } else if (/(dentist|doctor|appointment|health|medicine|clinic|checkup)/i.test(lower)) {
      category = 'Healthcare';
    } else if (/(passport|renew|license|document|visa|tax|bill|receipt)/i.test(lower)) {
      category = 'Documents';
    } else if (/(model|pytorch|tensorflow|deploy|api|code|bug|pr|github|repository|train)/i.test(lower)) {
      category = 'Development';
    } else if (/(gym|workout|running|coffee|dinner|movie|family)/i.test(lower)) {
      category = 'Personal';
    } else {
      category = 'Work';
    }

    // 3. Auto Date Calculation (Format: YYYY-MM-DD or Month Day) so user doesn't physically type
    const now = new Date();
    const isNegatedDate = /(don't\s+remind|do\s+not\s+remind|no\s+due\s+date|no\s+deadline)/i.test(lower);
    
    if (!isNegatedDate) {
      if (/\btomorrow\b/i.test(lower)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate = tomorrow.toISOString().split('T')[0];
      } else if (/\btoday\b/i.test(lower)) {
        dueDate = now.toISOString().split('T')[0];
      } else if (/\bthis weekend\b/i.test(lower)) {
        const weekend = new Date(now);
        const day = weekend.getDay();
        const diff = day === 0 ? 6 : 6 - day;
        weekend.setDate(weekend.getDate() + diff);
        dueDate = weekend.toISOString().split('T')[0];
      } else if (/\bnext week\b/i.test(lower)) {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        dueDate = nextWeek.toISOString().split('T')[0];
      }
    }

    // 4. Time Extraction (e.g. "at 4pm", "10am", "5:30 PM")
    const timeMatch = lower.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm)\b/i);
    if (timeMatch) {
      const hour = timeMatch[2];
      const mins = timeMatch[3] || ':00';
      const ampm = timeMatch[4].toUpperCase();
      dueTime = `${hour}${mins} ${ampm}`;
    }

    // Strip meta words from clean title
    cleanText = cleanText
      .replace(/,?\s*(not\s+urgent|isn't\s+urgent|no\s+urgency|high\s+priority|medium\s+priority|low\s+priority|urgent|asap)\b/gi, '')
      .replace(/,?\s*(don't\s+remind\s+me|do\s+not\s+remind\s+me)\b/gi, '')
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
      tags: [category]
    };
  }
}

window.SmartTaskParser = SmartTaskParser;
