# Dashboard JavaScript Modules

This directory contains the refactored, modular JavaScript for the dashboard. Each file handles a specific concern, making the code more maintainable and testable.

## Module Overview

### 1. **constants.js**
- **Purpose**: Static configuration and constants
- **Exports**: 
  - `API_BASE_URL` - Base URL for API calls
  - `VALID_BUILDING_CODES` - Object mapping building codes to names
  - `semesterDates` - Object with semester start/end dates
- **Dependencies**: None (leaf module)

### 2. **time-slots.js**
- **Purpose**: Time slot logic based on selected days
- **Functions**:
  - `getTimeSlots(selectedDays)` - Returns available time slots for given days
  - `updateTimeSlots(classIndex)` - Updates time slot dropdown when days change
- **Dependencies**: `constants.js`

### 3. **form-generation.js**
- **Purpose**: Dynamically generate class input forms
- **Functions**:
  - `generateClassForms(numClasses)` - Creates form inputs for N classes
- **Handles**: 
  - DOM creation and event listeners
  - Location toggle (dropdown vs manual entry)
  - Day checkbox listeners
- **Dependencies**: `time-slots.js`

### 4. **validation.js**
- **Purpose**: Input validation logic
- **Functions**:
  - `validateLocation(location)` - Validates building code and room number format
- **Dependencies**: `constants.js`

### 5. **semester.js**
- **Purpose**: Semester-related functionality
- **Functions**:
  - `autoSelectSemester()` - Auto-selects current semester
  - `setupSemesterListener()` - Attaches semester change listener
- **Dependencies**: `constants.js`

### 6. **api.js**
- **Purpose**: API communication
- **Functions**:
  - `loadEvents()` - Fetches events from `/api/events`
  - `createSchedule(events)` - Posts events to `/api/events`
- **Features**: 
  - Credentials included for cookie-based auth
  - Error handling
- **Dependencies**: `validation.js`

### 7. **ui-renderer.js**
- **Purpose**: Rendering functions for UI updates
- **Functions**:
  - `renderEventsList(events)` - Renders event cards in the sidebar
- **Dependencies**: `constants.js`

### 8. **form-submission.js**
- **Purpose**: Form submission and event listener setup
- **Functions**:
  - `setupFormSubmission()` - Attaches form submit handler
  - `setupNumClassesListener()` - Attaches num classes change listener
- **Handles**:
  - Collecting form data
  - Validation
  - API calls
  - Success/error alerts
- **Dependencies**: `validation.js`, `api.js`, `form-generation.js`

### 9. **app.js**
- **Purpose**: Main application initialization
- **Functions**:
  - `initializeDashboard()` - Orchestrates all setup
- **Calls**:
  - Sets up all event listeners
  - Initializes default state
  - Loads initial data
- **Dependencies**: All other modules

## Load Order (in `dashboard.ejs`)

```html
<!-- Set global API_BASE_URL -->
<script>
    const API_BASE_URL = '<%= apiBaseUrl %>';
</script>

<!-- Load modules in dependency order -->
<script src="/js/dashboard/constants.js"></script>
<script src="/js/dashboard/time-slots.js"></script>
<script src="/js/dashboard/form-generation.js"></script>
<script src="/js/dashboard/validation.js"></script>
<script src="/js/dashboard/semester.js"></script>
<script src="/js/dashboard/api.js"></script>
<script src="/js/dashboard/ui-renderer.js"></script>
<script src="/js/dashboard/form-submission.js"></script>
<script src="/js/dashboard/app.js"></script>
```

## Dependency Graph

```
app.js (entry point)
├── form-submission.js
│   ├── validation.js
│   │   └── constants.js
│   ├── api.js
│   │   ├── validation.js (already loaded)
│   │   └── constants.js (already loaded)
│   └── form-generation.js
│       └── time-slots.js
│           └── constants.js (already loaded)
├── semester.js
│   └── constants.js (already loaded)
├── form-generation.js (already loaded)
├── time-slots.js (already loaded)
├── validation.js (already loaded)
└── ui-renderer.js
    └── constants.js (already loaded)
```

## Adding New Features

### Example: Add event deletion

1. Add delete function to **api.js**:
```javascript
async function deleteEvent(eventId) {
    // DELETE /api/events/:id
}
```

2. Add delete button to **ui-renderer.js**:
```javascript
function renderEventCard(event) {
    return `
        <button onclick="deleteEvent(${event.event_id})">Delete</button>
    `;
}
```

3. Update **form-submission.js** or **app.js** to handle the deletion.

## Future Refactoring Ideas

- Move all event listeners to a centralized event delegation system
- Add state management (e.g., simple object tracking form state)
- Extract HTTP utilities to a separate file
- Add unit tests for validation and API functions
- Consider using ES6 modules/import/export instead of globals (requires bundler)

## Notes

- All modules assume `document` is available (browser environment)
- The `API_BASE_URL` is set globally before modules load
- Each module is self-contained and can be tested independently
- No external dependencies (vanilla JavaScript only)
