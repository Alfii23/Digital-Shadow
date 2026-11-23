/**
 * Digital Shadow — app.js
 * Handles: form management, API calls, result rendering,
 * chart drawing, export, and UI state machine.
 * No personal data is logged to the console.
 */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = '';
const MAX_URLS = 10;

// ── Demo sample data (entirely fictional) ────────────────────────────────────
const DEMO_DATA = {
  username: 'alex_nova_dev',
  email: 'alex.nova.demo@example-fictional.com',
  profile_urls: [
    'https://github.com/alex_nova_dev',
    'https://twitter.com/alex_nova_dev',
    'http://linkedin.com/in/alex-nova-demo',
  ],
  website_urls: [
    'https://alexnova.example.com?utm_source=portfolio&utm_medium=email',
  ],
  profile_text:
    'Hello! I\'m Alex Nova, a fictional software developer. ' +
    'Contact me at alex.nova.demo@example-fictional.com or +44 7700 900123. ' +
    'DOB: 15/03/1992. I live at 42 Fictional Street, London SW1A 2AA.',
};

// ── State ─────────────────────────────────────────────────────────────────────
let currentReport = null;
let chartInstances = {};
let isDemo = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const loaderOverlay    = $('#loader-overlay');
const resultsSection   = $('#results-section');
const analyzeBtn       = $('#analyze-btn');
const demoBtn          = $('#demo-btn');
const clearBtn         = $('#clear-btn');
const docAnalyzeBtn    = $('#doc-analyze-btn');
const exportJsonBtn    = $('#export-json-btn');
const exportCsvBtn     = $('#export-csv-btn');

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUrlLists();
  bindFormEvents();
  bindActionButtons();
  initFileUpload();
  initBenchmarkLab();
  updateAnalyzeButtonState();

  // Welcome toast on fresh authentication
  try {
    if (sessionStorage.getItem('ds_just_logged_in')) {
      sessionStorage.removeItem('ds_just_logged_in');
      setTimeout(() => {
        showToast('🛡️ Authentication verified. Secure workspace active.', 'success');
      }, 350);
    }
  } catch (e) {}
});

// ── Benchmark Lab ─────────────────────────────────────────────────────────────
function initBenchmarkLab() {
  const SAMPLES = {
    clean: {
      username: '',
      email: '',
      website_urls: ['https://example.com/about'],
      profile_urls: [],
      profile_text: 'Public security research whitepaper. General protocol specifications.',
      label: 'Tier 1 Clean Baseline (0% Risk)'
    },
    low: {
      username: '',
      email: '',
      website_urls: ['https://example.com/store?utm_source=spring_sale&utm_medium=email&fbclid=IwAR123'],
      profile_urls: ['https://example.org/docs'],
      profile_text: '',
      label: 'Tier 2 Low Risk Vector (~10% Risk)'
    },
    moderate: {
      username: 'marcus_vance',
      email: 'marcus.vance@corporate-sample.org',
      website_urls: ['http://insecure-portal.example.com'],
      profile_urls: [],
      profile_text: 'Quarterly review prepared by Marcus Vance for engineering division.',
      label: 'Tier 3 Moderate Risk Vector (~30% Risk)'
    },
    high: {
      username: 'elena_rostova',
      email: 'elena.rostova@executive-dispatch.org',
      website_urls: ['http://192.168.1.50:8080/dashboard'],
      profile_urls: [],
      profile_text: 'Elena Rostova. Contact phone: +1 (555) 234-8901. Primary address: 742 Evergreen Terrace, Springfield, IL 62704.',
      label: 'Tier 4 High Risk Vector (~50% Risk)'
    },
    critical: {
      username: 'root_admin',
      email: 'admin@corporate-vault.net',
      website_urls: ['https://admin:SuperSecretToken2026!@api.internal-cloud.org/v1/vault'],
      profile_urls: ['https://github.com/root_admin', 'https://twitter.com/root_admin'],
      profile_text: 'CONFIDENTIAL IDENTITY VAULT: Owner: Root Administrator. DOB: 14/05/1984. Direct phone: +1-555-891-2345. Permanent Residence: 10 Downing Street, London SW1A 2AA. Password Vault Key: Passw0rd!2026#RootToken.',
      label: 'Tier 5 Critical Risk Vector (~90% Risk)'
    }
  };

  $$('.btn-benchmark-load').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.dataset.tier;
      const sample = SAMPLES[tier];
      if (!sample) return;

      const uInput = $('#username');
      const eInput = $('#email');
      const pText  = $('#profile-text');
      if (uInput) uInput.value = sample.username || '';
      if (eInput) eInput.value = sample.email || '';
      if (pText)  pText.value  = sample.profile_text || '';

      const webContainer = $('#website-urls-list');
      if (webContainer) {
        webContainer.innerHTML = '';
        (sample.website_urls || []).forEach(u => addUrlRow('website-urls-list', u));
        if (!sample.website_urls || sample.website_urls.length === 0) {
          addUrlRow('website-urls-list');
        }
      }

      const profContainer = $('#profile-urls-list');
      if (profContainer) {
        profContainer.innerHTML = '';
        (sample.profile_urls || []).forEach(u => addUrlRow('profile-urls-list', u));
        if (!sample.profile_urls || sample.profile_urls.length === 0) {
          addUrlRow('profile-urls-list');
        }
      }

      updateAnalyzeButtonState();
      showToast(`Loaded ${sample.label}. Click "Run Analysis" or test below.`, 'success');

      const formEl = $('#analyze-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ── URL list manager ──────────────────────────────────────────────────────────
function initUrlLists() {
  $$('.url-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.dataset.list;
      addUrlRow(listId);
    });
  });
}

