// ============================================================
// INDUCTIVE LAYER — Corporate Estimator Wizard
// ============================================================

// ─── STATE ───────────────────────────────────────────────────
let wizardStep = 1;
let wizardProfile = { hq: '', sources: [], exports: [], sector: '', subsector: '', revenue: '', usStates: [] };
let inductiveResults = null;
let activeResultsTab = 'domestic';

// ─── SECTOR DATA ─────────────────────────────────────────────
const SECTOR_DATA = {
  'Food & Beverage': {
    pollutants: ['HFC', 'Methane'],
    industryFlags: ['solid_waste', 'food_agriculture'],
    subcategories: ['Food Processing & Manufacturing', 'Beverage Production', 'Food Distribution & Cold Chain', 'Restaurants & Food Service'],
    naics: '311-312'
  },
  'Agriculture & Livestock': {
    pollutants: ['Methane', 'N2O'],
    industryFlags: ['food_agriculture'],
    subcategories: ['Crop Farming', 'Livestock & Dairy', 'Aquaculture & Fishing'],
    naics: '111-112'
  },
  'Manufacturing & Industrial': {
    pollutants: ['HFC', 'NOx', 'Black Carbon'],
    industryFlags: ['hvac', 'fossil_fuel_production'],
    subcategories: ['Metal Manufacturing', 'Electronics Manufacturing', 'Textile & Apparel', 'Plastics & Rubber', 'General Manufacturing'],
    naics: '313-339'
  },
  'Logistics & Transportation': {
    pollutants: ['NOx', 'Black Carbon'],
    industryFlags: ['transportation'],
    subcategories: ['Road Freight & Trucking', 'Air Freight & Aviation', 'Shipping & Maritime', 'Warehousing & Distribution', 'Rail Freight'],
    naics: '481-492'
  },
  'Real Estate & Construction': {
    pollutants: ['HFC', 'NOx'],
    industryFlags: ['hvac'],
    subcategories: ['Commercial Real Estate', 'Residential Development', 'Construction & Building', 'Facilities Management'],
    naics: '236-238'
  },
  'Retail & Consumer Goods': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Grocery & Food Retail', 'General Retail', 'E-Commerce & Fulfilment', 'Consumer Goods Manufacturing'],
    naics: '441-459'
  },
  'Waste Management & Recycling': {
    pollutants: ['Methane'],
    industryFlags: ['solid_waste'],
    subcategories: ['Municipal Waste Management', 'Industrial Waste', 'Recycling & Recovery', 'Wastewater Treatment'],
    naics: '562'
  },
  'Energy & Utilities': {
    pollutants: ['Methane', 'NOx'],
    industryFlags: ['fossil_fuel_production', 'trading_tax_systems'],
    subcategories: ['Oil & Gas Production', 'Natural Gas Distribution', 'Electric Power Generation', 'Renewable Energy'],
    naics: '211, 221'
  },
  'Chemical & Pharmaceutical': {
    pollutants: ['HFC', 'Other F-Gases', 'N2O'],
    industryFlags: ['fossil_fuel_production'],
    subcategories: ['Industrial Chemicals', 'Pharmaceuticals & Biotech', 'Specialty Chemicals', 'Agrochemicals'],
    naics: '325-326'
  },
  'Technology & Data Centers': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Data Centers & Cloud Computing', 'Software & SaaS', 'Hardware Manufacturing', 'IT Services'],
    naics: '518, 334'
  },
  'Financial Services & Insurance': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Banking & Investment', 'Insurance', 'Asset Management', 'Financial Technology'],
    naics: '521-541'
  },
  'Healthcare': {
    pollutants: ['HFC', 'N2O'],
    industryFlags: ['hvac'],
    subcategories: ['Hospitals & Clinics', 'Pharmaceuticals (Clinical)', 'Medical Devices', 'Aged Care & Residential'],
    naics: '621-623'
  },
  'Hospitality & Tourism': {
    pollutants: ['HFC', 'Methane'],
    industryFlags: ['hvac', 'solid_waste'],
    subcategories: ['Hotels & Accommodation', 'Restaurants & Dining', 'Travel & Airlines', 'Events & Conferences'],
    naics: '721-722'
  },
  'Mining & Extractives': {
    pollutants: ['Methane', 'NOx', 'Black Carbon'],
    industryFlags: ['fossil_fuel_production'],
    subcategories: ['Coal Mining', 'Oil & Gas Extraction', 'Metal & Mineral Mining', 'Quarrying'],
    naics: '211-213'
  },
  'Media, Entertainment & Events': {
    pollutants: ['NOx', 'Black Carbon'],
    industryFlags: ['transportation'],
    subcategories: ['Film & Television', 'Music & Live Events', 'Sports & Recreation', 'Digital Media & Streaming'],
    naics: '711-713'
  },
  'Education & Research': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Universities & Higher Education', 'Schools & K-12', 'Research Institutes', 'Online Education'],
    naics: '611'
  },
  'Telecommunications': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Mobile & Wireless', 'Fixed Line & Broadband', 'Satellite Communications', 'Network Infrastructure'],
    naics: '517'
  },
  'Government & Public Sector': {
    pollutants: ['HFC', 'NOx'],
    industryFlags: ['hvac', 'transportation'],
    subcategories: ['National Government', 'State & Regional Government', 'Municipal Government', 'Public Transit & Infrastructure'],
    naics: '921-928'
  },
  'Professional Services': {
    pollutants: ['HFC'],
    industryFlags: ['hvac'],
    subcategories: ['Legal Services', 'Management Consulting', 'Accounting & Finance', 'Architecture & Engineering'],
    naics: '541'
  },
  'Other': {
    pollutants: ['HFC', 'Methane', 'NOx', 'Black Carbon', 'Other F-Gases', 'N2O'],
    industryFlags: [],
    subcategories: ['Other'],
    naics: '—'
  }
};

// ─── "SO WHAT" NARRATIVES ────────────────────────────────────
function getSoWhat(reg, context) {
  // context: 'domestic' | 'import' | 'export'
  const name = (reg.name || '').toLowerCase();
  const pollutants = (reg.pollutants || '').toLowerCase();

  // Pronoun helpers based on context
  const your      = context === 'import' ? 'The country you import from and its' : context === 'export' ? 'The country you export to and its' : 'Your';
  const yourLower = context === 'import' ? 'the country you import from and its' : context === 'export' ? 'the country you export to and its' : 'your';
  const youMay    = context === 'import' ? 'Suppliers in this country may'        : context === 'export' ? 'Buyers or operators in this market may' : 'You may';
  const yourOps   = context === 'import' ? 'Operations in the country you import from' : context === 'export' ? 'Operations in the country you export to' : 'Your operations';

  if (name.includes('cbam') || name.includes('carbon border') || name.includes('border adjustment'))
    return context === 'export'
      ? 'This market applies a carbon border adjustment mechanism. Carbon-intensive goods you export here may be subject to additional levies, increasing your cost to serve.'
      : context === 'import'
      ? 'This sourcing country has a carbon border mechanism. Goods imported from here may carry embedded carbon costs that affect your supply chain pricing.'
      : 'Import prices for carbon-intensive goods into this jurisdiction are likely to rise, potentially affecting your cost base and competitiveness.';

  if (name.includes('cap-and-trade') || name.includes('cap and trade') || name.includes('emission trading') || name.includes(' ets ') || name.includes('allowances'))
    return `${youMay} need to purchase and surrender emission allowances under this scheme, creating compliance costs and ongoing monitoring and reporting obligations.`;

  // Treaty participation — Kigali Amendment and Global Methane Pledge
  if (name.includes('global methane pledge') || name.includes('methane pledge'))
    return 'This country has committed to the Global Methane Pledge, signalling likely future regulation of methane emissions. While not yet a direct compliance obligation, it indicates regulatory tightening ahead in this jurisdiction.';
  if (name.includes('kigali amendment participant'))
    return 'This country is a signatory to the Kigali Amendment to the Montreal Protocol, committing to phase down HFCs. Expect tightening regulations on refrigerants and cooling equipment in this jurisdiction.';

  if (pollutants.includes('hfc') && (name.includes('kigali') || name.includes('hfc') || name.includes('refrigerant') || name.includes('f-gas')))
    return `${your} refrigeration and cooling equipment may require upgrades or phase-downs. Certified technician handling, import restrictions, and regular leak inspections may apply.`;

  if (pollutants.includes('methane') && (name.includes('oil') || name.includes('gas') || name.includes('upstream') || name.includes('flaring') || name.includes('venting')))
    return `${yourOps} may face restrictions on venting and flaring, LDAR (leak detection and repair) program requirements, and enhanced emissions monitoring obligations.`;

  if (pollutants.includes('methane'))
    return `Methane emissions from ${yourLower} operations may be subject to monitoring, reporting, and reduction requirements. Waste management and agricultural operations are particularly affected.`;

  if (pollutants.includes('nox') || name.includes('air quality'))
    return `${your} vehicles, boilers, or industrial equipment may be subject to emission limits. Fleet upgrades, operational changes, or permit requirements may apply.`;

  if (name.includes('reporting') || name.includes('registry') || name.includes('inventory') || name.includes('disclosure'))
    return `${youMay} be required to measure, verify, and report greenhouse gas emissions publicly in this jurisdiction. This typically requires monitoring systems and third-party verification.`;

  if (name.includes('biomethane') || name.includes('renewable gas') || name.includes('biogas'))
    return `${youMay} be eligible for incentives or subsidies related to biomethane production or use in this jurisdiction, which could offset compliance costs or create revenue opportunities.`;

  const howAffects = reg.how_affects || '';
  if (howAffects && howAffects !== 'N/A' && howAffects !== 'nan' && howAffects.length > 20)
    return howAffects;
  return 'Review this regulation with your compliance team to understand specific obligations and timelines that apply to your operations.';
}
// ─── COUNTRY LIST ────────────────────────────────────────────
function getCountryList() {
  return Object.keys(countryToISO).sort();
}

