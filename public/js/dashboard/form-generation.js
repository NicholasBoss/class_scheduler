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
                                <input type="text" id="roomNumber${i}" name="roomNumber${i}" placeholder="e.g., 101">
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
                <label for="timeSlot${i}">Time Slot</label>
                <select id="timeSlot${i}" name="timeSlot${i}" required>
                    <option value="">Select Days First, Then Choose Time</option>
                </select>
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
            });
        });

        // Attach change listeners to day checkboxes
        const dayCheckboxes = document.querySelectorAll(`input[name="days${i}"]`);
        dayCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                updateTimeSlots(i);
            });
        });
    }
}