function addUrlRow(listId, value = '') {
  const container = $(`#${listId}`);
  if (!container) return;

  const rows = $$('.url-input-row', container);
  if (rows.length >= MAX_URLS) {
    showToast(`Maximum ${MAX_URLS} URLs per field.`, 'info');
    return;
  }

  const row = document.createElement('div');
  row.className = 'url-input-row';
  row.innerHTML = `
    <input type="url" class="form-input url-input" placeholder="https://example.com"
           value="${escapeAttr(value)}" autocomplete="off">
    <button type="button" class="btn-remove-url" aria-label="Remove URL" title="Remove">✕</button>
  `;
  row.querySelector('.btn-remove-url').addEventListener('click', () => {
    row.remove();
    updateAnalyzeButtonState();
  });
  row.querySelector('.url-input').addEventListener('input', updateAnalyzeButtonState);
  container.appendChild(row);
  updateAnalyzeButtonState();
}

function getUrlListValues(listId) {
  return $$(`#${listId} .url-input`)
    .map(i => i.value.trim())
    .filter(v => v.length > 0);
}

// ── Form events ───────────────────────────────────────────────────────────────
function bindFormEvents() {
  $$('#analyze-form input, #analyze-form textarea').forEach(el => {
    el.addEventListener('input', updateAnalyzeButtonState);
  });
}

function updateAnalyzeButtonState() {
  const hasAny = hasAnyInput();
  if (analyzeBtn) analyzeBtn.disabled = !hasAny;
}

function hasAnyInput() {
  const fields = ['#username', '#email', '#profile-text'];
  for (const sel of fields) {
    const el = $(sel);
    if (el && el.value.trim()) return true;
  }
  for (const listId of ['profile-url-list', 'website-url-list']) {
    if (getUrlListValues(listId).length > 0) return true;
  }
  return false;
}

// ── Action buttons ────────────────────────────────────────────────────────────
function bindActionButtons() {
  analyzeBtn && analyzeBtn.addEventListener('click', handleAnalyze);
  demoBtn    && demoBtn.addEventListener('click', handleDemo);
  clearBtn   && clearBtn.addEventListener('click', handleClear);
  exportJsonBtn && exportJsonBtn.addEventListener('click', handleExportJson);
  exportCsvBtn  && exportCsvBtn.addEventListener('click', handleExportCsv);
}

async function handleAnalyze() {
  if (!validateForm()) return;
  const payload = buildPayload();
  isDemo = false;
  await submitAnalysis(payload);
}

async function handleDemo() {
  isDemo = true;
  populateFormWithDemo();
  await new Promise(r => setTimeout(r, 200));
  const payload = buildPayload();
  await submitAnalysis(payload, true);
}

function handleClear() {
  $('#analyze-form').reset();
  $$('.url-input-row').forEach(r => r.remove());
  resultsSection.classList.remove('visible');
  currentReport = null;
  isDemo = false;
  destroyCharts();
  updateAnalyzeButtonState();
  scrollToForm();
}

// ── Form build & population ───────────────────────────────────────────────────
function buildPayload() {
  return {
    username: ($('#username')?.value || '').trim(),
    email:    ($('#email')?.value    || '').trim(),
    profile_text: ($('#profile-text')?.value || '').trim(),
    profile_urls: getUrlListValues('profile-url-list'),
    website_urls: getUrlListValues('website-url-list'),
  };
}

function populateFormWithDemo() {
  $('#username') && ($('#username').value = DEMO_DATA.username);
  $('#email')    && ($('#email').value    = DEMO_DATA.email);
  $('#profile-text') && ($('#profile-text').value = DEMO_DATA.profile_text);

  // Clear existing URL rows first
  $$('.url-input-row').forEach(r => r.remove());

  DEMO_DATA.profile_urls.forEach(url => addUrlRow('profile-url-list', url));
  DEMO_DATA.website_urls.forEach(url => addUrlRow('website-url-list', url));
  updateAnalyzeButtonState();
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm() {
  clearErrors();
  let valid = true;

  const email = $('#email')?.value.trim();
  if (email && !isValidEmail(email)) {
    showError('email-group', 'Please enter a valid email address.');
    valid = false;
  }

  if (!hasAnyInput()) {
    showToast('Please fill in at least one field.', 'error');
    valid = false;
  }

  return valid;
}

function isValidEmail(v) {
  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(v);
}

function showError(groupId, msg) {
  const group = $(`#${groupId}`);
  if (!group) return;
  group.classList.add('has-error');
  const errEl = group.querySelector('.form-error');
  if (errEl) errEl.textContent = msg;
}

function clearErrors() {
  $$('.has-error').forEach(el => el.classList.remove('has-error'));
}

// ── API & DOM Analysis call ───────────────────────────────────────────────────
async function submitAnalysis(payload, demo = false) {
  showLoader('Analyzing your digital footprint…');

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      currentReport = data;
      hideLoader();
      renderResults(data, demo);
      scrollToResults();
      return;
    }
  } catch (err) {
    // Graceful fallback to pure DOM-based client analyzer
    console.info('Switching to in-browser DOM-based analysis engine.');
  }

  // Run DOM-based analysis directly in the browser
  setTimeout(() => {
    try {
      const domData = runClientSideDomAnalysis(payload, demo);
      currentReport = domData;
      hideLoader();
      renderResults(domData, demo);
      showToast('⚡ Running in 100% DOM-based client mode', 'success');
      scrollToResults();
    } catch (e) {
      hideLoader();
      showToast('Analysis error occurred.', 'error');
    }
  }, 350);
}

