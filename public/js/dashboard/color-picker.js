// Color Picker Module
const ColorPicker = (() => {
    let allColors = [];
    let selectedCalendarId = null;
    let selectedCalendarName = null;

    // Initialize color picker
    async function init() {
        // console.log('🎨 Initializing ColorPicker module...');
        await fetchAvailableColors();
    }

    // Fetch available colors from backend
    async function fetchAvailableColors() {
        try {
            // console.log('🌈 Fetching available colors from API...');
            const response = await fetch(`${API_BASE_URL}/events/colors/list`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            allColors = await response.json();
            // console.log(`✓ Fetched ${allColors.length} colors`);
            // allColors.forEach(c => console.log(`  ${c.id}: ${c.hex}`));
        } catch (err) {
            console.error('Error fetching colors:', err);
            allColors = [];
        }
    }

    // Open color picker modal for a calendar
    async function openModal(calendarId, calendarName, currentColorId = null) {
        // console.log(`📂 Opening modal: calendar=${calendarName}, currentColorId=${currentColorId}`);
        
        selectedCalendarId = calendarId;
        selectedCalendarName = calendarName;

        const modal = document.getElementById('colorPickerModal');
        if (!modal) {
            console.error('❌ Color picker modal not found');
            return;
        }

        // Ensure colors are loaded
        if (!allColors || allColors.length === 0) {
            // console.log('🔄 Colors not loaded, fetching...');
            await fetchAvailableColors();
        }

        // console.log(`  Have ${allColors.length} colors available`);
        
        // Update modal title
        document.querySelector('#colorPickerModal .modal-header h2').textContent = 
            `Select Color for ${calendarName}`;

        // Render color buttons
        renderColorGrid(currentColorId);

        // Show modal
        modal.style.display = 'flex';
        // console.log('✓ Modal displayed');
    }

    // Close the modal
    function closeModal() {
        const modal = document.getElementById('colorPickerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Render color grid
    function renderColorGrid(currentColorId = null) {
        const colorGrid = document.getElementById('colorGrid');
        if (!colorGrid) {
            console.error('❌ Color grid container not found');
            return;
        }

        colorGrid.innerHTML = '';

        // Check if colors are available
        if (!allColors || !Array.isArray(allColors) || allColors.length === 0) {
            console.error('❌ No colors available');
            colorGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Unable to load colors. Please try again.</p>';
            return;
        }

        // Ensure currentColorId is a string for comparison
        const normalizedCurrentId = String(currentColorId || '');
        // console.log(`🎨 Rendering grid with current selection: "${normalizedCurrentId}"`);

        allColors.forEach(color => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'color-button';
            button.style.backgroundColor = color.hex;
            button.title = `Color ${color.id}`;
            
            // Mark current color as selected - compare as strings
            const colorIdStr = String(color.id);
            if (colorIdStr === normalizedCurrentId) {
                button.classList.add('selected');
                // console.log(`  ✓ Color ${color.id} SELECTED`);
            }

            button.addEventListener('click', (e) => {
                e.preventDefault();
                selectColor(color.id, color.hex);
            });

            colorGrid.appendChild(button);
        });
    }

    // Handle color selection
    async function selectColor(colorId, colorHex) {
        // console.log(`🎯 selectColor called: colorId=${colorId}, hex=${colorHex}`);
        
        if (!selectedCalendarId) {
            console.error('❌ No calendar selected');
            alert('No calendar selected');
            return;
        }

        try {
            // Show loading state
            const modal = document.getElementById('colorPickerModal');
            const saveBtn = modal.querySelector('.btn-save-color');
            // const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            // console.log(`📡 Sending PUT to /events/calendars/${selectedCalendarId}/color`);
            
            // Call backend to update color
            const response = await fetch(
                `${API_BASE_URL}/events/calendars/${selectedCalendarId}/color`,
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ colorId: colorId })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // const result = await response.json();
            // console.log('✓ Server response:', result);

            // Update visual feedback
            updateColorButtonSelection(colorId);

            // Show success message
            showSuccessMessage(`Color updated for ${selectedCalendarName}`);

            // Close modal and refresh page after short delay
            // console.log('⏳ Reloading page in 1 second...');
            setTimeout(() => {
                // console.log('🔄 PAGE RELOAD');
                closeModal();
                // Reload the page to reflect new color
                location.reload();
            }, 1000);

        } catch (err) {
            console.error('Error updating color:', err);
            alert(`Failed to update color: ${err.message}`);
        } finally {
            const modal = document.getElementById('colorPickerModal');
            if (modal) {
                const saveBtn = modal.querySelector('.btn-save-color');
                saveBtn.textContent = 'Apply Color';
                saveBtn.disabled = false;
            }
        }
    }

    // Update color button visual selection
    function updateColorButtonSelection(colorId) {
        const buttons = document.querySelectorAll('#colorGrid .color-button');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
        });

        // Find and highlight the selected color
        const colorObj = allColors.find(c => c.id === colorId);
        if (colorObj) {
            const button = Array.from(buttons).find(btn => 
                btn.style.backgroundColor.toLowerCase() === colorObj.hex.toLowerCase()
            );
            if (button) {
                button.classList.add('selected');
            }
        }
    }

    // Show success message
    function showSuccessMessage(message) {
        const messageDiv = document.getElementById('colorPickerMessage');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';
            messageDiv.className = 'color-message success';

            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
    }

    // Wrapper for onclick handlers
    function openModalHandler(calendarId, calendarName, colorId) {
        return openModal(calendarId, calendarName, colorId || null);
    }

    return {
        init,
        openModal,
        openModalHandler,
        closeModal,
        fetchAvailableColors
    };
})();
