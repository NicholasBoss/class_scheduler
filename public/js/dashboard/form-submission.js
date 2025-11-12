// Setup form submission handler
function setupFormSubmission() {
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const numClasses = parseInt(document.getElementById('numClasses').value);
        const beginDate = document.getElementById('beginDate').value;
        const endDate = document.getElementById('endDate').value;

        const events = [];
        for (let i = 0; i < numClasses; i++) {
            const className = document.getElementById(`className${i}`).value;
            
            const buildingCode = document.getElementById(`buildingCode${i}`)?.value;
            const roomNumber = document.getElementById(`roomNumber${i}`)?.value;
            const manualLocation = document.getElementById(`location${i}`)?.value;
            
            let location = '';
            if (buildingCode && roomNumber) {
                location = `${buildingCode} ${roomNumber}`;
            } else if (manualLocation) {
                location = manualLocation;
            }
            
            const timeSlot = document.getElementById(`timeSlot${i}`).value;
            const dayCheckboxes = document.querySelectorAll(`input[name="days${i}"]:checked`);
            const days = Array.from(dayCheckboxes).map(cb => cb.value).join(',');

            if (location) {
                const locationValidation = validateLocation(location);
                if (!locationValidation.valid) {
                    alert(`Class ${i + 1}: ${locationValidation.error}`);
                    return;
                }
                location = locationValidation.formatted;
            } else {
                alert(`Class ${i + 1}: Please enter a location`);
                return;
            }

            if (className && timeSlot && days) {
                events.push({
                    class_name: className,
                    location: location,
                    days: days,
                    time_slot: timeSlot,
                    start_date: beginDate,
                    end_date: endDate
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
            await loadEvents();
        } catch (err) {
            alert('Failed to create schedule: ' + err.message);
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
    }
}

// Edit event function
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
    document.getElementById('editClassName').value = event.class_name || '';
    document.getElementById('editLocation').value = event.location || '';
    
    // Parse days first
    const days = event.days.split(',').map(d => d.trim());
    
    // Populate time slot dropdown with correct options for these days
    populateEditTimeSlots(days);
    
    // Now set the time slot value
    const timeSlotSelect = document.getElementById('editTimeSlot');
    timeSlotSelect.value = event.time_slot || '';
    
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
    
    modal.style.display = 'block';
}

// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
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
    const timeSlot = document.getElementById('editTimeSlot').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value;
    
    const dayCheckboxes = document.querySelectorAll('input[name="editDays"]:checked');
    const days = Array.from(dayCheckboxes).map(cb => cb.value).join(',');

    if (!className || !timeSlot || !days || !startDate || !endDate) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({
                class_name: className,
                location,
                time_slot: timeSlot,
                days,
                start_date: startDate,
                end_date: endDate
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        alert('✓ Class updated successfully!');
        closeEditModal();
        await loadEvents();
    } catch (err) {
        console.error('Error updating event:', err);
        alert('Failed to update class');
    }
}

// Delete event function
function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        deleteEventAPI(eventId)
            .then(response => {
                alert('Event deleted successfully');
                loadEvents();
            })
            .catch(err => {
                alert('Failed to delete event: ' + err.message);
            });
    }
}
