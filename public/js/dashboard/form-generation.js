// Generate class forms
function generateClassForms(numClasses) {
    const container = document.getElementById('classesContainer');
    container.innerHTML = '';

    for (let i = 0; i < numClasses; i++) {
        const classForm = document.createElement('div');
        classForm.className = 'class-form';
        classForm.innerHTML = `
            <h3>Class ${i + 1}</h3>
            
            <div class="form-group">
                <label for="className${i}">Class Name</label>
                <input type="text" id="className${i}" name="className${i}" placeholder="e.g., CSE 499" required>
            </div>

            <div class="form-group">
                <label>Location</label>
                <div class="location-input-group">
                    <div class="location-form-simple" id="locationSimple${i}">
                        <div class="location-row">
                            <div>
                                <label for="buildingCode${i}">Building</label>
                                <select id="buildingCode${i}" name="buildingCode${i}">
                                    <option value="">Select Building</option>
                                    <option value="AUS">AUS - Austin</option>
                                    <option value="BCTR">BCTR - BYU-I Center</option>
                                    <option value="BEN">BEN - Benson</option>
                                    <option value="CLK">CLK - Clarke</option>
                                    <option value="ETC">ETC - Engineering and Technology Center</option>
                                    <option value="HIN">HIN - Hinkley</option>
                                    <option value="KIM">KIM - Kimball</option>
                                    <option value="MC">MC - Manwaring Center</option>
                                    <option value="RKS">RKS - Ricks</option>
                                    <option value="ROM">ROM - Romney</option>
                                    <option value="SMI">SMI - Smith</option>
                                    <option value="SNO">SNO - Snow</option>
                                    <option value="SPO">SPO - Spori</option>
                                    <option value="STC">STC - Science and Technology Center</option>
                                    <option value="TAY">TAY - Taylor</option>
                                </select>
                            </div>
                            <div>
                                <label for="roomNumber${i}">Room Number</label>
                                <input type="text" id="roomNumber${i}" name="roomNumber${i}" placeholder="e.g., 101 or CT5">
                            </div>
                        </div>
                        <button type="button" class="toggle-location-btn" data-class-index="${i}">Or Enter Manually</button>
                    </div>
                    <div class="location-form-manual" id="locationManual${i}" style="display: none;">
                        <input type="text" id="location${i}" name="location${i}" placeholder="e.g., KIM 101">
                        <button type="button" class="toggle-location-btn" data-class-index="${i}">Use Dropdown</button>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Days of Week</label>
                <div class="days-select">
                    <label><input type="checkbox" name="days${i}" value="Monday"> Monday</label>
                    <label><input type="checkbox" name="days${i}" value="Tuesday"> Tuesday</label>
                    <label><input type="checkbox" name="days${i}" value="Wednesday"> Wednesday</label>
                    <label><input type="checkbox" name="days${i}" value="Thursday"> Thursday</label>
                    <label><input type="checkbox" name="days${i}" value="Friday"> Friday</label>
                </div>
            </div>

            <div class="form-group">
                <label>Time Slot</label>
                <div class="time-slot-input-group">
                    <div class="time-form-preset" id="timePreset${i}">
                        <select id="timeSlot${i}" name="timeSlot${i}">
                            <option value="">Select Days, Then Choose Time</option>
                        </select>
                        <button type="button" class="toggle-time-btn" data-class-index="${i}">Or Enter Custom Time</button>
                    </div>
                    <div class="time-form-custom" id="timeCustom${i}" style="display: none;">
                        <div class="custom-time-input">
                            <input type="time" id="customStartTime${i}" name="customStartTime${i}">
                            <input type="time" id="customEndTime${i}" name="customEndTime${i}">
                        </div>
                        <button type="button" class="toggle-time-btn" data-class-index="${i}">Use Preset Times</button>
                    </div>
                </div>
            </div>
            <div class="info-message">
                <strong>Note:</strong> By default, reminders have a 15 minute lead time. You can add additional reminders below. For more options, please use Google Calendar directly.
            </div>
            <div class="form-group">
                <label>Reminders</label>
                <div class="reminder-options">
                    <label><input type="checkbox" id="reminder30min${i}" name="reminder30min${i}" value="30"> 30 min</label>
                    <label><input type="checkbox" id="reminder1hr${i}" name="reminder1hr${i}" value="60"> 1 hr</label>
                </div>
            </div>
        `;
        container.appendChild(classForm);

        // Attach location toggle listeners
        const locationToggleButtons = classForm.querySelectorAll('.toggle-location-btn');
        locationToggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const classIdx = parseInt(e.target.dataset.classIndex);
                const simpleForm = document.getElementById(`locationSimple${classIdx}`);
                const manualForm = document.getElementById(`locationManual${classIdx}`);
                
                if (simpleForm.style.display !== 'none') {
                    simpleForm.style.display = 'none';
                    manualForm.style.display = 'block';
                } else {
                    simpleForm.style.display = 'block';
                    manualForm.style.display = 'none';
                }
                
                // Save form data after toggling location mode
                FormDataPersistence.save();
            });
        });

        // Attach time toggle listeners
        const timeToggleButtons = classForm.querySelectorAll('.toggle-time-btn');
        timeToggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const classIdx = parseInt(e.target.dataset.classIndex);
                const presetForm = document.getElementById(`timePreset${classIdx}`);
                const customForm = document.getElementById(`timeCustom${classIdx}`);
                
                if (presetForm.style.display !== 'none') {
                    presetForm.style.display = 'none';
                    customForm.style.display = 'block';
                } else {
                    presetForm.style.display = 'block';
                    customForm.style.display = 'none';
                }
                
                FormDataPersistence.save();
            });
        });

        // Attach listener to custom start time to auto-set end time
        const customStartTime = document.getElementById(`customStartTime${i}`);
        if (customStartTime) {
            customStartTime.addEventListener('change', (e) => {
                const startTime = e.target.value;
                if (startTime) {
                    // Calculate end time (1 hour later)
                    const [hours, minutes] = startTime.split(':');
                    const endHour = (parseInt(hours) + 1).toString().padStart(2, '0');
                    const endTime = `${endHour}:${minutes}`;
                    
                    const endTimeInput = document.getElementById(`customEndTime${i}`);
                    endTimeInput.value = endTime;
                    
                    FormDataPersistence.save();
                }
            });
        }

        // Attach change listeners to day checkboxes
        const dayCheckboxes = document.querySelectorAll(`input[name="days${i}"]`);
        dayCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                updateTimeSlots(i);
                // Save form data when days change
                FormDataPersistence.save();
            });
        });

        // Attach listener to time slot selector
        const timeSlotSelect = document.getElementById(`timeSlot${i}`);
        timeSlotSelect.addEventListener('change', () => {
            FormDataPersistence.save();
        });

        // Attach listeners to reminder checkboxes
        const reminder30min = document.getElementById(`reminder30min${i}`);
        const reminder1hr = document.getElementById(`reminder1hr${i}`);
        
        if (reminder30min) {
            reminder30min.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
        
        if (reminder1hr) {
            reminder1hr.addEventListener('change', () => {
                FormDataPersistence.save();
            });
        }
    }

    // Restore previously saved form data after generating new forms
    FormDataPersistence.restore();
    
    // Setup event listeners for the newly generated form fields
    setupClassFormListeners();
}