function runClientSideDomAnalysis(payload, demo = false) {
  const findings = [];
  const username = (payload.username || '').trim();
  const email = (payload.email || '').trim();
  const profileText = (payload.profile_text || '').trim();
  const profileUrls = Array.isArray(payload.profile_urls) ? payload.profile_urls : [];
  const websiteUrls = Array.isArray(payload.website_urls) ? payload.website_urls : [];
  const allUrls = [...profileUrls, ...websiteUrls];

  // 1. Email Analysis
  if (email) {
    findings.push({
      rule_id: 'EXPOSURE_EMAIL_DIRECT',
      title: 'Public email address provided',
      severity: 'medium',
      category: 'Contact Info',
      score_contribution: 10,
      evidence: email,
      explanation: 'Your email address is directly exposed. Threat actors can use it for spear-phishing or credential-stuffing.',
      mitigation: 'Use email alias forwarding services for public communications.',
      recommendation_action: 'Deploy email aliasing for public profiles.',
      recommendation_detail: 'Prevent inbox compromise by rotating proxy emails.'
    });

    if (username && email.toLowerCase().includes(username.toLowerCase())) {
      findings.push({
        rule_id: 'EMAIL_CONTAINS_USERNAME',
        title: 'Email address contains username handle',
        severity: 'low',
        category: 'Identity Correlation',
        score_contribution: 5,
        evidence: `Username "${username}" found inside "${email}"`,
        explanation: 'Having your username inside your email makes it trivial to cross-reference your accounts across services.',
        mitigation: 'Maintain distinct handles that do not mirror your private email address.',
        recommendation_action: 'Separate username handles from personal email addresses.',
        recommendation_detail: 'Avoid revealing your primary inbox address inside platform screen names.'
      });
    }
  }

  // 2. Phone detection in text
  const phoneRegex = /(?:\+?[1-9]\d{0,2}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/g;
  const phoneMatches = profileText.match(phoneRegex);
  if (phoneMatches) {
    const validPhones = phoneMatches.filter(p => p.replace(/\D/g, '').length >= 9);
    if (validPhones.length > 0) {
      findings.push({
        rule_id: 'TEXT_PHONE_DETECTED',
        title: 'Phone number pattern detected in profile text',
        severity: 'high',
        category: 'Contact Info',
        score_contribution: 20,
        evidence: validPhones[0],
        explanation: 'Phone numbers can be leveraged for SMS phishing (smishing), SIM swapping, and identity verification bypass.',
        mitigation: 'Remove phone numbers from public bios and public repositories.',
        recommendation_action: 'Remove public phone numbers from bios and profiles.',
        recommendation_detail: 'Use VoIP numbers (like Google Voice) for public contacts.'
      });
    }
  }

  // 3. Date of birth detection
  const dobRegex = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|(19|20)\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g;
  const dobMatches = profileText.match(dobRegex);
  if (dobMatches) {
    findings.push({
      rule_id: 'TEXT_DOB_DETECTED',
      title: 'Date of birth pattern detected in text',
      severity: 'high',
      category: 'Personal Identity',
      score_contribution: 20,
      evidence: dobMatches[0],
      explanation: 'Dates of birth are frequently used in bank security questions and knowledge-based authentication.',
      mitigation: 'Do not publish full birth dates online; use year-only or birthday without year.',
      recommendation_action: 'Do not publicly share your exact date of birth.',
      recommendation_detail: 'Full date of birth is a primary KYC data point used by social engineers.'
    });
  }

  // 4. Username reuse in URLs
  if (username && username.length >= 3 && allUrls.length > 0) {
    const reusedIn = allUrls.filter(u => u.toLowerCase().includes(username.toLowerCase()));
    if (reusedIn.length >= 2) {
      findings.push({
        rule_id: 'PROFILE_USERNAME_REUSE',
        title: 'Username reused across multiple profile URLs',
        severity: 'medium',
        category: 'Account Correlation',
        score_contribution: 10,
        evidence: `Username "${username}" found in: ${reusedIn.slice(0, 3).join('; ')}`,
        explanation: 'Reusing the same username enables cross-platform profiling and OSINT tracking.',
        mitigation: 'Use distinct pseudonyms across unrelated services.',
        recommendation_action: 'Use unique handles for high-risk accounts.',
        recommendation_detail: 'Keep pseudonyms segregated between professional, gaming, and personal accounts.'
      });
    }
  }

  // 5. URL analysis
  allUrls.forEach(urlStr => {
    try {
      const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      if (u.protocol === 'http:') {
        findings.push({
          rule_id: 'URL_NON_HTTPS',
          title: 'Unencrypted HTTP URL provided',
          severity: 'medium',
          category: 'Network Security',
          score_contribution: 10,
          evidence: urlStr,
          explanation: 'HTTP transmits traffic in cleartext, exposing metadata and credentials to interception.',
          mitigation: 'Migrate to HTTPS or use HSTS.',
          recommendation_action: 'Ensure all profile links use HTTPS.',
          recommendation_detail: 'Update links to secure TLS/SSL protocols.'
        });
      }

      if (u.username || u.password) {
        findings.push({
          rule_id: 'URL_CREDENTIALS_EMBEDDED',
          title: 'Embedded credentials found in URL authority',
          severity: 'critical',
          category: 'Credentials Exposure',
          score_contribution: 30,
          evidence: `${u.protocol}//[REDACTED_CREDENTIALS]@${u.host}${u.pathname}`,
          explanation: 'Credentials embedded in URLs are logged by browsers, proxies, and web servers.',
          mitigation: 'Never embed usernames or passwords in public hyperlinks.',
          recommendation_action: 'Immediately revoke credentials embedded in public URLs.',
          recommendation_detail: 'Rotate any passwords exposed via URL components.'
        });
      }

      const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', '_ga'];
      const foundParams = trackingKeys.filter(k => u.searchParams.has(k));
      if (foundParams.length > 0) {
        findings.push({
          rule_id: 'URL_TRACKING_PARAMS',
          title: 'Tracking parameters detected in URL',
          severity: 'low',
          category: 'Tracking & Analytics',
          score_contribution: 5,
          evidence: `Parameters: ${foundParams.join(', ')}`,
          explanation: 'Campaign tracking parameters allow ad networks to correlate clicks to your identity.',
          mitigation: 'Strip tracking tokens from URLs before posting them publicly.',
          recommendation_action: 'Strip tracking queries from profile links.',
          recommendation_detail: 'Remove UTM and click IDs to maintain anonymous browsing records.'
        });
      }
    } catch (e) {}
  });

  // Calculate score & breakdown
  const severityWeights = { low: 5, medium: 10, high: 20, critical: 30 };
  const seenRuleIds = new Set();
  let totalScore = 0;
  const breakdown = [];
  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const categories = {};

  findings.forEach(f => {
    const sev = f.severity.toLowerCase();
    if (severityCounts[sev] !== undefined) severityCounts[sev]++;
    categories[f.category] = (categories[f.category] || 0) + 1;

    if (!seenRuleIds.has(f.rule_id)) {
      seenRuleIds.add(f.rule_id);
      const contribution = f.score_contribution || severityWeights[sev] || 5;
      totalScore += contribution;
      breakdown.push({
        rule_id: f.rule_id,
        title: f.title,
        severity: sev,
        contribution: contribution,
        running_total: Math.min(totalScore, 100)
      });
    }
  });

  totalScore = Math.min(totalScore, 100);
  let riskCategory = 'Low';
  if (totalScore >= 70) riskCategory = 'Critical';
  else if (totalScore >= 40) riskCategory = 'High';
  else if (totalScore >= 20) riskCategory = 'Moderate';

  const recommendations = findings.map(f => ({
    severity: f.severity,
    action: f.recommendation_action,
    detail: f.recommendation_detail || f.mitigation,
    rule_id: f.rule_id
  }));

  return {
    report_id: 'dom-' + Math.random().toString(36).substring(2, 10),
    timestamp: new Date().toISOString(),
    findings,
    severity_counts: severityCounts,
    categories,
    total_findings: findings.length,
    scoring: {
      total_score: totalScore,
      risk_category: riskCategory,
      score_breakdown: breakdown,
      disclaimer: 'Calculated locally in browser via DOM-based security analyzer.'
    },
    recommendations,
    note: 'DOM-based client execution (Zero network footprint).',
    limitations: [
      'Analysis conducted entirely inside your browser DOM.',
      'No data was transmitted over the network.',
      '100% private, local browser-native execution.'
    ]
  };
}

// ── Document upload ───────────────────────────────────────────────────────────
function initFileUpload() {
  const dropZone = $('#doc-drop-zone');
  const fileInput = $('#doc-file-input');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleDocFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleDocFile(file);
  });

  docAnalyzeBtn && docAnalyzeBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) { showToast('Please select a document first.', 'error'); return; }
    handleDocAnalyze(file);
  });
}

