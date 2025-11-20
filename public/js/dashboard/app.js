// Main application initialization
async function initializeDashboard() {
    // Check Google Calendar authorization status
    await GoogleAuthStatus.checkAuthStatus();
    
    // Setup all event listeners
    setupSemesterListener();
    setupFormFieldListeners();
    setupNumClassesListener();
    setupFormSubmission();
    
    // Initialize calendar selection
    await CalendarSelection.init();
    
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
