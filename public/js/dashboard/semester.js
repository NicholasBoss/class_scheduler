// Auto-select semester based on current date
function autoSelectSemester() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    let selectedSemester = null;
    let yearOffset = 0;

    // Determine current semester and if we need next year's dates
    if (month >= 9 || month === 12) {
        // Fall semester (Sept - Dec)
        selectedSemester = 'Fall';
        // Fall is in the current year, so no offset
        yearOffset = 0;
    } else if (month >= 1 && month <= 4 && !(month === 4 && day > 30)) {
        // Winter semester (Jan - April 30)
        selectedSemester = 'Winter';
        // Winter is in the current year
        yearOffset = 0;
    } else if (month >= 4 && month <= 7 && !(month === 7 && day > 31)) {
        // Spring semester (April 1 - July 31)
        selectedSemester = 'Spring';
        // Spring is in the current year
        yearOffset = 0;
    } else if (month > 7 && month < 9) {
        // Between July 31 and Sept 1 - next Fall
        selectedSemester = 'Fall';
        yearOffset = 1;
    } else if (month === 4 && day > 30) {
        // After April 30 - next Spring
        selectedSemester = 'Spring';
        yearOffset = 1;
    } else if (month === 7 && day > 31) {
        // After July 31 - next Fall
        selectedSemester = 'Fall';
        yearOffset = 1;
    }

    if (selectedSemester) {
        const semesterSelect = document.getElementById('semester');
        semesterSelect.value = selectedSemester;
        // Store the year offset for later use
        semesterSelect.dataset.yearOffset = yearOffset;
        semesterSelect.dispatchEvent(new Event('change'));
    }
}

// Helper function to determine which year a semester should use
function getYearForSemester(semesterName) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    let currentYear = today.getFullYear();
    
    // Parse semester end date (mm-dd format)
    const semesterEnd = semesterDates[semesterName].end; // e.g., "04-30"
    const [endMonth, endDay] = semesterEnd.split('-').map(Number);
    
    // Check if current date is past this semester's end date
    const isPastSemester = (month > endMonth) || (month === endMonth && day > endDay);
    
    // If we're past this semester's end date in the current year, use next year
    if (isPastSemester) {
        return currentYear + 1;
    }
    
    return currentYear;
}

// Semester change handler
function setupSemesterListener() {
    document.getElementById('semester').addEventListener('change', async (e) => {
        const sem = e.target.value;
        
        if (sem && semesterDates[sem]) {
            const year = getYearForSemester(sem);
            document.getElementById('beginDate').value = `${year}-${semesterDates[sem].start}`;
            document.getElementById('endDate').value = `${year}-${semesterDates[sem].end}`;
            
            // Refresh available calendars for this semester
            await CalendarSelection.refreshCalendarsForSemester(sem);
        }
    });
}

