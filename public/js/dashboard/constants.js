// API_BASE_URL is set by the EJS template, default to /api if not available
if (typeof API_BASE_URL === 'undefined') {
    window.API_BASE_URL = '/api';
}

// Valid building codes
const VALID_BUILDING_CODES = {
    'KIM': 'Kimball',
    'TAY': 'Taylor',
    'SPO': 'Spori',
    'ROM': 'Romney',
    'SNO': 'Snow',
    'HRT': 'Hart',
    'BCTR': 'BYU-I Center',
    'BEN': 'Benson',
    'MC': 'Manwaring Center',
    'STC': 'Science and Technology Center',
    'SMI': 'Smith',
    'HIN': 'Hinkley',
    'RKS': 'Ricks',
    'ETC': 'Engineering and Technology Center',
    'AUS': 'Austin',
    'CLK': 'Clarke'
};

const semesterDates = {
    Fall: { start: '09-01', end: '12-31' },
    Winter: { start: '01-01', end: '04-30' },
    Spring: { start: '04-01', end: '07-31' }
};