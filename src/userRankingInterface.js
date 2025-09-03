/**
 * User Ranking Interface for Model Testing
 * Allows users to rate model performance on each task during gameplay
 */

class UserRankingInterface {
    constructor() {
        this.rankings = {
            rounds: [],
            currentRound: null
        };
        
        this.rankingCategories = [
            {
                id: 'word_selection',
                name: 'Word Selection Quality',
                description: 'How appropriate were the selected words for this difficulty level?',
                criteria: [
                    'Words match the difficulty level',
                    'Vocabulary is challenging but fair',
                    'Selected words are meaningful in context'
                ]
            },
            {
                id: 'passage_quality',
                name: 'Passage Selection',
                description: 'How suitable was this passage for language learning?',
                criteria: [
                    'Text is engaging and appropriate',
                    'Content is educational',
                    'Difficulty matches the level'
                ]
            },
            {
                id: 'hint_helpfulness',
                name: 'Hint Quality',
                description: 'How helpful were the AI-generated hints?',
                criteria: [
                    'Hints guide without revealing answers',
                    'Explanations are clear and educational',
                    'Responses are contextually appropriate'
                ]
            },
            {
                id: 'overall_experience',
                name: 'Overall Round Experience',
                description: 'How was the overall quality of this round?',
                criteria: [
                    'Smooth gameplay experience',
                    'AI responses were timely',
                    'Educational value was high'
                ]
            }
        ];
        
        this.createRankingUI();
        this.setupEventListeners();
    }

    createRankingUI() {
        // Create ranking modal
        const modal = document.createElement('div');
        modal.id = 'ranking-modal';
        modal.className = 'ranking-modal';
        modal.innerHTML = `
            <div class="ranking-modal-content">
                <h2>Rate This Round</h2>
                <p class="ranking-subtitle">Help us improve by rating the AI's performance</p>
                
                <div id="ranking-categories" class="ranking-categories">
                    <!-- Categories will be populated dynamically -->
                </div>
                
                <div class="ranking-comments">
                    <label for="ranking-comments-input">Additional Comments (Optional):</label>
                    <textarea id="ranking-comments-input" rows="3" placeholder="Any specific feedback about this round..."></textarea>
                </div>
                
                <div class="ranking-actions">
                    <button id="skip-ranking-btn" class="btn-secondary">Skip</button>
                    <button id="submit-ranking-btn" class="btn-primary" disabled>Submit Rating</button>
                </div>
            </div>
        `;
        
        // Create ranking trigger button
        const triggerButton = document.createElement('button');
        triggerButton.id = 'ranking-trigger-btn';
        triggerButton.className = 'ranking-trigger-btn';
        triggerButton.innerHTML = '⭐ Rate Round';
        triggerButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 999;
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            display: none;
        `;
        
        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .ranking-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                backdrop-filter: blur(5px);
            }
            
            .ranking-modal.active {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .ranking-modal-content {
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }
            
            .ranking-modal-content h2 {
                color: #2c3e50;
                margin-bottom: 10px;
                text-align: center;
            }
            
            .ranking-subtitle {
                color: #7f8c8d;
                text-align: center;
                margin-bottom: 30px;
            }
            
            .ranking-category {
                margin-bottom: 25px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border: 2px solid #e9ecef;
            }
            
            .ranking-category h3 {
                color: #2c3e50;
                margin-bottom: 8px;
                font-size: 1.1rem;
            }
            
            .ranking-category-description {
                color: #6c757d;
                font-size: 0.9rem;
                margin-bottom: 15px;
            }
            
            .ranking-criteria {
                font-size: 0.85rem;
                color: #6c757d;
                margin-bottom: 15px;
                padding-left: 20px;
            }
            
            .ranking-criteria li {
                margin-bottom: 5px;
            }
            
            .ranking-stars {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 10px;
            }
            
            .ranking-star {
                font-size: 30px;
                color: #ddd;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .ranking-star:hover,
            .ranking-star.hover {
                color: #ffd700;
                transform: scale(1.1);
            }
            
            .ranking-star.selected {
                color: #ffd700;
            }
            
            .ranking-comments {
                margin: 20px 0;
            }
            
            .ranking-comments label {
                display: block;
                color: #2c3e50;
                margin-bottom: 8px;
                font-weight: 500;
            }
            
            .ranking-comments textarea {
                width: 100%;
                padding: 10px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                font-family: inherit;
                resize: vertical;
            }
            
            .ranking-actions {
                display: flex;
                gap: 15px;
                justify-content: flex-end;
                margin-top: 20px;
            }
            
            .btn-primary, .btn-secondary {
                padding: 10px 24px;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 500;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .btn-primary:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            .btn-primary:disabled {
                background: #6c757d;
                cursor: not-allowed;
            }
            
            .btn-secondary {
                background: #e9ecef;
                color: #495057;
            }
            
            .btn-secondary:hover {
                background: #dee2e6;
            }
            
            .ranking-trigger-btn:hover {
                transform: translateY(-2px) scale(1.05);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            
            @media (max-width: 600px) {
                .ranking-modal-content {
                    padding: 20px;
                }
                
                .ranking-star {
                    font-size: 24px;
                }
                
                .ranking-trigger-btn {
                    bottom: 70px;
                    padding: 8px 16px;
                    font-size: 12px;
                }
            }
        `;
        
        document.head.appendChild(styles);
        document.body.appendChild(modal);
        document.body.appendChild(triggerButton);
        
        this.populateCategories();
    }