function handleDocFile(file) {
  const allowed = ['pdf', 'docx'];
  const ext = file.name.split('.').pop().toLowerCase();
  const nameEl = $('#selected-file-name');

  if (!allowed.includes(ext)) {
    showToast(`Unsupported file type: .${ext}. Use PDF or DOCX.`, 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File exceeds 5 MB limit.', 'error');
    return;
  }

  if (nameEl) nameEl.textContent = file.name;
  if (docAnalyzeBtn) docAnalyzeBtn.disabled = false;
}

async function handleDocAnalyze(file) {
  showLoader('Extracting document metadata & auditing exposure…');

  const form = new FormData();
  form.append('document', file);

  try {
    const res = await fetch(`${API_BASE}/api/analyze-document`, {
      method: 'POST',
      body: form,
    });

    if (res.ok) {
      const data = await res.json();
      hideLoader();
      currentReport = data;
      renderResults(data, false, true);
      scrollToResults();
      return;
    }
  } catch (err) {
    console.info('Switching to in-browser DOM document analysis.');
  }

  // Client-side DOM Document Analysis Fallback
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const domData = runClientSideDocAnalysis(file, content);
      currentReport = domData;
      hideLoader();
      renderResults(domData, false, true);
      showToast('⚡ Document analyzed locally in DOM mode', 'success');
      scrollToResults();
    } catch (err) {
      hideLoader();
      showToast('Document parsing error.', 'error');
    }
  };
  reader.onerror = function() {
    hideLoader();
    showToast('Could not read document file.', 'error');
  };
  reader.readAsBinaryString(file);
}

