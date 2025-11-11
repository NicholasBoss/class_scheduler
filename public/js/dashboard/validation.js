// Validate location format and building code
function validateLocation(location) {
    if (!location || location.trim() === '') {
        return { valid: false, error: 'Location is required' };
    }

    const trimmed = location.trim().toUpperCase();
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
        return { 
            valid: false, 
            error: `Invalid location format. Expected: "BUILDING ROOM" (e.g., "KIM 101")\n\nValid buildings: ${Object.keys(VALID_BUILDING_CODES).join(', ')}` 
        };
    }

    const buildingCode = parts[0];
    const room = parts.slice(1).join(' ');

    if (!VALID_BUILDING_CODES[buildingCode]) {
        return { 
            valid: false, 
            error: `Invalid building code: "${buildingCode}"\n\nValid buildings:\n${Object.entries(VALID_BUILDING_CODES).map(([code, name]) => `${code} - ${name}`).join('\n')}` 
        };
    }

    if (!room || !/^\d+/.test(room)) {
        return { 
            valid: false, 
            error: `Invalid room number. Format should be: "${buildingCode} ROOM_NUMBER"\n\nExample: "KIM 101"` 
        };
    }

    return { 
        valid: true, 
        formatted: `${buildingCode} ${room}`,
        building: VALID_BUILDING_CODES[buildingCode]
    };
}
