// Form Data Persistence Module
// Manages saving and restoring class form data to prevent data loss when regenerating forms

const FormDataPersistence = (() => {
    const STORAGE_KEY = 'classSchedulerFormData';
    
    /**
     * Save all current form data to storage
     */
    function saveFormData() {
        const numClasses = parseInt(document.getElementById('numClasses').value) || 0;
        const formData = {
            semester: document.getElementById('semester').value,
            numClasses: numClasses,
            beginDate: document.getElementById('beginDate').value,
            endDate: document.getElementById('endDate').value,
            calendarSelection: document.getElementById('calendarSelection')?.value || '',
            classes: []
        };

        // Collect data for each class
        for (let i = 0; i < numClasses; i++) {
            const classData = getClassFormData(i);
            if (classData) {
                formData.classes.push(classData);
            }
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        // console.log('Form data saved:', formData);
    }

    /**
     * Get data for a specific class form
     */
    function getClassFormData(index) {
        try {
            const className = document.getElementById(`className${index}`)?.value || '';
            const buildingCode = document.getElementById(`buildingCode${index}`)?.value || '';
            const roomNumber = document.getElementById(`roomNumber${index}`)?.value || '';
            const manualLocation = document.getElementById(`location${index}`)?.value || '';
            
            const dayCheckboxes = document.querySelectorAll(`input[name="days${index}"]:checked`);
            const days = Array.from(dayCheckboxes).map(cb => cb.value);
            
            const timeSlot = document.getElementById(`timeSlot${index}`)?.value || '';
            
            // Determine which location mode is active
            const simpleForm = document.getElementById(`locationSimple${index}`);
            const isSimpleMode = simpleForm && simpleForm.style.display !== 'none';
            
            // Determine which time mode is active
            const presetForm = document.getElementById(`timePreset${index}`);
            const isPresetTimeMode = presetForm && presetForm.style.display !== 'none';
            
            // Get custom time values if custom mode is active
            let customStartTime = '';
            let customEndTime = '';
            if (!isPresetTimeMode) {
                customStartTime = document.getElementById(`customStartTime${index}`)?.value || '';
                customEndTime = document.getElementById(`customEndTime${index}`)?.value || '';
            }

            return {
                className,
                buildingCode,
                roomNumber,
                manualLocation,
                days,
                timeSlot,
                isSimpleMode,
                isPresetTimeMode,
                customStartTime,
                customEndTime,
                reminder30min: document.getElementById(`reminder30min${index}`)?.checked || false,
                reminder1hr: document.getElementById(`reminder1hr${index}`)?.checked || false
            };
        } catch (e) {
            console.warn(`Error collecting class ${index} data:`, e);
            return null;
        }
    }

    /**
     * Retrieve all saved form data
     */
    function getFormData() {
        const data = sessionStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Restore form data after regeneration
     */
    function restoreFormData() {
        const formData = getFormData();
        if (!formData) {
            // console.log('No saved form data to restore');
            return;
        }

        // console.log('Restoring form data:', formData);

        try {
            // Restore top-level form fields
            if (formData.beginDate) {
                document.getElementById('beginDate').value = formData.beginDate;
            }
            if (formData.endDate) {
                document.getElementById('endDate').value = formData.endDate;
            }
            if (formData.calendarSelection) {
                const calendarSelect = document.getElementById('calendarSelection');
                if (calendarSelect) {
                    calendarSelect.value = formData.calendarSelection;
                }
            }

            // Restore class-specific data
            const numClasses = parseInt(document.getElementById('numClasses').value) || 0;
            for (let i = 0; i < numClasses && i < formData.classes.length; i++) {
                restoreClassFormData(i, formData.classes[i]);
            }
        } catch (e) {
            console.error('Error restoring form data:', e);
        }
    }

    /**
     * Restore data for a specific class form
     */
    function restoreClassFormData(index, classData) {
        if (!classData) return;

        try {
            // Restore class name
            if (classData.className) {
                const classNameInput = document.getElementById(`className${index}`);
                if (classNameInput) {
                    classNameInput.value = classData.className;
                }
            }

            // Restore location
            const simpleForm = document.getElementById(`locationSimple${index}`);
            const manualForm = document.getElementById(`locationManual${index}`);
            
            if (classData.isSimpleMode !== undefined) {
                if (classData.isSimpleMode) {
                    if (simpleForm) simpleForm.style.display = 'block';
                    if (manualForm) manualForm.style.display = 'none';
                } else {
                    if (simpleForm) simpleForm.style.display = 'none';
                    if (manualForm) manualForm.style.display = 'block';
                }
            }

            if (classData.buildingCode) {
                const buildingSelect = document.getElementById(`buildingCode${index}`);
                if (buildingSelect) {
                    buildingSelect.value = classData.buildingCode;
                }
            }

            if (classData.roomNumber) {
                const roomInput = document.getElementById(`roomNumber${index}`);
                if (roomInput) {
                    roomInput.value = classData.roomNumber;
                }
            }

            if (classData.manualLocation) {
                const locationInput = document.getElementById(`location${index}`);
                if (locationInput) {
                    locationInput.value = classData.manualLocation;
                }
            }

            // Restore time mode (preset vs custom)
            const presetForm = document.getElementById(`timePreset${index}`);
            const customForm = document.getElementById(`timeCustom${index}`);
            
            if (classData.isPresetTimeMode !== undefined) {
                if (classData.isPresetTimeMode) {
                    if (presetForm) presetForm.style.display = 'block';
                    if (customForm) customForm.style.display = 'none';
                } else {
                    if (presetForm) presetForm.style.display = 'none';
                    if (customForm) customForm.style.display = 'block';
                }
            }

            // Restore days
            if (classData.days && Array.isArray(classData.days)) {
                const dayCheckboxes = document.querySelectorAll(`input[name="days${index}"]`);
                dayCheckboxes.forEach(checkbox => {
                    checkbox.checked = classData.days.includes(checkbox.value);
                });
                
                // Update time slots after restoring days
                setTimeout(() => {
                    updateTimeSlots(index);
                }, 0);
            }

            // Restore time slot (after days are set and time slots are updated)
            if (classData.timeSlot && classData.isPresetTimeMode !== false) {
                setTimeout(() => {
                    const timeSlotSelect = document.getElementById(`timeSlot${index}`);
                    if (timeSlotSelect) {
                        timeSlotSelect.value = classData.timeSlot;
                    }
                }, 50);
            }

            // Restore custom times if custom mode
            if (classData.customStartTime && classData.customEndTime && classData.isPresetTimeMode === false) {
                setTimeout(() => {
                    const startInput = document.getElementById(`customStartTime${index}`);
                    const endInput = document.getElementById(`customEndTime${index}`);
                    if (startInput) startInput.value = classData.customStartTime;
                    if (endInput) endInput.value = classData.customEndTime;
                }, 50);
            }

            // Restore reminders
            if (classData.reminder30min) {
                const reminder30 = document.getElementById(`reminder30min${index}`);
                if (reminder30) reminder30.checked = true;
            }
            if (classData.reminder1hr) {
                const reminder60 = document.getElementById(`reminder1hr${index}`);
                if (reminder60) reminder60.checked = true;
            }
        } catch (e) {
            console.warn(`Error restoring class ${index} data:`, e);
        }
    }

    /**
     * Clear all saved form data
     */
    function clearFormData() {
        sessionStorage.removeItem(STORAGE_KEY);
        // console.log('Form data cleared');
    }

    // Public API
    return {
        save: saveFormData,
        restore: restoreFormData,
        get: getFormData,
        clear: clearFormData
    };
})();
