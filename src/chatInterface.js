// Chat UI components for contextual hints
class ChatUI {
  constructor(gameLogic) {
    this.game = gameLogic;
    this.activeChatBlank = null;
    this.chatModal = null;
    this.isOpen = false;
    this.messageHistory = new Map(); // blankId -> array of messages for persistent history
    this.setupChatModal();
  }

  // Create and setup chat modal
  setupChatModal() {
    // Create modal HTML
    const modalHTML = `
      <div id="chat-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b">
            <h3 id="chat-title" class="text-lg font-semibold text-gray-900">
              Chat about Word #1
            </h3>
            <button id="chat-close" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <!-- Chat messages area -->
          <div id="chat-messages" class="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[400px]">
            <div class="text-center text-gray-500 text-sm">
              Ask me anything about this word! I can help with meaning, context, grammar, or give you hints.
            </div>
          </div>
          
          <!-- Suggested questions -->
          <div id="suggested-questions" class="px-4 py-2 border-t border-gray-100">
            <div id="suggestion-buttons" class="flex flex-wrap gap-1">
              <!-- Suggestion buttons will be inserted here -->
            </div>
          </div>
          
          <!-- Question dropdown area -->
          <div class="p-4 border-t">
            <!-- Dropdown for all devices -->
            <select id="question-dropdown" class="w-full p-2 border rounded mb-2">
              <option value="">Select a question...</option>
            </select>
          </div>
        </div>
      </div>
    `;

    // Insert modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    this.chatModal = document.getElementById('chat-modal');
    this.setupEventListeners();
  }

  // Setup event listeners for chat modal
  setupEventListeners() {
    const closeBtn = document.getElementById('chat-close');
    
    // Close modal
    closeBtn.addEventListener('click', () => this.closeChat());
    this.chatModal.addEventListener('click', (e) => {
      if (e.target === this.chatModal) this.closeChat();
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.closeChat();
    });
  }

  // Open chat for specific blank
  async openChat(blankIndex) {
    this.activeChatBlank = blankIndex;
    this.isOpen = true;
    
    // Update title
    const title = document.getElementById('chat-title');
    title.textContent = `Help with Word #${blankIndex + 1}`;
    
    // Restore previous messages or show intro
    this.restoreMessages(blankIndex);
    
    // Load question buttons
    this.loadQuestionButtons();
    
    // Show modal
    this.chatModal.classList.remove('hidden');
  }

  // Close chat modal
  closeChat() {
    this.isOpen = false;
    this.chatModal.classList.add('hidden');
    this.activeChatBlank = null;
  }