function getRevenueLabel(val) {
  const map = { 'small': 'Under $10M', 'medium-small': '$10M – $100M', 'medium-large': '$100M – $1B', 'large': 'Over $1B' };
  return map[val] || val;
}

// ─── MODE SWITCHING ───────────────────────────────────────────
function showSplash() {
  document.getElementById('splashScreen').style.display = 'flex';
  document.querySelector('.container').style.display = 'none';
  document.getElementById('inductiveOverlay').style.display = 'none';
  document.getElementById('resultsOverlay').style.display = 'none';
}

function enterMapMode() {
  localStorage.setItem('spMode', 'map');
  document.getElementById('splashScreen').style.display = 'none';
  document.querySelector('.container').style.display = 'flex';
  document.getElementById('inductiveOverlay').style.display = 'none';
  document.getElementById('resultsOverlay').style.display = 'none';
  document.getElementById('inductiveDetailOverlay').style.display = 'none';
}

function enterCorporateMode() {
  localStorage.setItem('spMode', 'corporate');
  document.getElementById('splashScreen').style.display = 'none';
  document.querySelector('.container').style.display = 'none';
  document.getElementById('resultsOverlay').style.display = 'none';
  // Start fresh wizard
  wizardStep = 1;
  wizardProfile = { hq: '', sources: [], exports: [], sector: '', subsector: '', revenue: '', usStates: [] };
  document.getElementById('inductiveOverlay').style.display = 'flex';
  renderWizardStep(1);
}

// On page load — check remembered preference
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('spMode');
  if (saved === 'map') {
    enterMapMode();
  } else if (saved === 'corporate') {
    enterCorporateMode();
  } else {
    showSplash();
  }
});

// ─── OPEN / CLOSE (kept for internal use) ────────────────────
function openWizard() {
  enterCorporateMode();
}

function backToWizard() {
  document.getElementById('inductiveOverlay').style.display = 'flex';
  document.getElementById('resultsOverlay').style.display = 'none';
  renderWizardStep(wizardStep);
}

// ─── STEP NAVIGATION ──────────────────────────────────────────
function wizardNext() {
  if (!validateStep(wizardStep)) return;
  saveStepData(wizardStep);
  // If step 1 and US selected, go to state selector (step 1.5)
  if (wizardStep === 1 && wizardProfile.hq === 'United States') {
    wizardStep = 1.5;
    renderWizardStep(1.5);
    return;
  }
  // After state selector, jump to step 2 (not 2.5)
  if (wizardStep === 1.5) {
    wizardStep = 2;
    renderWizardStep(2);
    return;
  }
  if (wizardStep === 5) {
    runMatchingAndShowResults();
    return;
  }
  wizardStep++;
  renderWizardStep(wizardStep);
}

function wizardPrev() {
  if (wizardStep === 1) { showSplash(); return; }
  saveStepData(wizardStep);
  // Going back from step 2 — if US was selected, return to state selector
  if (wizardStep === 2 && wizardProfile.hq === 'United States') {
    wizardStep = 1.5;
    renderWizardStep(1.5);
    return;
  }
  // Going back from state selector goes to step 1
  if (wizardStep === 1.5) {
    wizardStep = 1;
    renderWizardStep(1);
    return;
  }
  wizardStep--;
  renderWizardStep(wizardStep);
}

function validateStep(step) {
  if (step === 1 && !document.getElementById('wHQCountry').value) {
    showWizardError('Please select your headquarters country.'); return false;
  }
  if (step === 2 && wizardProfile.sources.length === 0) {
    showWizardError('Please select at least one source country, or check "We do not import".'); return false;
  }
  if (step === 3 && wizardProfile.exports.length === 0) {
    showWizardError('Please select at least one export country, or check "We do not export".'); return false;
  }
  if (step === 4 && !document.getElementById('wSector').value) {
    showWizardError('Please select your industry sector.'); return false;
  }
  if (step === 5 && !document.querySelector('input[name="wRevenue"]:checked')) {
    showWizardError('Please select your approximate annual revenue.'); return false;
  }
  return true;
}

function showWizardError(msg) {
  const err = document.getElementById('wizardError');
  if (err) { err.textContent = msg; err.style.display = 'block'; setTimeout(() => err.style.display = 'none', 3000); }
}

function saveStepData(step) {
  if (step === 1) {
    const sel = document.getElementById('wHQCountry');
    if (sel) wizardProfile.hq = sel.value;
    // Clear states if country changed away from US
    if (wizardProfile.hq !== 'United States') wizardProfile.usStates = [];
  }
  if (step === 1.5) {
    // Save selected US states
    const checked = document.querySelectorAll('#wUSStatesList input:checked');
    wizardProfile.usStates = Array.from(checked).map(cb => cb.value);
  }
  if (step === 4) {
    const sel = document.getElementById('wSector');
    const sub = document.getElementById('wSubsector');
    if (sel) wizardProfile.sector = sel.value;
    if (sub) wizardProfile.subsector = sub.value;
  }
  if (step === 5) {
    const sel = document.querySelector('input[name="wRevenue"]:checked');
    if (sel) wizardProfile.revenue = sel.value;
  }
}

