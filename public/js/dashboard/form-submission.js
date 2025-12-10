// Validate time selection for all classes
function validateTimeSelection() {
    const numClasses = parseInt(document.getElementById('numClasses').value);
    
    for (let i = 0; i < numClasses; i++) {
        const presetForm = document.getElementById(`timePreset${i}`);
        const customForm = document.getElementById(`timeCustom${i}`);
        
        if (presetForm.style.display !== 'none') {
            const timeSlot = document.getElementById(`timeSlot${i}`).value;
            if (!timeSlot) {
                alert(`Please select a time slot for Class ${i + 1}`);
                return false;
            }
        } else {
            const startTime = document.getElementById(`customStartTime${i}`).value;
            const endTime = document.getElementById(`customEndTime${i}`).value;
            if (!startTime || !endTime) {
                alert(`Please enter start and end times for Class ${i + 1}`);
                return false;
            }
        }
    }
    return true;
}

// Convert 24-hour time format to 12-hour format with AM/PM
function convertTo12HourFormat(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
}

// Convert 12-hour time format with AM/PM to 24-hour format
function parseTime12to24(time12) {
    const [time, period] = time12.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Setup form submission handler
function setupFormSubmission() {
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get and disable the submit button
        const submitButton = document.querySelector('#scheduleForm button[type="submit"]');
        submitButton.disabled = true;
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Generating...';
        
        // Validate time selections before proceeding
        if (!validateTimeSelection()) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            return;
        }
        
        const numClasses = parseInt(document.getElementById('numClasses').value);
        const beginDate = document.getElementById('beginDate').value;
        const endDate = document.getElementById('endDate').value;
        const semesterName = document.getElementById('semester').value;
        
        // Get calendar selection
        const calendarOption = CalendarSelection.getSelectedCalendarOption();
        if (!calendarOption) {
            alert('Please select a calendar option');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            return;
        }
        
        const createSeparateCalendar = (calendarOption.type === 'create');

        const events = [];
        for (let i = 0; i < numClasses; i++) {
            const className = document.getElementById(`className${i}`).value;
            
            const buildingCode = document.getElementById(`buildingCode${i}`)?.value;
            let roomNumber = document.getElementById(`roomNumber${i}`)?.value;
            const manualLocation = document.getElementById(`location${i}`)?.value;
            
            // Pad single digit room numbers with a leading zero
            if (roomNumber && /^\d$/.test(roomNumber)) {
                roomNumber = '0' + roomNumber;
            }
            
            let location = '';
            if (buildingCode && roomNumber) {
                location = `${buildingCode} ${roomNumber}`;
            } else if (manualLocation) {
                location = manualLocation;
            }
            
            // Get time slot from preset or custom
            let timeSlot = '';
            const presetForm = document.getElementById(`timePreset${i}`);
            if (presetForm.style.display !== 'none') {
                timeSlot = document.getElementById(`timeSlot${i}`).value;
            } else {
                const startTime = document.getElementById(`customStartTime${i}`).value;
                const endTime = document.getElementById(`customEndTime${i}`).value;
                const start12Hour = convertTo12HourFormat(startTime);
                const end12Hour = convertTo12HourFormat(endTime);
                timeSlot = `${start12Hour} - ${end12Hour}`;
            }
            
            const dayCheckboxes = document.querySelectorAll(`input[name="days${i}"]:checked`);
            const days = Array.from(dayCheckboxes).map(cb => cb.value).join(',');

            // Get selected reminders
            const reminders = [];
            const reminder30Element = document.getElementById(`reminder30min${i}`);
            const reminder60Element = document.getElementById(`reminder1hr${i}`);
            
            console.log(`Class ${i}: reminder30min element:`, reminder30Element, `checked:`, reminder30Element?.checked);
            console.log(`Class ${i}: reminder1hr element:`, reminder60Element, `checked:`, reminder60Element?.checked);
            
            if (reminder30Element?.checked) {
                reminders.push(30);
            }
            if (reminder60Element?.checked) {
                reminders.push(60);
            }
            
            console.log(`Class ${i}: Reminders array:`, reminders);

            if (location) {
                const locationValidation = validateLocation(location);
                if (!locationValidation.valid) {
                    alert(`Class ${i + 1}: ${locationValidation.error}`);
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                    return;
                }
                location = locationValidation.formatted;
            } else {
                alert(`Class ${i + 1}: Please enter a location`);
                submitButton.disabled = false;
                submitButton.textContent = originalText;
                return;
            }

            if (className && timeSlot && days) {
                events.push({
                    class_name: className,
                    location: location,
                    days: days,
                    time_slot: timeSlot,
                    start_date: beginDate,
                    end_date: endDate,
                    create_separate_calendar: createSeparateCalendar,
                    calendar_type: calendarOption.type,
                    semester_name: semesterName,
                    reminders: reminders
                });
            }
        }

        try {
            const result = await createSchedule(events);
            alert(result.message);
            document.getElementById('scheduleForm').reset();
            document.getElementById('classesContainer').innerHTML = '';
            // Clear saved form data after successful submission
            FormDataPersistence.clear();
            // Regenerate the class forms (1 class by default)
            generateClassForms(1);
            // Re-select the current semester and refresh calendars
            autoSelectSemester();
            
            // Reset the submit button
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            
            // If a new calendar was created, refresh calendars to get the correct color
            if (result.newCalendarCreated) {
                console.log(`✓ New calendar created for ${result.newCalendarSemester}, refreshing...`);
                await CalendarSelection.loadExistingCalendars();
            }
            
            CalendarSelection.refreshCalendarsForSemester(semesterName);
            await loadEvents();
            
            // Check sync status after 5-10 seconds and re-render with status badges
            checkSyncStatusAfterDelay(7000);
        } catch (err) {
            console.error('Error creating schedule:', err);
            
            // Re-enable the button on error
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            
            // Check if this is a Google Calendar auth error
            if (err.authError) {
                showGoogleNotification(
                    `<strong>⚠ Google Calendar Authentication Failed</strong><br><br>` +
                    `We could not create your class schedule because your Google Calendar authentication has expired or is invalid.<br><br>` +
                    `<strong>What to do:</strong> Please log out and log back in to re-authorize Google Calendar access, then try creating your schedule again.`
                );
            } else if (err.message && err.message.includes('authentication credentials')) {
                showGoogleNotification(
                    `<strong>⚠ Google Calendar Authentication Issue</strong><br><br>` +
                    `Your classes were not created because we couldn't authenticate with Google Calendar.<br><br>` +
                    `<strong>What to do:</strong> Please log out and log back in to re-authorize Google Calendar access.`
                );
            } else {
                alert('Failed to create schedule: ' + err.message);
            }
        }
    });
}