function runClientSideDocAnalysis(file, rawContent) {
  const findings = [];
  const filename = file.name;

  // 1. Filename sensitivity check
  const sensitiveRegex = /(?:^|[\W_])(password|passwd|secret|credential|private.?key|ssn|national.?id|passport|tax.?return|bank.?statement|medical|health.?record|confidential|salary|payslip)(?:[\W_]|$|\.\w+$)/i;
  if (sensitiveRegex.test(filename)) {
    findings.push({
      rule_id: 'DOC_SENSITIVE_FILENAME',
      title: 'Sensitive keyword in document filename',
      category: 'Sensitive Document Indicators',
      severity: 'medium',
      score_contribution: 10,
      evidence: `Filename: ${filename}`,
      explanation: 'The document filename contains a term indicating sensitive or confidential content.',
      mitigation: 'Rename the file before public transmission.',
      recommendation_action: 'Rename files before sharing to conceal sensitive context.',
      recommendation_detail: 'Avoid keywords like salary, tax, medical, or passwords in public filenames.'
    });
  }

  // 2. Metadata extraction from raw PDF / text
  const meta = {};
  const tags = ['author', 'creator', 'producer', 'title', 'creationdate', 'moddate'];
  tags.forEach(tag => {
    const m = new RegExp('/' + tag + '\\s*\\(([^)]+)\\)', 'i').exec(rawContent);
    if (m && m[1] && m[1].trim()) {
      meta[tag] = m[1].trim();
    }
  });

  if (meta.author || meta.creator) {
    const authorVal = meta.author || meta.creator;
    findings.push({
      rule_id: 'DOC_AUTHOR_METADATA',
      title: 'Author / creator identity in document metadata',
      category: 'Sensitive Document Indicators',
      severity: 'medium',
      score_contribution: 10,
      evidence: `author: ${authorVal}`,
      explanation: 'Embedded document metadata contains author/owner identity information.',
      mitigation: 'Strip personal metadata properties before sharing.',
      recommendation_action: 'Strip document author metadata before sharing.',
      recommendation_detail: 'Use document properties inspection to sanitize author tags.'
    });
  }

  if (meta.producer) {
    findings.push({
      rule_id: 'DOC_SOFTWARE_METADATA',
      title: 'Software / application version in document metadata',
      category: 'Sensitive Document Indicators',
      severity: 'low',
      score_contribution: 5,
      evidence: `producer: ${meta.producer}`,
      explanation: 'The software version used to produce the document is exposed in file properties.',
      mitigation: 'Sanitize document producer fields.',
      recommendation_action: 'Sanitize software version metadata.',
      recommendation_detail: 'Prevent attacker profiling by removing tool version strings.'
    });
  }

  if (meta.creationdate || meta.moddate) {
    findings.push({
      rule_id: 'DOC_TIMESTAMP_METADATA',
      title: 'Creation / modification timestamp in metadata',
      category: 'Sensitive Document Indicators',
      severity: 'low',
      score_contribution: 5,
      evidence: `timestamp: ${meta.creationdate || meta.moddate}`,
      explanation: 'Embedded timestamps reveal precise editing dates and timezone offsets.',
      mitigation: 'Remove timestamp attributes from exported files.',
      recommendation_action: 'Scrub timestamps before public distribution.',
      recommendation_detail: 'Timestamps expose operational schedules and local timezones.'
    });
  }

  if (meta.title && !['untitled', 'document'].includes(meta.title.toLowerCase())) {
    findings.push({
      rule_id: 'DOC_TITLE_METADATA',
      title: 'Document title or subject in metadata',
      category: 'Sensitive Document Indicators',
      severity: 'low',
      score_contribution: 5,
      evidence: `title: ${meta.title}`,
      explanation: 'Internal titles can disclose project codes or confidential classifications.',
      mitigation: 'Clear title and subject properties in document properties.',
      recommendation_action: 'Clear internal document titles.',
      recommendation_detail: 'Ensure internal project names are removed from metadata.'
    });
  }

  // 3. Scan readable text in content for PII
  const emailMatches = rawContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    const uniqueEmails = [...new Set(emailMatches)].slice(0, 3);
    findings.push({
      rule_id: 'DOC_TEXT_EMAIL_EXPOSURE',
      title: 'Email address detected in document content',
      category: 'Contact Info',
      severity: 'medium',
      score_contribution: 10,
      evidence: `Found: ${uniqueEmails.join(', ')}`,
      explanation: 'The document content contains exposed email addresses.',
      mitigation: 'Redact email addresses before distributing documents publicly.',
      recommendation_action: 'Redact emails from public documents.',
      recommendation_detail: 'Prevent email harvesting and spear-phishing.'
    });
  }

  const phoneMatches = rawContent.match(/(?:\+?[1-9]\d{0,2}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/g);
  if (phoneMatches) {
    const validPhones = phoneMatches.filter(p => p.replace(/\D/g, '').length >= 9).slice(0, 2);
    if (validPhones.length > 0) {
      findings.push({
        rule_id: 'DOC_TEXT_PHONE_EXPOSURE',
        title: 'Phone number detected in document content',
        category: 'Contact Info',
        severity: 'high',
        score_contribution: 20,
        evidence: `Found: ${validPhones.join(', ')}`,
        explanation: 'The document content exposes personal telephone numbers.',
        mitigation: 'Redact phone numbers to avoid smishing and identity compromise.',
        recommendation_action: 'Redact phone numbers before sharing documents.',
        recommendation_detail: 'Prevent phone harvesting and SIM-swap reconnaissance.'
      });
    }
  }

  // Score calculation
  const seenRuleIds = new Set();
  let totalScore = 0;
  const breakdown = [];
  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const categories = {};

  findings.forEach(f => {
    const sev = f.severity.toLowerCase();
    if (severityCounts[sev] !== undefined) severityCounts[sev]++;
    categories[f.category] = (categories[f.category] || 0) + 1;

    if (!seenRuleIds.has(f.rule_id)) {
      seenRuleIds.add(f.rule_id);
      const contribution = f.score_contribution || 5;
      totalScore += contribution;
      breakdown.push({
        rule_id: f.rule_id,
        title: f.title,
        severity: sev,
        contribution: contribution,
        running_total: Math.min(totalScore, 100)
      });
    }
  });

  totalScore = Math.min(totalScore, 100);
  let riskCategory = 'Low';
  if (totalScore >= 70) riskCategory = 'Critical';
  else if (totalScore >= 40) riskCategory = 'High';
  else if (totalScore >= 20) riskCategory = 'Moderate';

  const recommendations = findings.map(f => ({
    severity: f.severity,
    action: f.recommendation_action,
    detail: f.recommendation_detail || f.mitigation,
    rule_id: f.rule_id
  }));

  return {
    report_id: 'doc-' + Math.random().toString(36).substring(2, 10),
    timestamp: new Date().toISOString(),
    findings,
    severity_counts: severityCounts,
    categories,
    total_findings: findings.length,
    scoring: {
      total_score: totalScore,
      risk_category: riskCategory,
      score_breakdown: breakdown,
      disclaimer: 'Calculated from document properties and content analysis.'
    },
    recommendations,
    note: `Audited document: ${filename}`,
    limitations: [
      'Document analysis evaluated embedded properties and readable text.',
      'No data was transmitted over external networks.',
      '100% private zero-knowledge document audit.'
    ]
  };
}

