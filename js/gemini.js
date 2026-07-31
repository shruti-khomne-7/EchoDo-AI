/**
 * Voice Task Engine Client for EchoDo AI
 * Connects securely to the backend /api/parse-task endpoint.
 */

class TaskEngineClient {
  constructor() {
    this.checkStatus();
  }

  async checkStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend check failed:', err);
    }
    return { status: 'offline' };
  }

  async analyzeSpeechTask(rawSpeechText) {
    try {
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ speechText: rawSpeechText })
      });

      if (!response.ok) {
        throw new Error('Backend parse error');
      }

      return await response.json();
    } catch (err) {
      console.warn('API request fallback:', err);
      const localResult = SmartTaskParser.parseSpeech(rawSpeechText);
      return {
        ...localResult,
        suggestedSubtasks: [],
        reasoning: 'Parsed voice dictation.',
        isAiPowered: false
      };
    }
  }
}

window.TaskEngineClient = TaskEngineClient;