// Setup number of classes change handler
function setupNumClassesListener() {
    document.getElementById('numClasses').addEventListener('change', (e) => {
        const numClasses = parseInt(e.target.value);
        // Save current form data before regenerating
        FormDataPersistence.save();
        generateClassForms(numClasses);
    });
}

// Setup listeners for form field changes to auto-save data
function setupFormFieldListeners() {
    const scheduleForm = document.getElementById('scheduleForm');
    
    // Listen for changes on top-level form fields
    const dateInputs = ['beginDate', 'endDate'];
    dateInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
    });
}

// Setup listeners for class field changes (called after forms are generated)
function setupClassFormListeners() {
    const numClasses = parseInt(document.getElementById('numClasses').value) || 0;
    
    for (let i = 0; i < numClasses; i++) {
        // Class name input
        const classNameInput = document.getElementById(`className${i}`);
        if (classNameInput) {
            classNameInput.addEventListener('change', () => {
                FormDataPersistence.save();
            });
            classNameInput.addEventListener('input', () => {
                // Debounced save on input
                clearTimeout(classNameInput.saveTimeout);
                classNameInput.saveTimeout = setTimeout(() => {
                    FormDataPersistence.save();
                }, 500);
            });
        }
        
        // Building code select
        const buildingSelect = document.getElementById(`buildingCode${i}`);
        if (buildingSelect) {
            buildingSelect.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
        
        // Room number input
        const roomInput = document.getElementById(`roomNumber${i}`);
        if (roomInput) {
            roomInput.addEventListener('change', () => {
                FormDataPersistence.save();
            });
            roomInput.addEventListener('input', () => {
                clearTimeout(roomInput.saveTimeout);
                roomInput.saveTimeout = setTimeout(() => {
                    FormDataPersistence.save();
                }, 500);
            });
        }
        
        // Manual location input
        const locationInput = document.getElementById(`location${i}`);
        if (locationInput) {
            locationInput.addEventListener('change', () => {
                FormDataPersistence.save();
            });
            locationInput.addEventListener('input', () => {
                clearTimeout(locationInput.saveTimeout);
                locationInput.saveTimeout = setTimeout(() => {
                    FormDataPersistence.save();
                }, 500);
            });
        }
        
        // Time slot select
        const timeSlotSelect = document.getElementById(`timeSlot${i}`);
        if (timeSlotSelect) {
            timeSlotSelect.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }

        // Custom time inputs
        const customStartTime = document.getElementById(`customStartTime${i}`);
        const customEndTime = document.getElementById(`customEndTime${i}`);
        if (customStartTime) {
            customStartTime.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
        if (customEndTime) {
            customEndTime.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
    }
}

// Edit event function
// Render event color picker grid in edit modal

async function editEvent(eventId) {
    try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        // Fetch the event details
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const event = await response.json();
        openEditModal(event);
    } catch (err) {
        console.error('Error fetching event:', err);
        alert('Failed to load event details: ' + err.message);
    }
}

// Populate time slot dropdown in edit modal
function populateEditTimeSlots(selectedDays) {
    const timeSlots = getTimeSlots(selectedDays);
    const timeSelect = document.getElementById('editTimeSlot');
    
    timeSelect.innerHTML = '<option value="">Select Time Slot</option>';
    timeSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.value;
        option.textContent = slot.label;
        timeSelect.appendChild(option);
    });
}