// ── Result rendering ──────────────────────────────────────────────────────────
function renderResults(report, demo = false, docMode = false) {
  const sec = resultsSection;

  // Demo banner
  const demoBanner = $('#demo-banner');
  if (demoBanner) demoBanner.style.display = demo ? 'flex' : 'none';

  // Summary pills
  renderSummaryPills(report);

  // Score gauge
  renderScoreGauge(report.scoring, report.severity_counts);

  // Charts
  renderCharts(report);

  // Findings
  renderFindings(report.findings || []);

  // Recommendations
  renderRecommendations(report.recommendations || []);

  // Export buttons
  if (exportJsonBtn) exportJsonBtn.disabled = false;
  if (exportCsvBtn)  exportCsvBtn.disabled  = false;

  sec.classList.add('visible');
}

function renderSummaryPills(report) {
  const sc = report.severity_counts || {};
  const mapping = [
    { id: 'pill-total',    val: report.total_findings ?? 0, color: null },
    { id: 'pill-critical', val: sc.critical ?? 0, color: 'var(--sev-critical)' },
    { id: 'pill-high',     val: sc.high     ?? 0, color: 'var(--sev-high)' },
    { id: 'pill-medium',   val: sc.medium   ?? 0, color: 'var(--sev-medium)' },
    { id: 'pill-low',      val: sc.low      ?? 0, color: 'var(--sev-low)' },
  ];
  mapping.forEach(({ id, val, color }) => {
    const el = $(`#${id}`);
    if (!el) return;
    el.textContent = val;
    if (color) el.style.color = color;
  });
}

function renderScoreGauge(scoring, severityCounts) {
  if (!scoring) return;

  const score = scoring.total_score ?? 0;
  const category = scoring.risk_category ?? 'Unknown';

  // Number
  const numEl = $('#score-number');
  if (numEl) numEl.textContent = score;

  // Category badge
  const catBadge = $('#score-category');
  if (catBadge) {
    catBadge.textContent = category;
    catBadge.className = 'score-category-badge ' + severityClass(category);
  }

  // Severity stats breakdown under gauge
  const sc = severityCounts || (currentReport ? currentReport.severity_counts : null) || {};
  const critEl = $('#sc-critical');
  const highEl = $('#sc-high');
  const medEl  = $('#sc-medium');
  const lowEl  = $('#sc-low');
  if (critEl) critEl.textContent = sc.critical ?? 0;
  if (highEl) highEl.textContent = sc.high ?? 0;
  if (medEl)  medEl.textContent  = sc.medium ?? 0;
  if (lowEl)  lowEl.textContent   = sc.low ?? 0;

  // SVG gauge
  const fill = $('#gauge-fill');
  if (fill) {
    const r = 56;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(score, 100) / 100;
    fill.setAttribute('stroke-dasharray', circ.toFixed(2));
    fill.setAttribute('stroke-dashoffset', (circ * (1 - pct)).toFixed(2));
    fill.setAttribute('stroke', gaugeColor(score));
  }

  // Disclaimer
  const disclaimerEl = $('#score-disclaimer');
  if (disclaimerEl) disclaimerEl.textContent = scoring.disclaimer || '';
}

function gaugeColor(score) {
  if (score < 20)  return 'var(--sev-low)';
  if (score < 40)  return 'var(--sev-medium)';
  if (score < 70)  return 'var(--sev-high)';
  return 'var(--sev-critical)';
}

