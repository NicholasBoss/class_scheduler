// Auto-select semester based on current date
function autoSelectSemester() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    let selectedSemester = null;

    if (month === 9 || (month > 9) || (month === 1 && day < 1) || (month === 12 && day > 31)) {
        selectedSemester = 'Fall';
    } else if ((month >= 1 && month <= 4) || (month === 4 && day <= 30)) {
        selectedSemester = 'Winter';
    } else if ((month >= 4 && month <= 7) || (month === 7 && day <= 31)) {
        selectedSemester = 'Spring';
    }

    if (selectedSemester) {
        const semesterSelect = document.getElementById('semester');
        semesterSelect.value = selectedSemester;
        semesterSelect.dispatchEvent(new Event('change'));
    }
}

// Semester change handler
function setupSemesterListener() {
    document.getElementById('semester').addEventListener('change', (e) => {
        const sem = e.target.value;
        const currentYear = new Date().getFullYear();
        if (sem && semesterDates[sem]) {
            document.getElementById('beginDate').value = `${currentYear}-${semesterDates[sem].start}`;
            document.getElementById('endDate').value = `${currentYear}-${semesterDates[sem].end}`;
        }
    });
}
