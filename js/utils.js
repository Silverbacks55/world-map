// utils.js — Pure utility functions: esc, safeUrl, getCountryFlag, normalizeCountryName

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeUrl(url) {
    if (!url || url === 'N/A' || url === 'nan') return null;
    const trimmed = url.trim();
    return (trimmed.startsWith('http://') || trimmed.startsWith('https://')) ? trimmed : null;
}

        function getCountryFlag(countryName) {
            const cleanName = countryName.replace(' (Federal)', '');
            if (usStateToCode[cleanName]) {
                return `https://flagcdn.com/w80/${usStateToCode[cleanName]}.png`;
            }
            const isoCode = countryToISO[cleanName];
            if (isoCode) {
                return `https://flagcdn.com/w80/${isoCode}.png`;
            }
            return null;
        }

        function normalizeCountryName(name) {
            return countryNameMapping[name] || name;
        }

        // ============================================
        // FIX #1: Single loadWorldMap() definition