// Open edit modal
function openEditModal(event) {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    
    if (!modal || !form) {
        console.error('Edit modal or form not found');
        return;
    }
    
    // Populate form with current values
    form.dataset.eventId = event.event_id;
    form.dataset.googleEventId = event.google_event_id || null;
    document.getElementById('editClassName').value = event.class_name || '';
    document.getElementById('editLocation').value = event.location || '';
    
    // Parse days first
    const days = event.days.split(',').map(d => d.trim());
    
    // Populate time slot dropdown with correct options for these days
    populateEditTimeSlots(days);
    
    // Parse time slot and determine if it's a preset or custom time
    const timeSlot = event.time_slot || '';
    const timeSlotSelect = document.getElementById('editTimeSlot');
    
    // Check if it's a preset time (exists in dropdown)
    let isPresetTime = false;
    const options = Array.from(timeSlotSelect.options);
    for (let option of options) {
        if (option.value === timeSlot) {
            isPresetTime = true;
            break;
        }
    }
    
    // If preset time, use dropdown; otherwise use custom inputs
    const presetForm = document.getElementById('editTimePreset');
    const customForm = document.getElementById('editTimeCustom');
    
    if (isPresetTime) {
        presetForm.style.display = 'block';
        customForm.style.display = 'none';
        timeSlotSelect.value = timeSlot;
    } else {
        // Parse custom time from time slot string (e.g., \"9:00 AM - 10:00 AM\")
        presetForm.style.display = 'none';
        customForm.style.display = 'block';
        
        const [startStr, endStr] = timeSlot.split(' - ');
        if (startStr && endStr) {
            const startTime24 = parseTime12to24(startStr.trim());
            const endTime24 = parseTime12to24(endStr.trim());
            document.getElementById('editCustomStartTime').value = startTime24;
            document.getElementById('editCustomEndTime').value = endTime24;
        }
    }
    
    // Format and set dates
    const startDateFormatted = formatDateForInput(event.start_date);
    const endDateFormatted = formatDateForInput(event.end_date);
    
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    
    startDateInput.value = startDateFormatted;
    endDateInput.value = endDateFormatted;
    
    // Set checkboxes for days
    document.querySelectorAll('input[name="editDays"]').forEach(checkbox => {
        const isChecked = days.includes(checkbox.value);
        checkbox.checked = isChecked;
    });

    // Log for debugging
    console.log('📅 Edit Modal - Original days from event:', event.days);
    console.log('📅 Edit Modal - Parsed days array:', days);
    const checkedBoxes = document.querySelectorAll('input[name="editDays"]:checked');
    console.log('📅 Edit Modal - Currently checked boxes:', Array.from(checkedBoxes).map(cb => cb.value));

    // Restore reminders from stored data
    const editReminder30 = document.getElementById('editReminder30min');
    const editReminder60 = document.getElementById('editReminder1hr');
    
    if (editReminder30 && editReminder60) {
        // Check if reminders array exists and contains the reminder values
        if (event.reminders && Array.isArray(event.reminders)) {
            editReminder30.checked = event.reminders.includes(30);
            editReminder60.checked = event.reminders.includes(60);
        } else {
            // Default: only 15-min (which is always applied)
            editReminder30.checked = false;
            editReminder60.checked = false;
        }
    }
    
    modal.style.display = 'block';
}

