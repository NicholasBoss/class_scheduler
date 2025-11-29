// Main application initialization
async function initializeDashboard() {
    // Check Google Calendar authorization status
    await GoogleAuthStatus.checkAuthStatus();
    
    // Initialize color picker
    await ColorPicker.init();
    
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
    
    // Check sync status of events and re-render (after initial load)
    if (typeof SyncStatusChecker !== 'undefined') {
        SyncStatusChecker.init().then(() => {
            // Re-render events to show sync status badges
            loadEvents();
        }).catch(err => console.error('Sync status check failed:', err));
    }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});
