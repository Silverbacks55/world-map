// app.js — All application logic: tabs, layers, tooltips, regulations, filters, event handlers

        function renderMap() {
            const svg = d3.select('#worldMap');
            const isMobile = window.innerWidth <= 768;
            const width = isMobile ? 600 : 1200;
            const height = isMobile ? 800 : 600;
            
            svg.attr('viewBox', `0 0 ${width} ${height}`);
            svg.html('');

            svg.append('rect')
                .attr('width', width)
                .attr('height', height)
                .attr('fill', '#e0f7fa')
                .attr('x', 0)
                .attr('y', 0)
                .attr('class', 'ocean')
                .style('cursor', 'pointer')
                .on('click', deselectCountry);

            const mapGroup = svg.append('g');

            const projection = d3.geoNaturalEarth1()
                .scale(isMobile ? 300 : 200)
                .translate(isMobile ? [width / 2 + 50, height / 2 - 50] : [width / 2, height / 2]);

            const pathGenerator = d3.geoPath().projection(projection);

            worldMapData.features.forEach(feature => {
                const countryName = feature.properties.name;
                if (!countryName || countryName === '' || countryName === 'Antarctica') return;
                // Hide the parent country outline when subfederal borders are shown for it
                if (subfederalCountry === countryName) return;
                
                const hasData = Object.keys(countryData).some(key => 
                    normalizeCountryName(key) === countryName || key === countryName
                );
                
                const pathElement = mapGroup.append('path')
                    .datum(feature)
                    .attr('d', pathGenerator)
                    .attr('class', hasData ? 'country has-data' : 'country')
                    .attr('data-country', countryName)
                    .style('cursor', hasData ? 'pointer' : 'default')
                    .on('mouseenter', function(event) {
                        let displayName = countryName;
                        if (countryName === "France") {
                            const [mouseX, mouseY] = d3.pointer(event);
                            const coords = projection.invert([mouseX, mouseY]);
                            const [lon, lat] = coords;
                            if (lon < -20) {
                                displayName = "French Guiana";
                            }
                        }
                        showHoverTooltip(event, displayName);
                    })
                    .on('mousemove', function(event) {
                        moveHoverTooltip(event);
                    })
                    .on('mouseleave', function() {
                        hideHoverTooltip();
                    })
                    .on('click', function(event) {
                        event.stopPropagation();
                        if (!activeTab) {
                            showNoTabMessage(event, this);
                        } else if (activeTab === 'agreements' || activeTab === 'biomethane' || activeTab === 'carbon') {
                            selectCountry(event, countryName, this);
                        } else if (hasData) {
                            selectCountry(event, countryName, this);
                        }
                    });
                
                if (selectedCountry === countryName) {
                    pathElement.classed('selected', true);
                }
            });

            // Subfederal rendering for US / Canada / Mexico
            const subfederalDatasets = [
                { country: 'United States of America', dataKey: 'United States', geoData: usStatesData },
                { country: 'Canada',                   dataKey: 'Canada',        geoData: canadaProvincesData },
                { country: 'Mexico',                   dataKey: 'Mexico',        geoData: mexicoStatesData }
            ];
            subfederalDatasets.forEach(({ country, dataKey, geoData }) => {
                if (subfederalCountry !== country || !geoData) return;
                geoData.features.forEach(feature => {
                    const subdivName = getSubdivisionName(feature);
                    if (!subdivName) return;
                    const parentData = countryData[dataKey];
                    const hasData = parentData && parentData.regulations && parentData.regulations.some(reg =>
                        reg.jurisdiction.toLowerCase().includes(subdivName.toLowerCase())
                    );
                    const pathElement = mapGroup.append('path')
                        .datum(feature)
                        .attr('d', pathGenerator)
                        .attr('class', hasData ? 'country has-data' : 'country')
                        .attr('data-state', subdivName)
                        .attr('data-country-parent', country)
                        .style('cursor', hasData ? 'pointer' : 'default')
                        .on('mouseenter', function(event) { showHoverTooltip(event, subdivName); })
                        .on('mousemove', function(event)  { moveHoverTooltip(event); })
                        .on('mouseleave', function()      { hideHoverTooltip(); })
                        .on('click', function(event) {
                            event.stopPropagation();
                            if (hasData) selectSubdivision(event, subdivName, dataKey, this);
                        });
                    if (selectedCountry === subdivName) pathElement.classed('selected', true);
                });
            });

            const minZoom = isMobile ? 1.5 : 1;
            const maxZoom = isMobile ? 10 : 8;
            
            zoomBehavior = d3.zoom()
                .scaleExtent([minZoom, maxZoom])
                .on('zoom', (event) => {
                    mapGroup.attr('transform', event.transform);
                });

            svg.call(zoomBehavior);
            
            if (isMobile) {
                svg.call(zoomBehavior.transform, d3.zoomIdentity.scale(2.5));
            }
            
            setTimeout(() => updateCountryHighlighting(), 100);
            // Reapply CH4 colours if layer is active (renderMap wipes inline styles)
            if (ch4LayerActive) updateCH4Layer();
            if (activeTab === 'biomethane') updateBiomethaneLayer();
            if (activeTab === 'carbon') updateVCMLayer();
        }

        function ensureTooltipsInBody() {
            const t  = document.getElementById('tooltip');
            const ht = document.getElementById('hoverTooltip');
            if (t  && t.parentNode  !== document.body) document.body.appendChild(t);
            if (ht && ht.parentNode !== document.body) document.body.appendChild(ht);
        }

        function showCH4Data(event, mapCountryName) {
            ensureTooltipsInBody();
            ch4PopupCountry = mapCountryName;

            const tooltip         = document.getElementById('tooltip');
            const tooltipCountry  = document.getElementById('tooltipCountry');
            const tooltipContent  = document.getElementById('tooltipContent');
            const tooltipNav      = document.getElementById('tooltipNav');
            const industryFilters = document.getElementById('industryFilters');
            const timelineToggle  = document.getElementById('timelineToggle');

            const flagUrl = getCountryFlag(mapCountryName);
            tooltipCountry.innerHTML = flagUrl
                ? '<span>' + mapCountryName + '</span><img src="' + flagUrl + '" alt="' + mapCountryName + ' flag" class="country-flag">'
                : mapCountryName;

            tooltipNav.style.display      = 'none';
            industryFilters.style.display = 'none';
            hideVCMFilters();
            timelineToggle.style.display  = 'none';
            isTimelineView = false;

            const tkey       = getCH4Key(mapCountryName);
            const skey       = getCH4SectorsKey(mapCountryName);
            const totalEntry = tkey ? ch4TotalsData[tkey] : null;
            const sectors    = skey ? (ch4SectorsData[skey] || []) : [];
            const yearKey    = 'ch4_' + ch4Year;
            const total      = totalEntry ? (totalEntry[yearKey] || 0) : 0;

            if (!totalEntry && !sectors.length) {
                tooltipContent.innerHTML = '<div style="padding:30px 20px;text-align:center;"><p style="color:#9ca3af;font-style:italic;font-size:0.9em;">No CH\u2084 emissions data available for ' + esc(mapCountryName) + '</p></div>';
                if (event) positionTooltip(event);
                tooltip.classList.add('visible');
                return;
            }

            const sorted = [...sectors]
                .filter(function(s) { return (s[yearKey] || 0) > 0; })
                .sort(function(a, b) { return (b[yearKey] || 0) - (a[yearKey] || 0); });

            const maxPct = (sorted.length && total) ? (sorted[0][yearKey] / total * 100) : 100;

            let html = '<div style="padding:4px 2px;">'
                + '<div style="background:#f0fdf4;border-left:4px solid #065f46;border-radius:4px;padding:10px 12px;margin-bottom:14px;">'
                + '<p style="margin:0;font-size:1em;font-weight:700;color:#065f46;">CH\u2084 Emissions \u2014 ' + esc(ch4Year) + '</p>'
                + (total ? '<p style="margin:5px 0 0;font-size:1.3em;font-weight:700;color:#374151;">' + Math.round(total).toLocaleString() + ' <span style="font-size:0.6em;font-weight:400;color:#6b7280;">kt CH\u2084/yr</span></p>' : '')
                + '<p style="margin:5px 0 0;font-size:0.72em;color:#9ca3af;">Source: EDGAR &middot; sector = <em>' + (ch4Sector === 'total' ? 'All Sectors' : esc(ch4Sector)) + '</em></p>'
                + '</div>';

            if (sorted.length) {
                html += '<p style="margin:0 0 10px;font-size:0.82em;font-weight:600;color:#374151;letter-spacing:0.03em;text-transform:uppercase;">Sectoral breakdown</p>';
                sorted.forEach(function(s) {
                    const val    = s[yearKey] || 0;
                    const pct    = total ? (val / total * 100) : 0;
                    const barW   = Math.min(100, Math.max(0.5, pct));
                    const colour = d3.interpolateYlOrRd(Math.min(1, pct / maxPct));
                    const label  = s.sector_name.replace(/^[\dA-Z][.\dA-Z]*\s+/, '');
                    html += '<div style="margin-bottom:11px;">'
                        + '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:0.8em;margin-bottom:3px;gap:8px;">'
                        + '<span style="color:#374151;line-height:1.3;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(label) + '">' + esc(label) + '</span>'
                        + '<span style="color:#374151;font-weight:700;white-space:nowrap;">' + pct.toFixed(1) + '% <span style="color:#9ca3af;font-weight:400;font-size:0.9em;">' + Math.round(val).toLocaleString() + ' kt</span></span>'
                        + '</div>'
                        + '<div style="background:#e5e7eb;border-radius:4px;height:9px;overflow:hidden;">'
                        + '<div style="background:' + colour + ';width:' + barW + '%;height:100%;border-radius:4px;transition:width 0.4s ease;"></div>'
                        + '</div></div>';
                });
            } else {
                html += '<p style="color:#9ca3af;font-style:italic;font-size:0.85em;text-align:center;margin:20px 0;">No sector breakdown available for this year.</p>';
            }

            html += '</div>';
            tooltipContent.innerHTML = html;
            if (event) positionTooltip(event);
            tooltip.classList.add('visible');
        }

        function showAgreementsData(event, countryName) {
            ensureTooltipsInBody();
            const tooltip        = document.getElementById('tooltip');
            const tooltipCountry = document.getElementById('tooltipCountry');
            const tooltipContent = document.getElementById('tooltipContent');
            const tooltipNav     = document.getElementById('tooltipNav');
            const timelineToggle = document.getElementById('timelineToggle');
            const industryFilters = document.getElementById('industryFilters');
            tooltip.classList.add('agreements-tooltip');

            // Country name + flag
            const flagUrl = getCountryFlag(countryName);
            if (flagUrl) {
                tooltipCountry.innerHTML = `<span>${countryName}</span><img src="${flagUrl}" alt="${countryName} flag" class="country-flag">`;
            } else {
                tooltipCountry.textContent = countryName;
            }

            // Hide nav elements not relevant to agreements
            tooltipNav.style.display      = 'none';
            timelineToggle.style.display  = 'none';
            industryFilters.style.display = 'none';
            hideVCMFilters();
            const existingBanner = document.getElementById('topBannerContainer');
            if (existingBanner) existingBanner.remove();

            // Look up agreements in countryData
            let hasKigali = false, kigaliYear = '';
            let hasMethane = false, methaneYear = '';
            for (const key in countryData) {
                if (normalizeCountryName(key) === countryName || key === countryName) {
                    const data = countryData[key];
                    if (data.regulations) {
                        const kigaliReg = data.regulations.find(r =>
                            r.name.toLowerCase().includes(COMMITMENT_REGULATION_NAMES[1]));
                        const methaneReg = data.regulations.find(r =>
                            r.name.toLowerCase().includes(COMMITMENT_REGULATION_NAMES[0]));
                        hasKigali  = !!kigaliReg;
                        kigaliYear = kigaliReg ? kigaliReg.date_enacted : '';
                        hasMethane  = !!methaneReg;
                        methaneYear = methaneReg ? methaneReg.date_enacted : '';
                    }
                    break;
                }
            }

            let html = '<div style="padding: 10px 4px;">';

            if (hasKigali) {
                html += `
                <div style="margin-bottom: 16px;">
                    <a href="https://treaties.un.org/Pages/ViewDetails.aspx?src=IND&mtdsg_no=XXVII-2-f&chapter=27&clang=_en"
                       target="_blank" rel="noopener noreferrer"
                       style="color:#15803d; font-weight:400; font-size:0.9em; display:flex; align-items:center; gap:6px; text-decoration:none;">
                        <span style="color:#16a34a; font-weight:bold; font-size:1em;"></span>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/320px-Flag_of_the_United_Nations.svg.png"
                             alt="UN" style="width:18px; height:18px; object-fit:contain;">
                        <span style="color:#16a34a; font-size:1.2em;">✓</span>
                        <span style="text-decoration:underline;">Kigali Participant${kigaliYear ? ' (Signed in ' + kigaliYear + ')' : ''}</span>
                    </a>
                </div>`;
            }

            if (hasMethane) {
                html += `
                <div style="margin-bottom: 16px;">
                    <a href="https://www.globalmethanepledge.org/"
                       target="_blank" rel="noopener noreferrer"
                       style="color:#15803d; font-weight:400; font-size:0.9em; display:flex; align-items:center; gap:6px; text-decoration:none;">
                        <span style="color:#16a34a; font-weight:bold; font-size:1em;"></span>
                        <span style="color:#16a34a; font-size:1.2em;">✓</span>
                        <span style="text-decoration:underline;">Global Methane Pledge${methaneYear ? ' (Signed in ' + methaneYear + ')' : ''}</span>
                    </a>
                </div>`;
            }

            if (!hasKigali && !hasMethane) {
                html += `
                <div style="padding: 30px 20px; text-align: center;">
                    <p style="color:#9ca3af; font-style:italic; font-size:0.9em;">
                        ${countryName} is not a signatory to either agreement.
                    </p>
                </div>`;
            }

            html += '</div>';
            tooltipContent.innerHTML = html;
            positionTooltip(event);
            tooltip.classList.add('visible');
        }

        // ============================================================
        // PROGRESS BAR HELPERS
        // ============================================================

        function showProgressBar(id, label) {
            const mapContainer = document.querySelector('.map-container');
            const div = document.createElement('div');
            div.id = id;
            div.className = 'loading-overlay';
            div.innerHTML = `
                <div class="loading-overlay-label">${label}</div>
                <div class="loading-bar-track">
                    <div class="loading-bar-fill" id="${id}Fill"></div>
                </div>`;
            mapContainer.appendChild(div);
            // Animate to 85% quickly, then crawl toward 98%
            let pct = 0;
            const timer = setInterval(() => {
                const increment = pct < 85
                    ? (Math.random() * 12 + 4)
                    : (Math.random() * 1.2 + 0.3);
                pct = Math.min(98, pct + increment);
                const fill = document.getElementById(id + 'Fill');
                if (fill) fill.style.width = pct + '%';
            }, 250);
            return timer;
        }

        function completeProgressBar(id, timer) {
            clearInterval(timer);
            const fill = document.getElementById(id + 'Fill');
            if (fill) fill.style.width = '100%';
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.remove();
            }, 350);
        }

        // ============================================================
        // BIOMETHANE PROGRAMS LAYER
        // ============================================================

        async function loadBiomethaneData() {
            if (biomethaneDataLoaded) return;
            const timer = showProgressBar('biomethaneLoadingIndicator', '⏳ Loading Biomethane data...');
            try {
                const response = await fetch(BIOMETHANE_URL);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const csvText = await response.text();
                biomethaneData = parseBiomethaneCSV(csvText);
                biomethaneDataLoaded = true;
            } catch (err) {
                console.error('❌ Biomethane load error:', err);
            } finally {
                completeProgressBar('biomethaneLoadingIndicator', timer);
            }
        }

        function parseBiomethaneCSV(csvText) {
            const lines = csvText.replace(/\r/g, '').split('\n');
            const headers = parseCSVLine(lines[0]).map(h => h.trim());
            const result = {};
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = parseCSVLine(line);
                const row = {};
                headers.forEach((h, idx) => row[h] = (values[idx] || '').trim());
                const country = row['Country'] || row['COUNTRY'] || '';
                if (!country) continue;
                const program = {
                    jurisdiction_level : row['JURISDICTION_LEVEL']  || '',
                    jurisdiction_name  : row['JURISDICTION_NAME']   || '',
                    name               : row['PROGRAM_OR_REG_ENGLISH'] || '',
                    category           : row['CATEGORY']            || '',
                    instrument_type    : row['INSTRUMENT_TYPE']     || '',
                    sector             : row['SECTOR']              || '',
                    obligated_entity   : row['OBLIGATED_ENTITY']    || '',
                    eligible_entity    : row['ELIGIBLE_ENTITY']     || '',
                    key_provisions     : row['KEY_PROVISIONS']      || '',
                    source_url         : row['PRIMARY_SOURCE_URL_1']|| '',
                    in_english         : row['In English']          || ''
                };
                if (!result[country]) result[country] = [];
                result[country].push(program);
            }
            return result;
        }

        function getBiomethanePrograms(countryName) {
            // Try exact match first, then normalised
            if (biomethaneData[countryName]) return biomethaneData[countryName];
            for (const key in biomethaneData) {
                if (normalizeCountryName(key) === countryName ||
                    normalizeCountryName(key) === normalizeCountryName(countryName)) {
                    return biomethaneData[key];
                }
            }
            return null;
        }

        function updateBiomethaneLayer() {
            if (activeTab !== 'biomethane') return;
            d3.selectAll('.country').each(function() {
                const el      = d3.select(this);
                const name    = el.attr('data-country');
                if (!name) return;
                const programs = getBiomethanePrograms(name);
                if (programs && programs.length) {
                    el.classed('has-biomethane', true);
                    el.style('fill', null);  // let CSS class drive the colour
                } else {
                    el.classed('has-biomethane', false);
                    el.style('fill', '#e5e7eb');
                }
            });
        }

        let currentBiomethanePrograms = [];
        let currentBiomethaneIndex   = 0;
        let currentBiomethaneCountry = '';

        function displayCurrentBiomethane() {
            const tooltipContent = document.getElementById('tooltipContent');
            const prevBtn        = document.getElementById('prevReg');
            const nextBtn        = document.getElementById('nextReg');
            const overviewLabel  = document.getElementById('overviewLabel');
            const regCounter     = document.getElementById('regCounter');
            if (regCounter) regCounter.style.display = 'none';
            const programs       = currentBiomethanePrograms;
            const total          = programs.length;

            prevBtn.disabled = (currentBiomethaneIndex === 0);
            nextBtn.disabled = (currentBiomethaneIndex === total - 1);
            overviewLabel.textContent = `${currentBiomethaneIndex + 1} / ${total}`;
            overviewLabel.classList.remove('active');
            overviewLabel.style.cursor = 'default';

            const p   = programs[currentBiomethaneIndex];
            const countryName = currentBiomethaneCountry;
            const url = safeUrl(p.source_url);
            const displayUrl = url
                ? (url.length > 55 ? url.substring(0, 55) + '...' : url)
                : '';

            tooltipContent.innerHTML = `
                <div style="padding:10px 12px;background:#f3f4f6;border-left:4px solid #4b5563;border-radius:4px;">
                    <p style="margin:0 0 8px;font-size:1em;font-weight:700;color:#111827;">${esc(p.name) || '<em>Unnamed program</em>'}</p>
                    ${p.jurisdiction_name ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#374151;">Jurisdiction:</strong> ${esc(p.jurisdiction_name)}</p>` : ''}
                    ${p.category        ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#374151;">Category:</strong> ${esc(p.category)}</p>`        : ''}
                    ${p.instrument_type ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#374151;">Instrument:</strong> ${esc(p.instrument_type)}</p>` : ''}
                    ${p.sector         ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#374151;">Sector:</strong> ${esc(p.sector)}</p>`              : ''}
                    ${p.eligible_entity  ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#374151;">Eligible Entity:</strong> ${esc(p.eligible_entity)}</p>`   : ''}
                    ${p.key_provisions  ? `<p style="margin:6px 0 3px;font-size:0.85em;"><strong style="color:#374151;">Key Provisions:</strong><br>${esc(p.key_provisions)}</p>` : ''}
                    ${url ? `<p style="margin:6px 0 0;font-size:0.82em;"><strong style="color:#374151;">Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#4b5563;word-break:break-all;">${esc(displayUrl)}</a></p>` : ''}
                    ${p.in_english ? `<p style="margin:4px 0 0;font-size:0.85em;"><strong style="color:#374151;">In English:</strong> ${p.in_english.toUpperCase() === 'Y' ? '<span style="color:#10b981;font-size:1.2em;">✓</span>' : '<span style="color:#ef4444;font-size:1.2em;">✗</span>'}</p>` : ''}
                </div>`;
        }

        function showBiomethaneData(event, countryName) {
            ensureTooltipsInBody();
            const tooltip         = document.getElementById('tooltip');
            const tooltipCountry  = document.getElementById('tooltipCountry');
            const tooltipNav      = document.getElementById('tooltipNav');
            const timelineToggle  = document.getElementById('timelineToggle');
            const industryFilters = document.getElementById('industryFilters');

            const flagUrl = getCountryFlag(countryName);
            tooltipCountry.innerHTML = flagUrl
                ? `<span>${countryName}</span><img src="${flagUrl}" alt="${countryName} flag" class="country-flag">`
                : countryName;

            timelineToggle.style.display  = 'none';
            industryFilters.style.display = 'none';
            hideVCMFilters();
            const existingBanner = document.getElementById('topBannerContainer');
            if (existingBanner) existingBanner.remove();

            const programs = getBiomethanePrograms(countryName);

            if (!programs || !programs.length) {
                tooltipNav.style.display = 'none';
                document.getElementById('tooltipContent').innerHTML =
                    `<div style="padding:30px 20px;text-align:center;"><p style="color:#9ca3af;font-style:italic;font-size:0.9em;">No biomethane programs found for ${esc(countryName)}</p></div>`;
                positionTooltip(event);
                tooltip.classList.add('visible');
                return;
            }

            currentBiomethanePrograms = [...programs].sort((a, b) =>
                (a.sector || '').localeCompare(b.sector || '')
            );
            currentBiomethaneIndex   = 0;
            currentBiomethaneCountry = countryName;
            tooltipNav.style.display = 'flex';
            displayCurrentBiomethane();
            positionTooltip(event);
            tooltip.classList.add('visible');
        }

        // ============================================================
        // VCM PROJECTS LAYER
        // ============================================================

        async function loadVCMData() {
            if (vcmDataLoaded) return;
            const timer = showProgressBar('vcmLoadingIndicator', '⏳ Loading VCM data...');
            try {
                const response = await fetch(VCM_URL);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const csvText = await response.text();
                vcmData = parseVCMCSV(csvText);
                // Collect unique Project Type Filter values
                const typeSet = new Set();
                Object.values(vcmData).forEach(projects =>
                    projects.forEach(p => { if (p.project_type_filter) typeSet.add(p.project_type_filter); })
                );
                vcmFilterTypes = [...typeSet].sort();
                activeVCMFilters = new Set(vcmFilterTypes); // all on by default
                buildVCMFilterPanel();
                vcmDataLoaded = true;
            } catch (err) {
                console.error('❌ VCM load error:', err);
            } finally {
                completeProgressBar('vcmLoadingIndicator', timer);
            }
        }

        function parseVCMCSV(csvText) {
            const lines = csvText.replace(/\r/g, '').split('\n');
            const headers = parseCSVLine(lines[0]).map(h => h.trim());
            const result = {};
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = parseCSVLine(line);
                const row = {};
                headers.forEach((h, idx) => row[h] = (values[idx] || '').trim());
                const include = row['Include'] || row['INCLUDE'] || '';
                if (include.toUpperCase() === 'N') continue;
                const country = row['Country'] || row['COUNTRY'] || '';
                if (!country) continue;
                const startYear = (row['Start date'] || '').substring(0, 4);
                const endYear   = (row['End date']   || '').substring(0, 4);
                const project = {
                    id             : row['ID']                                  || '',
                    name           : row['Name']                                || '',
                    proponent      : row['Proponent']                           || '',
                    project_type   : row['Project Type']                        || '',
                    project_type_filter : row['Project Type Filter']            || '',
                    super_pollutant     : row['Super Pollutant']                || '',
                    status         : row['Status']                               || '',
                    annual_reductions: row['Estimated Annual Emission Reductions'] || '',
                    start_year     : startYear,
                    end_year       : endYear,
                    registry       : row['Registry']                                        || '',
                    credits_registered : row['Total Number of Offset Credits Registered']   || '',
                    registration_date  : (row['Registered date'] || '').substring(0, 4),
                };
                if (!result[country]) result[country] = [];
                result[country].push(project);
            }
            return result;
        }

        function getVCMProjects(countryName) {
            if (vcmData[countryName]) return vcmData[countryName];
            for (const key in vcmData) {
                if (normalizeCountryName(key) === countryName ||
                    normalizeCountryName(key) === normalizeCountryName(countryName)) {
                    return vcmData[key];
                }
            }
            return null;
        }

        function updateVCMLayer() {
            if (activeTab !== 'carbon') return;
            d3.selectAll('.country').each(function() {
                const el   = d3.select(this);
                const name = el.attr('data-country');
                if (!name) return;
                const projects = getVCMProjects(name);
                if (projects && projects.length) {
                    el.classed('has-vcm', true);
                    el.style('fill', null);
                } else {
                    el.classed('has-vcm', false);
                    el.style('fill', '#e5e7eb');
                }
            });
        }

        function hideVCMFilters() {
            const _vf = document.getElementById('vcmFilters'); if (_vf) _vf.style.display = 'none';
        }

        function buildVCMFilterPanel() {
            const container = document.getElementById('vcmFilterOptions');
            if (!container) return;
            container.innerHTML = '';
            vcmFilterTypes.forEach(type => {
                const label = document.createElement('label');
                label.className = 'industry-filter-option';
                label.innerHTML = `<input type="checkbox" id="vcmFilter_${type.replace(/\s+/g,'_')}" checked /><span>${type}</span>`;
                label.querySelector('input').addEventListener('change', function() {
                    if (this.checked) activeVCMFilters.add(type);
                    else activeVCMFilters.delete(type);
                    if (currentVCMProjects.length) displayCurrentVCM();
                });
                container.appendChild(label);
            });
            // Select all / Clear all links
            const selAll = document.createElement('span');
            selAll.textContent = 'Select all';
            selAll.style.cssText = 'font-size:11px;color:#1d4ed8;cursor:pointer;margin-left:6px;text-decoration:underline;user-select:none;align-self:center;';
            selAll.onclick = selectAllVCMFilters;
            const clrAll = document.createElement('span');
            clrAll.textContent = 'Clear all';
            clrAll.style.cssText = 'font-size:11px;color:#1d4ed8;cursor:pointer;margin-left:6px;text-decoration:underline;user-select:none;align-self:center;';
            clrAll.onclick = clearAllVCMFilters;
            container.appendChild(selAll);
            container.appendChild(clrAll);
        }

        function updateVCMFilterAvailability(projects) {
            // Build set of types that actually appear in this country's projects
            const presentTypes = new Set(projects.map(p => p.project_type_filter).filter(Boolean));
            vcmFilterTypes.forEach(type => {
                const cb = document.getElementById('vcmFilter_' + type.replace(/\s+/g, '_'));
                if (!cb) return;
                const label = cb.closest('label');
                const present = presentTypes.has(type);
                cb.disabled = !present;
                if (label) label.classList.toggle('disabled', !present);
                // If this type is now absent, uncheck and remove from active set
                if (!present) {
                    cb.checked = false;
                    activeVCMFilters.delete(type);
                } else {
                    // Restore to checked/active if it was previously just absent
                    cb.checked = activeVCMFilters.has(type) || !activeVCMFilters.size;
                    if (cb.checked) activeVCMFilters.add(type);
                }
            });
        }

        function filterVCMProjects(projects) {
            if (activeVCMFilters.size === vcmFilterTypes.length) return projects;
            return projects.filter(p => {
                if (!p.project_type_filter) return activeVCMFilters.size === 0 || activeVCMFilters.has('');
                return activeVCMFilters.has(p.project_type_filter);
            });
        }

        function selectAllVCMFilters() {
            activeVCMFilters = new Set(vcmFilterTypes);
            document.querySelectorAll('#vcmFilterOptions input[type="checkbox"]').forEach(cb => {
                if (!cb.disabled) cb.checked = true;
            });
            if (currentVCMProjects.length) displayCurrentVCM();
        }

        function clearAllVCMFilters() {
            activeVCMFilters.clear();
            document.querySelectorAll('#vcmFilterOptions input[type="checkbox"]').forEach(cb => {
                if (!cb.disabled) cb.checked = false;
            });
            if (currentVCMProjects.length) displayCurrentVCM();
        }

        let currentVCMProjects = [];
        let currentVCMIndex    = 0;

        function displayCurrentVCM() {
            const tooltipContent = document.getElementById('tooltipContent');
            const prevBtn        = document.getElementById('prevReg');
            const nextBtn        = document.getElementById('nextReg');
            const overviewLabel  = document.getElementById('overviewLabel');
            const vcmFilters     = document.getElementById('vcmFilters');
            const regCounter     = document.getElementById('regCounter');
            if (regCounter) regCounter.style.display = 'none';
            const filtered       = filterVCMProjects(currentVCMProjects);
            const total          = filtered.length;

            // Show the filter panel
            if (vcmFilters) vcmFilters.style.display = 'flex';

            if (!total) {
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                overviewLabel.textContent = '0 / 0';
                overviewLabel.classList.remove('active');
                overviewLabel.style.cursor = 'default';
                tooltipContent.innerHTML = '<div style="padding:30px 20px;text-align:center;"><p style="color:#9ca3af;font-style:italic;font-size:0.9em;">No projects match the selected filters.</p></div>';
                return;
            }

            // Clamp index to filtered list
            if (currentVCMIndex >= total) currentVCMIndex = total - 1;

            prevBtn.disabled = (currentVCMIndex === 0);
            nextBtn.disabled = (currentVCMIndex === total - 1);
            overviewLabel.textContent = `${currentVCMIndex + 1} / ${total}`;
            overviewLabel.classList.remove('active');
            overviewLabel.style.cursor = 'default';

            const p = filtered[currentVCMIndex];
            const isCAR = p.registry.toUpperCase() === 'CAR';

            tooltipContent.innerHTML = `
                <div style="padding:10px 12px;background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:4px;">
                    <p style="margin:0 0 8px;font-size:1em;font-weight:700;color:#1e3a8a;">${esc(p.name) || '<em>Unnamed project</em>'}</p>
                    ${p.proponent      ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Proponent:</strong> ${esc(p.proponent)}</p>`             : ''}
                    ${p.project_type   ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Project Type:</strong> ${esc(p.project_type)}</p>`       : ''}
                    ${p.status         ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Status:</strong> ${esc(p.status)}</p>`                   : ''}
                    ${isCAR
                        ? (p.credits_registered ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Total Offset Credits Registered:</strong> ${esc(p.credits_registered)}</p>` : '')
                        : (p.annual_reductions  ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Est. Annual Reductions:</strong> ${esc(p.annual_reductions)}</p>` : '')
                    }
                    ${isCAR
                        ? (p.registration_date ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Registered Date:</strong> ${esc(p.registration_date)}</p>` : '')
                        : (p.start_year        ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Crediting Start:</strong> ${esc(p.start_year)}</p>` : '')
                    }
                    ${!isCAR && p.end_year     ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Crediting End:</strong> ${esc(p.end_year)}</p>`   : ''}
                    ${p.registry       ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Registry:</strong> ${esc(p.registry)}</p>`             : ''}
                    ${p.id             ? `<p style="margin:3px 0;font-size:0.85em;"><strong style="color:#1d4ed8;">Registry ID:</strong> ${esc(p.id)}</p>`                : ''}
                </div>`;
        }

        function showVCMData(event, countryName) {
            ensureTooltipsInBody();
            const tooltip         = document.getElementById('tooltip');
            const tooltipCountry  = document.getElementById('tooltipCountry');
            const tooltipNav      = document.getElementById('tooltipNav');
            const timelineToggle  = document.getElementById('timelineToggle');
            const industryFilters = document.getElementById('industryFilters');

            const flagUrl = getCountryFlag(countryName);
            tooltipCountry.innerHTML = flagUrl
                ? `<span>${countryName}</span><img src="${flagUrl}" alt="${countryName} flag" class="country-flag">`
                : countryName;

            timelineToggle.style.display  = 'none';
            industryFilters.style.display = 'none';
            hideVCMFilters();
            const existingBanner = document.getElementById('topBannerContainer');
            if (existingBanner) existingBanner.remove();

            const projects = getVCMProjects(countryName);

            if (!projects || !projects.length) {
                tooltipNav.style.display = 'none';
                document.getElementById('tooltipContent').innerHTML =
                    `<div style="padding:30px 20px;text-align:center;"><p style="color:#9ca3af;font-style:italic;font-size:0.9em;">No VCM projects found for ${esc(countryName)}</p></div>`;
                positionTooltip(event);
                tooltip.classList.add('visible');
                return;
            }

            currentVCMProjects = [...projects].sort((a, b) => {
                const yearA = (a.registry.toUpperCase() === 'CAR' ? a.registration_date : a.start_year) || '9999';
                const yearB = (b.registry.toUpperCase() === 'CAR' ? b.registration_date : b.start_year) || '9999';
                return yearA.localeCompare(yearB);
            });
currentVCMIndex   = 0;
activeVCMFilters = new Set(vcmFilterTypes); // reset to select all on new country
updateVCMFilterAvailability(currentVCMProjects);
            tooltipNav.style.display = 'flex';
            displayCurrentVCM();
            positionTooltip(event);
            tooltip.classList.add('visible');
        }

        function selectCountry(event, countryName, pathElement) {
            hideHoverTooltip();

            // VCM tab â€” show projects popup
            if (activeTab === 'carbon') {
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showVCMData(event, countryName);
                return;
            }

            // Biomethane tab â€” show programs popup
            if (activeTab === 'biomethane') {
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showBiomethaneData(event, countryName);
                return;
            }

            // International Agreements tab â€” show agreements popup
            if (activeTab === 'agreements') {
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showAgreementsData(event, countryName);
                return;
            }

            // CH4 layer active — show emissions popup instead of regulations
            if (ch4LayerActive) {
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showCH4Data(event, countryName);
                return;
            }

            // If we're in subfederal mode and click a different country, exit first then re-select
            if (subfederalCountry && countryName !== subfederalCountry) {
                subfederalCountry = null;
                renderMap();
                // renderMap is synchronous â€” select the country directly after it completes
                const newPathElement = document.querySelector(`[data-country="${countryName}"]`);
                if (newPathElement) selectCountry(event, countryName, newPathElement);
                return;
            }

            // Countries with subfederal options — show choice modal unless already drilled in
            if (SUBFEDERAL_COUNTRIES[countryName] && !subfederalCountry) {
                showSubfederalModal(event, pathElement, countryName);
                return;
            }
            
            d3.selectAll('.country').classed('selected', false);
            d3.select(pathElement).classed('selected', true);
            selectedCountry = countryName;

            let data = null;
            for (const key in countryData) {
                if (normalizeCountryName(key) === countryName || key === countryName) {
                    data = countryData[key];
                    break;
                }
            }

            showCountryData(event, countryName, data);
        }

        function showSubfederalModal(event, pathElement, countryName) {
            // Store context so modal buttons can act on it
            subfederalModal.country = countryName;
            subfederalModal.event = event;
            subfederalModal.path = pathElement;

            const info = SUBFEDERAL_COUNTRIES[countryName];
            // Update modal text dynamically
            document.getElementById('modalTitle').textContent = countryName + ' Regulations';
            document.getElementById('modalBody').textContent = 'Would you like to view federal (national) regulations or sub-federal regulations?';
            document.getElementById('nationalBtn').textContent = info.national;
            document.getElementById('subdivisionBtn').textContent = info.sub;
            document.getElementById('modalOverlay').classList.add('visible');
        }

        function showNationalRegulations() {
            document.getElementById('modalOverlay').classList.remove('visible');
            const countryName = subfederalModal.country;
            const event      = subfederalModal.event;
            const pathElement = subfederalModal.path;
            const info = SUBFEDERAL_COUNTRIES[countryName];

            let data = null;
            for (const key in countryData) {
                if (key === info.dataKey || normalizeCountryName(key) === countryName) {
                    data = countryData[key];
                    break;
                }
            }

            if (data && data.regulations) {
                const nationalRegs = data.regulations.filter(reg =>
                    reg.jurisdiction.toLowerCase().includes('federal') ||
                    reg.jurisdiction.toLowerCase().includes('national')
                );
                const nationalData = { ...data, regulations: nationalRegs, total_regulations: nationalRegs.length };
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showCountryData(event, countryName + ' (Federal)', nationalData);
            } else {
                // No federal filter — just show all
                d3.selectAll('.country').classed('selected', false);
                d3.select(pathElement).classed('selected', true);
                selectedCountry = countryName;
                showCountryData(event, countryName, data);
            }
        }

        async function showSubdivisionLevel() {
            document.getElementById('modalOverlay').classList.remove('visible');
            const countryName = subfederalModal.country;

            // For US, show a brief loading indicator while fetching from CDN
            let loader = null;
            if (countryName === 'United States of America') {
                loader = document.createElement('div');
                loader.id = 'subfederalLoading';
                loader.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:white;padding:16px 28px;border-radius:8px;font-size:1em;z-index:3000;pointer-events:none;';
                loader.textContent = 'Loading US state borders…';
                document.body.appendChild(loader);
            }

            subfederalCountry = countryName;
            const ok = await loadSubfederalBorders(countryName);
            if (loader) loader.remove();

            if (!ok) {
                subfederalCountry = null;
                renderMap();
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#b91c1c;color:white;padding:12px 24px;border-radius:8px;font-size:0.95em;z-index:3000;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
                toast.textContent = 'Could not load ' + countryName + ' borders — check your internet connection and try again.';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 5000);
                return;
            }

            renderMap();
        }

        function showEURegulations(event) {
            let euData = null;
            for (const key in countryData) {
                if (key === "European Union" || key.toLowerCase() === "european union") {
                    euData = countryData[key];
                    break;
                }
            }
            if (euData) {
                d3.selectAll('.country').classed('selected', false);
                selectedCountry = null;
                showCountryData(event, "European Union", euData);
            } else {
                alert('No EU regulations data found. Please ensure "European Union" is added as a country in your spreadsheet.');
            }
        }

        function selectSubdivision(event, subdivisionName, parentCountry, pathElement) {
            hideHoverTooltip();
            
            d3.selectAll('.country').classed('selected', false);
            d3.select(pathElement).classed('selected', true);
            selectedCountry = subdivisionName;
            
            const parentData = countryData[parentCountry];
            if (parentData && parentData.regulations) {
                const subdivisionRegs = parentData.regulations.filter(reg =>
                    reg.jurisdiction.toLowerCase().includes(subdivisionName.toLowerCase())
                );
                
                subdivisionRegs.sort((a, b) => {
                    const yearA = parseInt(a.date_enacted) || 9999;
                    const yearB = parseInt(b.date_enacted) || 9999;
                    return yearA - yearB;
                });
                
                const filteredData = {
                    ...parentData,
                    regulations: subdivisionRegs,
                    total_regulations: subdivisionRegs.length
                };
                
                showCountryData(event, subdivisionName, filteredData);
            }
        }

        function positionTooltip(event) {
            const tooltip = document.getElementById('tooltip');
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            tooltip.style.transform = '';
            tooltip.style.minHeight = '';
            tooltip.style.maxWidth = '';

            // FIX #6: Only reset dimensions if the user hasn't manually resized the tooltip
            if (!hasBeenResized) {
                if (activeTab === 'agreements') {
                    tooltip.style.width  = '276px';
                    tooltip.style.height = '330px';
                } else {
                    tooltip.style.width  = '552px';
                    tooltip.style.height = '660px';
                }
            }
            
            const clickX = event.clientX;
            const clickY = event.clientY;
            
            const isLeftHalf = clickX < windowWidth / 2;
            const isTopHalf = clickY < windowHeight / 2;
            
            if (isLeftHalf && isTopHalf) {
                tooltip.style.right = '20px';
                tooltip.style.bottom = '80px';
                tooltip.style.left = 'auto';
                tooltip.style.top = 'auto';
            } else if (!isLeftHalf && isTopHalf) {
                tooltip.style.left = '20px';
                tooltip.style.bottom = '80px';
                tooltip.style.right = 'auto';
                tooltip.style.top = 'auto';
            } else if (isLeftHalf && !isTopHalf) {
                tooltip.style.right = '20px';
                tooltip.style.top = '20px';
                tooltip.style.left = 'auto';
                tooltip.style.bottom = 'auto';
            } else {
                tooltip.style.left = '20px';
                tooltip.style.top = '20px';
                tooltip.style.right = 'auto';
                tooltip.style.bottom = 'auto';
            }
        }

        function deselectCountry() {
            d3.selectAll('.country').classed('selected', false);
            selectedCountry = null;
            currentCountry = null;
            currentRegIndex = 0;
            currentDisplayData = null; // FIX #3: use module-level variable
            ch4PopupCountry = null;
            
            isTimelineView = false;
            document.getElementById('timelineToggle').style.display = 'none';
            document.getElementById('timelineOverlay').style.display = 'none';
            
            const tooltip = document.getElementById('tooltip');
            tooltip.classList.remove('visible');
            tooltip.classList.remove('agreements-tooltip');
            
            // FIX #6: Reset resize flag when tooltip is closed
            hasBeenResized = false;
            
            const industryFilters = document.getElementById('industryFilters');
            industryFilters.style.display = 'none';
            hideVCMFilters();
            
            if (subfederalCountry) {
                subfederalCountry = null;
                renderMap();
            }
        }

        // Generic helper to pull the single feature collection out of a TopoJSON file
        // regardless of what the object key is named
        function topoToFeatureCollection(topo) {
            const key = Object.keys(topo.objects)[0];
            return topojson.feature(topo, topo.objects[key]);
        }

        // Canada and Mexico data are pre-embedded; only US needs a CDN fetch.
        // Returns true if data is ready, false if it failed to load.
        async function loadSubfederalBorders(countryName) {
            // Canada and Mexico are already loaded from embedded data at startup
            if (countryName === 'Canada')  return !!canadaProvincesData;
            if (countryName === 'Mexico')  return !!mexicoStatesData;

            // United States — load from CDN on demand
            if (countryName === 'United States of America') {
                if (usStatesData) return true;
                try {
                    const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const us = await res.json();
                    usStatesData = topojson.feature(us, us.objects.states);
                    return true;
                } catch (error) {
                    console.error('Error loading US state borders:', error);
                    return false;
                }
            }
            return false;
        }

        function showCountryData(event, countryName, data) {
            const tooltip = document.getElementById('tooltip');
            const tooltipCountry = document.getElementById('tooltipCountry');
            const tooltipContent = document.getElementById('tooltipContent');
            const tooltipNav = document.getElementById('tooltipNav');

            const flagUrl = getCountryFlag(countryName);
            if (flagUrl) {
                tooltipCountry.innerHTML = `<span>${countryName}</span><img src="${flagUrl}" alt="${countryName} flag" class="country-flag">`;
            } else {
                tooltipCountry.textContent = countryName;
            }

            const existingBanner = document.getElementById('topBannerContainer');
            if (existingBanner) {
                existingBanner.remove();
            }

            const topBannerContainer = document.createElement('div');
            topBannerContainer.id = 'topBannerContainer';
            topBannerContainer.style.cssText = `
                display: flex; justify-content: space-between;
                align-items: center; margin: 10px 0; gap: 10px;
            `;

            if (data && data.is_eu_member && countryName !== "European Union") {
                const euLinkDiv = document.createElement('div');
                euLinkDiv.id = 'euLinkContainer';
                euLinkDiv.style.cssText = `
                    padding: 0px; background: #00000000;
                    border: .01px solid #00000000; border-radius: .001px;
                    text-align: left; flex: 1;
                `;
                euLinkDiv.innerHTML = `
                    <a href="#" id="euRegulationsLink" style="
                        color: #2563eb; font-weight: 400; text-decoration: none;
                        display: flex; align-items: center; justify-content: flex-start;
                        gap: 4px; font-size: 0.75em;
                    ">
                         See EU Regulations
                    </a>
                `;
                topBannerContainer.appendChild(euLinkDiv);
            } else {
                const spacer = document.createElement('div');
                spacer.style.flex = '1';
                topBannerContainer.appendChild(spacer);
            }

            if (data && data.is_eu_member && countryName !== "European Union") {
                tooltipCountry.parentNode.insertBefore(topBannerContainer, tooltipNav);
                
                const euLink = document.getElementById('euRegulationsLink');
                if (euLink) {
                    euLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showEURegulations(event);
                    });
                }
            }

            if (data && data.regulations && data.regulations.length > 0) {
                const sortedRegulations = [...data.regulations].sort((a, b) => {
                    const yearA = parseInt(a.date_enacted) || 9999;
                    const yearB = parseInt(b.date_enacted) || 9999;
                    return yearA - yearB;
                });
                
                data = { ...data, regulations: sortedRegulations };
                
                currentCountry = countryName;
                currentRegIndex = 0;
                
                showHVAC = true;
                showAgriculture = true;
                showTradingTax = true;
                showFossilFuel = true;
                showSolidWaste = true;
                showTransportation = true;
                showRemaining = true;
                
                currentDisplayData = data; // FIX #3: use module-level variable
                
                tooltipNav.style.display = 'flex';
                
                isTimelineView = false;
                document.getElementById('timelineToggle').style.display = 'block';
                document.getElementById('timelineToggle').innerHTML = '<span onclick="toggleTimeline()" style="color:#065f46; font-size:0.78em; cursor:pointer; font-weight:500; user-select:none;">See timeline view</span>';
                document.getElementById('timelineOverlay').style.display = 'none';
                
                displayCurrentRegulation();
                
                const industryFilters = document.getElementById('industryFilters');
                if (currentRegIndex === 1) {
                    industryFilters.style.display = 'flex';
                } else {
                    industryFilters.style.display = 'none';
            hideVCMFilters();
                }
                
                positionTooltip(event);
                tooltip.classList.add('visible');
            } else {
                tooltipNav.style.display = 'none';
                
                const industryFilters = document.getElementById('industryFilters');
                industryFilters.style.display = 'none';
            hideVCMFilters();
                
                tooltipContent.innerHTML = '<p><em>No regulatory data available</em></p>';
                positionTooltip(event);
                tooltip.classList.add('visible');
            }
        }

        function showHoverTooltip(event, countryName) {
            const hoverTooltip = document.getElementById('hoverTooltip');
            if (activeTab === 'carbon') {
                const projects = getVCMProjects(countryName);
                const count = projects ? projects.length : 0;
                if (count) {
                    hoverTooltip.innerHTML = '<span style="font-size:18px;font-weight:800;line-height:1;">' + count + '</span><span style="font-size:10px;font-weight:500;opacity:0.85;margin-top:2px;">' + esc(countryName) + '</span>';
                    hoverTooltip.classList.add('vcm-count');
                } else {
                    hoverTooltip.textContent = countryName;
                    hoverTooltip.classList.remove('vcm-count');
                }
            } else if (activeTab === 'biomethane') {
                const programs = getBiomethanePrograms(countryName);
                const count = programs ? programs.length : 0;
                if (count) {
                    hoverTooltip.innerHTML = '<span style="font-size:18px;font-weight:800;line-height:1;">' + count + '</span><span style="font-size:10px;font-weight:500;opacity:0.85;margin-top:2px;">' + esc(countryName) + '</span>';
                    hoverTooltip.classList.add('reg-count');
                } else {
                    hoverTooltip.textContent = countryName;
                    hoverTooltip.classList.remove('reg-count');
                }
            } else if (activeTab === 'regulations') {
                const normalized = normalizeCountryName(countryName);
                const data = countryData[countryName] || countryData[normalized]
                    || Object.entries(countryData).find(([k]) =>
                        normalizeCountryName(k) === normalized ||
                        normalizeCountryName(k) === countryName
                    )?.[1];
                const count = data && data.regulations ? filterRegulations(data.regulations).length : 0;
                if (count) {
                    hoverTooltip.innerHTML = '<span style="font-size:18px;font-weight:800;line-height:1;">' + count + '</span><span style="font-size:10px;font-weight:500;opacity:0.85;margin-top:2px;">' + esc(countryName) + '</span>';
                    hoverTooltip.classList.add('reg-count');
                } else {
                    hoverTooltip.textContent = countryName;
                    hoverTooltip.classList.remove('reg-count');
                }
            } else {
                hoverTooltip.textContent = countryName;
                hoverTooltip.classList.remove('vcm-count');
                hoverTooltip.classList.remove('reg-count');
            }
            hoverTooltip.classList.add('visible');
            moveHoverTooltip(event);
        }

        function moveHoverTooltip(event) {
            const hoverTooltip = document.getElementById('hoverTooltip');
            const offsetX = 15;
            const offsetY = 15;
            let x = event.clientX + offsetX;
            let y = event.clientY + offsetY;
            const tooltipRect = hoverTooltip.getBoundingClientRect();
            if (x + tooltipRect.width > window.innerWidth) {
                x = event.clientX - tooltipRect.width - offsetX;
            }
            if (y + tooltipRect.height > window.innerHeight) {
                y = event.clientY - tooltipRect.height - offsetY;
            }
            hoverTooltip.style.left = x + 'px';
            hoverTooltip.style.top = y + 'px';
        }

        function hideHoverTooltip() {
            const hoverTooltip = document.getElementById('hoverTooltip');
            hoverTooltip.classList.remove('visible');
            hoverTooltip.classList.remove('vcm-count');
            hoverTooltip.classList.remove('reg-count');
        }

        function formatYesNo(value) {
            if (!value) return 'N/A';
            const upperValue = String(value).toUpperCase().trim();
            if (upperValue === 'Y' || upperValue === 'YES') {
                return '<span style="color: #10b981; font-size: 1.2em;">✓</span>';
            } else if (upperValue === 'N' || upperValue === 'NO') {
                return '<span style="color: #ef4444; font-size: 1.1em;">✗</span>';
            }
            return value;
        }

        function exportToCSV(countryName, data) {
            if (!data || !data.regulations || data.regulations.length === 0) {
                alert('No data available to export');
                return;
            }

            const headers = [
                'Country', 'Jurisdiction', 'Name of regulation',
                'HFC (Y/N)', 'NOx (Y/N)', 'Black Carbon (Y/N)',
                'Methane (Y/N)', 'Other F Gases (Y/N)', 'N2O (Y/N)',
                'Description', 'Impacts corporations (Y/N)',
                'How it affects corporations', 'Date enacted (Year)',
                'Still in effect (Y/N)', 'Website / source'
            ];

            let csvContent = headers.join(',') + '\n';

            data.regulations.forEach(reg => {
                const hasPollutant = (pollutant) => {
                    return reg.pollutants.toLowerCase().includes(pollutant.toLowerCase()) ? 'Y' : 'N';
                };

                const escapeCSV = (value) => {
                    if (!value || value === 'N/A' || value === 'nan') return '';
                    value = String(value).replace(/"/g, '""');
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return `"${value}"`;
                    }
                    return value;
                };

                const row = [
                    escapeCSV(countryName),
                    escapeCSV(reg.jurisdiction),
                    escapeCSV(reg.name),
                    hasPollutant('hfc'),
                    hasPollutant('nox'),
                    hasPollutant('black carbon'),
                    hasPollutant('methane'),
                    hasPollutant('other f-gas'),
                    hasPollutant('n2o'),
                    escapeCSV(reg.description),
                    escapeCSV(reg.impacts_corps),
                    escapeCSV(reg.how_affects),
                    escapeCSV(reg.date_enacted),
                    escapeCSV(reg.still_in_effect),
                    escapeCSV(reg.website)
                ];

                csvContent += row.join(',') + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${countryName.replace(/\s+/g, '_')}_Regulations.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(link);
        }

        function filterRegulations(regulations) {
            return regulations.filter(reg => {
                const nameLower = reg.name.toLowerCase();
                
                // FIX #5: Use named constant array instead of inline string literals
                if (COMMITMENT_REGULATION_NAMES.some(n => nameLower.includes(n))) {
                    return false;
                }
                
                const hasIndustryTag = reg.hvac || reg.food_agriculture || reg.trading_tax_systems || reg.fossil_fuel_production || reg.solid_waste || reg.transportation;
                
                if (!hasIndustryTag) {
                    return showRemaining;
                }
                
                if (!showHVAC && reg.hvac) return false;
                if (!showAgriculture && reg.food_agriculture) return false;
                if (!showTradingTax && reg.trading_tax_systems) return false;
                if (!showFossilFuel && reg.fossil_fuel_production) return false;
                if (!showSolidWaste && reg.solid_waste) return false;
                if (!showTransportation && reg.transportation) return false;
                
                return true;
            });
        }

        function displayCurrentRegulation() {
            const tooltipContent = document.getElementById('tooltipContent');
            // FIX #7: removed reference to non-existent tooltipCounter element
            const overviewLabel = document.getElementById('overviewLabel');
            const prevBtn = document.getElementById('prevReg');
            const nextBtn = document.getElementById('nextReg');
            const regCounter = document.getElementById('regCounter');
            const vcmCounter = document.getElementById('vcmCounter');
            if (vcmCounter) vcmCounter.style.display = 'none';
            overviewLabel.textContent = 'Overview';
            
            // FIX #3: use module-level variable instead of window.currentDisplayData
const data = currentDisplayData;
if (!data) return;
            
            if (!data || !data.regulations || data.regulations.length === 0) return;
            
            const displayRegulations = filterRegulations(data.regulations);
            const totalSlides = displayRegulations.length + 2;
            
            if (currentRegIndex <= 1) {
                overviewLabel.classList.remove('active');
                overviewLabel.style.cursor = 'default';
                if (regCounter) regCounter.style.display = 'none';
            } else {
                overviewLabel.classList.add('active');
                overviewLabel.style.cursor = 'pointer';
                if (regCounter) {
                    regCounter.textContent = (currentRegIndex - 1) + ' / ' + displayRegulations.length;
                    regCounter.style.display = '';
                }
            }
            
            if (currentRegIndex >= 2 && currentRegIndex >= totalSlides) {
                currentRegIndex = 1;
            }
            
            prevBtn.disabled = (currentRegIndex === 0);
            nextBtn.disabled = (displayRegulations.length === 0 && currentRegIndex === 1) || (currentRegIndex === totalSlides - 1);
            
            let content = '';
            
            const industryFilters = document.getElementById('industryFilters');
            if (currentRegIndex === 1) {
                industryFilters.style.display = 'flex';
                
                const hasHVAC = data.regulations.some(reg => reg.hvac);
                const hasAgriculture = data.regulations.some(reg => reg.food_agriculture);
                const hasTradingTax = data.regulations.some(reg => reg.trading_tax_systems);
                const hasFossilFuel = data.regulations.some(reg => reg.fossil_fuel_production);
                const hasSolidWaste = data.regulations.some(reg => reg.solid_waste);
                const hasTransportation = data.regulations.some(reg => reg.transportation);
                const hasRemaining = data.regulations.some(reg => 
                    !reg.hvac && !reg.food_agriculture && !reg.trading_tax_systems && !reg.fossil_fuel_production && !reg.solid_waste && !reg.transportation &&
                    !COMMITMENT_REGULATION_NAMES.some(n => reg.name.toLowerCase().includes(n))
                );
                
                const hvacCheckbox = document.getElementById('filterHVAC');
                const hvacLabel = hvacCheckbox.closest('.industry-filter-option');
                const agricultureCheckbox = document.getElementById('filterAgriculture');
                const agricultureLabel = agricultureCheckbox.closest('.industry-filter-option');
                const tradingTaxCheckbox = document.getElementById('filterTradingTax');
                const tradingTaxLabel = tradingTaxCheckbox.closest('.industry-filter-option');
                const fossilFuelCheckbox = document.getElementById('filterFossilFuel');
                const fossilFuelLabel = fossilFuelCheckbox.closest('.industry-filter-option');
                const solidWasteCheckbox = document.getElementById('filterSolidWaste');
                const solidWasteLabel = solidWasteCheckbox.closest('.industry-filter-option');
                const transportationCheckbox = document.getElementById('filterTransportation');
                const transportationLabel = transportationCheckbox.closest('.industry-filter-option');
                const remainingCheckbox = document.getElementById('filterRemaining');
                const remainingLabel = remainingCheckbox.closest('.industry-filter-option');
                
                if (hasHVAC) { hvacCheckbox.disabled = false; hvacCheckbox.checked = showHVAC; hvacLabel.classList.remove('disabled'); }
                else { hvacCheckbox.disabled = true; hvacCheckbox.checked = false; hvacLabel.classList.add('disabled'); }
                
                if (hasAgriculture) { agricultureCheckbox.disabled = false; agricultureCheckbox.checked = showAgriculture; agricultureLabel.classList.remove('disabled'); }
                else { agricultureCheckbox.disabled = true; agricultureCheckbox.checked = false; agricultureLabel.classList.add('disabled'); }
                
                if (hasTradingTax) { tradingTaxCheckbox.disabled = false; tradingTaxCheckbox.checked = showTradingTax; tradingTaxLabel.classList.remove('disabled'); }
                else { tradingTaxCheckbox.disabled = true; tradingTaxCheckbox.checked = false; tradingTaxLabel.classList.add('disabled'); }
                
                if (hasFossilFuel) { fossilFuelCheckbox.disabled = false; fossilFuelCheckbox.checked = showFossilFuel; fossilFuelLabel.classList.remove('disabled'); }
                else { fossilFuelCheckbox.disabled = true; fossilFuelCheckbox.checked = false; fossilFuelLabel.classList.add('disabled'); }
                
                if (hasSolidWaste) { solidWasteCheckbox.disabled = false; solidWasteCheckbox.checked = showSolidWaste; solidWasteLabel.classList.remove('disabled'); }
                else { solidWasteCheckbox.disabled = true; solidWasteCheckbox.checked = false; solidWasteLabel.classList.add('disabled'); }
                
                if (hasTransportation) { transportationCheckbox.disabled = false; transportationCheckbox.checked = showTransportation; transportationLabel.classList.remove('disabled'); }
                else { transportationCheckbox.disabled = true; transportationCheckbox.checked = false; transportationLabel.classList.add('disabled'); }
                
                if (hasRemaining) { remainingCheckbox.disabled = false; remainingCheckbox.checked = showRemaining; remainingLabel.classList.remove('disabled'); }
                else { remainingCheckbox.disabled = true; remainingCheckbox.checked = false; remainingLabel.classList.add('disabled'); }
            } else {
                industryFilters.style.display = 'none';
            hideVCMFilters();
            }
            
            // Slide 0: Pollutants Overview
            if (currentRegIndex === 0) {
                const pollutantsCovered = {
                    'HFC': false, 'NOx': false, 'Black Carbon': false,
                    'Methane': false, 'Other F-Gases': false, 'N2O': false
                };
                
                data.regulations.forEach(reg => {
                    const pollutants = reg.pollutants.toLowerCase();
                    if (pollutants.includes('hfc') && !pollutants.includes('other')) pollutantsCovered['HFC'] = true;
                    if (pollutants.includes('nox')) pollutantsCovered['NOx'] = true;
                    if (pollutants.includes('black carbon')) pollutantsCovered['Black Carbon'] = true;
                    if (pollutants.includes('methane')) pollutantsCovered['Methane'] = true;
                    if (pollutants.includes('other f-gas')) pollutantsCovered['Other F-Gases'] = true;
                    if (pollutants.includes('n2o')) pollutantsCovered['N2O'] = true;
                });
                
                // FIX #5: Use COMMITMENT_REGULATION_NAMES constant for lookups
                
                content = `
                    <div style="padding: 2px; background: #f8fef9; border-left: 3px solid #065f46; border-radius: 3px;">
                        <p style="margin: 0 0 15px 0;"><strong style="color: #065f46; font-size: 1.1em;">Pollutants Covered</strong></p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['HFC'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>HFC</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['NOx'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>NO<sub>x</sub></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['Black Carbon'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>Black Carbon</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['Methane'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>Methane (CH<sub>4</sub>)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['Other F-Gases'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>Other F-Gases</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.3em;">${pollutantsCovered['N2O'] ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #d1d5db;">–</span>'}</span>
                                <span>N<sub>2</sub>O</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            // Slide 1: Regulations List
            else if (currentRegIndex === 1) {
                if (displayRegulations.length === 0) {
                    content = `
                        <div style="padding: 10px; background: #f8fef9; border-left: 3px solid #065f46; border-radius: 3px;">
                            <p style="margin: 0 0 10px 0;"><strong style="color: #065f46; font-size: 1.1em;">All Regulations (0)</strong></p>
                            <p style="margin: 15px 0; font-size: 0.9em; font-style: italic; color: #666; text-align: center;">
                                No regulations match the selected filters.<br>
                                Check the boxes below to show regulations.
                            </p>
                        </div>
                    `;
                } else {
                    content = `
                        <div style="padding: 10px; background: #f8fef9; border-left: 3px solid #065f46; border-radius: 3px;">
                            <p style="margin: 0 0 10px 0;"><strong style="color: #065f46; font-size: 1.1em;">All Regulations (${displayRegulations.length})</strong></p>
                            <ol style="margin: 0; padding-left: 20px; line-height: 1.4;">
                    `;
                    
                    displayRegulations.forEach((reg, index) => {
content += `<li style="margin: 5px 0;">${esc(reg.name)} (${esc(reg.jurisdiction)}) <span onclick="jumpToRegulation(${index + 2})" style="color: #387f6b; cursor: pointer; font-size: 0.95em; margin-left: 4px; opacity: 0.5;" title="View details">➜</span></li>`;
                    });
                    
                    content += `</ol></div>`;
                }

} else {
    // Slides 2+: Detail for specific regulation
    const reg = displayRegulations[currentRegIndex - 2];
    const regNumber = currentRegIndex - 1;
    
    const industries = [];
    if (reg.hvac) industries.push('HVAC');
    if (reg.food_agriculture) industries.push('Food & Agriculture');
    if (reg.trading_tax_systems) industries.push('Trading & Tax Systems');
    if (reg.fossil_fuel_production) industries.push('Fossil Fuel Production');
    if (reg.solid_waste) industries.push('Solid Waste');
    if (reg.transportation) industries.push('Transportation');
    const industryCovered = industries.length > 0 ? industries.join(', ') : 'General';
    const url = safeUrl(reg.website);

    content = `
        <div style="padding: 10px; background: #f8fef9; border-left: 3px solid #065f46; border-radius: 3px;">
            <p style="margin: 0 0 8px 0;"><strong style="color: #065f46; font-size: 1.1em;">${regNumber}. ${esc(reg.name)}</strong></p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Jurisdiction:</strong> ${esc(reg.jurisdiction)}</p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Pollutants Covered:</strong> ${esc(reg.pollutants)}</p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Industry Covered:</strong> ${esc(industryCovered)}</p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Date Enacted:</strong> ${esc(reg.date_enacted)} | <strong>Still in Effect:</strong> ${formatYesNo(reg.still_in_effect)}</p>
            <p style="margin: 8px 0 5px 0; font-size: 0.9em;"><strong>Description:</strong><br>${esc(reg.description)}</p>
            ${reg.how_affects && reg.how_affects !== 'N/A' && reg.how_affects !== 'nan' ? `<p style="margin: 8px 0 5px 0; font-size: 0.9em;"><strong>How it Affects Corporations:</strong><br>${esc(reg.how_affects)}</p>` : ''}
            ${url ? `<p style="margin: 8px 0 0 0; font-size: 0.85em;"><strong>Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #065f46; word-break: break-all;">${url.length > 60 ? esc(url.substring(0, 60)) + '...' : esc(url)}</a></p>` : ''}
            ${url ? `<p style="margin: 8px 0 0 0; font-size: 0.85em;"><strong>Document in English:</strong> ${reg.in_english && reg.in_english.toUpperCase() === 'Y' ? '<span style="color: #10b981; font-size: 1.2em;">✓</span>' : '<span style="color: #ef4444; font-size: 1.2em;">✗</span>'}</p>` : ''}
        </div>
    `;
}

            tooltipContent.innerHTML = content;
        }

        function selectAllFilters() {
            showHVAC = showAgriculture = showTradingTax = showFossilFuel = showSolidWaste = showTransportation = showRemaining = true;
            ['filterHVAC','filterAgriculture','filterTradingTax','filterFossilFuel','filterSolidWaste','filterTransportation','filterRemaining'].forEach(id => {
                const cb = document.getElementById(id);
                if (!cb.disabled) cb.checked = true;
            });
            if (currentCountry) displayCurrentRegulation();
        }

        function clearAllFilters() {
            showHVAC = showAgriculture = showTradingTax = showFossilFuel = showSolidWaste = showTransportation = showRemaining = false;
            ['filterHVAC','filterAgriculture','filterTradingTax','filterFossilFuel','filterSolidWaste','filterTransportation','filterRemaining'].forEach(id => {
                const cb = document.getElementById(id);
                if (!cb.disabled) cb.checked = false;
            });
            if (currentCountry) displayCurrentRegulation();
        }

        function jumpToRegulation(slideIndex) {
            currentRegIndex = slideIndex;
            displayCurrentRegulation();
        }

        function toggleTimeline() {
            const tooltip = document.getElementById('tooltip');
            const tooltipNav = document.getElementById('tooltipNav');
            const industryFilters = document.getElementById('industryFilters');
            const timelineToggle = document.getElementById('timelineToggle');

            isTimelineView = !isTimelineView;

            if (isTimelineView) {
                const isMobile = window.innerWidth <= 768;

                savedTooltipStyles = {
                    width: tooltip.style.width, height: tooltip.style.height,
                    left: tooltip.style.left, top: tooltip.style.top,
                    right: tooltip.style.right, bottom: tooltip.style.bottom,
                    transform: tooltip.style.transform, maxWidth: tooltip.style.maxWidth,
                    minHeight: tooltip.style.minHeight
                };

                if (!isMobile) {
                    const timelineWidth = Math.min(window.innerWidth * 0.85, 1200);
                    tooltip.style.width = timelineWidth + 'px';
                    tooltip.style.height = 'auto';
                    tooltip.style.minHeight = '300px';
                    tooltip.style.maxWidth = '1200px';
                    tooltip.style.left = ((window.innerWidth - timelineWidth) / 2) + 'px';
                    tooltip.style.top = '50%';
                    tooltip.style.right = 'auto';
                    tooltip.style.bottom = 'auto';
                    tooltip.style.transform = 'translateY(-50%)';
                }

                tooltipNav.style.display = 'none';
                industryFilters.style.display = 'none';
            hideVCMFilters();
                timelineToggle.innerHTML = '<span onclick="toggleTimeline()" style="color:#065f46; font-size:0.78em; cursor:pointer; font-weight:500; user-select:none;">See list view</span>';
                renderTimeline();
            } else {
                tooltip.style.width = savedTooltipStyles.width || '';
                tooltip.style.height = savedTooltipStyles.height || '';
                tooltip.style.left = savedTooltipStyles.left || '';
                tooltip.style.top = savedTooltipStyles.top || '';
                tooltip.style.right = savedTooltipStyles.right || '';
                tooltip.style.bottom = savedTooltipStyles.bottom || '';
                tooltip.style.transform = savedTooltipStyles.transform || '';
                tooltip.style.maxWidth = savedTooltipStyles.maxWidth || '';
                tooltip.style.minHeight = savedTooltipStyles.minHeight || '';

                tooltipNav.style.display = 'flex';
                timelineToggle.innerHTML = '<span onclick="toggleTimeline()" style="color:#065f46; font-size:0.78em; cursor:pointer; font-weight:500; user-select:none;">See timeline view</span>';
                displayCurrentRegulation();
            }
        }

        function renderTimeline() {
            const tooltipContent = document.getElementById('tooltipContent');
            const data = currentDisplayData; // FIX #3: use module-level variable
            if (!data) return;

            const regs = filterRegulations(data.regulations);
            const isMobile = window.innerWidth <= 768;

            if (regs.length === 0) {
                tooltipContent.innerHTML = '<p style="padding:40px; text-align:center; color:#666; font-style:italic;">No regulations to display on timeline.</p>';
                return;
            }

            const datedRegs = [];
            regs.forEach((reg, index) => {
                const year = parseInt(reg.date_enacted);
                if (!isNaN(year)) {
                    datedRegs.push({ reg, index, year });
                }
            });

            if (datedRegs.length === 0) {
                tooltipContent.innerHTML = '<p style="padding:40px; text-align:center; color:#666; font-style:italic;">No dated regulations to display on timeline.</p>';
                return;
            }

            const minYear = Math.min(...datedRegs.map(d => d.year));
            const maxYear = 2026;
            const yearRange = maxYear - minYear || 1;

            let tickInterval;
            if (yearRange <= 5) tickInterval = 1;
            else if (yearRange <= 15) tickInterval = 2;
            else if (yearRange <= 40) tickInterval = 5;
            else tickInterval = 10;

            const regsByYear = {};
            datedRegs.forEach(item => {
                if (!regsByYear[item.year]) regsByYear[item.year] = [];
                regsByYear[item.year].push(item);
            });

            if (isMobile) {
                const dotSize = 20;
                const slotWidth = 28;
                const leftPad = 50;
                const axisX = leftPad;

                const ticks = new Set();
                const startTick = Math.ceil(minYear / tickInterval) * tickInterval;
                for (let y = startTick; y <= maxYear; y += tickInterval) ticks.add(y);
                ticks.add(minYear);
                ticks.add(maxYear);
                const sortedTicks = [...ticks].sort((a, b) => a - b);

                const getTop = (year) => ((year - minYear) / yearRange) * 90 + 5;
                const totalHeight = Math.max(500, sortedTicks.length * 38 + 40);

                let html = `<div style="position:relative; width:100%; height:${totalHeight}px; padding:0; box-sizing:border-box;">`;
                html += `<div style="position:absolute; left:${axisX}px; top:5%; bottom:5%; width:2.5px; background:#065f46; border-radius:1px;"></div>`;

                sortedTicks.forEach(year => {
                    const topPct = getTop(year);
                    html += `<div style="position:absolute; top:${topPct}%; left:0; transform:translateY(-50%); z-index:1; display:flex; align-items:center;">
                                <span style="font-size:9px; color:#6b7280; white-space:nowrap; width:${leftPad - 8}px; text-align:right; padding-right:4px;">${year}</span>
                                <div style="width:7px; height:1.5px; background:#065f46;"></div>
                             </div>`;
                });

                Object.entries(regsByYear).forEach(([year, items]) => {
                    const topPct = getTop(parseInt(year));
                    items.forEach((item, stackIndex) => {
                        const leftOffset = axisX + 10 + stackIndex * slotWidth;
                        html += `<div class="timeline-dot"
                                    onclick="showTimelineDetail(${item.index})"
                             title="${esc(item.reg.name)} (${item.year})"
                                    style="position:absolute; left:${leftOffset}px; top:${topPct}%; transform:translateY(-50%); cursor:pointer; z-index:2;">
                                    <div style="width:${dotSize}px; height:${dotSize}px; border-radius:50%; background:#065f46; border:3px solid #10b981; box-sizing:border-box; transition:all 0.15s;"></div>
                                </div>`;
                    });
                });

                html += '</div>';
                html += `<p style="text-align:center; font-size:0.75em; color:#9ca3af; font-style:italic; margin:8px 0 0 0;">Tap dots to view details</p>`;
                tooltipContent.innerHTML = html;

            } else {
                const maxStack = Math.max(...Object.values(regsByYear).map(arr => arr.length), 1);
                const dotSize = 18;
                const slotHeight = 26;
                const topPad = 16;
                const axisY = topPad + maxStack * slotHeight;
                const totalHeight = axisY + 40;

                const getLeft = (year) => ((year - minYear) / yearRange) * 88 + 6;

                let html = `<div style="position:relative; width:100%; height:${totalHeight}px; padding:0 5px; box-sizing:border-box;">`;

                Object.entries(regsByYear).forEach(([year, items]) => {
                    const left = getLeft(parseInt(year));
                    items.forEach((item, stackIndex) => {
                        const top = topPad + stackIndex * slotHeight;
                        html += `<div class="timeline-dot"
                                    onclick="showTimelineDetail(${item.index})"
                         title="${esc(item.reg.name)} (${item.year})"
                                    style="position:absolute; left:${left}%; top:${top}px; transform:translateX(-50%); cursor:pointer; z-index:2;">
                                    <div style="width:${dotSize}px; height:${dotSize}px; border-radius:50%; background:#065f46; border:3px solid #10b981; box-sizing:border-box; transition:all 0.15s;"></div>
                                </div>`;
                    });
                });

                html += `<div style="position:absolute; left:6%; right:6%; top:${axisY}px; height:2.5px; background:#065f46; border-radius:1px;"></div>`;

                const ticks = new Set();
                const startTick = Math.ceil(minYear / tickInterval) * tickInterval;
                for (let y = startTick; y <= maxYear; y += tickInterval) ticks.add(y);
                ticks.add(minYear);
                ticks.add(maxYear);

                [...ticks].sort((a, b) => a - b).forEach(year => {
                    const left = getLeft(year);
                    html += `<div style="position:absolute; left:${left}%; top:${axisY}px; transform:translateX(-50%); z-index:1;">
                                <div style="width:1.5px; height:7px; background:#065f46;"></div>
                                <span style="display:block; font-size:9px; color:#6b7280; margin-top:2px; white-space:nowrap; position:relative; left:50%; transform:translateX(-50%);">${year}</span>
                             </div>`;
                });

                html += '</div>';
                html += `<p style="text-align:center; font-size:0.75em; color:#9ca3af; font-style:italic; margin:8px 0 0 0;">Hover over dots to see regulation names · Click to view details</p>`;
                tooltipContent.innerHTML = html;
            }
        }

        function showTimelineDetail(regIndex) {
            const data = currentDisplayData; // FIX #3: use module-level variable
            if (!data) return;

            const regs = filterRegulations(data.regulations);
            const reg = regs[regIndex];
            if (!reg) return;

            timelineSelectedReg = regIndex;

            const industries = [];
            if (reg.hvac) industries.push('HVAC');
            if (reg.food_agriculture) industries.push('Food & Agriculture');
            if (reg.trading_tax_systems) industries.push('Trading & Tax Systems');
            if (reg.fossil_fuel_production) industries.push('Fossil Fuel Production');
            if (reg.solid_waste) industries.push('Solid Waste');
            if (reg.transportation) industries.push('Transportation');
            const industryCovered = industries.length > 0 ? industries.join(', ') : 'General';

            const regNumber = regIndex + 1;

const url = safeUrl(reg.website);
const detailHTML = `
    <div style="padding: 10px; background: #f8fef9; border-left: 3px solid #065f46; border-radius: 3px;">
        <p style="margin: 0 0 8px 0;"><strong style="color: #065f46; font-size: 1.1em;">${regNumber}. ${esc(reg.name)}</strong></p>
        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Jurisdiction:</strong> ${esc(reg.jurisdiction)}</p>
        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Pollutants Covered:</strong> ${esc(reg.pollutants)}</p>
        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Industry Covered:</strong> ${esc(industryCovered)}</p>
        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Date Enacted:</strong> ${esc(reg.date_enacted)} | <strong>Still in Effect:</strong> ${formatYesNo(reg.still_in_effect)}</p>
        <p style="margin: 8px 0 5px 0; font-size: 0.9em;"><strong>Description:</strong><br>${esc(reg.description)}</p>
        ${reg.how_affects && reg.how_affects !== 'N/A' && reg.how_affects !== 'nan' ? `<p style="margin: 8px 0 5px 0; font-size: 0.9em;"><strong>How it Affects Corporations:</strong><br>${esc(reg.how_affects)}</p>` : ''}
        ${url ? `<p style="margin: 8px 0 0 0; font-size: 0.85em;"><strong>Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #065f46; word-break: break-all;">${url.length > 60 ? esc(url.substring(0, 60)) + '...' : esc(url)}</a></p>` : ''}
        ${url ? `<p style="margin: 8px 0 0 0; font-size: 0.85em;"><strong>Document in English:</strong> ${reg.in_english && reg.in_english.toUpperCase() === 'Y' ? '<span style="color: #10b981; font-size: 1.2em;">✓</span>' : '<span style="color: #ef4444; font-size: 1.2em;">✗</span>'}</p>` : ''}
    </div>
`;

            document.getElementById('timelineDetailContent').innerHTML = detailHTML;
            
            const panel = document.getElementById('timelineDetailPanel');
            if (window.innerWidth <= 768) {
                panel.style.width = '90vw';
                panel.style.height = '85vh';
            } else {
                panel.style.width = '552px';
                panel.style.height = '660px';
            }
            
            document.getElementById('timelineOverlay').style.display = 'block';
        }

        function closeTimelineDetail() {
            timelineSelectedReg = null;
            document.getElementById('timelineOverlay').style.display = 'none';
        }

        function nextRegulation() {
            if (activeTab === 'carbon') {
                if (currentVCMIndex < currentVCMProjects.length - 1) {
                    currentVCMIndex++;
                    displayCurrentVCM();
                }
                return;
            }
            if (activeTab === 'biomethane') {
                if (currentBiomethaneIndex < currentBiomethanePrograms.length - 1) {
                    currentBiomethaneIndex++;
                    displayCurrentBiomethane();
                }
                return;
            }
const data = currentDisplayData;
if (!data) return;
            
            const displayRegulations = filterRegulations(data.regulations);
            
            if (data && currentRegIndex < displayRegulations.length + 1) {
                currentRegIndex++;
                displayCurrentRegulation();
            }
        }

        function prevRegulation() {
            if (activeTab === 'carbon') {
                if (currentVCMIndex > 0) {
                    currentVCMIndex--;
                    displayCurrentVCM();
                }
                return;
            }
            if (activeTab === 'biomethane') {
                if (currentBiomethaneIndex > 0) {
                    currentBiomethaneIndex--;
                    displayCurrentBiomethane();
                }
                return;
            }
            if (currentRegIndex > 0) {
                currentRegIndex--;
                displayCurrentRegulation();
            }
        }

        // Zoom button controls
        document.getElementById('zoomIn').addEventListener('click', () => {
            const svg = d3.select('#worldMap');
            svg.transition().call(zoomBehavior.scaleBy, 1.5);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            const svg = d3.select('#worldMap');
            svg.transition().call(zoomBehavior.scaleBy, 0.67);
        });

        document.getElementById('zoomReset').addEventListener('click', () => {
            const svg = d3.select('#worldMap');
            svg.transition().call(zoomBehavior.transform, d3.zoomIdentity);
        });

        document.getElementById('prevReg').addEventListener('click', (e) => {
            e.stopPropagation();
            prevRegulation();
        });

        document.getElementById('nextReg').addEventListener('click', (e) => {
            e.stopPropagation();
            nextRegulation();
        });

        document.getElementById('closeBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            deselectCountry();
        });

        document.getElementById('nationalBtn').addEventListener('click', () => {
            showNationalRegulations();
        });

        document.getElementById('subdivisionBtn').addEventListener('click', () => {
            showSubdivisionLevel();
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                document.getElementById('modalOverlay').classList.remove('visible');
            }
        });

        // Tooltip drag behavior
        const tooltip = document.getElementById('tooltip');
        const tooltipContent = document.getElementById('tooltipContent');

        tooltip.addEventListener('mousedown', (e) => {
            if (isTimelineView) return;
            if (e.target.tagName === 'BUTTON' || 
                e.target.tagName === 'A' ||
                e.target.closest('#tooltipContent')) {
                return;
            }
            
            isDragging = true;
            const rect = tooltip.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            tooltip.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const newLeft = e.clientX - dragOffsetX;
                const newTop = e.clientY - dragOffsetY;
                const maxLeft = window.innerWidth - tooltip.offsetWidth;
                const maxTop = window.innerHeight - tooltip.offsetHeight;
                tooltip.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                tooltip.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                tooltip.style.right = 'auto';
                tooltip.style.bottom = 'auto';
            }
            
            if (isResizing) {
                e.preventDefault();
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;
                const newWidth = Math.max(300, Math.min(800, resizeStartWidth + deltaX));
                const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, resizeStartHeight + deltaY));
                tooltip.style.width = newWidth + 'px';
                tooltip.style.height = newHeight + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                tooltip.style.cursor = 'move';
            }
            if (isResizing) {
                isResizing = false;
            }
        });

        // Resize handle
        const resizeHandle = document.querySelector('.resize-handle');
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            hasBeenResized = true; // FIX #6: mark tooltip as manually resized
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            resizeStartWidth = tooltip.offsetWidth;
            resizeStartHeight = tooltip.offsetHeight;
        });

        // Initialize
async function initialize() {
    document.body.appendChild(document.getElementById('tooltip'));
    document.body.appendChild(document.getElementById('hoverTooltip'));

    // Re-reparent tooltips if Squarespace ever moves them back
    const observer = new MutationObserver(ensureTooltipsInBody);
    observer.observe(document.body, { childList: true, subtree: true });
    await loadWorldMap();
            countryData = await loadRegulationsData();
            populateFilterSets();
            renderMap();
            setupFilterEventListeners();
        }

        function populateFilterSets() {
            kigaliCountries.clear();
            methaneCountries.clear();
            
            Object.entries(countryData).forEach(([country, data]) => {
                if (data.regulations) {
                    data.regulations.forEach(reg => {
                        const regName = reg.name.toLowerCase();
                        // FIX #5: Use COMMITMENT_REGULATION_NAMES constant
                        if (regName.includes(COMMITMENT_REGULATION_NAMES[1])) {
                            kigaliCountries.add(country);
                            addCountryVariations(kigaliCountries, country);
                        }
                        if (regName.includes(COMMITMENT_REGULATION_NAMES[0])) {
                            methaneCountries.add(country);
                            addCountryVariations(methaneCountries, country);
                        }
                    });
                }
            });
            
        }
        
        function addCountryVariations(set, country) {
            if (country === 'United States' || country === 'USA') {
                set.add('United States');
                set.add('United States of America');
                set.add('USA');
            }
            if (country === 'Czech Republic' || country === 'Czechia') {
                set.add('Czech Republic');
                set.add('Czechia');
            }
            if (country === 'Democratic Republic of the Congo' || country === 'Dem. Rep. Congo') {
                set.add('Democratic Republic of the Congo');
                set.add('Dem. Rep. Congo');
            }
            if (country === 'Republic of the Congo' || country === 'Congo') {
                set.add('Republic of the Congo');
                set.add('Congo');
            }
        }
        
        function setupFilterEventListeners() {
            document.getElementById('kigaliFilter').addEventListener('change', (e) => {
                kigaliFilterActive = e.target.checked;
                updateCountryHighlighting();
            });
            
            document.getElementById('methaneFilter').addEventListener('change', (e) => {
                methaneFilterActive = e.target.checked;
                updateCountryHighlighting();
            });
            
            const industryFilterMap = {
                'filterHVAC': () => { showHVAC = document.getElementById('filterHVAC').checked; },
                'filterAgriculture': () => { showAgriculture = document.getElementById('filterAgriculture').checked; },
                'filterTradingTax': () => { showTradingTax = document.getElementById('filterTradingTax').checked; },
                'filterFossilFuel': () => { showFossilFuel = document.getElementById('filterFossilFuel').checked; },
                'filterSolidWaste': () => { showSolidWaste = document.getElementById('filterSolidWaste').checked; },
                'filterTransportation': () => { showTransportation = document.getElementById('filterTransportation').checked; },
                'filterRemaining': () => { showRemaining = document.getElementById('filterRemaining').checked; }
            };

            Object.entries(industryFilterMap).forEach(([id, setter]) => {
                document.getElementById(id).addEventListener('change', (e) => {
                    if (!e.target.disabled) {
                        setter();
                        if (currentCountry) displayCurrentRegulation();
                    }
                });
            });
        }
        
        function updateAgreementsHighlighting(active) {
            d3.selectAll('.country').each(function() {
                const el = d3.select(this);
                const name = el.attr('data-country');
                if (!name) return;
                if (active && (kigaliCountries.has(name) || methaneCountries.has(name))) {
                    el.style('fill', '#6b7280');
                } else {
                    el.style('fill', null);
                }
            });
        }

        function updateCountryHighlighting() {
            // Don't touch fills if CH4 layer is managing them
            if (ch4LayerActive) return;
            const anyFilterActive = kigaliFilterActive || methaneFilterActive;
            
            d3.selectAll('.country').each(function() {
                const countryPath = d3.select(this);
                const countryName = countryPath.attr('data-country');
                if (!countryName) return;
                
                if (!anyFilterActive) {
                    countryPath.classed('highlighted', false);
                    countryPath.classed('dimmed', false);
                    countryPath.style('fill', null);
                    countryPath.style('stroke', null);
                    countryPath.style('stroke-width', null);
                } else {
                    const matchesKigali  = kigaliFilterActive  && kigaliCountries.has(countryName);
                    const matchesMethane = methaneFilterActive && methaneCountries.has(countryName);
                    const matches = matchesKigali || matchesMethane;
                    countryPath.classed('highlighted', matches);
                    countryPath.classed('dimmed', !matches);
                    if (matches) {
                        countryPath.style('fill', '#047857');
                        countryPath.style('stroke', '#ffffff');
                        countryPath.style('stroke-width', '0.5');
                    } else {
                        countryPath.style('fill', '#9ca3af');
                        countryPath.style('stroke', '#d1d5db');
                        countryPath.style('stroke-width', '0.5');
                    }
                }
            });
            // If on agreements tab with active filter, inline styles from updateCountryHighlighting
            // handle the green/dimmed display â€” CSS class handles the default dark grey
            if (activeTab === 'agreements') {
                const agreementOverlay = document.getElementById('selectAgreementOverlay');
                agreementOverlay.classList.toggle('visible', !anyFilterActive);
            }
        }
        
        initialize();

        // Re-render map on window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (worldMapData) {
                    renderMap();
                }
            }, 250);
        });

        // ============================================
        // CH4 EMISSIONS LAYER
        // ============================================

        const CH4_TOTALS_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJi-qo-LucF89aehHoaql7fy0ILu39mEwRGX_yyCVVPD9Kyir_ilTge5I9x3Ax096svxTbq9Lyz2pQ/pub?gid=581726615&single=true&output=csv';
        const CH4_SECTORS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJi-qo-LucF89aehHoaql7fy0ILu39mEwRGX_yyCVVPD9Kyir_ilTge5I9x3Ax096svxTbq9Lyz2pQ/pub?gid=582954007&single=true&output=csv';
        const BIOMETHANE_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJi-qo-LucF89aehHoaql7fy0ILu39mEwRGX_yyCVVPD9Kyir_ilTge5I9x3Ax096svxTbq9Lyz2pQ/pub?gid=1586590993&single=true&output=csv';
        const VCM_URL         = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJi-qo-LucF89aehHoaql7fy0ILu39mEwRGX_yyCVVPD9Kyir_ilTge5I9x3Ax096svxTbq9Lyz2pQ/pub?gid=1466741913&single=true&output=csv';

        let biomethaneData       = {};   // keyed by country name
        let biomethaneDataLoaded = false;

        let vcmData              = {};   // keyed by country name
        let vcmDataLoaded        = false;
        let vcmFilterTypes       = [];    // unique Project Type Filter values from sheet
        let activeVCMFilters     = new Set(); // currently shown types (all = show all)

        let ch4TotalsData   = {};
        let ch4SectorsData  = {};
        let ch4LayerActive  = false;
        let ch4PopupCountry = null;
        let ch4Year         = '2024';
        let ch4Sector       = 'total';
        let ch4ColorScale   = null;
        let ch4MaxValue     = 0;
        let ch4SectorList   = [];
        let ch4TotalsLoaded = false;
        let ch4SectorsLoaded = false;

        const EDGAR_TO_MAP_NAME = {
            'united states':                          'United States of America',
            'usa':                                    'United States of America',
            'russian federation':                     'Russia',
            'republic of korea':                      'South Korea',
            "dem. people's republic of korea":        'North Korea',
            "democratic people's republic of korea":  'North Korea',
            'iran (islamic republic of)':             'Iran',
            'islamic republic of iran':               'Iran',
            'bolivia (plurinational state of)':       'Bolivia',
            'plurinational state of bolivia':         'Bolivia',
            'venezuela (bolivarian republic of)':     'Venezuela',
            'bolivarian republic of venezuela':       'Venezuela',
            'viet nam':                               'Vietnam',
            'dem. rep. congo':                        'Democratic Republic of the Congo',
            'democratic republic of the congo':       'Democratic Republic of the Congo',
            "congo, the democratic republic of the":  'Democratic Republic of the Congo',
            'republic of congo':                      'Congo',
            'lao pdr':                                'Laos',
            "lao people's democratic republic":       'Laos',
            'syrian arab republic':                   'Syria',
            'taiwan, province of china':              'Taiwan',
            'united republic of tanzania':            'Tanzania',
            'czech republic':                         'Czechia',
            'north macedonia':                        'Macedonia',
            'moldova, republic of':                   'Moldova',
            'republic of moldova':                    'Moldova',
            "côte d'ivoire":                          "Côte d'Ivoire",
            "cote d'ivoire":                          "Côte d'Ivoire",
            'swaziland':                              'Eswatini',
            'cabo verde':                             'Cape Verde',
            'timor-leste':                            'East Timor',
            'holy see (vatican city state)':          'Vatican City',
            'brunei darussalam':                      'Brunei',
        };

        function normalizeCH4Name(name) {
            if (!name) return '';
            const lower = name.toLowerCase().trim();
            return EDGAR_TO_MAP_NAME[lower] || name;
        }

        function getCH4Key(mapCountryName) {
            if (!mapCountryName) return null;
            const lower = mapCountryName.toLowerCase();
            if (ch4TotalsData[lower]) return lower;
            for (const [edgarKey, mapName] of Object.entries(EDGAR_TO_MAP_NAME)) {
                if (mapName.toLowerCase() === lower && ch4TotalsData[edgarKey]) return edgarKey;
            }
            return null;
        }

        function getCH4SectorsKey(mapCountryName) {
            if (!mapCountryName) return null;
            const lower = mapCountryName.toLowerCase();
            if (ch4SectorsData[lower]) return lower;
            for (const [edgarKey, mapName] of Object.entries(EDGAR_TO_MAP_NAME)) {
                if (mapName.toLowerCase() === lower && ch4SectorsData[edgarKey]) return edgarKey;
            }
            return null;
        }

        function parseCH4Totals(csvText) {
            const lines = csvText.replace(/\r/g, '').split('\n');
            const headers = parseCSVLine(lines[0]).map(h => h.trim());
            ch4TotalsData = {};
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const vals = line.split(',');
                const row = {};
                headers.forEach((h, idx) => row[h] = (vals[idx] || '').trim());
                const key = (row.country_name || '').toLowerCase();
                if (!key) continue;
                ch4TotalsData[key] = {
                    country_code: row.country_code,
                    country_name: row.country_name,
                    ch4_2022: parseFloat(row.ch4_2022_kt) || 0,
                    ch4_2023: parseFloat(row.ch4_2023_kt) || 0,
                    ch4_2024: parseFloat(row.ch4_2024_kt) || 0,
                };
            }
        }

        function parseCH4Sectors(csvText) {
            const lines = csvText.replace(/\r/g, '').split('\n');
            const headers = parseCSVLine(lines[0]).map(h => h.trim());
            ch4SectorsData = {};
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const vals = parseCSVLine(line);
                const row = {};
                headers.forEach((h, idx) => row[h] = (vals[idx] || '').trim());
                const key = (row.country_name || '').toLowerCase();
                if (!key) continue;
                if (!ch4SectorsData[key]) ch4SectorsData[key] = [];
                ch4SectorsData[key].push({
                    sector_code: row.sector_code,
                    sector_name: row.sector_name,
                    ch4_2022: parseFloat(row.ch4_2022_kt) || 0,
                    ch4_2023: parseFloat(row.ch4_2023_kt) || 0,
                    ch4_2024: parseFloat(row.ch4_2024_kt) || 0,
                    pct_2022: parseFloat(row.ch4_2022_pct) || 0,
                    pct_2023: parseFloat(row.ch4_2023_pct) || 0,
                    pct_2024: parseFloat(row.ch4_2024_pct) || 0,
                });
            }
        }

        function finalizeCH4Load() {
            if (!ch4TotalsLoaded || !ch4SectorsLoaded) return;
            const sectorSet = new Set();
            Object.values(ch4SectorsData).forEach(arr => arr.forEach(s => sectorSet.add(s.sector_name)));
            ch4SectorList = [...sectorSet].sort();
            populateCH4SectorDropdown();
            const btn = document.getElementById('ch4LayerBtn');
            btn.disabled = false;
        }

        async function loadCH4Data() {
            try {
                const [totalsRes, sectorsRes] = await Promise.all([
                    fetch(CH4_TOTALS_URL),
                    fetch(CH4_SECTORS_URL)
                ]);
                if (!totalsRes.ok || !sectorsRes.ok) throw new Error('HTTP error');
                const [t, s] = await Promise.all([totalsRes.text(), sectorsRes.text()]);
                parseCH4Totals(t);
                parseCH4Sectors(s);
                ch4TotalsLoaded = true;
                ch4SectorsLoaded = true;
                finalizeCH4Load();
            } catch (e) {
                console.error('CH4 load error:', e);
                document.getElementById('ch4UploadSection').style.display = 'block';
            }
        }

        function handleCH4TotalsUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                parseCH4Totals(e.target.result);
                ch4TotalsLoaded = true;
                finalizeCH4Load();
            };
            reader.readAsText(file);
        }

        function handleCH4SectorsUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                parseCH4Sectors(e.target.result);
                ch4SectorsLoaded = true;
                finalizeCH4Load();
            };
            reader.readAsText(file);
        }

        function populateCH4SectorDropdown() {
            const sel = document.getElementById('ch4SectorSelect');
            sel.innerHTML = '<option value="total">All Sectors (Total)</option>';
            ch4SectorList.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name.length > 40 ? name.substring(0, 38) + '…' : name;
                sel.appendChild(opt);
            });
        }

        function getCH4Value(mapCountryName) {
            const key = getCH4Key(mapCountryName);
            if (!key) return null;
            if (ch4Sector === 'total') {
                return ch4TotalsData[key]?.[`ch4_${ch4Year}`] ?? null;
            } else {
                const skey = getCH4SectorsKey(mapCountryName) || key;
                const sectors = ch4SectorsData[skey];
                if (!sectors) return null;
                const s = sectors.find(x => x.sector_name === ch4Sector);
                return s ? (s[`ch4_${ch4Year}`] || 0) : null;
            }
        }

        function buildCH4ColorScale() {
            const vals = [];
            worldMapData.features.forEach(f => {
                const v = getCH4Value(f.properties.name || '');
                if (v !== null && v > 0) vals.push(v);
            });
            if (!vals.length) return;
            vals.sort(d3.ascending);
            const lo = vals[0];
            ch4MaxValue = d3.quantile(vals, 0.95);
            ch4ColorScale = d3.scaleSequentialLog()
                .domain([Math.max(1, lo), Math.max(2, ch4MaxValue)])
                .clamp(true)
                .interpolator(d3.interpolateYlOrRd);
        }

        function updateCH4Layer() {
            if (!ch4LayerActive) {
                d3.selectAll('.country').style('fill', null);
                document.getElementById('ch4Legend').style.display = 'none';
                return;
            }
            // Always clear CSS-class-based green fills first so regulation
            // colours never bleed through while CH4 is active
            d3.selectAll('.country').style('fill', '#e5e7eb');
            buildCH4ColorScale();
            if (!ch4ColorScale) return;
            d3.selectAll('.country').each(function() {
                const el = d3.select(this);
                const name = el.attr('data-country');
                if (!name) return;
                const v = getCH4Value(name);
                el.style('fill', (v !== null && v > 0) ? ch4ColorScale(v) : '#e5e7eb');
            });
            renderCH4Legend();
        }

        function renderCH4Legend() {
            const legend = document.getElementById('ch4Legend');
            legend.style.display = 'block';
            const svg = d3.select('#ch4LegendSvg');
            svg.html('');
            const defs = svg.append('defs');
            const grad = defs.append('linearGradient').attr('id', 'ch4Grad').attr('x1', '0%').attr('x2', '100%');
            d3.range(0, 1.01, 0.1).forEach(t => {
                grad.append('stop').attr('offset', `${Math.round(t*100)}%`).attr('stop-color', d3.interpolateYlOrRd(t));
            });
            svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#ch4Grad)').attr('rx', 2);
            const lo = Math.round(ch4ColorScale.domain()[0]);
            document.getElementById('ch4LegendMin').textContent = lo.toLocaleString() + ' kt';
            document.getElementById('ch4LegendMax').textContent = Math.round(ch4MaxValue).toLocaleString() + '+ kt';
            const sLabel = ch4Sector === 'total' ? 'All Sectors' : (ch4Sector.length > 25 ? ch4Sector.substring(0,23)+'…' : ch4Sector);
            document.getElementById('ch4LegendTitle').textContent = `CH₄ (${ch4Year}) — ${sLabel}`;
        }

        function showNoTabMessage(event, pathElement) {
            d3.selectAll('.country').classed('selected', false);
            d3.select(pathElement).classed('selected', true);
            const tooltip = document.getElementById('tooltip');
            const tooltipContent = document.getElementById('tooltipContent');
            const tooltipCountry = document.getElementById('tooltipCountry');
            const tooltipNav = document.getElementById('tooltipNav');
            const industryFilters = document.getElementById('industryFilters');
            document.getElementById('timelineToggle').style.display = 'none';
            document.getElementById('timelineOverlay').style.display = 'none';
            tooltipNav.style.display = 'none';
            industryFilters.style.display = 'none';
            hideVCMFilters();
            tooltipCountry.textContent = '';
            tooltipContent.innerHTML = 
                '<div style="text-align:center; padding:40px 20px;">'
                + '<p style="font-size:1.1em; font-weight:600; color:#065f46; margin-bottom:8px;">No layer selected</p>'
                + '<p style="font-size:0.9em; color:#6b7280;">Select a layer above to explore data for this country.</p>'
                + '</div>';
            positionTooltip(event);
            tooltip.classList.add('visible');
        }

        // ============================================
        // Tab navigation
        // ============================================
        // Track which banners have been dismissed this session
        const dismissedBanners = new Set();

        function dismissBanner(id) {
            dismissedBanners.add(id);
            document.getElementById(id).classList.remove('visible');
        }

        function showBanner(id) {
            if (!dismissedBanners.has(id)) {
                document.getElementById(id).classList.add('visible');
            }
        }

        function hideBanner(id) {
            document.getElementById(id).classList.remove('visible');
        }

        function setActiveTab(tab) {
            const allTabs = {
                emissions: 'tabEmissions',
                regulations: 'tabRegulations',
                biomethane: 'tabBiomethane',
                carbon: 'tabCarbon',
                agreements: 'tabAgreements'
            };
            const sidebar        = document.getElementById('layerSidebar');
            const rightPanel     = document.getElementById('rightPanel');
            const filterControls = document.getElementById('filterControls');
            const worldMap       = document.getElementById('worldMap');
            const comingSoon     = document.getElementById('comingSoonOverlay');

            // Toggle: clicking the already-active tab deselects it
            if (activeTab === tab) {
                activeTab = null;
                Object.values(allTabs).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.remove('active');
                });
                sidebar.classList.remove('visible');
                rightPanel.classList.remove('visible');
                filterControls.classList.remove('visible');
                comingSoon.classList.remove('visible');
                document.getElementById('selectPollutantOverlay').classList.remove('visible');
                document.getElementById('selectAgreementOverlay').classList.remove('visible');
                hideBanner('bioMethaneBanner');
                hideBanner('emissionsBanner');
                hideBanner('vcmBanner');
                worldMap.classList.remove('map-agreements');
                worldMap.classList.add('map-no-tab');
                updateAgreementsHighlighting(false);
                // Reset Kigali/Methane filters
                kigaliFilterActive = false;
                methaneFilterActive = false;
                document.getElementById('kigaliFilter').checked = false;
                document.getElementById('methaneFilter').checked = false;
                updateCountryHighlighting();
                // Turn off CH4 if it was on
                if (ch4LayerActive) {
                    ch4LayerActive = false;
                    document.getElementById('ch4LayerBtn').classList.remove('active');
                    document.getElementById('ch4RightControls').style.display = 'none';
                    if (subfederalCountry) { subfederalCountry = null; renderMap(); }
                    deselectCountry();
                    updateCH4Layer();
                } else {
                    deselectCountry();
                }
                return;
            }

            // Switching to a new tab
            activeTab = tab;
            Object.entries(allTabs).forEach(([key, id]) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('active', key === tab);
            });
            worldMap.classList.remove('map-no-tab');
            // Show coming-soon overlay and grey map for unimplemented tabs
            const comingSoonTabs = [];
            comingSoon.classList.toggle('visible', comingSoonTabs.includes(tab));
            if (comingSoonTabs.includes(tab)) {
                worldMap.classList.add('map-no-tab');
            }
            // VCM: load data lazily then colour the map
            if (tab === 'carbon') {
                if (subfederalCountry) { subfederalCountry = null; renderMap(); }
                loadVCMData().then(() => updateVCMLayer());
                showBanner('vcmBanner');
            } else {
                d3.selectAll('.country').classed('has-vcm', false);
                hideBanner('vcmBanner');
            }
            // Biomethane: load data lazily then colour the map
            if (tab === 'biomethane') {
                if (subfederalCountry) { subfederalCountry = null; renderMap(); }
                loadBiomethaneData().then(() => updateBiomethaneLayer());
                showBanner('bioMethaneBanner');
            } else {
                // Clear biomethane classes when leaving
                d3.selectAll('.country').classed('has-biomethane', false);
                hideBanner('bioMethaneBanner');
            }
            // Show layer sidebar only on emissions tab
            sidebar.classList.toggle('visible', tab === 'emissions');
            // Grey out map on agreements tab (no country data shown)
            if (tab === 'agreements') {
                worldMap.classList.add('map-no-tab');
                worldMap.classList.add('map-agreements');
                document.getElementById('selectAgreementOverlay').classList.add('visible');
            } else {
                worldMap.classList.remove('map-agreements');
                document.getElementById('selectAgreementOverlay').classList.remove('visible');
                updateAgreementsHighlighting(false);
            }
            // Auto-select CH4 layer when switching to emissions tab
            if (tab === 'emissions' && !ch4LayerActive) {
                toggleCH4Layer();
            }
            if (tab === 'emissions') {
                updateEmissionsOverlay();
                showBanner('emissionsBanner');
            } else {
                hideBanner('emissionsBanner');
            }
            // Show Kigali/Methane filter controls only on agreements tab
            filterControls.classList.toggle('visible', tab === 'agreements');
            // Reset filter checkboxes when leaving agreements tab
            if (tab !== 'agreements') {
                kigaliFilterActive = false;
                methaneFilterActive = false;
                document.getElementById('kigaliFilter').checked = false;
                document.getElementById('methaneFilter').checked = false;
                updateCountryHighlighting(); // clears inline styles and classes
            }
            // Hide right panel and turn off CH4 when leaving emissions tab
            if (tab !== 'emissions') {
                document.getElementById('selectPollutantOverlay').classList.remove('visible');
                rightPanel.classList.remove('visible');
                if (ch4LayerActive) {
                    ch4LayerActive = false;
                    document.getElementById('ch4LayerBtn').classList.remove('active');
                    document.getElementById('ch4RightControls').style.display = 'none';
                    if (subfederalCountry) { subfederalCountry = null; renderMap(); }
                    deselectCountry();
                    updateCH4Layer();
                }
            }
        }

        function updateEmissionsOverlay() {
            if (activeTab !== 'emissions') return;
            const overlay = document.getElementById('selectPollutantOverlay');
            const worldMap = document.getElementById('worldMap');
            const anyLayerOn = ch4LayerActive; // extend with other layers as added
            overlay.classList.toggle('visible', !anyLayerOn);
            worldMap.classList.toggle('map-no-tab', !anyLayerOn);
        }

        function toggleCH4Layer() {
            ch4LayerActive = !ch4LayerActive;
            const btn = document.getElementById('ch4LayerBtn');
            const rightPanel = document.getElementById('rightPanel');
            const ch4RightControls = document.getElementById('ch4RightControls');
            btn.classList.toggle('active', ch4LayerActive);
            rightPanel.classList.toggle('visible', ch4LayerActive);
            ch4RightControls.style.display = ch4LayerActive ? 'block' : 'none';
            // When turning CH4 ON, close any open regulation popup and clear all
            // country selection state (including subfederal drill-down)
            if (ch4LayerActive) {
                if (subfederalCountry) {
                    subfederalCountry = null;
                    renderMap();
                }
                deselectCountry();
            }
            updateCH4Layer();
            updateEmissionsOverlay();
        }

        function setCH4Year(year) {
            ch4Year = year;
            ['2022','2023','2024'].forEach(y => {
                document.getElementById(`yearBtn${y}`).classList.toggle('active', y === year);
            });
            if (ch4LayerActive) updateCH4Layer();
            if (ch4PopupCountry) showCH4Data(null, ch4PopupCountry);
            else if (currentCountry) displayCurrentRegulation();
        }

        function setCH4Sector(sector) {
            ch4Sector = sector;
            if (ch4LayerActive) updateCH4Layer();
            if (ch4PopupCountry) showCH4Data(null, ch4PopupCountry);
            else if (currentCountry) displayCurrentRegulation();
        }

        loadCH4Data();
    