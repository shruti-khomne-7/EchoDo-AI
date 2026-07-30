/**
 * EchoDo AI - Main Application Controller
 * Connects Voice Engine, Task Storage, Smart Parser, and UI Components.
 */

document.addEventListener('DOMContentLoaded', () => {
  const storage = new TaskStorage();

  // App State
  let currentFilter = {
    category: 'all',
    status: 'all',
    search: '',
    sortBy: 'newest'
  };

  let pendingVoiceData = null; // Holds transient voice transcription before user confirmation

  // DOM Elements
  const micBtn = document.getElementById('mic-btn');
  const micInstruction = document.getElementById('mic-instruction');
  const liveTranscript = document.getElementById('live-transcript');
  const engineStatus = document.getElementById('engine-status');

  const confirmationModal = document.getElementById('confirmation-modal');
  const confirmedTaskText = document.getElementById('confirmed-task-text');
  const modalCategory = document.getElementById('modal-category');
  const modalPriority = document.getElementById('modal-priority');
  const modalDueDate = document.getElementById('modal-due-date');
  const confirmSaveBtn = document.getElementById('confirm-save-btn');
  const rerecordBtn = document.getElementById('rerecord-btn');
  const discardBtn = document.getElementById('discard-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  const taskListEl = document.getElementById('task-list');
  const quickTextInput = document.getElementById('quick-text-input');
  const manualAddBtn = document.getElementById('manual-add-btn');
  const taskSearchInput = document.getElementById('task-search');
  const filterStatusSelect = document.getElementById('filter-status');
  const sortBySelect = document.getElementById('sort-by');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const categoryTabs = document.querySelectorAll('.cat-tab');
  const promptChips = document.querySelectorAll('.prompt-chip');
  const themeToggleBtn = document.getElementById('theme-toggle');

  // Stats DOM
  const statTotal = document.getElementById('stat-total');
  const statPending = document.getElementById('stat-pending');
  const statCompleted = document.getElementById('stat-completed');
  const statVoiceRate = document.getElementById('stat-voice-rate');

  // Initialize Voice Engine
  const voice = new VoiceEngine({
    onStart: () => {
      micBtn.classList.add('active');
      micInstruction.textContent = 'Listening... Speak your task now';
      liveTranscript.textContent = 'Speak clearly into your microphone...';
      engineStatus.innerHTML = '<span class="status-dot listening"></span><span class="status-text">Recording Audio...</span>';
    },

    onResult: (transcript, isFinal) => {
      liveTranscript.textContent = `"${transcript}"`;

      if (isFinal && transcript.trim().length > 0) {
        processVoiceInput(transcript);
      }
    },

    onEnd: () => {
      micBtn.classList.remove('active');
      micInstruction.textContent = 'Click the Microphone & Speak';
      engineStatus.innerHTML = '<span class="status-dot green"></span><span class="status-text">Voice Engine Ready</span>';
    },

    onError: (errorMsg) => {
      showToast(`Voice Error: ${errorMsg}. Using text simulation mode.`, 'warning');
      micBtn.classList.remove('active');
    }
  });

  // Apply saved theme
  const savedTheme = TaskStorage.getTheme();
  if (savedTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  }

  // --- VOICE PROCESSOR & CONFIRMATION MODAL WORKFLOW ---

  function processVoiceInput(rawText) {
    // Run NLP Smart Parser on spoken text
    const parsed = SmartTaskParser.parseSpeech(rawText);

    pendingVoiceData = {
      rawText: rawText,
      parsed: parsed,
      isVoice: true
    };

    // Open Confirmation Modal (The core requested feature!)
    openConfirmationModal(parsed.text, parsed.category, parsed.priority, parsed.dueDate);
  }

  function openConfirmationModal(text, category, priority, dueDate) {
    confirmedTaskText.value = text;
    modalCategory.value = category;
    modalPriority.value = priority;
    modalDueDate.value = dueDate !== 'No due date' ? dueDate : '';

    confirmationModal.classList.remove('hidden');
    confirmedTaskText.focus();
  }

  function closeConfirmationModal() {
    confirmationModal.classList.add('hidden');
    pendingVoiceData = null;
  }

  // Confirmation Modal Action Listeners
  confirmSaveBtn.addEventListener('click', () => {
    const finalTaskText = confirmedTaskText.value.trim();
    if (!finalTaskText) {
      showToast('Task description cannot be empty', 'warning');
      return;
    }

    const newTask = storage.addTask({
      text: finalTaskText,
      category: modalCategory.value,
      priority: modalPriority.value,
      dueDate: modalDueDate.value.trim() || 'No due date',
      createdViaVoice: pendingVoiceData ? pendingVoiceData.isVoice : false
    });

    closeConfirmationModal();
    renderTasks();
    showToast('Task confirmed and saved successfully!', 'success');

    // Text-to-Speech audio feedback
    voice.speak(`Task added: ${finalTaskText}`);
  });

  rerecordBtn.addEventListener('click', () => {
    closeConfirmationModal();
    voice.startListening();
  });

  discardBtn.addEventListener('click', () => {
    closeConfirmationModal();
    showToast('Voice task discarded', 'info');
  });

  modalCloseBtn.addEventListener('click', closeConfirmationModal);

  confirmationModal.addEventListener('click', (e) => {
    if (e.target === confirmationModal) closeConfirmationModal();
  });

  // Hotkey support in modal (Enter to confirm, Esc to close)
  document.addEventListener('keydown', (e) => {
    if (!confirmationModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        closeConfirmationModal();
      }
    }
  });

  // --- MIC BUTTON CLICK EVENT ---
  micBtn.addEventListener('click', () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      // If Web Speech is available, start recognition
      voice.startListening();
    }
  });

  // --- PROMPT CHIPS SIMULATOR ---
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleText = chip.getAttribute('data-prompt');
      liveTranscript.textContent = `"${sampleText}"`;
      processVoiceInput(sampleText);
    });
  });

  // --- MANUAL ADD INPUT ---
  manualAddBtn.addEventListener('click', handleManualAdd);
  quickTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualAdd();
  });

  function handleManualAdd() {
    const text = quickTextInput.value.trim();
    if (!text) return;

    const parsed = SmartTaskParser.parseSpeech(text);
    pendingVoiceData = { rawText: text, parsed, isVoice: false };

    openConfirmationModal(parsed.text, parsed.category, parsed.priority, parsed.dueDate);
    quickTextInput.value = '';
  }

  // --- RENDERING TASK LIST & DASHBOARD ---

  function renderTasks() {
    let filtered = storage.tasks;

    // Filter by Category Tab
    if (currentFilter.category !== 'all') {
      filtered = filtered.filter(t => t.category === currentFilter.category);
    }

    // Filter by Status
    if (currentFilter.status === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (currentFilter.status === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    // Filter by Search Query
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.text.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q) ||
        (t.dueDate && t.dueDate.toLowerCase().includes(q))
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      if (currentFilter.sortBy === 'priority') {
        const pOrder = { high: 1, medium: 2, low: 3 };
        return pOrder[a.priority] - pOrder[b.priority];
      } else if (currentFilter.sortBy === 'due') {
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      } else {
        // Newest first
        return b.createdAt - a.createdAt;
      }
    });

    // Render HTML
    if (filtered.length === 0) {
      taskListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎙️</div>
          <h3>No tasks found</h3>
          <p>Tap the microphone above and speak a task to get started!</p>
        </div>
      `;
    } else {
      taskListEl.innerHTML = filtered.map(t => createTaskCardHTML(t)).join('');
    }

    updateStats();
    attachTaskEventListeners();
  }

  function createTaskCardHTML(t) {
    const categoryLabels = {
      'ai-ml': '🤖 AI / ML',
      'work': '💼 Work',
      'personal': '👤 Personal',
      'ideas': '💡 Ideas'
    };

    return `
      <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
        <div class="task-checkbox" data-action="toggle" title="Toggle Completion">
          ${t.completed ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>

        <div class="task-details">
          <div class="task-title">${escapeHTML(t.text)}</div>
          <div class="task-meta">
            <span class="badge badge-cat-${t.category}">${categoryLabels[t.category] || t.category}</span>
            <span class="badge badge-priority-${t.priority}">Priority: ${t.priority}</span>
            ${t.dueDate && t.dueDate !== 'No due date' ? `<span class="task-due">📅 ${escapeHTML(t.dueDate)}</span>` : ''}
            ${t.createdViaVoice ? `<span class="badge" style="background: rgba(99, 102, 241, 0.12); color: var(--accent-primary);" title="Captured via Voice Engine">🎙️ Voice</span>` : ''}
          </div>
        </div>

        <div class="task-actions">
          <button class="btn-icon" data-action="speak" title="Read task aloud">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button class="btn-icon danger" data-action="delete" title="Delete task">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  function attachTaskEventListeners() {
    const items = taskListEl.querySelectorAll('.task-item');
    items.forEach(item => {
      const id = item.getAttribute('data-id');

      item.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;

        const action = actionBtn.getAttribute('data-action');
        const task = storage.tasks.find(t => t.id === id);

        if (action === 'toggle') {
          storage.toggleTask(id);
          renderTasks();
        } else if (action === 'delete') {
          storage.deleteTask(id);
          renderTasks();
          showToast('Task deleted', 'info');
        } else if (action === 'speak') {
          if (task) voice.speak(task.text);
        }
      });
    });
  }

  function updateStats() {
    const stats = storage.getStats();
    statTotal.textContent = stats.total;
    statPending.textContent = stats.pending;
    statCompleted.textContent = stats.completed;
    statVoiceRate.textContent = `${stats.voicePrecision}%`;
  }

  // --- FILTERS & SEARCH EVENT LISTENERS ---

  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter.category = tab.getAttribute('data-category');
      renderTasks();
    });
  });

  taskSearchInput.addEventListener('input', (e) => {
    currentFilter.search = e.target.value.trim();
    renderTasks();
  });

  filterStatusSelect.addEventListener('change', (e) => {
    currentFilter.status = e.target.value;
    renderTasks();
  });

  sortBySelect.addEventListener('change', (e) => {
    currentFilter.sortBy = e.target.value;
    renderTasks();
  });

  clearCompletedBtn.addEventListener('click', () => {
    storage.clearCompleted();
    renderTasks();
    showToast('Cleared all completed tasks', 'info');
  });

  // --- THEME TOGGLE ---
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    if (currentTheme === 'light') {
      document.body.removeAttribute('data-theme');
      TaskStorage.setTheme('dark');
    } else {
      document.body.setAttribute('data-theme', 'light');
      TaskStorage.setTheme('light');
    }
  });

  // --- TOAST SYSTEM ---
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Initial render
  renderTasks();
});
