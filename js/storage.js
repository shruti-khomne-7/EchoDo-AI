/**
 * Storage Manager for EchoDo AI
 * Manages task persistence, theme preference, and analytics.
 */

const STORAGE_KEY = 'echodo_ai_tasks_v1';
const THEME_KEY = 'echodo_ai_theme';

const DEFAULT_TASKS = [
  {
    id: 'task_1',
    text: 'Train LLaMA fine-tuning model on GPU cluster',
    category: 'ai-ml',
    priority: 'high',
    dueDate: 'Tomorrow at 4:00 PM',
    completed: false,
    createdViaVoice: true,
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'task_2',
    text: 'Review pull request for API rate limiter microservice',
    category: 'work',
    priority: 'medium',
    dueDate: 'Today at 6:00 PM',
    completed: false,
    createdViaVoice: true,
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: 'task_3',
    text: 'Buy mechanical keyboard switches & dark roast coffee',
    category: 'personal',
    priority: 'low',
    dueDate: 'This Weekend',
    completed: true,
    createdViaVoice: false,
    createdAt: Date.now() - 3600000 * 24
  }
];

class TaskStorage {
  constructor() {
    this.tasks = this.loadTasks();
  }

  loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveTasks(DEFAULT_TASKS);
        return DEFAULT_TASKS;
      }
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error loading tasks from localStorage:', err);
      return DEFAULT_TASKS;
    }
  }

  saveTasks(tasksToSave) {
    this.tasks = tasksToSave;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch (err) {
      console.error('Error saving tasks to localStorage:', err);
    }
  }

  addTask(taskObj) {
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: taskObj.text,
      category: taskObj.category || 'work',
      priority: taskObj.priority || 'medium',
      dueDate: taskObj.dueDate || 'No due date',
      completed: false,
      createdViaVoice: taskObj.createdViaVoice ?? true,
      createdAt: Date.now()
    };
    this.tasks.unshift(newTask);
    this.saveTasks(this.tasks);
    return newTask;
  }

  toggleTask(id) {
    this.tasks = this.tasks.map(t => {
      if (t.id === id) {
        return { ...t, completed: !t.completed };
      }
      return t;
    });
    this.saveTasks(this.tasks);
    return this.tasks.find(t => t.id === id);
  }

  updateTask(id, updatedFields) {
    this.tasks = this.tasks.map(t => {
      if (t.id === id) {
        return { ...t, ...updatedFields };
      }
      return t;
    });
    this.saveTasks(this.tasks);
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks(this.tasks);
  }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => !t.completed);
    this.saveTasks(this.tasks);
  }

  getStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const voiceCount = this.tasks.filter(t => t.createdViaVoice).length;
    const voicePrecision = total > 0 ? Math.round((voiceCount / total) * 100) : 100;

    return { total, completed, pending, voicePrecision };
  }

  static getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  static setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }
}

window.TaskStorage = TaskStorage;
