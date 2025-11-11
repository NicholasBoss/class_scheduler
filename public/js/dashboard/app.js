// Main application initialization
function initializeDashboard() {
    // Setup all event listeners
    setupSemesterListener();
    setupNumClassesListener();
    setupFormSubmission();
    
    // Initialize default state
    autoSelectSemester();
    generateClassForms(1); // Generate form for 1 class by default
    loadEvents();
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});
