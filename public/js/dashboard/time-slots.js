// Get time slots based on selected days
function getTimeSlots(selectedDays) {
    if (!selectedDays || selectedDays.length === 0) {
        return [];
    }

    const hasTuesday = selectedDays.includes('Tuesday');
    const hasThursday = selectedDays.includes('Thursday');
    const hasMWF = selectedDays.some(day => ['Monday', 'Wednesday', 'Friday'].includes(day));

    if ((hasTuesday || hasThursday) && !hasMWF) {
        return [
            { value: '7:45 AM - 8:45 AM', label: '7:45 AM - 8:45 AM (1 hour)' },
            { value: '8:00 AM - 9:30 AM', label: '8:00 AM - 9:30 AM (1.5 hours)' },
            { value: '9:00 AM - 10:00 AM', label: '9:00 AM - 10:00 AM (1 hour)' },
            { value: '9:45 AM - 11:15 AM', label: '9:45 AM - 11:15 AM (1.5 hours)' },
            { value: '10:15 AM - 11:15 AM', label: '10:15 AM - 11:15 AM (1 hour)' },
            { value: '12:45 PM - 1:45 PM', label: '12:45 PM - 1:45 PM (1 hour)' },
            { value: '1:00 PM - 2:30 PM', label: '1:00 PM - 2:30 PM (1.5 hours)' },
            { value: '2:00 PM - 3:00 PM', label: '2:00 PM - 3:00 PM (1 hour)' },
            { value: '2:45 PM - 4:15 PM', label: '2:45 PM - 4:15 PM (1.5 hours)' },
            { value: '3:15 PM - 4:15 PM', label: '3:15 PM - 4:15 PM (1 hour)' }
        ];
    } else {
        return [
            { value: '7:45 AM - 8:45 AM', label: '7:45 AM - 8:45 AM' },
            { value: '9:00 AM - 10:00 AM', label: '9:00 AM - 10:00 AM' },
            { value: '10:15 AM - 11:15 AM', label: '10:15 AM - 11:15 AM' },
            { value: '11:30 AM - 12:30 PM', label: '11:30 AM - 12:30 PM' },
            { value: '12:45 PM - 1:45 PM', label: '12:45 PM - 1:45 PM' },
            { value: '2:00 PM - 3:00 PM', label: '2:00 PM - 3:00 PM' },
            { value: '3:15 PM - 4:15 PM', label: '3:15 PM - 4:15 PM' },
            { value: '4:30 PM - 5:30 PM', label: '4:30 PM - 5:30 PM' }
        ];
    }
}

// Update time slots when days change
function updateTimeSlots(classIndex) {
    const dayCheckboxes = document.querySelectorAll(`input[name="days${classIndex}"]:checked`);
    const selectedDays = Array.from(dayCheckboxes).map(cb => cb.value);
    const timeSlots = getTimeSlots(selectedDays);
    const timeSelect = document.getElementById(`timeSlot${classIndex}`);

    timeSelect.innerHTML = '<option value="">Select Days First, Then Choose Time</option>';
    timeSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.value;
        option.textContent = slot.label;
        timeSelect.appendChild(option);
    });
}