// Close Google Calendar notification modal
function closeGoogleNotification() {
    const modal = document.getElementById('googleCalendarNotification');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Redirect to Google login
function redirectToGoogleLogin() {
    // Log out user and redirect to login page for re-authentication
    localStorage.removeItem('token');
    window.location.href = '/login';
}

// Show Google Calendar notification
function showGoogleNotification(message) {
    const modal = document.getElementById('googleCalendarNotification');
    const messageElement = document.getElementById('googleNotificationMessage');
    
    if (modal && messageElement) {
        messageElement.innerHTML = message;
        modal.style.display = 'block';
    }
}

// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Toggle between preset and custom time inputs in edit form
function toggleEditTimeMode() {
    const presetForm = document.getElementById('editTimePreset');
    const customForm = document.getElementById('editTimeCustom');
    
    if (presetForm.style.display !== 'none') {
        presetForm.style.display = 'none';
        customForm.style.display = 'block';
    } else {
        presetForm.style.display = 'block';
        customForm.style.display = 'none';
    }
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(dateStr) {
    if (!dateStr) {
        return '';
    }
    
    // If it's a string, check if it's already in YYYY-MM-DD format or has a timestamp
    if (typeof dateStr === 'string') {
        // Extract just the date part (first 10 characters: YYYY-MM-DD)
        const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            return dateMatch[0]; // Returns YYYY-MM-DD
        }
    }
    
    // Fallback: parse as Date object
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return '';
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Error formatting date:', e);
        return '';
    }
}