  // Clear messages and show intro
  clearMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = `
      <div class="text-center text-gray-500 text-sm mb-4">
        Choose a question below to get help with this word.
      </div>
    `;
  }

  // Restore messages for a specific blank or show intro
  restoreMessages(blankIndex) {
    const messagesContainer = document.getElementById('chat-messages');
    const blankId = `blank_${blankIndex}`;
    const history = this.messageHistory.get(blankId);
    
    if (history && history.length > 0) {
      // Restore previous messages
      messagesContainer.innerHTML = '';
      history.forEach(msg => {
        this.displayMessage(msg.sender, msg.content, msg.isUser);
      });
    } else {
      // Show intro for new conversation
      this.clearMessages();
    }
  }

  // Display a message without storing it (used for restoration)
  displayMessage(sender, content, isUser) {
    const messagesContainer = document.getElementById('chat-messages');
    const alignment = isUser ? 'flex justify-end' : 'flex justify-start';
    const messageClass = isUser 
      ? 'bg-blue-500 text-white' 
      : 'bg-gray-100 text-gray-900';
    const displaySender = isUser ? 'You' : sender;

    const messageHTML = `
      <div class="mb-3 ${alignment}">
        <div class="${messageClass} rounded-lg px-3 py-2 max-w-[80%]">
          <div class="text-xs font-medium mb-1">${displaySender}</div>
          <div class="text-sm">${this.escapeHtml(content)}</div>
        </div>
      </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Clear all chat history (called when round ends)
  clearChatHistory() {
    this.messageHistory.clear();
  }

  // Load question dropdown with disabled state for used questions
  loadQuestionButtons() {
    const dropdown = document.getElementById('question-dropdown');
    const questions = this.game.getSuggestedQuestionsForBlank(this.activeChatBlank);
    
    // Clear existing content
    dropdown.innerHTML = '<option value="">Select a question...</option>';
    
    // Build dropdown options
    questions.forEach(question => {
      const isDisabled = question.used;
      const optionText = isDisabled ? `${question.text} ✓` : question.text;
      
      // Add all options but mark used ones as disabled
      const option = document.createElement('option');
      option.value = isDisabled ? '' : question.type;
      option.textContent = optionText;
      option.disabled = isDisabled;
      option.style.color = isDisabled ? '#9CA3AF' : '#111827';
      dropdown.appendChild(option);
    });
    
    // Add change listener to dropdown
    dropdown.addEventListener('change', (e) => {
      if (e.target.value) {
        this.askQuestion(e.target.value);
        e.target.value = ''; // Reset dropdown
      }
    });
  }

  // Ask a specific question
  async askQuestion(questionType) {
    if (this.activeChatBlank === null) return;
    
    // Get current user input for the blank
    const currentInput = this.getCurrentBlankInput();
    
    // Get the actual question text from the button that was clicked
    const questions = this.game.getSuggestedQuestionsForBlank(this.activeChatBlank);
    const selectedQuestion = questions.find(q => q.type === questionType);
    const questionText = selectedQuestion ? selectedQuestion.text : this.getQuestionText(questionType);
    
    // Show question and loading
    this.addMessageToChat('You', questionText, true);
    this.showTypingIndicator();
    
    try {
      // Send to chat service with question type
      const response = await this.game.askQuestionAboutBlank(
        this.activeChatBlank,
        questionType,
        currentInput
      );
      
      this.hideTypingIndicator();
      
      if (response.success) {
        // Make sure we're displaying the response string, not the object
        const responseText = typeof response.response === 'string'
          ? response.response
          : response.response.response || 'Sorry, I had trouble with that question.';
        this.addMessageToChat('Cluemaster', responseText, false);
        
        // Refresh question buttons to show the used question as disabled
        this.loadQuestionButtons();
      } else {
        this.addMessageToChat('Cluemaster', response.message || 'Sorry, I had trouble with that question.', false);
      }
      
    } catch (error) {
      this.hideTypingIndicator();
      console.error('Chat error:', error);
      this.addMessageToChat('Cluemaster', 'Sorry, I encountered an error. Please try again.', false);
    }
  }

  // Get question text for display
  getQuestionText(questionType) {
    const questions = {
      'grammar': 'What type of word is this?',
      'meaning': 'What does this word mean?',
      'context': 'Why does this word fit here?',
      'clue': 'Give me a clue'
    };
    return questions[questionType] || questions['clue'];
  }

  // Get current input for the active blank
  getCurrentBlankInput() {
    const input = document.querySelector(`input[data-blank-index="${this.activeChatBlank}"]`);
    return input ? input.value.trim() : '';
  }

  // Add message to chat display and store in history
  addMessageToChat(sender, content, isUser) {
    // Store message in history for current blank
    if (this.activeChatBlank !== null) {
      const blankId = `blank_${this.activeChatBlank}`;
      if (!this.messageHistory.has(blankId)) {
        this.messageHistory.set(blankId, []);
      }
      
      // Change "Tutor" to "Cluemaster" for display and storage
      const displaySender = sender === 'Tutor' ? 'Cluemaster' : sender;
      
      this.messageHistory.get(blankId).push({
        sender: displaySender,
        content: content,
        isUser: isUser,
        timestamp: Date.now()
      });
    }
    
    // Display the message
    this.displayMessage(sender === 'Tutor' ? 'Cluemaster' : sender, content, isUser);
  }

  // Show typing indicator
  showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingHTML = `
      <div id="typing-indicator" class="mb-3 mr-auto max-w-[80%]">
        <div class="bg-gray-100 text-gray-900 rounded-lg px-3 py-2">
          <div class="text-xs font-medium mb-1">Cluemaster</div>
          <div class="text-sm">
            <span class="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        </div>
      </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Hide typing indicator
  hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Setup chat buttons for blanks
  setupChatButtons() {
    // Remove existing listeners
    document.querySelectorAll('.chat-button').forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
    
    // Add new listeners
    document.querySelectorAll('.chat-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const blankIndex = parseInt(btn.dataset.blankIndex);
        this.openChat(blankIndex);
      });
    });
  }
}

export default ChatUI;