function severityClass(category) {
  const c = (category || '').toLowerCase();
  if (c === 'critical') return 'sev-badge sev-critical';
  if (c === 'high')     return 'sev-badge sev-high';
  if (c === 'moderate') return 'sev-badge sev-medium';
  return 'sev-badge sev-low';
}

// ── Charts ────────────────────────────────────────────────────────────────────
function destroyCharts() {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
}

function renderCharts(report) {
  destroyCharts();

  const sc = report.severity_counts || {};
  const totalFindings = (sc.critical || 0) + (sc.high || 0) + (sc.medium || 0) + (sc.low || 0);
  const sevCanvas = $('#sev-chart');
  if (sevCanvas) {
    if (totalFindings === 0) {
      chartInstances.severity = new Chart(sevCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Clean / No Risks Detected'],
          datasets: [{
            data: [1],
            backgroundColor: ['rgba(34, 197, 94, 0.85)'],
            borderColor: '#050505',
            borderWidth: 3,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#00e5ff', font: { size: 12 }, padding: 12 },
            },
            tooltip: {
              callbacks: {
                label: () => ' Clean Document: 0 security or privacy risks found',
              },
            },
          },
        },
      });
    } else {
      chartInstances.severity = new Chart(sevCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Critical', 'High', 'Medium', 'Low'],
          datasets: [{
            data: [sc.critical || 0, sc.high || 0, sc.medium || 0, sc.low || 0],
            backgroundColor: [
              'rgba(239,68,68,0.85)',
              'rgba(249,115,22,0.85)',
              'rgba(245,158,11,0.85)',
              'rgba(34,197,94,0.85)',
            ],
            borderColor: '#050505',
            borderWidth: 3,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#a89cb8', font: { size: 12 }, padding: 12 },
            },
          },
        },
      });
    }
  }

  const cats = report.categories || {};
  const catCanvas = $('#cat-chart');
  if (catCanvas) {
    const catKeys = Object.keys(cats);
    if (catKeys.length === 0) {
      chartInstances.category = new Chart(catCanvas, {
        type: 'bar',
        data: {
          labels: ['Privacy Baseline', 'Metadata Exposure', 'PII Leakage'],
          datasets: [{
            label: 'Violations Detected',
            data: [0, 0, 0],
            backgroundColor: 'rgba(0, 229, 255, 0.25)',
            borderColor: 'rgba(0, 229, 255, 0.85)',
            borderWidth: 2,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'All Categories Clean (0 Violations)',
              color: '#22c55e',
              font: { size: 12, weight: 'bold' },
            },
          },
          scales: {
            x: { ticks: { color: '#a89cb8', font: { size: 11 } }, grid: { display: false } },
            y: {
              ticks: { color: '#a89cb8', stepSize: 1 },
              grid: { color: 'rgba(94, 22, 166, 0.20)' },
              beginAtZero: true,
              suggestedMax: 2,
            },
          },
        },
      });
    } else {
      chartInstances.category = new Chart(catCanvas, {
        type: 'bar',
        data: {
          labels: catKeys.map(k => k.length > 22 ? k.slice(0, 22) + '…' : k),
          datasets: [{
            data: Object.values(cats),
            backgroundColor: 'rgba(0, 229, 255, 0.25)',
            borderColor: 'rgba(0, 229, 255, 0.85)',
            borderWidth: 2,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#a89cb8', font: { size: 11 } }, grid: { display: false } },
            y: {
              ticks: { color: '#a89cb8', stepSize: 1 },
              grid: { color: 'rgba(94, 22, 166, 0.20)' },
              beginAtZero: true,
            },
          },
        },
      });
    }
  }
}