// Submit edit form
async function submitEditForm(e) {
    e.preventDefault();

    const form = document.getElementById('editForm');
    const eventId = form.dataset.eventId;
    const className = document.getElementById('editClassName').value;
    const location = document.getElementById('editLocation').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value;
    
    const dayCheckboxes = document.querySelectorAll('input[name="editDays"]:checked');
    const days = Array.from(dayCheckboxes).map(cb => cb.value).join(',');

    // Validate that at least one day is selected
    if (!days) {
        alert('Please select at least one day for this class');
        return;
    }

    // Get time slot from either preset or custom input
    let timeSlot;
    const presetForm = document.getElementById('editTimePreset');
    if (presetForm.style.display !== 'none') {
        // Using preset times
        timeSlot = document.getElementById('editTimeSlot').value;
        if (!timeSlot) {
            alert('Please select a time slot');
            return;
        }
    } else {
        // Using custom times
        const startTime = document.getElementById('editCustomStartTime').value;
        const endTime = document.getElementById('editCustomEndTime').value;
        if (!startTime || !endTime) {
            alert('Please enter both start and end times');
            return;
        }
        const start12Hour = convertTo12HourFormat(startTime);
        const end12Hour = convertTo12HourFormat(endTime);
        timeSlot = `${start12Hour} - ${end12Hour}`;
    }

    if (!className || !days || !startDate || !endDate) {
        alert('Please fill in all required fields');
        return;
    }

    // Get selected reminders
    const reminders = [];
    const editReminder30Element = document.getElementById('editReminder30min');
    const editReminder60Element = document.getElementById('editReminder1hr');
    
    if (editReminder30Element?.checked) {
        reminders.push(30);
    }
    if (editReminder60Element?.checked) {
        reminders.push(60);
    }

    try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        const payload = {
            class_name: className,
            location,
            time_slot: timeSlot,
            days,
            start_date: startDate,
            end_date: endDate,
            reminders
        };
        
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }

        const responseData = await response.json();
        
        // If event was not synced before, attempt to sync it now
        if (form.dataset.googleEventId === 'null' || !form.dataset.googleEventId) {
            console.log('🔄 Event was not previously synced, attempting to sync...');
            try {
                const syncResponse = await fetch(`${API_BASE_URL}/events/${eventId}/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (syncResponse.ok) {
                    const syncData = await syncResponse.json();
                    console.log('✓ Event synced to Google Calendar:', syncData.google_event_id);
                    alert('✓ Class updated and synced to Google Calendar!');
                } else if (syncResponse.status === 401) {
                    const syncData = await syncResponse.json();
                    console.warn('⚠ Google Calendar auth error during sync');
                    showGoogleNotification(
                        `<strong>⚠ Google Calendar Authentication Failed</strong><br><br>` +
                        `Your class was updated successfully, but we could not sync it to Google Calendar because your authentication has expired or is invalid.<br><br>` +
                        `<strong>What to do:</strong> Please log out and log back in to re-authorize Google Calendar access. Your class will sync the next time you update it.`
                    );
                } else {
                    console.warn('⚠ Could not sync event to Google Calendar');
                    alert('✓ Class updated successfully! (Could not sync to Google Calendar)');
                }
            } catch (syncErr) {
                console.warn('⚠ Sync attempt failed:', syncErr);
                alert('✓ Class updated successfully! (Sync failed, but local update succeeded)');
            }
        } else {
            alert('✓ Class updated successfully!');
        }
        
        closeEditModal();
        await loadEvents();
    } catch (err) {
        console.error('Error updating event:', err);
        
        // Check if this is a Google Calendar auth error
        if (err.message && err.message.includes('401')) {
            showGoogleNotification(
                `<strong>⚠ Google Calendar Authentication Failed</strong><br><br>` +
                `We could not update your class because your Google Calendar authentication has expired or is invalid.<br><br>` +
                `<strong>What to do:</strong> Please log out and log back in to re-authorize Google Calendar access, then try updating your class again.`
            );
        } else if (err.message && (err.message.includes('authentication') || err.message.includes('credentials'))) {
            showGoogleNotification(
                `<strong>⚠ Google Calendar Authentication Issue</strong><br><br>` +
                `Your class was not updated because we couldn't authenticate with Google Calendar.<br><br>` +
                `<strong>What to do:</strong> Please log out and log back in to re-authorize Google Calendar access.`
            );
        } else {
            alert('Failed to update class: ' + err.message);
        }
    }
}

// Delete event function
function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        deleteEventAPI(eventId)
            .then(async (response) => {
                alert('Event deleted successfully');
                
                // Load events and check if calendar is now empty
                const eventsResponse = await fetch(`${API_BASE_URL}/events`, {
                    credentials: 'include'
                });
                
                if (eventsResponse.ok) {
                    const allEvents = await eventsResponse.json();
                    
                    // Get the semester of the deleted event from response if available
                    // Or reload and find calendars that have no events
                    const calendarsResponse = await fetch(`${API_BASE_URL}/events/calendars/semesters`, {
                        credentials: 'include'
                    });
                    
                    if (calendarsResponse.ok) {
                        const calendars = await calendarsResponse.json();
                        
                        // Check each calendar to see if it has any events
                        for (const calendar of calendars) {
                            const calendarHasEvents = allEvents.some(event => event.semester_name === calendar.semester_name);
                            
                            if (!calendarHasEvents) {
                                // This calendar is now empty, offer to delete it
                                if (confirm(`The "${calendar.semester_name}" calendar has no more events. Would you like to delete this calendar?`)) {
                                    try {
                                        await deleteCalendar(calendar.google_calendar_id, calendar.semester_name);
                                    } catch (err) {
                                        console.error('Error deleting calendar:', err);
                                    }
                                }
                            }
                        }
                    }
                }
                
                loadEvents();
            })
            .catch(err => {
                alert('Failed to delete event: ' + err.message);
            });
    }
}

// Helper function to delete calendar (reusing from calendar-selection.js logic)
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

        console.log(`✓ Calendar "${calendarName}" deleted successfully`);
        
        // Refresh the calendar selection if CalendarSelection module is available
        if (typeof CalendarSelection !== 'undefined') {
            await CalendarSelection.loadExistingCalendars();
        }
    } catch (err) {
        console.error('Error deleting calendar:', err);
        throw err;
    }
}
