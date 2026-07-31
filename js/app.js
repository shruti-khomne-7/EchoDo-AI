/**
 * EchoDo AI - Main Application Controller
 * Features:
 * - Duplicate-Save Guard (isSavingTask flag + single-trigger voice command handler)
 * - User-Friendly Date Formatting for ISO dates (e.g. 2026-08-15 -> Aug 15, 2026)
 * - Notion UI Layout & Workflow Exact Retention
 */

document.addEventListener('DOMContentLoaded', () => {
  const storage = new TaskStorage();
  const aiEngine = new TaskEngineClient();

  // App State
  let currentFilter = {
    category: 'all',
    status: 'all',
    search: '',
    sortBy: 'newest'
  };

  let pendingVoiceData = null;
  let voiceConfirmEngine = null; // Separate voice listener for "Confirm" / "Cancel" commands
  let isSavingTask = false; // Guard to prevent duplicate saving!

  // DOM Elements
  const micBtn = document.getElementById('mic-btn');
  const micInstruction = document.getElementById('mic-instruction');
  const liveTranscript = document.getElementById('live-transcript');
  const engineStatus = document.getElementById('engine-status');

  // Confirmation Modal DOM
  const confirmationModal = document.getElementById('confirmation-modal');
  const confirmedTaskText = document.getElementById('confirmed-task-text');
  const modalCategory = document.getElementById('modal-category');
  const modalPriority = document.getElementById('modal-priority');
  const modalDueDate = document.getElementById('modal-due-date');
  const modalDueTime = document.getElementById('modal-due-time');
  const modalSubtasksContainer = document.getElementById('modal-subtasks-container');
  const gcalBtn = document.getElementById('gcal-btn');
  const gcalWrapper = document.getElementById('gcal-wrapper');
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
  const promptChips = document.querySelectorAll('.prompt-chip');
  const themeToggleBtn = document.getElementById('theme-toggle');

  // Stats DOM
  const statTotal = document.getElementById('stat-total');
  const statPending = document.getElementById('stat-pending');
  const statCompleted = document.getElementById('stat-completed');

  // Initialize Dictation Voice Engine
  const dictationVoice = new VoiceEngine({
    onStart: () => {
      micBtn.classList.add('active');
      micInstruction.textContent = 'Listening... Dictate your task now';
      liveTranscript.textContent = 'Speak clearly into your microphone...';
      engineStatus.innerHTML = '<span class="status-dot listening"></span><span class="status-text" style="font-size: 0.75rem; color: var(--notion-blue);">Dictating...</span>';
    },

    onResult: (transcript, isFinal) => {
      liveTranscript.textContent = `"${transcript}"`;
      if (isFinal && transcript.trim().length > 0) {
        processVoiceInput(transcript);
      }
    },

    onEnd: (finalTranscript) => {
      micBtn.classList.remove('active');
      micInstruction.textContent = 'Click Mic & Speak Task';
      engineStatus.innerHTML = '<span class="status-dot green"></span><span class="status-text" style="font-size: 0.75rem; color: var(--notion-text-subtle);">Voice Ready</span>';

      if (finalTranscript && finalTranscript.trim().length > 0 && !pendingVoiceData && confirmationModal.classList.contains('hidden')) {
        processVoiceInput(finalTranscript);
      }
    },

    onError: (errorMsg) => {
      micBtn.classList.remove('active');
    }
  });

  // Apply saved theme
  const savedTheme = TaskStorage.getTheme();
  if (savedTheme === 'light') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', 'dark');
  }

  // --- HELPER: USER-FRIENDLY DATE FORMATTER ---
  function formatFriendlyDate(dateStr) {
    if (!dateStr || dateStr === 'No due date') return 'No due date';

    // If YYYY-MM-DD format (e.g. 2026-08-15)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);

      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffDays = Math.round((d - todayDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';

      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: year !== today.getFullYear() ? 'numeric' : undefined });
    }

    return dateStr;
  }

  // --- VOICE DICTATION & CONFIRMATION MODAL WORKFLOW ---

  async function processVoiceInput(rawText) {
    micInstruction.textContent = 'Analyzing voice dictation...';
    const result = await aiEngine.analyzeSpeechTask(rawText);

    pendingVoiceData = {
      rawText: rawText,
      parsed: result,
      isVoice: true
    };

    openConfirmationModal(result);
  }

  function openConfirmationModal(parsedResult) {
    isSavingTask = false; // Reset guard
    confirmedTaskText.value = parsedResult.text;
    modalCategory.value = parsedResult.category || 'General';
    modalPriority.value = parsedResult.priority || 'medium';
    modalDueDate.value = parsedResult.dueDate !== 'No due date' ? parsedResult.dueDate : '';
    modalDueTime.value = parsedResult.dueTime || '';

    // Render Subtasks
    renderModalSubtasks(parsedResult.suggestedSubtasks || []);

    // Toggle Google Calendar button visibility
    const hasValidDate = modalDueDate.value.trim().length > 0;
    gcalWrapper.style.display = hasValidDate ? 'block' : 'none';

    confirmationModal.classList.remove('hidden');
    confirmedTaskText.focus();

    // Start listening for Voice Confirmation Commands ("Confirm" / "Cancel")
    startVoiceConfirmationListener();
  }

  function renderModalSubtasks(subtasks) {
    if (!subtasks || subtasks.length === 0) {
      modalSubtasksContainer.innerHTML = '<span style="font-size: 0.78rem; color: var(--notion-text-muted);">None</span>';
      return;
    }

    modalSubtasksContainer.innerHTML = subtasks.map((st) => `
      <input type="text" class="notion-input modal-subtask-input" style="padding: 4px 8px; font-size: 0.8rem;" value="${escapeHTML(st)}">
    `).join('');
  }

  function closeConfirmationModal() {
    stopVoiceConfirmationListener();
    confirmationModal.classList.add('hidden');
    pendingVoiceData = null;
    isSavingTask = false;
  }

  // --- VOICE CONFIRMATION LISTENER WITH SINGLE-TRIGGER GUARD ---

  function startVoiceConfirmationListener() {
    stopVoiceConfirmationListener();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      voiceConfirmEngine = new SpeechRecognition();
      voiceConfirmEngine.continuous = false;
      voiceConfirmEngine.interimResults = true;
      voiceConfirmEngine.lang = 'en-US';

      voiceConfirmEngine.onresult = (event) => {
        if (isSavingTask) return; // Prevent duplicate execution!

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const spoken = event.results[i][0].transcript.toLowerCase().trim();

          if (spoken.includes('confirm') || spoken.includes('yes save')) {
            isSavingTask = true;
            voiceConfirmEngine.onresult = null; // Disable listener immediately!
            stopVoiceConfirmationListener();
            confirmSaveBtn.click();
            break;
          } else if (spoken.includes('cancel') || spoken.includes('discard')) {
            isSavingTask = true;
            voiceConfirmEngine.onresult = null; // Disable listener immediately!
            stopVoiceConfirmationListener();
            discardBtn.click();
            break;
          }
        }
      };

      voiceConfirmEngine.start();
    } catch (e) {
      console.warn('Voice confirmation engine notice:', e);
    }
  }

  function stopVoiceConfirmationListener() {
    if (voiceConfirmEngine) {
      try {
        voiceConfirmEngine.stop();
      } catch (e) {}
      voiceConfirmEngine = null;
    }
  }

  // Update GCal button visibility when user edits due date input physically
  modalDueDate.addEventListener('input', () => {
    gcalWrapper.style.display = modalDueDate.value.trim().length > 0 ? 'block' : 'none';
  });

  // --- GOOGLE CALENDAR INTEGRATION ---
  gcalBtn.addEventListener('click', () => {
    const title = confirmedTaskText.value.trim() || 'Task';
    const dateStr = modalDueDate.value.trim();
    const timeStr = modalDueTime.value.trim();

    if (!dateStr) {
      showToast('Please enter a valid due date first', 'warning');
      return;
    }

    let startDate = dateStr.replace(/-/g, '');
    let endDate = startDate;

    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
      if (match) {
        let hrs = parseInt(match[1], 10);
        const mins = match[2] || '00';
        const ampm = match[3] ? match[3].toUpperCase() : '';

        if (ampm === 'PM' && hrs < 12) hrs += 12;
        if (ampm === 'AM' && hrs === 12) hrs = 0;

        const padHrs = hrs.toString().padStart(2, '0');
        const padEndHrs = (hrs + 1).toString().padStart(2, '0');

        startDate = `${startDate}T${padHrs}${mins}00`;
        endDate = `${dateStr.replace(/-/g, '')}T${padEndHrs}${mins}00`;
      }
    }

    const subtaskInputs = document.querySelectorAll('.modal-subtask-input');
    const subtasksText = Array.from(subtaskInputs).map(i => i.value.trim()).filter(Boolean).join('\n- ');
    const details = subtasksText ? `Subtasks:\n- ${subtasksText}` : 'Created via EchoDo AI Workspace';

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}`;
    window.open(gcalUrl, '_blank');
  });

  // Confirmation Modal Save Button Listener with Guard
  confirmSaveBtn.addEventListener('click', () => {
    if (isSavingTask && !confirmationModal.classList.contains('hidden')) {
      // Guard already executing save
    }
    isSavingTask = true;

    const finalTaskText = confirmedTaskText.value.trim();
    if (!finalTaskText) {
      showToast('Task text cannot be empty', 'warning');
      isSavingTask = false;
      return;
    }

    const subtaskInputs = document.querySelectorAll('.modal-subtask-input');
    const editedSubtasks = Array.from(subtaskInputs).map(i => i.value.trim()).filter(Boolean);

    storage.addTask({
      text: finalTaskText,
      category: modalCategory.value.trim() || 'General',
      priority: modalPriority.value,
      dueDate: modalDueDate.value.trim() || 'No due date',
      dueTime: modalDueTime.value.trim() || '',
      subtasks: editedSubtasks,
      createdViaVoice: pendingVoiceData ? pendingVoiceData.isVoice : false
    });

    closeConfirmationModal();
    renderCategoryTabs();
    renderTasks();
    showToast('Task confirmed & added to database!', 'success');

    dictationVoice.speak(`Task added: ${finalTaskText}`);
  });

  rerecordBtn.addEventListener('click', () => {
    closeConfirmationModal();
    dictationVoice.startListening();
  });

  discardBtn.addEventListener('click', () => {
    closeConfirmationModal();
    showToast('Task cancelled', 'info');
  });

  modalCloseBtn.addEventListener('click', closeConfirmationModal);

  confirmationModal.addEventListener('click', (e) => {
    if (e.target === confirmationModal) closeConfirmationModal();
  });

  document.addEventListener('keydown', (e) => {
    if (!confirmationModal.classList.contains('hidden') && e.key === 'Escape') {
      closeConfirmationModal();
    }
  });

  // Mic Button Click
  micBtn.addEventListener('click', () => {
    dictationVoice.toggleListening();
  });

  // Prompt Chips Click
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleText = chip.getAttribute('data-prompt');
      liveTranscript.textContent = `"${sampleText}"`;
      processVoiceInput(sampleText);
    });
  });

  // Manual Add Input
  manualAddBtn.addEventListener('click', handleManualAdd);
  quickTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualAdd();
  });

  async function handleManualAdd() {
    const text = quickTextInput.value.trim();
    if (!text) return;

    const result = await aiEngine.analyzeSpeechTask(text);
    pendingVoiceData = { rawText: text, parsed: result, isVoice: false };

    openConfirmationModal(result);
    quickTextInput.value = '';
  }

  // --- RENDERING DYNAMIC CATEGORY TABS & NOTION TASK ROWS ---

  function renderCategoryTabs() {
    const categoryTabsEl = document.getElementById('category-tabs');
    const categoriesSet = new Set(['all']);
    storage.tasks.forEach(t => {
      if (t.category) categoriesSet.add(t.category);
    });

    const tabsHTML = Array.from(categoriesSet).map(cat => {
      const label = cat === 'all' ? '📋 All Tasks' : `🏷️ ${escapeHTML(cat)}`;
      const activeClass = currentFilter.category === cat ? 'active' : '';
      return `<button class="notion-tab ${activeClass}" data-category="${escapeHTML(cat)}">${label}</button>`;
    }).join('');

    categoryTabsEl.innerHTML = tabsHTML;

    categoryTabsEl.querySelectorAll('.notion-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        categoryTabsEl.querySelectorAll('.notion-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter.category = tab.getAttribute('data-category');
        renderTasks();
      });
    });
  }

  function renderTasks() {
    let filtered = storage.tasks;

    if (currentFilter.category !== 'all') {
      filtered = filtered.filter(t => t.category === currentFilter.category);
    }

    if (currentFilter.status === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (currentFilter.status === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.text.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        t.priority.toLowerCase().includes(q) ||
        (t.dueDate && t.dueDate.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      if (currentFilter.sortBy === 'priority') {
        const pOrder = { high: 1, medium: 2, low: 3 };
        return pOrder[a.priority] - pOrder[b.priority];
      } else if (currentFilter.sortBy === 'due') {
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      } else {
        return b.createdAt - a.createdAt;
      }
    });

    if (filtered.length === 0) {
      taskListEl.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--notion-text-subtle); border: 1px dashed var(--notion-border); border-radius: 6px;">
          <div style="font-size: 2rem; margin-bottom: 6px;">📄</div>
          <p style="font-size: 0.9rem; font-weight: 500;">No tasks found in this view</p>
          <p style="font-size: 0.8rem; color: var(--notion-text-muted);">Click the mic icon above to dictate a task.</p>
        </div>
      `;
    } else {
      taskListEl.innerHTML = filtered.map(t => createTaskCardHTML(t)).join('');
    }

    updateStats();
    attachTaskEventListeners();
  }

  function createTaskCardHTML(t) {
    const subtaskHTML = (t.subtasks && t.subtasks.length > 0)
      ? `<div style="font-size: 0.75rem; color: var(--notion-text-subtle); margin-top: 4px;">• ${t.subtasks.map(st => escapeHTML(st)).join(' • ')}</div>`
      : '';

    const friendlyDate = formatFriendlyDate(t.dueDate);

    return `
      <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
        <div class="task-checkbox" data-action="toggle" title="Toggle Done">
          ${t.completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>

        <div class="task-details">
          <div class="task-title">${escapeHTML(t.text)}</div>
          ${subtaskHTML}
          <div class="task-meta" style="margin-top: 4px;">
            <span class="notion-badge" style="background: var(--notion-blue-bg); color: var(--notion-blue);">🏷️ ${escapeHTML(t.category || 'General')}</span>
            <span class="notion-badge badge-priority-${t.priority}">${t.priority}</span>
            ${t.dueDate && t.dueDate !== 'No due date' ? `<span class="task-due">📅 ${escapeHTML(friendlyDate)} ${t.dueTime ? escapeHTML(t.dueTime) : ''}</span>` : ''}
            ${t.createdViaVoice ? `<span class="notion-badge" style="background: rgba(43, 138, 98, 0.15); color: #1d6d4d;">🎙️ Voice</span>` : ''}
          </div>
        </div>

        <div class="task-actions">
          <button class="notion-action-btn" data-action="speak" title="Read task aloud">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button class="notion-action-btn danger" data-action="delete" title="Delete task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
          renderCategoryTabs();
          renderTasks();
          showToast('Task removed', 'info');
        } else if (action === 'speak') {
          if (task) dictationVoice.speak(task.text);
        }
      });
    });
  }

  function updateStats() {
    const stats = storage.getStats();
    statTotal.textContent = stats.total;
    statPending.textContent = stats.pending;
    statCompleted.textContent = stats.completed;
  }

  // --- FILTERS & SEARCH ---

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
    renderCategoryTabs();
    renderTasks();
    showToast('Cleared completed tasks', 'info');
  });

  // --- THEME TOGGLE ---
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.hasAttribute('data-theme');
    if (isDark) {
      document.body.removeAttribute('data-theme');
      TaskStorage.setTheme('light');
    } else {
      document.body.setAttribute('data-theme', 'dark');
      TaskStorage.setTheme('dark');
    }
  });

  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
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

  renderCategoryTabs();
  renderTasks();
});