// ─── STEP RENDERERS ───────────────────────────────────────────
function renderWizardStep(step) {
  const container = document.getElementById('wizardStepContainer');
  const stepNum = document.getElementById('wizardStepNum');
  const prevBtn = document.getElementById('wizardPrevBtn');
  const nextBtn = document.getElementById('wizardNextBtn');

  stepNum.textContent = wizardStep === 1.5 ? '1' : step;
  prevBtn.textContent = '← Previous';
  prevBtn.style.visibility = (step === 1 || step === 1.5) ? 'hidden' : 'visible';
  nextBtn.textContent = step === 5 ? 'See My Results →' : 'Next →';

  // Progressive background — darker at step 1, lighter by step 5
  const overlay = document.getElementById('inductiveOverlay');
  const bgStep = step === 1.5 ? 1 : Math.min(Math.max(Math.round(step), 1), 5);
  overlay.className = 'inductive-overlay wizard-step-bg-' + bgStep;

  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById('stepDot' + i);
    if (node) {
      const innerDot = node.querySelector('.step-dot');
      if (innerDot) innerDot.className = 'step-dot' + (i === step ? ' active' : i < step ? ' done' : '');
    }
  }

  const STEP_LABELS = ['', 'Headquarters', 'Source Countries', 'Export Countries', 'Industry', 'Revenue'];
  for (let i = 1; i <= 5; i++) {
    const label = document.getElementById('stepLabel' + i);
    if (label) label.className = 'step-label' + (i === step ? ' active' : i < step ? ' done' : '');
  }

  let html = '';

  if (step === 1) {
    const countries = getCountryList();
    html = `<div class="wizard-step">
      <h3 class="wizard-step-title">Where is your company headquartered?</h3>
      <p class="wizard-step-hint">Select the country where your main operations or legal entity are based.</p>
      <select id="wHQCountry" class="wizard-select">
        <option value="">— Select a country —</option>
        ${countries.map(c => `<option value="${esc(c)}"${wizardProfile.hq === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>`;
  }

  if (step === 2) {
    html = renderCountryCheckStep('wSources', 'Where do you source materials or finished goods from?',
      'Select up to 5 countries you import from.', wizardProfile.sources, 'sources');
  }

  if (step === 3) {
    html = renderCountryCheckStep('wExports', 'Which countries do you export or sell products to?',
      'Select up to 5 countries you export to.', wizardProfile.exports, 'exports');
  }

  if (step === 4) {
    const sectors = Object.keys(SECTOR_DATA);
    const currentSector = wizardProfile.sector;
    const subcats = currentSector && SECTOR_DATA[currentSector] ? SECTOR_DATA[currentSector].subcategories : [];
    const pollutants = currentSector && SECTOR_DATA[currentSector] ? SECTOR_DATA[currentSector].pollutants : [];
    html = `<div class="wizard-step">
      <h3 class="wizard-step-title">What industry are you in?</h3>
      <p class="wizard-step-hint">Select the category that best describes your primary business activity.</p>
      <select id="wSector" class="wizard-select" onchange="onSectorChange(this.value)">
        <option value="">— Select a sector —</option>
        ${sectors.map(s => `<option value="${esc(s)}"${wizardProfile.sector === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <div id="wSubsectorWrapper" style="margin-top:16px;${subcats.length > 1 ? '' : 'display:none;'}">
        <label class="wizard-label">Subcategory (optional):</label>
        <select id="wSubsector" class="wizard-select">
          <option value="">— All subcategories —</option>
          ${subcats.map(s => `<option value="${esc(s)}"${wizardProfile.subsector === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      ${currentSector ? `<div class="wizard-sector-info">Primary super pollutants for this sector: <strong>${pollutants.join(', ')}</strong></div>` : ''}
    </div>`;
  }

  if (step === 5) {
    const bands = [
      { value: 'small', label: 'Under $10M' },
      { value: 'medium-small', label: '$10M – $100M' },
      { value: 'medium-large', label: '$100M – $1B' },
      { value: 'large', label: 'Over $1B' },
    ];
    html = `<div class="wizard-step">
      <h3 class="wizard-step-title">What is your approximate annual revenue?</h3>
      <p class="wizard-step-hint">This helps identify regulations that apply based on company size thresholds.</p>
      <div class="wizard-revenue-options">
        ${bands.map(b => `<label class="wizard-revenue-option${wizardProfile.revenue === b.value ? ' selected' : ''}">
          <input type="radio" name="wRevenue" value="${b.value}"${wizardProfile.revenue === b.value ? ' checked' : ''}
            onchange="document.querySelectorAll('.wizard-revenue-option').forEach(el => el.classList.remove('selected')); this.closest('.wizard-revenue-option').classList.add('selected');">
          ${b.label}
        </label>`).join('')}
      </div>
    </div>`;
  }

  if (step === 1.5) {
    const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
    const fedOnly = wizardProfile.usStates.includes('__federal__');
    const selectedStates = wizardProfile.usStates.filter(s => s !== '__federal__');
    html = `<div class="wizard-step">
      <h3 class="wizard-step-title">Which US states do you operate in?</h3>
      <p class="wizard-step-hint">We'll include federal regulations plus only the state-level regulations relevant to your selected states. Select up to 10 states, or choose federal only.</p>
      <label class="wizard-none-option${fedOnly ? ' selected' : ''}" style="margin-bottom:14px;">
        <input type="checkbox" id="wFederalOnly" ${fedOnly ? 'checked' : ''}
          onchange="toggleUSFederalOnly(this.checked)">
        Federal regulations only
      </label>
      <div id="wUSStatesWrapper"${fedOnly ? ' style="opacity:0.4;pointer-events:none;"' : ''}>
        <div class="wizard-country-search-row">
          <input type="text" class="wizard-country-search" placeholder="Search states..."
            oninput="filterCountryList('wUSStatesList', this.value)">
          <span class="wizard-selected-count" id="wUSStatesCount">${selectedStates.length} / 10 selected</span>
        </div>
        <div class="wizard-country-list" id="wUSStatesList">
          ${US_STATES.map(s => {
            const checked = selectedStates.includes(s);
            const disabled = !checked && selectedStates.length >= 10;
            return `<label class="wizard-country-item${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}">
              <input type="checkbox" value="${esc(s)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}
                onchange="toggleUSState('${esc(s)}', this.checked)">
              ${esc(s)}
            </label>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }

  document.getElementById('wizardStepContainer').innerHTML = html;
}

function renderCountryCheckStep(id, title, hint, selectedList, profileKey) {
  const countries = getCountryList();
  const noneSelected = selectedList.includes('__none__');
  const selectedReal = selectedList.filter(x => x !== '__none__');
  return `<div class="wizard-step">
    <h3 class="wizard-step-title">${title}</h3>
    <p class="wizard-step-hint">${hint}</p>
    <label class="wizard-none-option${noneSelected ? ' selected' : ''}">
      <input type="checkbox" id="${id}None"${noneSelected ? ' checked' : ''}
        onchange="toggleNoneOption('${profileKey}', '${id}', this.checked)">
      We do not ${profileKey === 'sources' ? 'import' : 'export'}
    </label>
    <div class="wizard-country-search-wrapper" id="${id}Wrapper"${noneSelected ? ' style="opacity:0.4;pointer-events:none;"' : ''}>
      <div class="wizard-country-search-row">
        <input type="text" class="wizard-country-search" placeholder=" Search countries..."
          oninput="filterCountryList('${id}List', this.value)">
        <span class="wizard-selected-count" id="${id}Count">${selectedReal.length} / 5 selected</span>
      </div>
      <div class="wizard-country-list" id="${id}List">
        ${countries.map(c => {
          const checked = selectedList.includes(c);
          const disabled = !checked && selectedReal.length >= 5;
          return `<label class="wizard-country-item${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}">
            <input type="checkbox" value="${esc(c)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}
              onchange="toggleCountry('${profileKey}', '${id}', '${esc(c)}', this.checked)">
            ${esc(c)}
          </label>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// ─── COUNTRY CHECKBOX HANDLERS ────────────────────────────────
function toggleCountry(key, listId, country, checked) {
  const arr = key === 'sources' ? wizardProfile.sources : wizardProfile.exports;
  if (checked) {
    if (arr.filter(x => x !== '__none__').length < 5) arr.push(country);
  } else {
    const idx = arr.indexOf(country);
    if (idx > -1) arr.splice(idx, 1);
  }
  const selectedReal = arr.filter(x => x !== '__none__');
  const countEl = document.getElementById(listId + 'Count');
  if (countEl) countEl.textContent = selectedReal.length + ' / 5 selected';
  document.querySelectorAll('#' + listId + 'List .wizard-country-item').forEach(label => {
    const cb = label.querySelector('input');
    if (!cb) return;
    const isChecked = arr.includes(cb.value);
    const isDisabled = !isChecked && selectedReal.length >= 5;
    cb.disabled = isDisabled;
    label.className = 'wizard-country-item' + (isChecked ? ' checked' : '') + (isDisabled ? ' disabled' : '');
  });
}

function toggleNoneOption(key, id, checked) {
  const arr = key === 'sources' ? wizardProfile.sources : wizardProfile.exports;
  arr.length = 0;
  const wrapper = document.getElementById(id + 'Wrapper');
  const noneLabel = document.getElementById(id + 'None').closest('label');
  if (checked) {
    arr.push('__none__');
    if (wrapper) { wrapper.style.opacity = '0.4'; wrapper.style.pointerEvents = 'none'; }
    noneLabel.classList.add('selected');
  } else {
    if (wrapper) { wrapper.style.opacity = ''; wrapper.style.pointerEvents = ''; }
    noneLabel.classList.remove('selected');
  }
}

function toggleUSFederalOnly(checked) {
  wizardProfile.usStates = checked ? ['__federal__'] : [];
  const wrapper = document.getElementById('wUSStatesWrapper');
  const label = document.getElementById('wFederalOnly').closest('label');
  if (wrapper) { wrapper.style.opacity = checked ? '0.4' : ''; wrapper.style.pointerEvents = checked ? 'none' : ''; }
  if (label) label.className = 'wizard-none-option' + (checked ? ' selected' : '');
  document.getElementById('wUSStatesCount').textContent = '0 / 10 selected';
}

function toggleUSState(state, checked) {
  const arr = wizardProfile.usStates;
  if (checked) {
    if (arr.filter(s => s !== '__federal__').length < 10) arr.push(state);
  } else {
    const idx = arr.indexOf(state);
    if (idx > -1) arr.splice(idx, 1);
  }
  const selectedReal = arr.filter(s => s !== '__federal__');
  document.getElementById('wUSStatesCount').textContent = selectedReal.length + ' / 10 selected';
  document.querySelectorAll('#wUSStatesList .wizard-country-item').forEach(label => {
    const cb = label.querySelector('input');
    if (!cb) return;
    const isChecked = arr.includes(cb.value);
    const isDisabled = !isChecked && selectedReal.length >= 10;
    cb.disabled = isDisabled;
    label.className = 'wizard-country-item' + (isChecked ? ' checked' : '') + (isDisabled ? ' disabled' : '');
  });
}

function filterCountryList(listId, query) {
  if (!list) return;
  const q = query.toLowerCase();
  list.querySelectorAll('.wizard-country-item').forEach(label => {
    label.style.display = label.textContent.trim().toLowerCase().includes(q) ? '' : 'none';
  });
}

function onSectorChange(sector) {
  wizardProfile.sector = sector;
  wizardProfile.subsector = '';
  const wrapper = document.getElementById('wSubsectorWrapper');
  const subSel = document.getElementById('wSubsector');
  let infoDiv = document.querySelector('.wizard-sector-info');

  if (sector && SECTOR_DATA[sector]) {
    const subcats = SECTOR_DATA[sector].subcategories;
    const pollutants = SECTOR_DATA[sector].pollutants;
    if (subcats.length > 1 && wrapper) {
      subSel.innerHTML = `<option value="">— All subcategories —</option>` +
        subcats.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      wrapper.style.display = '';
    } else if (wrapper) {
      wrapper.style.display = 'none';
    }
    if (!infoDiv) {
      infoDiv = document.createElement('div');
      infoDiv.className = 'wizard-sector-info';
      document.querySelector('.wizard-step').appendChild(infoDiv);
    }
    infoDiv.innerHTML = `Primary super pollutants for this sector: <strong>${pollutants.join(', ')}</strong>`;
    infoDiv.style.display = '';
  } else {
    if (wrapper) wrapper.style.display = 'none';
    if (infoDiv) infoDiv.style.display = 'none';
  }
}

// ─── MATCHING LOGIC ───────────────────────────────────────────
function runMatchingAndShowResults() {
  saveStepData(wizardStep);
  const sectorInfo = SECTOR_DATA[wizardProfile.sector] || SECTOR_DATA['Other'];
  const sectorPollutants = sectorInfo.pollutants;
  const sectorFlags = sectorInfo.industryFlags;

  inductiveResults = {
    domestic: matchDomestic(sectorPollutants, sectorFlags),
    importExport: matchImportExport(sectorPollutants, sectorFlags),
    incentives: matchIncentives(),
    vcm: matchVCM(sectorPollutants)
  };

  document.getElementById('inductiveOverlay').style.display = 'none';
  document.getElementById('resultsOverlay').style.display = 'flex';
  renderResults();
}

function regulationMatchesSector(reg, sectorPollutants) {
  const regPollutants = (reg.pollutants || '').toLowerCase();
  return sectorPollutants.some(p => regPollutants.includes(p.toLowerCase()));
}

function findCountryRegs(countryName) {
  if (countryData[countryName]) return countryData[countryName].regulations || [];
  const normalized = normalizeCountryName(countryName);
  if (countryData[normalized]) return countryData[normalized].regulations || [];
  for (const key of Object.keys(countryData)) {
    if (key.toLowerCase() === countryName.toLowerCase() ||
      normalizeCountryName(key).toLowerCase() === countryName.toLowerCase()) {
      return countryData[key].regulations || [];
    }
  }
  return [];
}

function matchDomestic(sectorPollutants, sectorFlags) {
  if (!wizardProfile.hq) return [];
  let regs = findCountryRegs(wizardProfile.hq)
    .filter(r => regulationMatchesSector(r, sectorPollutants))
    .filter(r => r.still_in_effect !== 'N')
    .map(r => ({ ...r, country: wizardProfile.hq }));

  // If US and user specified states, filter to federal + selected states only
  if (wizardProfile.hq === 'United States' && wizardProfile.usStates.length > 0) {
    const fedOnly = wizardProfile.usStates.includes('__federal__');
    const selectedStates = wizardProfile.usStates.filter(s => s !== '__federal__');
    regs = regs.filter(r => {
      const j = (r.jurisdiction || '').toLowerCase();
      const isFederal = j.includes('national') || j.includes('federal') || j === '';
      if (isFederal) return true;
      if (fedOnly) return false;
      return selectedStates.some(s => s.toLowerCase() === j.toLowerCase());
    });
  }
  // If US, always sort federal first then states alphabetically by jurisdiction
  if (wizardProfile.hq === 'United States') {
    regs.sort((a, b) => {
      const aFed = /national|federal/i.test(a.jurisdiction || '') || !a.jurisdiction;
      const bFed = /national|federal/i.test(b.jurisdiction || '') || !b.jurisdiction;
      if (aFed && !bFed) return -1;
      if (!aFed && bFed) return 1;
      return (a.jurisdiction || '').localeCompare(b.jurisdiction || '');
    });
  }
  return regs;
}

function matchImportExport(sectorPollutants, sectorFlags) {
  const results = { sources: [], exports: [] };
  wizardProfile.sources.filter(c => c !== '__none__').forEach(country => {
    findCountryRegs(country)
      .filter(r => regulationMatchesSector(r, sectorPollutants))
      .filter(r => r.still_in_effect !== 'N')
      .forEach(r => results.sources.push({ ...r, country }));
  });
  wizardProfile.exports.filter(c => c !== '__none__').forEach(country => {
    findCountryRegs(country)
      .filter(r => regulationMatchesSector(r, sectorPollutants))
      .filter(r => r.still_in_effect !== 'N')
      .forEach(r => results.exports.push({ ...r, country }));
  });
  return results;
}

function matchIncentives() {
  if (!biomethaneDataLoaded || !biomethaneData) return [];
  const allCountries = [
    wizardProfile.hq,
    ...wizardProfile.sources.filter(c => c !== '__none__'),
    ...wizardProfile.exports.filter(c => c !== '__none__')
  ].filter(Boolean);
  const seen = new Set();
  const results = [];
  allCountries.forEach(country => {
    const programs = getBiomethanePrograms(country);
    if (programs && programs.length > 0) {
      programs.forEach(p => {
        const key = (p.name || '') + '|' + country;
        if (!seen.has(key)) { seen.add(key); results.push({ ...p, country }); }
      });
    }
  });
  return results;
}

// Keywords that indicate a VCM project covers a given pollutant
function projectMatchesPollutant(pType, pollutant) {
  const pLow = pollutant.toLowerCase();
  return pType.includes(pLow) ||
    (pLow === 'methane' && /landfill|livestock|coal|oil|gas|waste|manure|rice|biogas|fugitive/.test(pType)) ||
    (pLow === 'hfc' && /refriger|hvac|cooling|f-gas|fluorin/.test(pType)) ||
    (pLow === 'nox' && /transport|vehicle|fuel|combustion/.test(pType)) ||
    (pLow === 'black carbon' && /cookstove|combustion|fuel|diesel/.test(pType)) ||
    (pLow === 'n2o' && /nitrous|fertilizer|agriculture|soil|manure/.test(pType));
}

// Keywords mapping sector NAICS/activity to VCM project type
const SECTOR_VCM_KEYWORDS = {
  'Food & Beverage':          /food|beverage|dairy|livestock|agriculture|waste|landfill/,
  'Agriculture & Livestock':  /agriculture|livestock|dairy|enteric|manure|rice|soil|cropland/,
  'Manufacturing & Industrial': /industrial|manufacturing|cement|steel|chemical|fuel switching/,
  'Logistics & Transportation': /transport|vehicle|fleet|aviation|shipping|fuel/,
  'Real Estate & Construction': /building|construction|efficiency|hvac|fuel switching/,
  'Retail & Consumer Goods':  /retail|waste|landfill|refriger|cold chain/,
  'Waste Management & Recycling': /landfill|waste|wastewater|composting|biogas|biomethane/,
  'Energy & Utilities':       /energy|fuel switching|renewable|solar|wind|coal|oil|gas|power/,
  'Chemical & Pharmaceutical': /chemical|industrial|refriger|f-gas|fluorin/,
  'Technology & Data Centers': /efficiency|renewable|energy|building/,
  'Financial Services & Insurance': /efficiency|renewable|building|offset/,
  'Healthcare':               /efficiency|waste|renewable|building/,
  'Hospitality & Tourism':    /efficiency|waste|renewable|building|food/,
  'Mining & Extractives':     /coal|mining|oil|gas|fugitive|methane/,
  'Media, Entertainment & Events': /transport|waste|renewable|efficiency/,
  'Education & Research':     /efficiency|renewable|building|waste/,
  'Telecommunications':       /efficiency|renewable|building/,
  'Government & Public Sector': /waste|transport|renewable|efficiency|landfill/,
  'Professional Services':    /efficiency|renewable|building/,
  'Other':                    /.*/,
};

function matchVCM(sectorPollutants) {
  if (!vcmDataLoaded || !vcmData) return { country: [], emissions: [], sector: [] };

  const userCountries = new Set([
    wizardProfile.hq,
    ...wizardProfile.sources.filter(c => c !== '__none__'),
    ...wizardProfile.exports.filter(c => c !== '__none__')
  ].filter(Boolean));

  const sectorKeywords = SECTOR_VCM_KEYWORDS[wizardProfile.sector] || SECTOR_VCM_KEYWORDS['Other'];
  const seenCountry = new Set();
  const seenEmissions = new Set();
  const seenSector = new Set();
  const countryMatches = [], emissionsMatches = [], sectorMatches = [];

  // Scan all VCM data for matches
  Object.entries(vcmData).forEach(([vcmCountry, projects]) => {
    projects.forEach(p => {
      const pType = ((p.project_type || '') + ' ' + (p.project_type_filter || '')).toLowerCase();
      const proj = { ...p, country: vcmCountry };
      const key = (p.id || p.name || '') + '|' + vcmCountry;

      // Section 1: Country match — project is in one of the user's countries
      if (userCountries.has(vcmCountry) && !seenCountry.has(key)) {
        seenCountry.add(key);
        countryMatches.push(proj);
      }

      // Section 2: Emissions match — project covers same molecules as user's sector
      const emissionsMatch = sectorPollutants.some(pol => projectMatchesPollutant(pType, pol));
      if (emissionsMatch && !seenEmissions.has(key)) {
        seenEmissions.add(key);
        emissionsMatches.push(proj);
      }

      // Section 3: Sector match — project type aligns with user's industry activity
      if (sectorKeywords.test(pType) && !seenSector.has(key)) {
        seenSector.add(key);
        sectorMatches.push(proj);
      }
    });
  });

  return {
    country:   countryMatches.slice(0, 30),
    emissions: emissionsMatches.slice(0, 30),
    sector:    sectorMatches.slice(0, 30)
  };
}

// ─── RESULTS RENDERING ────────────────────────────────────────
function renderResults() {
  activeResultsTab = 'domestic';
  const sourceNames = wizardProfile.sources.filter(c => c !== '__none__');
  const exportNames = wizardProfile.exports.filter(c => c !== '__none__');
  const sectorInfo = SECTOR_DATA[wizardProfile.sector] || {};

  document.getElementById('resultsProfileSummary').innerHTML = `
    <div class="profile-summary-row">
      <div class="profile-summary-grid">
        <div class="profile-pill"><strong>HQ:</strong> ${esc(wizardProfile.hq)}${wizardProfile.hq === 'United States' && wizardProfile.usStates.length > 0 ? ' (' + (wizardProfile.usStates.includes('__federal__') ? 'Federal only' : wizardProfile.usStates.join(', ')) + ')' : ''}</div>
        <div class="profile-pill"><strong>Sources:</strong> ${sourceNames.length > 0 ? sourceNames.map(esc).join(', ') : 'None'}</div>
        <div class="profile-pill"><strong>Exports:</strong> ${exportNames.length > 0 ? exportNames.map(esc).join(', ') : 'None'}</div>
        <div class="profile-pill"><strong>Sector:</strong> ${esc(wizardProfile.sector)}${wizardProfile.subsector ? ' › ' + esc(wizardProfile.subsector) : ''}</div>
        <div class="profile-pill"><strong>Revenue:</strong> ${esc(getRevenueLabel(wizardProfile.revenue))}</div>
        ${sectorInfo.pollutants ? `<div class="profile-pill"><strong>Pollutant focus:</strong> ${sectorInfo.pollutants.join(', ')}</div>` : ''}
      </div>
      <button class="assumptions-btn" onclick="showInfoOverlay('aboutOverlay')">About</button>
    </div>`;

  const r = inductiveResults;
  const domCount = r.domestic.length;
  const importCount = r.importExport.sources.length;
  const exportCount = r.importExport.exports.length;
  const incCount = r.incentives.length;
  const vcmCount = new Set([
    ...r.vcm.country.map(p => p.id || p.name),
    ...r.vcm.emissions.map(p => p.id || p.name),
    ...r.vcm.sector.map(p => p.id || p.name)
  ]).size;

  document.getElementById('resultsTabDomestic').innerHTML  = `Domestic <span class="results-tab-badge">${domCount}</span>`;
  document.getElementById('resultsTabImports').innerHTML   = `Imports <span class="results-tab-badge">${importCount}</span>`;
  document.getElementById('resultsTabExports').innerHTML   = `Exports <span class="results-tab-badge">${exportCount}</span>`;
  document.getElementById('resultsTabIncentives').innerHTML = `Incentives &amp; Opportunities <span class="results-tab-badge">${incCount}</span>`;
  document.getElementById('resultsTabVCM').innerHTML     = `VCM Projects <span class="results-tab-badge">${vcmCount}</span>`;

  showResultsTab('domestic');
}

function showResultsTab(tab) {
  activeResultsTab = tab;
  const tabMap = { domestic: 'Domestic', imports: 'Imports', exports: 'Exports', incentives: 'Incentives', vcm: 'VCM', exposure: 'Exposure' };
  document.querySelectorAll('.results-tab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('resultsTab' + tabMap[tab]);
  if (activeBtn) activeBtn.classList.add('active');
  const content = document.getElementById('resultsContent');
  if (tab === 'domestic')   content.innerHTML = renderDomesticTab();
  if (tab === 'imports')    content.innerHTML = renderImportsTab();
  if (tab === 'exports')    content.innerHTML = renderExportsTab();
  if (tab === 'incentives') content.innerHTML = renderIncentivesTab();
  if (tab === 'vcm')        content.innerHTML = renderVCMTab();
  if (tab === 'exposure')   content.innerHTML = renderPollutantExposureTab();
}

function regCard(reg, context) {
  const soWhat = getSoWhat(reg, context || 'domestic');
  const url = safeUrl(reg.website);
  const regJson = JSON.stringify(reg).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<div class="result-card" onclick="showInductiveRegDetail('${regJson}')">
    <div class="result-card-header">
      <span class="result-card-jurisdiction">${esc(reg.jurisdiction || '')}</span>
    </div>
    <div class="result-card-name">${esc(reg.name)}</div>
    <div class="result-card-pollutants">${esc(reg.pollutants)}</div>
    <div class="result-card-sowhat">${esc(soWhat)}</div>
    ${url ? `<div class="result-card-link"><a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">View source</a></div>` : ''}
    <div class="result-card-cta">View full details →</div>
  </div>`;
}

// Group an array of regulations by country and render with country headers
function renderGroupedByCountry(regs, context) {
  // Build ordered map: country -> [regs]
  const groups = [];
  const seen = {};
  regs.forEach(r => {
    const country = r.country || 'Unknown';
    if (!seen[country]) { seen[country] = []; groups.push({ country, regs: seen[country] }); }
    seen[country].push(r);
  });
  return groups.map(g => `
    <div class="country-group">
      <h4 class="country-group-heading">${esc(g.country)} <span class="country-group-count">${g.regs.length} regulation${g.regs.length === 1 ? '' : 's'}</span></h4>
      ${g.regs.map(r => regCard(r, context)).join('')}
    </div>`).join('');
}

function renderDomesticTab() {
  const regs = inductiveResults.domestic;
  if (regs.length === 0) return `<div class="results-empty">
    <p>No matching domestic regulations found for <strong>${esc(wizardProfile.hq)}</strong> in your sector.</p>
    <p class="results-empty-hint">This may mean your country's data isn't fully tagged yet for your sector, or regulations haven't been added. Check back as data is added on an ongoing basis.</p>
  </div>`;
  return `<h3 class="results-section-heading">Regulations in <strong>${esc(wizardProfile.hq)}</strong> relevant to your sector — ${regs.length} found</h3>` +
    renderGroupedByCountry(regs, 'domestic');
}

function renderImportsTab() {
  const sources = inductiveResults.importExport.sources;
  const sourceCountries = wizardProfile.sources.filter(c => c !== '__none__');
  if (sourceCountries.length === 0)
    return `<div class="results-empty"><p>You indicated your company does not import.</p></div>`;
  if (sources.length === 0)
    return `<div class="results-empty">
      <p>No matching regulations found in your sourcing countries for your sector.</p>
      <p class="results-empty-hint">Data is added on an ongoing basis. Check back as coverage expands.</p>
    </div>`;
  return `<h3 class="results-section-heading">Regulations in countries you source from — ${sources.length} found</h3>` +
    renderGroupedByCountry(sources, 'import');
}

function renderExportsTab() {
  const exportRegs = inductiveResults.importExport.exports;
  const exportCountries = wizardProfile.exports.filter(c => c !== '__none__');
  if (exportCountries.length === 0)
    return `<div class="results-empty"><p>You indicated your company does not export.</p></div>`;
  if (exportRegs.length === 0)
    return `<div class="results-empty">
      <p>No matching regulations found in your export countries for your sector.</p>
      <p class="results-empty-hint">Data is added on an ongoing basis. Check back as coverage expands.</p>
    </div>`;
  return `<h3 class="results-section-heading">Regulations in countries you export to — ${exportRegs.length} found</h3>` +
    renderGroupedByCountry(exportRegs, 'export');
}

function renderIncentivesTab() {
  const programs = inductiveResults.incentives;
  if (programs.length === 0) return `<div class="results-empty">
    <p>No biomethane or renewable gas incentive programs found in your countries.</p>
    <p class="results-empty-hint">Additional incentive types and countries are being added on an ongoing basis.</p>
  </div>`;
  return `<h3 class="results-section-heading">Biomethane &amp; renewable gas incentive programs in your countries — ${programs.length} found</div>
    ${programs.map(p => {
      const url = safeUrl(p.source_url);
      const pJson = JSON.stringify(p).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div class="result-card" onclick="showInductiveBiomethaneDetail('${pJson}')">
        <div class="result-card-header">
          <span class="result-card-country">${esc(p.country || '')}</span>
          <span class="result-card-jurisdiction">${esc(p.jurisdiction_name || '')}</span>
        </div>
        <div class="result-card-name">${esc(p.name || 'Unnamed program')}</div>
        ${p.category ? `<div class="result-card-pollutants">Category: ${esc(p.category)}</div>` : ''}
        ${p.instrument_type ? `<div class="result-card-pollutants">Instrument: ${esc(p.instrument_type)}</div>` : ''}
        <div class="result-card-sowhat"> Your company may be eligible for this incentive. Review eligibility criteria with your compliance team.</div>
        ${url ? `<div class="result-card-link"> <a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">View program</a></div>` : ''}
        <div class="result-card-cta">View full details →</div>
      </div>`;
    }).join('')}`;
}

function vcmCard(p) {
  const pJson = JSON.stringify(p).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<div class="result-card" onclick="showInductiveVCMDetail('${pJson}')">
    <div class="result-card-header">
      <span class="result-card-country">${esc(p.country || '')}</span>
      <span class="result-card-jurisdiction">${esc(p.registry || '')}</span>
    </div>
    <div class="result-card-name">${esc(p.name || 'Unnamed project')}</div>
    ${p.project_type ? `<div class="result-card-pollutants">Type: ${esc(p.project_type)}</div>` : ''}
    ${p.status ? `<div class="result-card-pollutants">Status: ${esc(p.status)}</div>` : ''}
    ${p.annual_reductions ? `<div class="result-card-pollutants">Est. Annual Reductions: ${esc(p.annual_reductions)} tCO₂e</div>` : ''}
    <div class="result-card-sowhat">This project may offer carbon credits relevant to your profile. Verify eligibility and availability with the registry.</div>
    <div class="result-card-cta">View full details →</div>
  </div>`;
}

function renderVCMTab() {
  const { country, emissions, sector } = inductiveResults.vcm;
  const totalUnique = new Set([
    ...country.map(p => p.id || p.name),
    ...emissions.map(p => p.id || p.name),
    ...sector.map(p => p.id || p.name)
  ]).size;

  if (totalUnique === 0) return `<div class="results-empty">
    <p>No matching VCM projects found for your profile.</p>
    <p class="results-empty-hint">Additional VCM projects are being added on an ongoing basis.</p>
  </div>`;

  let html = '';

  // Section 1: Country match
  html += `<div class="vcm-section">
    <h3 class="results-section-heading">Projects in your countries <span class="country-group-count">${country.length} found</span></h3>`;
  if (country.length === 0) {
    html += `<p class="vcm-empty-section">No VCM projects found in your headquarters, import, or export countries.</p>`;
  } else {
    // Group by country
    const groups = {};
    country.forEach(p => { if (!groups[p.country]) groups[p.country] = []; groups[p.country].push(p); });
    Object.entries(groups).forEach(([c, ps]) => {
      html += `<div class="country-group">
        <h4 class="country-group-heading">${esc(c)} <span class="country-group-count">${ps.length} project${ps.length === 1 ? '' : 's'}</span></h4>
        ${ps.map(p => vcmCard(p)).join('')}
      </div>`;
    });
  }
  html += `</div>`;

  // Section 2: Emissions / molecule match
  html += `<div class="vcm-section">
    <h3 class="results-section-heading">Projects covering the same molecules <span class="country-group-count">${emissions.length} found</span></h3>
    <p class="vcm-section-desc">VCM projects whose emissions type aligns with your sector’s primary super pollutants: <strong>${(SECTOR_DATA[wizardProfile.sector] || {pollutants:[]}).pollutants.join(', ')}</strong></p>`;
  if (emissions.length === 0) {
    html += `<p class="vcm-empty-section">No projects found matching your sector’s pollutant profile.</p>`;
  } else {
    html += emissions.map(p => vcmCard(p)).join('');
  }
  html += `</div>`;

  // Section 3: Sector / activity match
  html += `<div class="vcm-section">
    <h3 class="results-section-heading">Projects with similar industry coverage <span class="country-group-count">${sector.length} found</span></h3>
    <p class="vcm-section-desc">VCM projects whose activity type aligns with your sector: <strong>${esc(wizardProfile.sector)}</strong></p>`;
  if (sector.length === 0) {
    html += `<p class="vcm-empty-section">No projects found matching your industry sector.</p>`;
  } else {
    html += sector.map(p => vcmCard(p)).join('');
  }
  html += `</div>`;

  return html;
}


// ─── DETAIL MODALS ────────────────────────────────────────────
function showInductiveRegDetail(regJson) {
  const reg = typeof regJson === 'string' ? JSON.parse(regJson.replace(/&quot;/g, '"')) : regJson;
  const url = safeUrl(reg.website);
  const industries = [];
  if (reg.hvac) industries.push('HVAC');
  if (reg.food_agriculture) industries.push('Food & Agriculture');
  if (reg.trading_tax_systems) industries.push('Trading & Tax Systems');
  if (reg.fossil_fuel_production) industries.push('Fossil Fuel Production');
  if (reg.solid_waste) industries.push('Solid Waste');
  if (reg.transportation) industries.push('Transportation');

  document.getElementById('inductiveDetailContent').innerHTML = `
    <div style="padding:12px; background:#f8fef9; border-left:4px solid #065f46; border-radius:4px;">
      <p style="margin:0 0 10px; font-size:1.05em; font-weight:700; color:#065f46;">${esc(reg.name)}</p>
      <p style="margin:4px 0; font-size:0.9em;"><strong>Country:</strong> ${esc(reg.country || '')}</p>
      <p style="margin:4px 0; font-size:0.9em;"><strong>Jurisdiction:</strong> ${esc(reg.jurisdiction)}</p>
      <p style="margin:4px 0; font-size:0.9em;"><strong>Pollutants:</strong> ${esc(reg.pollutants)}</p>
      ${industries.length > 0 ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Industry:</strong> ${esc(industries.join(', '))}</p>` : ''}
      <p style="margin:4px 0; font-size:0.9em;"><strong>Date Enacted:</strong> ${esc(reg.date_enacted)} &nbsp;|&nbsp; <strong>Still in Effect:</strong> ${reg.still_in_effect === 'Y' ? ' Yes' : ' No'}</p>
      ${reg.description ? `<p style="margin:10px 0 4px; font-size:0.9em;"><strong>Description:</strong><br>${esc(reg.description)}</p>` : ''}
      ${reg.how_affects && reg.how_affects !== 'N/A' && reg.how_affects !== 'nan' ? `<p style="margin:8px 0 4px; font-size:0.9em;"><strong>How it affects corporations:</strong><br>${esc(reg.how_affects)}</p>` : ''}
      ${url ? `<p style="margin:10px 0 0; font-size:0.85em;"><strong>Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#065f46; word-break:break-all;">${esc(url.length > 70 ? url.substring(0,70) + '...' : url)}</a></p>` : ''}
    </div>`;
  document.getElementById('inductiveDetailOverlay').style.display = 'flex';
}

function showInductiveBiomethaneDetail(pJson) {
  const p = typeof pJson === 'string' ? JSON.parse(pJson.replace(/&quot;/g, '"')) : pJson;
  const url = safeUrl(p.source_url);
  document.getElementById('inductiveDetailContent').innerHTML = `
    <div style="padding:12px; background:#fffbeb; border-left:4px solid #d97706; border-radius:4px;">
      <p style="margin:0 0 10px; font-size:1.05em; font-weight:700; color:#92400e;">${esc(p.name || 'Unnamed program')}</p>
      <p style="margin:4px 0; font-size:0.9em;"><strong>Country:</strong> ${esc(p.country || '')}</p>
      ${p.jurisdiction_name ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Jurisdiction:</strong> ${esc(p.jurisdiction_name)}</p>` : ''}
      ${p.category ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Category:</strong> ${esc(p.category)}</p>` : ''}
      ${p.instrument_type ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Instrument Type:</strong> ${esc(p.instrument_type)}</p>` : ''}
      ${p.sector ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Sector:</strong> ${esc(p.sector)}</p>` : ''}
      ${p.eligible_entity ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Eligible Entity:</strong> ${esc(p.eligible_entity)}</p>` : ''}
      ${p.key_provisions ? `<p style="margin:10px 0 4px; font-size:0.9em;"><strong>Key Provisions:</strong><br>${esc(p.key_provisions)}</p>` : ''}
      ${url ? `<p style="margin:10px 0 0; font-size:0.85em;"><strong>Source:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#92400e; word-break:break-all;">${esc(url.length > 70 ? url.substring(0,70) + '...' : url)}</a></p>` : ''}
    </div>`;
  document.getElementById('inductiveDetailOverlay').style.display = 'flex';
}

function showInductiveVCMDetail(pJson) {
  const p = typeof pJson === 'string' ? JSON.parse(pJson.replace(/&quot;/g, '"')) : pJson;
  document.getElementById('inductiveDetailContent').innerHTML = `
    <div style="padding:12px; background:#eff6ff; border-left:4px solid #1d4ed8; border-radius:4px;">
      <p style="margin:0 0 10px; font-size:1.05em; font-weight:700; color:#1e3a8a;">${esc(p.name || 'Unnamed project')}</p>
      <p style="margin:4px 0; font-size:0.9em;"><strong>Country:</strong> ${esc(p.country || '')}</p>
      ${p.proponent ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Proponent:</strong> ${esc(p.proponent)}</p>` : ''}
      ${p.project_type ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Project Type:</strong> ${esc(p.project_type)}</p>` : ''}
      ${p.status ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Status:</strong> ${esc(p.status)}</p>` : ''}
      ${p.registry ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Registry:</strong> ${esc(p.registry)}</p>` : ''}
      ${p.annual_reductions ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Est. Annual Reductions:</strong> ${esc(p.annual_reductions)} tCO₂e</p>` : ''}
      ${p.credits_registered ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Credits Registered:</strong> ${esc(p.credits_registered)}</p>` : ''}
      ${p.start_year ? `<p style="margin:4px 0; font-size:0.9em;"><strong>Project Period:</strong> ${esc(p.start_year)}${p.end_year ? ' – ' + esc(p.end_year) : ''}</p>` : ''}
    </div>`;
  document.getElementById('inductiveDetailOverlay').style.display = 'flex';
}

function closeInductiveDetail() {
  document.getElementById('inductiveDetailOverlay').style.display = 'none';
}

// ─── POLLUTANT EXPOSURE PIE CHART ────────────────────────────
// Data sourced from EPA Inventory of U.S. Greenhouse Gas Emissions
// and Sinks 1990-2022 (published April 2024) and EPA GHGRP 2023.
// Values represent the approximate share of each super pollutant
// in that sector's non-CO2 GHG emissions profile (CO2e basis).
// Source: EPA 430-R-24-004 | cfpub.epa.gov/ghgdata/inventoryexplorer

const POLLUTANT_COLORS = {
  'Methane':    '#f97316',
  'N2O':      '#8b5cf6',
  'HFC':      '#3b82f6',
  'NOx':      '#ef4444',
  'Black Carbon': '#1f2937',
  'Other F-Gases': '#10b981'
};

const SECTOR_POLLUTANT_PROFILE = {
  // Agriculture: 41.7% CH4 (enteric fermentation + manure + rice),
  // 46.6% N2O (soil management + manure), 11.7% CO2 (energy use)
  // Super pollutant share (excl CO2): CH4 53%, N2O 47%
  // Source: USDA ERS citing EPA 430-R-24-004
  'Agriculture & Livestock': [
    { pollutant: 'Methane', pct: 53, note: 'Enteric fermentation (beef 71%, dairy 25%), manure management, rice cultivation' },
    { pollutant: 'N2O',   pct: 47, note: 'Agricultural soil management (75% of US N2O), manure management' },
  ],

  // Food & Beverage: HFCs dominate from refrigeration (supermarkets, cold chain)
  // + methane from organic waste + N2O from food processing
  // Source: EPA GHGRP subpart I (refrigerants) + subpart HH (landfills)
  'Food & Beverage': [
    { pollutant: 'HFC',   pct: 55, note: 'Refrigeration and cold storage equipment (largest HFC use category in commercial sector)' },
    { pollutant: 'Methane', pct: 30, note: 'Organic waste decomposition, wastewater treatment from food processing' },
    { pollutant: 'N2O',   pct: 15, note: 'Combustion from industrial processes, some food processing byproducts' },
  ],

  // Waste Management: ~90% of GHGRP waste sector emissions are methane
  // Source: EPA GHGRP Waste Sector Profile — "about 90% of GHG emissions from
  // the waste sector reported to the GHGRP are methane emissions"
  'Waste Management & Recycling': [
    { pollutant: 'Methane', pct: 90, note: 'Landfill decomposition (~84% MSW landfills), wastewater treatment' },
    { pollutant: 'N2O',   pct: 10, note: 'Wastewater treatment processes (N2O increased 48% from 1990-2022), composting' },
  ],

  // Energy & Utilities: Natural gas systems + coal mines = major CH4 sources
  // N2O from combustion, F-gases from electrical equipment
  // Source: EPA 2024 Chapter 3 (Energy) — CH4 40.2% of energy sector non-CO2
  'Energy & Utilities': [
    { pollutant: 'Methane',    pct: 60, note: 'Natural gas system leaks (production, transmission, distribution), coal mine methane' },
    { pollutant: 'N2O',      pct: 25, note: 'Stationary combustion (power generation, industrial boilers)' },
    { pollutant: 'Other F-Gases', pct: 15, note: 'SF6 from electrical transmission and distribution equipment' },
  ],

  // Chemical & Pharmaceutical: HFCs from ODS substitutes (largest HFC source),
  // F-gases from industrial processes, N2O from adipic/nitric acid production
  // Source: EPA 430-R-24-004 Chapter 4 (IPPU)
  'Chemical & Pharmaceutical': [
    { pollutant: 'HFC',      pct: 45, note: 'ODS substitute emissions (primary contributor to aggregate US HFC emissions)' },
    { pollutant: 'Other F-Gases', pct: 30, note: 'PFCs from electronics/aluminum, SF6, NF3 from industrial processes' },
    { pollutant: 'N2O',      pct: 25, note: 'Adipic acid and nitric acid production processes' },
  ],

  // Manufacturing: HFCs from refrigeration + NOx from combustion processes
  // Black carbon from industrial combustion
  // Source: EPA GHGRP Industry sector + EPA emission factors hub
  'Manufacturing & Industrial': [
    { pollutant: 'HFC',      pct: 35, note: 'Industrial refrigeration, process cooling, foam blowing agents' },
    { pollutant: 'NOx',      pct: 30, note: 'Combustion in industrial boilers, furnaces, and process heating' },
    { pollutant: 'Black Carbon', pct: 20, note: 'Incomplete combustion in industrial processes, diesel equipment' },
    { pollutant: 'Other F-Gases', pct: 15, note: 'Process emissions from metal production, electronics manufacturing' },
  ],

  // Logistics & Transportation: NOx and black carbon dominant from diesel
  // Small methane from natural gas vehicles
  // Source: EPA 2024 Chapter 3 Energy — transportation mobile sources
  'Logistics & Transportation': [
    { pollutant: 'NOx',     pct: 55, note: 'Diesel combustion from trucks, ships, aircraft engines (mobile sources)' },
    { pollutant: 'Black Carbon', pct: 35, note: 'Diesel particulate emissions from heavy freight vehicles and shipping' },
    { pollutant: 'Methane',   pct: 10, note: 'Natural gas vehicles, aviation, rail combustion' },
  ],

  // Real Estate & Construction: HFCs from HVAC/refrigeration dominant
  // NOx from construction equipment and heating
  // Source: EPA commercial buildings + GHGRP subpart I
  'Real Estate & Construction': [
    { pollutant: 'HFC',   pct: 60, note: 'HVAC refrigerant leaks from commercial buildings (major commercial HFC source)' },
    { pollutant: 'NOx',   pct: 25, note: 'Combustion from construction equipment, building heating systems' },
    { pollutant: 'Methane', pct: 15, note: 'Natural gas leaks from building distribution systems' },
  ],

  // Retail: HFCs dominate — supermarkets are the largest commercial HFC emitters
  // Source: EPA GHGRP subpart I — commercial refrigeration
  'Retail & Consumer Goods': [
    { pollutant: 'HFC',   pct: 70, note: 'Commercial refrigeration (supermarkets are among largest HFC emitters per EPA GHGRP)' },
    { pollutant: 'NOx',   pct: 20, note: 'Delivery fleet combustion, HVAC systems' },
    { pollutant: 'Methane', pct: 10, note: 'Natural gas heating, minor fugitive emissions' },
  ],

  // Mining: CH4 from coal mines, NOx and black carbon from equipment
  // Source: EPA GHGRP underground coal mines profile
  'Mining & Extractives': [
    { pollutant: 'Methane',   pct: 50, note: 'Coal mine methane (decreased 58.7% since 1990 due to fewer active mines)' },
    { pollutant: 'NOx',     pct: 30, note: 'Diesel combustion in mining equipment, blasting' },
    { pollutant: 'Black Carbon', pct: 20, note: 'Diesel particulates from underground and surface mining equipment' },
  ],

  // Tech / Data Centers: HFCs dominate from server cooling
  // NOx from diesel backup generators
  'Technology & Data Centers': [
    { pollutant: 'HFC',      pct: 65, note: 'Data center cooling systems, server rack refrigerants, UPS systems' },
    { pollutant: 'Other F-Gases', pct: 20, note: 'SF6 from electrical switchgear, NF3 from semiconductor manufacturing' },
    { pollutant: 'NOx',      pct: 15, note: 'Diesel backup generators (tested regularly), on-site combustion' },
  ],

  // Healthcare: HFCs from medical refrigeration + anesthetic N2O
  // Source: EPA GHGRP + WHO/HCWH healthcare emissions data
  'Healthcare': [
    { pollutant: 'HFC', pct: 55, note: 'Medical refrigeration, vaccine cold chain, HVAC in clinical facilities' },
    { pollutant: 'N2O', pct: 35, note: 'Nitrous oxide anesthetic gas — significant source in hospitals and dental facilities' },
    { pollutant: 'NOx', pct: 10, note: 'Medical waste incineration, facility heating systems' },
  ],

  // Hospitality: HFCs from food refrigeration + HVAC, methane from food waste
  'Hospitality & Tourism': [
    { pollutant: 'HFC',   pct: 50, note: 'Commercial kitchen refrigeration, hotel HVAC systems, minibar units' },
    { pollutant: 'Methane', pct: 30, note: 'Food waste decomposition, natural gas cooking equipment' },
    { pollutant: 'NOx',   pct: 20, note: 'Commercial kitchen combustion, laundry, heating boilers' },
  ],

  // Media/Entertainment: NOx from transport + black carbon from events
  'Media, Entertainment & Events': [
    { pollutant: 'NOx',     pct: 50, note: 'Fleet transport for productions, touring, logistics' },
    { pollutant: 'Black Carbon', pct: 30, note: 'Diesel generators for events, production equipment' },
    { pollutant: 'HFC',      pct: 20, note: 'Broadcast facility cooling, venue HVAC systems' },
  ],

  // All "commercial energy" sectors share a similar profile:
  // HFCs from HVAC + NOx from combustion
  'Financial Services & Insurance': [
    { pollutant: 'HFC', pct: 65, note: 'Office and data center HVAC/cooling systems' },
    { pollutant: 'NOx', pct: 35, note: 'Building heating systems, corporate fleet combustion' },
  ],
  'Education & Research': [
    { pollutant: 'HFC',   pct: 55, note: 'Campus HVAC systems, laboratory refrigeration and cooling' },
    { pollutant: 'NOx',   pct: 30, note: 'Building heating, campus fleet and bus transportation' },
    { pollutant: 'N2O',   pct: 15, note: 'Research laboratory gas use, some agricultural research facilities' },
  ],
  'Telecommunications': [
    { pollutant: 'HFC',      pct: 60, note: 'Cell tower and exchange cooling equipment' },
    { pollutant: 'Other F-Gases', pct: 25, note: 'SF6 in high-voltage switching equipment' },
    { pollutant: 'NOx',      pct: 15, note: 'Diesel backup generators at network infrastructure sites' },
  ],
  'Government & Public Sector': [
    { pollutant: 'HFC',   pct: 45, note: 'Government building HVAC, military refrigeration' },
    { pollutant: 'NOx',   pct: 35, note: 'Public fleet vehicles, military operations, government facilities' },
    { pollutant: 'Methane', pct: 20, note: 'Public landfills, wastewater treatment facilities' },
  ],
  'Professional Services': [
    { pollutant: 'HFC', pct: 70, note: 'Office building HVAC systems (primary emissions source for service firms)' },
    { pollutant: 'NOx', pct: 30, note: 'Business travel, employee commuting fleet, building heating' },
  ],
  'Other': [
    { pollutant: 'Methane',   pct: 35, note: 'Variable by activity' },
    { pollutant: 'HFC',     pct: 25, note: 'Variable by activity' },
    { pollutant: 'NOx',     pct: 20, note: 'Variable by activity' },
    { pollutant: 'N2O',     pct: 12, note: 'Variable by activity' },
    { pollutant: 'Black Carbon', pct: 8, note: 'Variable by activity' },
  ]
};

function renderPollutantExposureTab() {
  const sector = wizardProfile.sector;
  const profile = SECTOR_POLLUTANT_PROFILE[sector];

  if (!profile) {
    return `<div class="results-empty"><p>No pollutant profile available for this sector.</p></div>`;
  }

  // Draw SVG pie chart
  const size = 200;
  const cx = size / 2, cy = size / 2, r = 85;
  let startAngle = -Math.PI / 2;
  let slices = '';
  let total = profile.reduce((sum, d) => sum + d.pct, 0);

  profile.forEach(d => {
    const angle = (d.pct / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = POLLUTANT_COLORS[d.pollutant] || '#6b7280';
    slices += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
      fill="${color}" stroke="white" stroke-width="2" opacity="0.9"/>`;
    // Mid-angle label for slices > 12%
    if (d.pct >= 12) {
      const midAngle = startAngle + angle / 2;
      const lx = cx + (r * 0.65) * Math.cos(midAngle);
      const ly = cy + (r * 0.65) * Math.sin(midAngle);
      slices += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="middle"
        font-size="11" font-weight="700" fill="white">${d.pct}%</text>`;
    }
    startAngle = endAngle;
  });

  const legendItems = profile.map(d => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
      <div style="width:14px;height:14px;border-radius:3px;background:${POLLUTANT_COLORS[d.pollutant] || '#6b7280'};flex-shrink:0;margin-top:2px;"></div>
      <div>
        <div style="font-weight:700;font-size:13px;color:#111827;">${esc(d.pollutant)} — ${d.pct}%</div>
        <div style="font-size:12px;color:#6b7280;line-height:1.4;">${esc(d.note)}</div>
      </div>
    </div>`).join('');

  const subsectorNote = wizardProfile.subsector ? ` (${esc(wizardProfile.subsector)})` : '';

  return `
    <h3 class="results-section-heading">Estimated super pollutant emissions profile for <strong>${esc(sector)}${subsectorNote}</strong></div>
    <div style="display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start;padding:8px 0 16px;">
      <div style="flex-shrink:0;">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;">
          ${slices}
        </svg>
      </div>
      <div style="flex:1;min-width:200px;">
        ${legendItems}
      </div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;font-size:12px;color:#065f46;line-height:1.6;">
      <strong>About this chart:</strong> Percentages show the approximate share of each super pollutant
      in your sector's non-CO₂ greenhouse gas emissions profile, based on the
      <a href="https://www.epa.gov/ghgemissions/inventory-us-greenhouse-gas-emissions-and-sinks" target="_blank" rel="noopener noreferrer" style="color:#065f46;font-weight:600;">
      EPA Inventory of U.S. Greenhouse Gas Emissions and Sinks 1990–2022</a> (EPA 430-R-24-004, April 2024)
      and the EPA Greenhouse Gas Reporting Program (GHGRP) 2023 data.
      Actual emissions vary by company size, geography, and operations.
      This chart is indicative only and should not be used for regulatory reporting.
    </div>`;
}

// ─── INFO OVERLAYS (About, Methodology, Assumptions) ─────────
function showInfoOverlay(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeInfoOverlay(id) {
    document.getElementById(id).style.display = 'none';
}
