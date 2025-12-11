// Calendar Selection Module
const CalendarSelection = (() => {
    let existingCalendars = [];

    // Initialize calendar selection UI
    async function init() {
        await loadExistingCalendars();
        setupCalendarSelectionListener();
    }

    // Load existing semester calendars
    async function loadExistingCalendars() {
        try {
            // console.log('🔄 Loading semester calendars...');
            const response = await fetch(`${API_BASE_URL}/events/calendars/semesters`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            existingCalendars = await response.json();
            // console.log('✓ Loaded semester calendars:', existingCalendars);
            existingCalendars.forEach(cal => {
                // console.log(`  ${cal.semester_name}: colorId=${cal.color_id}, colorHex=${cal.color_hex}`);
            });
            populateCalendarOptions();
        } catch (err) {
            console.error('Error loading semester calendars:', err);
            // Don't fail if unable to load calendars
        }
    }

    // Populate calendar selection dropdown
    function populateCalendarOptions() {
        const select = document.getElementById('calendarSelection');
        const listContainer = document.getElementById('existingCalendars');
        
        if (!select || !listContainer) {
            console.warn('Calendar selection elements not found');
            return;
        }

        // Get the currently selected semester
        const semesterSelect = document.getElementById('semester');
        const selectedSemester = semesterSelect ? semesterSelect.value : '';

        // Check if a calendar already exists for this semester
        const calendarExistsForSemester = existingCalendars.some(cal => cal.semester_name === selectedSemester);

        // Clear existing options except the first two (placeholder and primary)
        const options = select.querySelectorAll('option');
        options.forEach((option, index) => {
            if (index > 1) {
                option.remove();
            }
        });

        // Only add "Create a new calendar" option if no calendar exists for this semester
        if (!calendarExistsForSemester) {
            // Find the index where to insert the create option (after primary)
            const primaryOption = select.querySelector('option[value="primary"]');
            if (primaryOption) {
                const createOption = document.createElement('option');
                createOption.value = 'create';
                createOption.textContent = 'Create a new calendar for this semester';
                primaryOption.parentNode.insertBefore(createOption, primaryOption.nextSibling);
            }
        }

        // Add existing calendars to dropdown
        existingCalendars.forEach(calendar => {
            const option = document.createElement('option');
            option.value = `use:${calendar.semester_name}`;
            option.textContent = `Use existing: ${calendar.semester_name} calendar`;
            select.appendChild(option);
        });

        // Update list display
        updateCalendarList();
    }

    // Update the visual list of existing calendars
    function updateCalendarList() {
        const listContainer = document.getElementById('existingCalendars');
        if (!listContainer) return;

        // console.log('📋 Updating calendar list with', existingCalendars.length, 'calendars');

        if (existingCalendars.length === 0) {
            listContainer.innerHTML = '<p class="calendar-info">No existing semester calendars found</p>';
        } else {
            let html = '<div class="calendar-list"><p class="calendar-info">Your existing calendars:</p><ul>';
            existingCalendars.forEach(calendar => {
                // console.log(`  Rendering: ${calendar.semester_name}, colorId=${calendar.color_id}, hex=${calendar.color_hex}`);
                html += `
                    <li class="calendar-item">
                        <div class="calendar-color-box" style="background-color: ${calendar.color_hex || '#616161'};" title="Calendar color"></div>
                        <span class="calendar-name">${calendar.semester_name} semester</span>
                        <button type="button" class="btn-edit-color" data-calendar-id="${calendar.google_calendar_id}" data-calendar-name="${calendar.semester_name}" data-color-id="${calendar.color_id || ''}" title="Change calendar color">Edit Color</button>
                        <button type="button" class="btn-delete-calendar" data-calendar-id="${calendar.google_calendar_id}" data-calendar-name="${calendar.semester_name}" title="Delete calendar">Delete</button>
                    </li>
                `;
            });
            html += '</ul></div>';
            listContainer.innerHTML = html;
            // console.log('✓ Calendar list updated');
            
            // Attach event listeners to color edit buttons
            attachColorButtonListeners();
        }
    }

    // Attach listeners to color edit buttons
    function attachColorButtonListeners() {
        const editButtons = document.querySelectorAll('.btn-edit-color');
        // console.log(`🎨 Attaching listeners to ${editButtons.length} color buttons`);
        editButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const calendarId = btn.dataset.calendarId;
                const calendarName = btn.dataset.calendarName;
                const colorId = btn.dataset.colorId;
                // console.log(`🖱️ Color button clicked: ${calendarName}, colorId=${colorId}`);
                
                if (typeof ColorPicker !== 'undefined') {
                    await ColorPicker.openModal(calendarId, calendarName, colorId || null);
                } else {
                    console.error('❌ ColorPicker module not available');
                }
            });
        });

        // Attach delete button listeners
        const deleteButtons = document.querySelectorAll('.btn-delete-calendar');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const calendarId = btn.dataset.calendarId;
                const calendarName = btn.dataset.calendarName;
                
                if (confirm(`Are you sure you want to delete the "${calendarName}" calendar? This cannot be undone.`)) {
                    await deleteCalendar(calendarId, calendarName);
                }
            });
        });
    }

    // Setup listener for calendar selection changes
    function setupCalendarSelectionListener() {
        const select = document.getElementById('calendarSelection');
        if (select) {
            select.addEventListener('change', onCalendarSelectionChange);
        }
    }

    // Handle calendar selection change
    function onCalendarSelectionChange(e) {
        // const value = e.target.value;
        
        // if (value === 'primary') {
        //     // Using default/primary calendar
        //     console.log('Using default calendar');
        // } else if (value === 'create') {
        //     // Creating new calendar - no special handling needed
        //     console.log('Creating new calendar for this semester');
        // } else if (value.startsWith('use:')) {
        //     // Using existing calendar
        //     const semesterName = value.substring(4);
        //     // console.log('Using existing calendar for:', semesterName);
        // }
        
        // Save form data when calendar selection changes
        FormDataPersistence.save();
    }

    // Get the selected calendar option
    function getSelectedCalendarOption() {
        const select = document.getElementById('calendarSelection');
        if (!select || !select.value) {
            return null;
        }

        const value = select.value;
        
        if (value === 'primary') {
            return { type: 'primary', semesterName: null };
        } else if (value === 'create') {
            return { type: 'create', semesterName: null };
        } else if (value.startsWith('use:')) {
            const semesterName = value.substring(4);
            return { type: 'use', semesterName: semesterName };
        }
        
        return null;
    }

    // Refresh calendars when semester changes
    async function refreshCalendarsForSemester(semesterName) {
        await loadExistingCalendars();
        populateCalendarOptions();
        
        // Auto-select existing calendar if available for this semester
        const select = document.getElementById('calendarSelection');
        if (select) {
            const existingOption = Array.from(select.options).find(opt => 
                opt.value === `use:${semesterName}`
            );
            
            if (existingOption) {
                select.value = `use:${semesterName}`;
                // console.log(`Auto-selected existing calendar for ${semesterName}`);
            } else {
                // Only set to create if that option exists
                const createOption = Array.from(select.options).find(opt => opt.value === 'create');
                if (createOption) {
                    select.value = 'create';
                    // console.log(`No existing calendar for ${semesterName}, will create new one`);
                } else {
                    // console.log(`Calendar already exists for ${semesterName}, create option hidden`);
                }
            }
        }
    }

    // Delete a calendar
    async function deleteCalendar(calendarId, calendarName) {
        try {
            const response = await fetch(`${API_BASE_URL}/events/calendars/${calendarId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete calendar');
            }

            alert(`✓ "${calendarName}" calendar deleted successfully`);
            
            // Reload calendars and refresh the UI
            await loadExistingCalendars();
            populateCalendarOptions();
            
            // Refresh the events list to remove deleted calendar's events
            if (typeof loadEvents === 'function') {
                await loadEvents();
            }
        } catch (err) {
            console.error('Error deleting calendar:', err);
            alert(`✗ Failed to delete calendar: ${err.message}`);
        }
    }

    return {
        init,
        loadExistingCalendars,
        getSelectedCalendarOption,
        refreshCalendarsForSemester
    };
})();
