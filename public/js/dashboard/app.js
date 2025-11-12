// Main application initialization
function initializeDashboard() {
    // Setup all event listeners
    setupSemesterListener();
    setupFormFieldListeners();
    setupNumClassesListener();
    setupFormSubmission();
    
    // Initialize default state
    autoSelectSemester();
    generateClassForms(1); // Generate form for 1 class by default
    setupClassFormListeners(); // Setup listeners for auto-save on form changes
    loadEvents();
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});
