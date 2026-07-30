/**
 * Smart NLP Task Parser for EchoDo AI
 * Extracts categories, priority levels, and due date phrases from natural speech.
 */

class SmartTaskParser {
  static parseSpeech(rawText) {
    let cleanText = rawText.trim();
    let priority = 'medium';
    let category = 'work';
    let dueDate = 'No due date';

    const lower = cleanText.toLowerCase();

    // 1. Detect Priority
    if (/(\burgent\b|\basap\b|\bhigh priority\b|\bcritical\b|\bimportant\b|\bemergency\b)/i.test(lower)) {
      priority = 'high';
    } else if (/(\blow priority\b|\bwhenever\b|\bsometime\b|\blater\b|\blow\b)/i.test(lower)) {
      priority = 'low';
    } else if (/(\bmedium priority\b|\bnormal priority\b)/i.test(lower)) {
      priority = 'medium';
    }

    // 2. Detect Category
    const aiMlKeywords = ['ai', 'ml', 'pytorch', 'tensorflow', 'model', 'dataset', 'training', 'gpu', 'cuda', 'llm', 'transformer', 'neural', 'bert', 'huggingface', 'weights', 'loss', 'python', 'scikit', 'pipeline'];
    const workKeywords = ['pr', 'pull request', 'meeting', 'review', 'code', 'deploy', 'api', 'docker', 'kubernetes', 'jira', 'bug', 'fix', 'refactor', 'client', 'email', 'standup', 'sprint'];
    const personalKeywords = ['buy', 'grocery', 'coffee', 'gym', 'workout', 'doctor', 'mom', 'dad', 'family', 'house', 'clean', 'pay', 'bill', 'dinner', 'lunch'];
    const ideasKeywords = ['idea', 'brainstorm', 'feature', 'concept', 'what if', 'experiment', 'prototype'];

    let aiScore = aiMlKeywords.filter(k => lower.includes(k)).length * 2;
    let workScore = workKeywords.filter(k => lower.includes(k)).length;
    let personalScore = personalKeywords.filter(k => lower.includes(k)).length;
    let ideasScore = ideasKeywords.filter(k => lower.includes(k)).length * 1.5;

    if (aiScore > 0 && aiScore >= workScore && aiScore >= personalScore && aiScore >= ideasScore) {
      category = 'ai-ml';
    } else if (ideasScore > 0 && ideasScore >= workScore && ideasScore >= personalScore) {
      category = 'ideas';
    } else if (personalScore > workScore) {
      category = 'personal';
    } else {
      category = 'work';
    }

    // 3. Detect & Extract Due Dates
    const datePatterns = [
      { regex: /\b(by|at|for)?\s*tomorrow\b(\s*(at|by)?\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?/i, label: 'Tomorrow' },
      { regex: /\b(by|at|for)?\s*today\b(\s*(at|by)?\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?/i, label: 'Today' },
      { regex: /\b(by|at|for)?\s*tonight\b/i, label: 'Tonight' },
      { regex: /\bthis weekend\b/i, label: 'This Weekend' },
      { regex: /\bnext week\b/i, label: 'Next Week' },
      { regex: /\bby\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i, label: 'Specific Time' }
    ];

    for (const pat of datePatterns) {
      const match = lower.match(pat.regex);
      if (match) {
        dueDate = match[0].charAt(0).toUpperCase() + match[0].slice(1);
        // Optionally clean up title text if phrase is trailing
        break;
      }
    }

    // Strip out explicit voice meta commands like "high priority" from title for cleaner display
    cleanText = cleanText
      .replace(/,?\s*(high|medium|low)\s+priority\b/gi, '')
      .replace(/,?\s*(urgent|asap)\b/gi, '')
      .trim();

    // Capitalize first letter
    if (cleanText.length > 0) {
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }

    return {
      text: cleanText,
      priority,
      category,
      dueDate
    };
  }
}

window.SmartTaskParser = SmartTaskParser;