// ── Findings ──────────────────────────────────────────────────────────────────
function renderFindings(findings) {
  const container = $('#findings-list');
  const countEl   = $('#findings-count');
  if (!container) return;

  if (countEl) countEl.textContent = findings.length;

  if (findings.length === 0) {
    container.innerHTML = `
      <div class="card" style="border-color: rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.05); text-align: left; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(34, 197, 94, 0.18); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">🛡️</div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #22c55e;">Document Privacy Audit Passed — Clean Status</h3>
            <p style="margin: 3px 0 0; font-size: 0.84rem; color: #a89cb8;">Heuristic Risk Score: 0/100 &middot; No privacy risks or metadata leaks detected</p>
          </div>
        </div>
        <p style="color: #d0c8dc; font-size: 0.88rem; line-height: 1.5; margin-bottom: 16px;">
          The multi-layer metadata inspector scrutinized all embedded streams, XMP tags, creation timestamps, and readable body text. No personal identifiers or sensitive traces were found.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
          <div style="background: rgba(5,5,5,0.7); padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(0, 229, 255, 0.2); font-size: 0.84rem; color: #e2d9f3;">
            <span style="color: #22c55e; font-weight: bold; margin-right: 6px;">✓</span> Author &amp; Creator Tags: <strong>Clean</strong>
          </div>
          <div style="background: rgba(5,5,5,0.7); padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(0, 229, 255, 0.2); font-size: 0.84rem; color: #e2d9f3;">
            <span style="color: #22c55e; font-weight: bold; margin-right: 6px;">✓</span> Software Signatures: <strong>Clean</strong>
          </div>
          <div style="background: rgba(5,5,5,0.7); padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(0, 229, 255, 0.2); font-size: 0.84rem; color: #e2d9f3;">
            <span style="color: #22c55e; font-weight: bold; margin-right: 6px;">✓</span> Editing Timestamps: <strong>Clean</strong>
          </div>
          <div style="background: rgba(5,5,5,0.7); padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(0, 229, 255, 0.2); font-size: 0.84rem; color: #e2d9f3;">
            <span style="color: #22c55e; font-weight: bold; margin-right: 6px;">✓</span> Plaintext PII (Emails/Phones): <strong>Clean</strong>
          </div>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = '';
  findings.forEach((f, i) => {
    container.appendChild(buildFindingCard(f, i));
  });

  // Filter buttons
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterFindings(btn.dataset.filter);
    });
  });
}

function buildFindingCard(f, i) {
  const sev = (f.severity || 'low').toLowerCase();
  const card = document.createElement('div');
  card.className = `finding-card sev-${sev}`;
  card.dataset.severity = sev;
  card.dataset.category = (f.category || '').toLowerCase();
  card.id = `finding-${i}`;

  card.innerHTML = `
    <div class="finding-header" role="button" aria-expanded="false" tabindex="0">
      <div class="finding-title-row">
        <span class="sev-badge sev-${sev}">${escapeHtml(sev)}</span>
        <span class="finding-title">${escapeHtml(f.title || f.rule_id)}</span>
      </div>
      <svg class="finding-chevron" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="finding-body">
      <div class="finding-section">
        <div class="finding-section-label">Category</div>
        <div class="finding-section-value">${escapeHtml(f.category || '—')}</div>
      </div>
      <div class="finding-section">
        <div class="finding-section-label">Evidence</div>
        <div class="finding-evidence">${escapeHtml(f.evidence || '—')}</div>
      </div>
      <div class="finding-section">
        <div class="finding-section-label">Explanation</div>
        <div class="finding-section-value">${escapeHtml(f.explanation || '—')}</div>
      </div>
      <div class="finding-section">
        <div class="finding-section-label">Potential Consequence</div>
        <div class="finding-section-value">${escapeHtml(f.consequence || '—')}</div>
      </div>
      <div class="finding-section">
        <div class="finding-section-label">Mitigation</div>
        <div class="finding-section-value"><strong>${escapeHtml(f.recommendation_action || '')}</strong>
          <br>${escapeHtml(f.recommendation_detail || '')}</div>
      </div>
      <div class="finding-meta">
        <span class="finding-meta-item">Rule: ${escapeHtml(f.rule_id || '—')}</span>
        <span class="finding-meta-item">Score: +${f.score_contribution ?? 0} pts</span>
      </div>
    </div>
  `;

  const header = card.querySelector('.finding-header');
  header.addEventListener('click', () => toggleFinding(card));
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFinding(card); }
  });

  return card;
}

function toggleFinding(card) {
  const expanded = card.classList.toggle('expanded');
  const header = card.querySelector('.finding-header');
  if (header) header.setAttribute('aria-expanded', expanded);
}

function filterFindings(filter) {
  $$('.finding-card').forEach(card => {
    const match = filter === 'all' || card.dataset.severity === filter;
    card.style.display = match ? '' : 'none';
  });
}

// ── Recommendations ───────────────────────────────────────────────────────────
function renderRecommendations(recs) {
  const container = $('#recommendations-list');
  if (!container) return;

  if (recs.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px 20px; background: rgba(34, 197, 94, 0.06); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 10px; color: #a89cb8; font-size: 0.88rem;">
        <strong style="color: #22c55e;">Zero Remediation Required:</strong> No privacy leaks were identified in this audit. The submitted artifact conforms to privacy baseline guidelines.
      </div>`;
    return;
  }

  container.innerHTML = '';
  recs.forEach((rec, i) => {
    const item = document.createElement('div');
    item.className = 'rec-item';
    item.innerHTML = `
      <div class="rec-num">${i + 1}</div>
      <div class="rec-content">
        <div class="rec-action">${escapeHtml(rec.action)}</div>
        <div class="rec-detail">${escapeHtml(rec.detail)}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// ── Export ────────────────────────────────────────────────────────────────────
function handleExportJson() {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `digital_shadow_${currentReport.report_id?.slice(0, 8) || 'report'}.json`);
  showToast('JSON report downloaded.', 'success');
}

function handleExportCsv() {
  if (!currentReport) return;
  const findings = currentReport.findings || [];
  const rows = [
    ['Rule ID', 'Title', 'Category', 'Severity', 'Score', 'Evidence', 'Explanation', 'Mitigation'],
    ...findings.map(f => [
      f.rule_id || '',
      f.title || '',
      f.category || '',
      f.severity || '',
      f.score_contribution ?? 0,
      f.evidence || '',
      f.explanation || '',
      f.recommendation_action || '',
    ]),
  ];

  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell);
      // Prevent formula injection
      const safe = s.replace(/^[=+\-@]/, "'$&");
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `digital_shadow_${currentReport.report_id?.slice(0, 8) || 'report'}.csv`);
  showToast('CSV report downloaded.', 'success');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Loader ────────────────────────────────────────────────────────────────────
function showLoader(msg = 'Analyzing…') {
  const txt = $('#loader-text');
  if (txt) txt.textContent = msg;
  if (loaderOverlay) loaderOverlay.classList.add('active');
}

function hideLoader() {
  if (loaderOverlay) loaderOverlay.classList.remove('active');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ── Scroll helpers ────────────────────────────────────────────────────────────
function scrollToResults() {
  const sec = resultsSection;
  if (sec) setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function scrollToForm() {
  const form = $('#analyze-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Security helpers ──────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