    populateCategories() {
        const container = document.getElementById('ranking-categories');
        container.innerHTML = '';
        
        this.rankingCategories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'ranking-category';
            categoryDiv.dataset.categoryId = category.id;
            
            const criteriaHtml = category.criteria.map(c => `<li>${c}</li>`).join('');
            
            categoryDiv.innerHTML = `
                <h3>${category.name}</h3>
                <p class="ranking-category-description">${category.description}</p>
                <ul class="ranking-criteria">${criteriaHtml}</ul>
                <div class="ranking-stars" data-category="${category.id}">
                    ${[1, 2, 3, 4, 5].map(i => 
                        `<span class="ranking-star" data-rating="${i}">★</span>`
                    ).join('')}
                </div>
            `;
            
            container.appendChild(categoryDiv);
        });
        
        // Setup star interactions
        this.setupStarInteractions();
    }

    setupStarInteractions() {
        const starContainers = document.querySelectorAll('.ranking-stars');
        
        starContainers.forEach(container => {
            const stars = container.querySelectorAll('.ranking-star');
            const categoryId = container.dataset.category;
            
            stars.forEach((star, index) => {
                star.addEventListener('mouseenter', () => {
                    this.highlightStars(stars, index + 1);
                });
                
                star.addEventListener('click', () => {
                    this.selectRating(categoryId, index + 1);
                    this.markStarsAsSelected(stars, index + 1);
                    this.updateSubmitButton();
                });
            });
            
            container.addEventListener('mouseleave', () => {
                const currentRating = this.getCurrentRating(categoryId);
                if (currentRating > 0) {
                    this.markStarsAsSelected(stars, currentRating);
                } else {
                    this.highlightStars(stars, 0);
                }
            });
        });
    }

    highlightStars(stars, count) {
        stars.forEach((star, index) => {
            if (index < count) {
                star.classList.add('hover');
            } else {
                star.classList.remove('hover');
            }
        });
    }

    markStarsAsSelected(stars, count) {
        stars.forEach((star, index) => {
            if (index < count) {
                star.classList.add('selected');
                star.classList.remove('hover');
            } else {
                star.classList.remove('selected');
                star.classList.remove('hover');
            }
        });
    }

    selectRating(categoryId, rating) {
        if (!this.currentRound) {
            this.currentRound = {
                timestamp: Date.now(),
                ratings: {},
                comments: ''
            };
        }
        
        this.currentRound.ratings[categoryId] = rating;
    }

    getCurrentRating(categoryId) {
        return this.currentRound?.ratings[categoryId] || 0;
    }

    setupEventListeners() {
        const modal = document.getElementById('ranking-modal');
        const triggerBtn = document.getElementById('ranking-trigger-btn');
        const skipBtn = document.getElementById('skip-ranking-btn');
        const submitBtn = document.getElementById('submit-ranking-btn');
        const commentsInput = document.getElementById('ranking-comments-input');
        
        // Show modal
        triggerBtn.addEventListener('click', () => {
            this.showRankingModal();
        });
        
        // Skip ranking
        skipBtn.addEventListener('click', () => {
            this.hideRankingModal();
            this.currentRound = null;
        });
        
        // Submit ranking
        submitBtn.addEventListener('click', () => {
            this.submitRanking();
        });
        
        // Update comments
        commentsInput.addEventListener('input', (e) => {
            if (this.currentRound) {
                this.currentRound.comments = e.target.value;
            }
        });
        
        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideRankingModal();
            }
        });
        
        // Listen for round completion events
        document.addEventListener('gameRoundComplete', (event) => {
            this.onRoundComplete(event.detail);
        });
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-ranking-btn');
        const allRated = this.rankingCategories.every(category => 
            this.getCurrentRating(category.id) > 0
        );
        
        submitBtn.disabled = !allRated;
    }

    showRankingModal() {
        const modal = document.getElementById('ranking-modal');
        modal.classList.add('active');
        
        // Reset current round if needed
        if (!this.currentRound) {
            this.currentRound = {
                timestamp: Date.now(),
                ratings: {},
                comments: ''
            };
        }
        
        // Clear previous selections
        this.resetUI();
    }

    hideRankingModal() {
        const modal = document.getElementById('ranking-modal');
        modal.classList.remove('active');
    }

    resetUI() {
        // Clear all star selections
        document.querySelectorAll('.ranking-star').forEach(star => {
            star.classList.remove('selected', 'hover');
        });
        
        // Clear comments
        document.getElementById('ranking-comments-input').value = '';
        
        // Disable submit button
        document.getElementById('submit-ranking-btn').disabled = true;
    }

    submitRanking() {
        if (!this.currentRound) return;
        
        // Add metadata
        this.currentRound.submittedAt = Date.now();
        this.currentRound.modelId = window.testGameRunner?.modelConfig?.modelId || 'unknown';
        
        // Calculate average rating
        const ratings = Object.values(this.currentRound.ratings);
        this.currentRound.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        
        // Save ranking
        this.rankings.rounds.push(this.currentRound);
        
        // Dispatch event for test runner
        document.dispatchEvent(new CustomEvent('userRanking', {
            detail: this.currentRound
        }));
        
        // Show confirmation
        this.showConfirmation();
        
        // Reset
        this.hideRankingModal();
        this.currentRound = null;
        
        console.log('Ranking submitted:', this.rankings);
    }

    showConfirmation() {
        const confirmation = document.createElement('div');
        confirmation.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
            z-index: 1001;
            animation: slideInUp 0.3s ease;
        `;
        confirmation.textContent = '✓ Thank you for your feedback!';
        
        document.body.appendChild(confirmation);
        
        setTimeout(() => {
            confirmation.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => confirmation.remove(), 300);
        }, 2000);
    }

    onRoundComplete(roundDetails) {
        // Store round details for context
        if (!this.currentRound) {
            this.currentRound = {
                timestamp: Date.now(),
                ratings: {},
                comments: '',
                roundDetails: roundDetails
            };
        } else {
            this.currentRound.roundDetails = roundDetails;
        }
        
        // Show ranking trigger button
        const triggerBtn = document.getElementById('ranking-trigger-btn');
        triggerBtn.style.display = 'block';
        
        // Auto-show modal after a short delay (optional)
        if (window.testGameRunner?.modelConfig?.autoShowRanking) {
            setTimeout(() => this.showRankingModal(), 1500);
        }
    }

    exportRankings() {
        const exportData = {
            ...this.rankings,
            exportedAt: new Date().toISOString(),
            modelId: window.testGameRunner?.modelConfig?.modelId || 'unknown'
        };
        
        return exportData;
    }

    getRankingSummary() {
        if (this.rankings.rounds.length === 0) {
            return null;
        }
        
        const summary = {
            totalRounds: this.rankings.rounds.length,
            averageRatings: {},
            categoryBreakdown: {},
            comments: []
        };
        
        // Calculate average ratings per category
        this.rankingCategories.forEach(category => {
            const ratings = this.rankings.rounds
                .map(r => r.ratings[category.id])
                .filter(r => r !== undefined);
            
            if (ratings.length > 0) {
                summary.averageRatings[category.id] = 
                    ratings.reduce((a, b) => a + b, 0) / ratings.length;
                
                // Distribution of ratings
                summary.categoryBreakdown[category.id] = {
                    1: ratings.filter(r => r === 1).length,
                    2: ratings.filter(r => r === 2).length,
                    3: ratings.filter(r => r === 3).length,
                    4: ratings.filter(r => r === 4).length,
                    5: ratings.filter(r => r === 5).length
                };
            }
        });
        
        // Collect all comments
        summary.comments = this.rankings.rounds
            .filter(r => r.comments)
            .map(r => ({
                timestamp: r.timestamp,
                comment: r.comments,
                averageRating: r.averageRating
            }));
        
        return summary;
    }
}

// Initialize when in test mode
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('testMode') === 'true') {
        window.userRankingInterface = new UserRankingInterface();
        
        // Add CSS animation keyframes
        const animationStyles = document.createElement('style');
        animationStyles.textContent = `
            @keyframes slideInUp {
                from {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutDown {
                from {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(animationStyles);
    }
});

export { UserRankingInterface };