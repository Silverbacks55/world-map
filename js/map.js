// map.js — D3 world map initialization, projection, zoom, and renderMap

        // (duplicate that caused a silent race condition is removed)
        // ============================================
        async function loadWorldMap() {
            try {
                const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
                const world = await response.json();
                worldMapData = topojson.feature(world, world.objects.countries);
                worldMapData.features = worldMapData.features.filter(d => d.properties.name !== 'Antarctica');
            } catch (error) {
                console.error('Error loading world map:', error);
            }
        }

        async function loadRegulationsData() {
            if (GOOGLE_SHEETS_URL) {
                const timer = showProgressBar('loadingIndicator', '⏳ Loading regulations data...');
                try {
                    const response = await fetch(GOOGLE_SHEETS_URL);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const csvText = await response.text();
                    const data = parseCSVToJSON(csvText);
                    completeProgressBar('loadingIndicator', timer);
                    return data;
                } catch (error) {
                    completeProgressBar('loadingIndicator', timer);
                    console.error('❌ Error loading Google Sheets data:', error);
                    alert(`Could not load regulations data from Google Sheets.\n\nError: ${error.message}\n\nUsing embedded test data instead.`);
                    return {...sampleData};
                }
            } else {
                return {...sampleData};
            }
        }

        // ============================================
        // REQUIRED CSV HEADERS - update if sheet columns change
        // ============================================
        const REQUIRED_CSV_HEADERS = [
            'Name of regulation',
            'Jurisdiction',
            'Description'
        ];

        function parseCSVToJSON(csvText) {
            // FIX #2: Strip carriage returns before splitting to handle
            // Windows-style line endings (\r\n) from Google Sheets exports
            const lines = csvText.replace(/\r/g, '').split('\n');
            const headers = parseCSVLine(lines[0]).map(h => h.trim());

            // FIX #4: Validate that required headers are present before parsing
            const missingHeaders = REQUIRED_CSV_HEADERS.filter(required =>
                !headers.some(h => h.toLowerCase() === required.toLowerCase())
            );
            if (missingHeaders.length > 0) {
                console.error('❌ CSV is missing required headers:', missingHeaders);
                console.error('   Found headers:', headers);
                throw new Error(
                    `Spreadsheet is missing required columns: ${missingHeaders.join(', ')}. ` +
                    `Please check that column names match exactly.`
                );
            }
            
            const countryData = {};
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = parseCSVLine(line);
                if (values.length < headers.length) continue;
                
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                
                let country = row['COUNTRY'] || row['Country'] || row['country'] || row['COLUMN2'] || row['Column2'] || 'Unknown';

                if (country.toLowerCase().includes('cote') || 
                    country.toLowerCase().includes('côte') ||
                    country.toLowerCase().includes('ivory')) {
                    country = "Côte d'Ivoire";
                }

                const isEU = row['EU'] || row['EU (Y/N)'] || row['eu'] || '';
                const isEUMember = isEU.toUpperCase().trim() === 'Y';
                
                const pollutants = [];
                if (row['HFC (Y/N)'] && row['HFC (Y/N)'].toUpperCase() === 'Y') pollutants.push('HFC');
                if (row['Tropospheric/ NOx (Y/N)'] && row['Tropospheric/ NOx (Y/N)'].toUpperCase() === 'Y') pollutants.push('NOx');
                if (row['Black Carbon (Y/N)'] && row['Black Carbon (Y/N)'].toUpperCase() === 'Y') pollutants.push('Black Carbon');
                if (row['Methane (Y/N)'] && row['Methane (Y/N)'].toUpperCase() === 'Y') pollutants.push('Methane');
                if (row['Other F Gases (Y/N)'] && row['Other F Gases (Y/N)'].toUpperCase() === 'Y') pollutants.push('Other F-Gases');
                if (row['N2O (Y/N)'] && row['N2O (Y/N)'].toUpperCase() === 'Y') pollutants.push('N2O');
                
                const regName = row['Name of regulation'] || 
                               row['Name of Regulation'] || 
                               row['name of regulation'] ||
                               row['NAME OF REGULATION'] ||
                               row['Name Of Regulation'] || '';
                
                const regulation = {
                    jurisdiction: row['Jurisdiction'] || '',
                    name: regName,
                    pollutants: pollutants.join(', ') || 'None specified',
                    description: row['Description'] || '',
                    impacts_corps: row['Impacts corporations (Y/N)'] || 'N',
                    how_affects: row['How it affects corporations'] || '',
                    date_enacted: row['Date enacted (Year)'] || '',
                    still_in_effect: row['Still in effect (Y/N)'] || 'Y',
                    website: (row['Confirmed URL'] && row['Confirmed URL'].toUpperCase() === 'Y') ? (row['Website / source'] || '') : '',
                    in_english: row['In English'] || 'N',
                    hvac: row['HVAC'] && row['HVAC'].toUpperCase() === 'Y',
                    agriculture: row['Agriculture'] && row['Agriculture'].toUpperCase() === 'Y',
                    trading_tax_systems: row['Trading & Tax Systems'] && row['Trading & Tax Systems'].toUpperCase() === 'Y',
                    fossil_fuel_production: row['Fossil Fuel Production'] && row['Fossil Fuel Production'].toUpperCase() === 'Y',
                    solid_waste: row['Solid Waste'] && row['Solid Waste'].toUpperCase() === 'Y',
                    transportation: row['Transportation'] && row['Transportation'].toUpperCase() === 'Y'
                };
                
                if (!countryData[country]) {
                    countryData[country] = {
                        total_regulations: 0,
                        regulations: [],
                        is_eu_member: isEUMember
                    };
                } else {
                    if (isEUMember && !countryData[country].is_eu_member) {
                        countryData[country].is_eu_member = true;
                    }
                }
                
                countryData[country].regulations.push(regulation);
                countryData[country].total_regulations++;
            }
            
            return countryData;
        }

        function parseCSVLine(line) {
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    // Handle escaped quotes ("") inside quoted fields
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++; // skip the second quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            values.push(current.trim());
            return values;
        }

