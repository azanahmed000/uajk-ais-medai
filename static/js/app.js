/* ============================================================
   UAJK AIS Society — MedAI Application Engine
   Single Page App (SPA) Controller & ML Predictor
   ============================================================ */

// ---- State Management ----
let currentSidebarCollapsed = false;
let backendConnected = false;
let defaultGenderPreset = 1; // 1 = Male, 0 = Female
let clinicalReviewMode = true;

// Active Step counters for forms
const wizardSteps = {
  heart: 1,
  hyper: 1,
  diab: 1
};

const maxWizardSteps = {
  heart: 5,
  hyper: 5,
  diab: 3
};

// Local Storage History array
let screeningHistory = [];

// ---- Page Routing ----
function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page-view').forEach(page => {
    page.classList.remove('active');
  });

  let targetId = pageId;

  // Show target page
  const targetPage = document.getElementById('view-' + targetId);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update headers
  const headerTitle = document.getElementById('headerTitle');
  if (headerTitle) {
    headerTitle.textContent = pageId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Set active class on Sidebar items
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('active');
    }
  });

  // Set active class on Mobile Navigation items
  document.querySelectorAll('.mobile-nav .mobile-nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('active');
    }
  });

  // Special page updates
  if (pageId === 'history') {
    loadHistoryTable();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Collapsed Sidebar (Desktop)
function toggleSidebarCollapse() {
  const sidebar = document.getElementById('appSidebar');
  const toggleIcon = document.getElementById('toggleIcon');
  currentSidebarCollapsed = !currentSidebarCollapsed;
  
  if (currentSidebarCollapsed) {
    sidebar.classList.add('collapsed');
    toggleIcon.innerHTML = '<path d="M9 5l7 7-7 7"/>'; // Point right
  } else {
    sidebar.classList.remove('collapsed');
    toggleIcon.innerHTML = '<path d="M15 19l-7-7 7-7"/>'; // Point left
  }
}

// ---- Custom Interactive Form Input Bindings ----
function selectSegment(element, hiddenInputId) {
  const container = element.parentElement;
  container.querySelectorAll('.segment-item').forEach(item => {
    item.classList.remove('active');
  });
  element.classList.add('active');
  
  const value = element.getAttribute('data-value');
  const input = document.getElementById(hiddenInputId);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }
}

function selectRadioCard(element, hiddenInputId) {
  const container = element.parentElement;
  container.querySelectorAll('.radio-card').forEach(card => {
    card.classList.remove('active');
  });
  element.classList.add('active');
  
  const value = element.getAttribute('data-value');
  const input = document.getElementById(hiddenInputId);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }
}

function selectChip(element, hiddenInputId) {
  const container = element.parentElement;
  container.querySelectorAll('.chip-item').forEach(chip => {
    chip.classList.remove('active');
  });
  element.classList.add('active');
  
  const value = element.getAttribute('data-value');
  const input = document.getElementById(hiddenInputId);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }
}

function updateSliderReadout(slider, readoutId) {
  const readout = document.getElementById(readoutId);
  if (readout) {
    readout.textContent = slider.value;
  }
}

// ---- Multi-Step Wizard Progress Logic ----
function navigateWizard(type, direction) {
  const currentStep = wizardSteps[type];
  const maxStep = maxWizardSteps[type];
  const nextStep = currentStep + direction;

  // Handle submission if we are at the final step and trying to go forward
  if (direction > 0 && currentStep === maxStep) {
    if (type === 'heart') submitHeartScreening(new Event('submit'));
    else if (type === 'hyper') submitHyperScreening(new Event('submit'));
    else if (type === 'diab') submitDiabetesScreening(new Event('submit'));
    return;
  }

  // Validation before moving forward
  if (direction > 0 && !validateWizardStep(type, currentStep)) {
    alert('Please enter valid measurements for all required fields in this section.');
    return;
  }

  if (nextStep < 1 || nextStep > maxStep) return;

  // Update active step in state
  wizardSteps[type] = nextStep;

  // Update Stepper visually
  const stepper = document.getElementById(type + 'Stepper');
  const nodes = stepper.querySelectorAll('.step-node');
  const fill = stepper.querySelector('.stepper-progress-fill');
  
  nodes.forEach(node => {
    const nodeStep = parseInt(node.getAttribute('data-step'));
    node.classList.remove('active', 'completed');
    
    if (nodeStep === nextStep) {
      node.classList.add('active');
    } else if (nodeStep < nextStep) {
      node.classList.add('completed');
    }
  });

  // Calculate percentage fill
  const fillPercent = ((nextStep - 1) / (maxStep - 1)) * 100;
  fill.style.width = fillPercent + '%';

  // Toggle pane views
  const form = document.getElementById(type + 'WizardForm');
  const panes = form.querySelectorAll('.wizard-step-pane');
  panes.forEach(pane => {
    pane.classList.remove('active');
    if (parseInt(pane.getAttribute('data-step')) === nextStep) {
      pane.classList.add('active');
    }
  });

  // Update buttons row
  const prevBtn = document.getElementById(type + 'PrevBtn');
  const nextBtn = document.getElementById(type + 'NextBtn');
  
  prevBtn.disabled = nextStep === 1;

  if (nextStep === maxStep) {
    nextBtn.innerHTML = 'Analyze Risk <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>';
    nextBtn.classList.add('btn-success');
    
    // Auto populate and render confirmation review page
    populateWizardReview(type);
  } else {
    nextBtn.innerHTML = 'Next <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    nextBtn.classList.remove('btn-success');
  }
}

// Validation helper per step
function validateWizardStep(type, step) {
  const form = document.getElementById(type + 'WizardForm');
  const activePane = form.querySelector(`.wizard-step-pane[data-step="${step}"]`);
  const inputs = activePane.querySelectorAll('input[required]');
  
  let valid = true;
  inputs.forEach(input => {
    if (!input.checkValidity()) {
      valid = false;
      input.reportValidity();
    }
  });
  return valid;
}

// Populate verification step tables
function populateWizardReview(type) {
  const reviewBody = document.getElementById(type + 'ReviewTableBody');
  if (!reviewBody) return;
  reviewBody.innerHTML = '';

  const form = document.getElementById(type + 'WizardForm');
  const formData = new FormData(form);
  
  const labelsMap = {
    // Heart labels
    age: 'Patient Age (Years)',
    sex: 'Biological Sex (1=Male, 0=Female)',
    cp: 'Chest Pain Classification (0-3)',
    trestbps: 'Resting Blood Pressure (mmHg)',
    chol: 'Serum Cholesterol (mg/dl)',
    fbs: 'Fasting Blood Sugar > 120 mg/dl',
    restecg: 'Resting ECG Results (0-2)',
    thalach: 'Maximum Heart Rate (bpm)',
    exang: 'Exercise Induced Angina (1=Yes, 0=No)',
    oldpeak: 'ST Depression (Oldpeak)',
    slope: 'Slope of ST Segment (0-2)',
    ca: 'Colored Major Vessels (0-4)',
    thal: 'Thalassemia Class (0-3)',
    // Hypertension labels
    gender: 'Gender (1=Male, 0=Female)',
    bmi: 'Body Mass Index (BMI)',
    cholesterol: 'Total Cholesterol (mg/dl)',
    systolic_bp: 'Systolic BP (mmHg)',
    diastolic_bp: 'Diastolic BP (mmHg)',
    smoking: 'Smoking Status (0=Never, 1=Former, 2=Current)',
    alcohol: 'Alcohol Consumption (0=None, 1=Mod, 2=Heavy)',
    activity: 'Physical Activity (0=Sed, 1=Mod, 2=Active)',
    family_history: 'Family Medical History',
    diabetes: 'Diabetes Diagnosed',
    stress: 'Psychological Stress (1-10)',
    salt: 'Dietary Salt Level (0-2)',
    sleep: 'Sleep Duration (hrs/day)',
    heart_rate: 'Pulse Rate (bpm)',
    ldl: 'LDL Low-density Lipid (mg/dl)',
    hdl: 'HDL High-density Lipid (mg/dl)',
    triglycerides: 'Triglycerides (mg/dl)',
    glucose: 'Blood Glucose (mg/dl)',
    // Diabetes labels
    pregnancies: 'Pregnancy History Count',
    blood_pressure: 'Diastolic Blood Pressure (mmHg)',
    skin_thickness: 'Triceps Skin Fold (mm)',
    insulin: 'Serum Insulin (mu U/ml)',
    dpf: 'Diabetes Pedigree Coefficient'
  };

  for (const [key, value] of formData.entries()) {
    const label = labelsMap[key] || key;
    let displayVal = value;
    
    // Map binary/categorical inputs to clinical text
    if (key === 'sex' || key === 'gender') displayVal = parseInt(value) === 1 ? 'Male' : 'Female';
    if (key === 'fbs') displayVal = parseInt(value) === 1 ? 'Yes' : 'No';
    if (key === 'exang' || key === 'family_history' || key === 'diabetes') displayVal = parseInt(value) === 1 ? 'Yes' : 'No';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight: 500;">${label}</td>
      <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${displayVal}</td>
    `;
    reviewBody.appendChild(row);
  }
}

// Handle final review run button trigger
function submitHeartScreening(event) {
  event.preventDefault();
  handlePredictionQuery('heart');
}

function submitHyperScreening(event) {
  event.preventDefault();
  handlePredictionQuery('hypertension');
}

function submitDiabetesScreening(event) {
  event.preventDefault();
  handlePredictionQuery('diabetes');
}

// ---- SMART DATA ENTRY AUTOCALCULATIONS ----
function calculateHeartVitals() {
  const age = parseFloat(document.getElementById('heart_age').value);
  const bp = parseFloat(document.getElementById('heart_trestbps').value);
}

function calculateHyperVitals() {
  const sys = parseFloat(document.getElementById('hyper_systolic_bp').value);
  const dia = parseFloat(document.getElementById('hyper_diastolic_bp').value);
}

function calculateDiabetesVitals() {
  const age = parseFloat(document.getElementById('diab_age').value);
  const bp = parseFloat(document.getElementById('diab_bp').value);
}

// Bridges from Calculators to Wizard Forms
function openCalculatorFromForm(calcType, fillElementId) {
  navigateTo('calculators');
  
  // Tag target fill ID in session
  sessionStorage.setItem('bridge_fill_target', fillElementId);
  sessionStorage.setItem('bridge_fill_type', calcType);
  
  // Flash calculator background
  const card = document.querySelector(`.calculator-card:has(#calc_${calcType}_apply)`);
  if (card) {
    card.style.borderColor = 'var(--secondary)';
    setTimeout(() => { card.style.borderColor = 'var(--border)'; }, 1500);
  }
}

// ---- HEALTH CALCULATORS HUB ----
function runBmiCalculation() {
  const height = parseFloat(document.getElementById('calc_bmi_height').value);
  const weight = parseFloat(document.getElementById('calc_bmi_weight').value);
  
  if (isNaN(height) || isNaN(weight) || height <= 0) {
    alert('Please enter valid measurements.');
    return;
  }
  
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  const roundedBmi = bmi.toFixed(1);
  
  let category = 'Underweight';
  if (bmi >= 18.5 && bmi < 25) category = 'Normal Weight';
  else if (bmi >= 25 && bmi < 30) category = 'Overweight';
  else if (bmi >= 30) category = 'Obese';
  
  document.getElementById('calc_bmi_value').textContent = roundedBmi;
  document.getElementById('calc_bmi_class').textContent = category;
  document.getElementById('calc_bmi_result').classList.add('active');
  document.getElementById('calc_bmi_apply').style.display = 'block';
}

function applyBmiToForms() {
  const bmiVal = document.getElementById('calc_bmi_value').textContent;
  const target = sessionStorage.getItem('bridge_fill_target');
  
  if (target) {
    const el = document.getElementById(target);
    if (el) el.value = bmiVal;
    alert(`Applied BMI: ${bmiVal} to form.`);
  } else {
    // Fill all visible bmi inputs as default shortcut
    const hBmi = document.getElementById('hyper_bmi');
    const dBmi = document.getElementById('diab_bmi');
    if (hBmi) hBmi.value = bmiVal;
    if (dBmi) dBmi.value = bmiVal;
    alert(`Applied BMI: ${bmiVal} globally.`);
  }
}

function runBpCalculation() {
  const sys = parseFloat(document.getElementById('calc_bp_sys').value);
  const dia = parseFloat(document.getElementById('calc_bp_dia').value);
  
  if (isNaN(sys) || isNaN(dia)) {
    alert('Please enter valid measurements.');
    return;
  }
  
  let category = 'Normal';
  let desc = 'systolic < 120 and diastolic < 80 mmHg. Normal range.';
  
  if (sys >= 140 || dia >= 90) {
    category = 'Stage 2 Hypertension';
    desc = 'systolic >= 140 or diastolic >= 90 mmHg. Immediate medical advice advised.';
  } else if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
    category = 'Stage 1 Hypertension';
    desc = 'systolic 130-139 or diastolic 80-89 mmHg. Lifestyle adjustments recommended.';
  } else if (sys >= 120 && sys <= 129 && dia < 80) {
    category = 'Elevated Blood Pressure';
    desc = 'systolic 120-129 and diastolic < 80 mmHg. Increased monitoring.';
  }
  
  document.getElementById('calc_bp_value').textContent = category;
  document.getElementById('calc_bp_desc').textContent = desc;
  document.getElementById('calc_bp_result').classList.add('active');
  document.getElementById('calc_bp_apply').style.display = 'block';
}

function applyBpToForms() {
  const sys = document.getElementById('calc_bp_sys').value;
  const dia = document.getElementById('calc_bp_dia').value;
  const target = sessionStorage.getItem('bridge_fill_target');
  
  if (target) {
    // If bridging from a specific field, fill appropriate group
    if (target.includes('heart')) {
      document.getElementById('heart_trestbps').value = sys;
    } else if (target.includes('hyper')) {
      document.getElementById('hyper_systolic_bp').value = sys;
      document.getElementById('hyper_diastolic_bp').value = dia;
    } else if (target.includes('diab')) {
      document.getElementById('diab_bp').value = dia;
    }
    alert('Applied blood pressure levels.');
  } else {
    // Default global fills
    const htBp = document.getElementById('heart_trestbps');
    if (htBp) htBp.value = sys;
    
    const hSys = document.getElementById('hyper_systolic_bp');
    const hDia = document.getElementById('hyper_diastolic_bp');
    if (hSys) hSys.value = sys;
    if (hDia) hDia.value = dia;
    
    const dBp = document.getElementById('diab_bp');
    if (dBp) dBp.value = dia;
    
    alert('Applied blood pressure measurements globally.');
  }
}

function runIbwCalculation() {
  const height = parseFloat(document.getElementById('calc_ibw_height').value);
  const sex = parseInt(document.getElementById('calc_ibw_sex').value);
  
  if (isNaN(height) || height < 152.4) {
    alert('Devine Ideal weight formula requires heights above 152 cm (60 inches).');
    return;
  }
  
  const inchesOver5Foot = (height - 152.4) / 2.54;
  let ibw = 0;
  if (sex === 1) {
    ibw = 50.0 + (2.3 * inchesOver5Foot);
  } else {
    ibw = 45.5 + (2.3 * inchesOver5Foot);
  }
  
  const minRange = Math.round(ibw * 0.85);
  const maxRange = Math.round(ibw * 1.15);
  
  document.getElementById('calc_ibw_value').textContent = ibw.toFixed(1) + ' kg';
  document.getElementById('calc_ibw_range').textContent = `${minRange} - ${maxRange} kg`;
  document.getElementById('calc_ibw_result').classList.add('active');
}

function runWaterCalculation() {
  const weight = parseFloat(document.getElementById('calc_water_weight').value);
  const act = document.getElementById('calc_water_act').value;
  
  if (isNaN(weight)) {
    alert('Please enter valid weight.');
    return;
  }
  
  // Base rate 35ml / kg
  let rate = 35;
  if (act === 'mod') rate = 40;
  if (act === 'high') rate = 45;
  
  const targetMl = weight * rate;
  const targetL = targetMl / 1000;
  const targetOz = targetMl / 29.574;
  
  document.getElementById('calc_water_value').textContent = targetL.toFixed(1) + ' Liters';
  document.getElementById('calc_water_oz').textContent = Math.round(targetOz) + ' fl oz';
  document.getElementById('calc_water_result').classList.add('active');
}

// ---- CONNECT TO FLASK API ENGINE ----
async function handlePredictionQuery(diseaseType) {
  // Get active step nodes to show loading
  const formId = diseaseType === 'heart' ? 'heartWizardForm' : diseaseType === 'hypertension' ? 'hyperWizardForm' : 'diabetesWizardForm';
  const form = document.getElementById(formId);
  
  // Build payload
  const formData = new FormData(form);
  const data = {};
  for (const [key, value] of formData.entries()) {
    data[key] = parseFloat(value);
  }

  // Fallback demo simulator trigger check
  let result = null;
  const endpoint = `/api/predict/${diseaseType}`;
  
  // Loading animations
  const nextBtn = document.getElementById(diseaseType + 'NextBtn');
  const origHtml = nextBtn.innerHTML;
  nextBtn.disabled = true;
  nextBtn.innerHTML = '<span class="status-dot" style="background:#fff;animation:pulse 1s infinite;"></span> Querying AI...';

  if (backendConnected) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const payload = await response.json();
        result = {
          riskScore: payload.risk_percent,
          disease: diseaseType,
          model: payload.disease === 'heart' ? 'GradientBoosting' : 'RandomForest',
          confidence: payload.risk_percent > 80 || payload.risk_percent < 20 ? 'HIGH' : 'MODERATE',
          inputs: data,
          timestamp: new Date().toLocaleString(),
          isBackend: true
        };
      }
    } catch (e) {
      console.warn('Backend request crashed, simulating offline result.', e);
    }
  }

  if (!result) {
    // Offline simulation if Flask backend unavailable
    await new Promise(r => setTimeout(r, 1200));
    result = simulateOfflinePrediction(diseaseType, data);
  }

  // Restore button
  nextBtn.disabled = false;
  nextBtn.innerHTML = origHtml;

  // Cache to session
  sessionStorage.setItem('current_screening_result', JSON.stringify(result));
  
  // Add to Local Storage History
  screeningHistory.push(result);
  localStorage.setItem('medai_history', JSON.stringify(screeningHistory));

  // Render & Route
  renderResultsScreen(result);
  navigateTo('results');
  
  // Reset active wizard steps back to step 1
  resetWizard(diseaseType);
}

// Reset form elements
function resetWizard(type) {
  wizardSteps[type] = 1;
  const form = document.getElementById(type + 'WizardForm');
  form.reset();
  
  // reset controls active selectors
  form.querySelectorAll('.segment-item, .radio-card, .chip-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // activate default segment/card inputs
  form.querySelectorAll('.segment-control, .radio-card-grid, .chip-grid').forEach(grid => {
    const first = grid.querySelector('.segment-item, .radio-card, .chip-item');
    if (first) first.classList.add('active');
  });
  
  // reset sliders
  form.querySelectorAll('.form-slider').forEach(slider => {
    slider.value = slider.getAttribute('value');
    const readout = slider.parentElement.parentElement.querySelector('.slider-val-readout');
    if (readout) readout.textContent = slider.value;
  });

  // reset stepper UI
  const stepper = document.getElementById(type + 'Stepper');
  const nodes = stepper.querySelectorAll('.step-node');
  const fill = stepper.querySelector('.stepper-progress-fill');
  
  nodes.forEach(node => {
    const nodeStep = parseInt(node.getAttribute('data-step'));
    node.classList.remove('active', 'completed');
    if (nodeStep === 1) node.classList.add('active');
  });
  fill.style.width = '0%';
  
  // panes
  const panes = form.querySelectorAll('.wizard-step-pane');
  panes.forEach(pane => {
    pane.classList.remove('active');
    if (parseInt(pane.getAttribute('data-step')) === 1) pane.classList.add('active');
  });
  
  const prevBtn = document.getElementById(type + 'PrevBtn');
  const nextBtn = document.getElementById(type + 'NextBtn');
  prevBtn.disabled = true;
  nextBtn.innerHTML = 'Next <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  nextBtn.classList.remove('btn-success');
}

// Offline Sim Engine
function simulateOfflinePrediction(disease, inputs) {
  let score = 30; // base risk
  
  if (disease === 'heart') {
    if (inputs.age > 50) score += 15;
    if (inputs.sex === 1) score += 5;
    if (inputs.cp > 0) score += 20;
    if (inputs.trestbps > 140) score += 10;
    if (inputs.chol > 240) score += 12;
    if (inputs.oldpeak > 1.5) score += 15;
    if (inputs.ca > 0) score += 18;
  } else if (disease === 'hypertension') {
    if (inputs.age > 45) score += 12;
    if (inputs.bmi > 28) score += 15;
    if (inputs.systolic_bp > 130 || inputs.diastolic_bp > 85) score += 25;
    if (inputs.smoking > 0) score += 10;
    if (inputs.stress > 6) score += 8;
  } else if (disease === 'diabetes') {
    if (inputs.glucose > 120) score += 30;
    if (inputs.bmi > 30) score += 18;
    if (inputs.age > 40) score += 8;
    if (inputs.dpf > 0.6) score += 10;
  }
  
  score = Math.min(Math.round(score), 99);
  
  return {
    riskScore: score,
    disease: disease,
    model: disease === 'heart' ? 'GradientBoosting' : 'RandomForest',
    confidence: score > 75 || score < 25 ? 'HIGH' : 'MODERATE',
    inputs: inputs,
    timestamp: new Date().toLocaleString(),
    isBackend: false
  };
}

// ---- DISPLAY RESULTS SCREEN ----
function renderResultsScreen(result) {
  const percent = result.riskScore;
  const circle = document.getElementById('resultsGaugeCircle');
  const valueText = document.getElementById('resultsGaugeValue');
  const riskBadge = document.getElementById('resultsRiskBadge');
  const modelBadge = document.getElementById('resultsModelBadge');
  const diseaseTitle = document.getElementById('resultsDiseaseTitle');
  const confidenceVal = document.getElementById('resultsConfidence');
  const accuracyVal = document.getElementById('resultsModelAccuracy');
  const summaryText = document.getElementById('resultsSummaryText');
  const explainContainer = document.getElementById('resultsExplainSection');
  const recList = document.getElementById('resultsRecommendationsList');

  // Title names
  const labels = { heart: 'Heart Disease', hypertension: 'Hypertension', diabetes: 'Diabetes' };
  const diseaseName = labels[result.disease] || 'General Assessment';
  diseaseTitle.textContent = `${diseaseName} Risk Screening`;

  // Render Gauge circle percentage
  // circumference is 2 * pi * r = 2 * 3.14159 * 86 = 540
  const circ = 540;
  const offset = circ - (percent / 100) * circ;
  circle.style.strokeDashoffset = offset;
  valueText.textContent = `${percent}%`;

  // Colors & badges classification
  let riskClass = 'low';
  let riskLabel = 'Low Risk';
  let riskColor = '#10B981';
  let summary = 'The diagnostic algorithm indicates a healthy profile. Maintain current lifestyle choices and check back annually.';

  if (percent >= 85) {
    riskClass = 'critical';
    riskLabel = 'Critical Risk';
    riskColor = '#EF4444';
    summary = 'Immediate medical diagnostic review is advised. The screening shows significant markers that correlate with advanced diagnostic thresholds.';
  } else if (percent >= 65) {
    riskClass = 'high';
    riskLabel = 'High Risk';
    riskColor = '#EF4444';
    summary = 'Elevated screening factors detected. We recommend scheduling an appointment with your healthcare provider for diagnostic validation.';
  } else if (percent >= 35) {
    riskClass = 'moderate';
    riskLabel = 'Moderate Risk';
    riskColor = '#F59E0B';
    summary = 'Moderate indicators present. Behavioral and dietary alterations can substantially mitigate risk coefficients. Routine monitoring suggested.';
  }

  riskBadge.className = `risk-badge ${riskClass}`;
  riskBadge.textContent = riskLabel;
  circle.style.stroke = riskColor;

  // Source badges
  modelBadge.className = 'status-badge ' + (result.isBackend ? 'live' : 'demo');
  modelBadge.style.marginBottom = '14px';
  modelBadge.innerHTML = `<span class="status-dot"></span> ${result.isBackend ? 'ML MODEL PREDICTION' : 'DEMO ESTIMATION'}`;

  confidenceVal.textContent = result.confidence;
  
  // Accuracy preset metrics
  const accMap = { heart: '78.7%', hypertension: '71.4%', diabetes: '85.0%' };
  accuracyVal.textContent = accMap[result.disease] || '80%';
  
  summaryText.innerHTML = `<strong>Diagnostic Summary:</strong> ${summary}`;

  // AI Explainability rendering
  explainContainer.innerHTML = '';
  recList.innerHTML = '';
  
  // Setup inputs mapping details
  const inputs = result.inputs;
  const factorList = [];
  const recs = [];

  // Parse Heart
  if (result.disease === 'heart') {
    factorList.push({ name: 'Chest Pain Level', val: inputs.cp * 33, class: inputs.cp > 1 ? 'high' : 'low' });
    factorList.push({ name: 'Resting Blood Pressure', val: (inputs.trestbps - 80) / 1.2, class: inputs.trestbps > 140 ? 'high' : inputs.trestbps > 125 ? 'medium' : 'low' });
    factorList.push({ name: 'Serum Cholesterol', val: (inputs.chol - 100) / 5, class: inputs.chol > 240 ? 'high' : inputs.chol > 200 ? 'medium' : 'low' });
    factorList.push({ name: 'Oldpeak Depression', val: inputs.oldpeak * 16, class: inputs.oldpeak > 1.5 ? 'high' : 'low' });

    if (inputs.trestbps > 140) {
      recs.push({ issue: 'Elevated Resting Blood Pressure', desc: 'Resting BP is in hypertensive range.', imp: 'Discuss pharmacological options and sodium reduction with a physician.', priority: 'high' });
    }
    if (inputs.chol > 240) {
      recs.push({ issue: 'Hypercholesterolemia Risk', desc: 'Total cholesterol exceeds 240 mg/dl standard.', imp: 'Increase dietary fiber and request full lipid profile analysis.', priority: 'high' });
    }
  } 
  // Parse Hypertension
  else if (result.disease === 'hypertension') {
    factorList.push({ name: 'Systolic Blood Pressure', val: (inputs.systolic_bp - 80) / 1.2, class: inputs.systolic_bp > 140 ? 'high' : inputs.systolic_bp > 125 ? 'medium' : 'low' });
    factorList.push({ name: 'Body Mass Index (BMI)', val: inputs.bmi * 1.6, class: inputs.bmi > 30 ? 'high' : inputs.bmi > 25 ? 'medium' : 'low' });
    factorList.push({ name: 'Stress Coefficient', val: inputs.stress * 10, class: inputs.stress > 6 ? 'high' : 'low' });
    factorList.push({ name: 'Blood Glucose', val: (inputs.glucose - 50) / 2.5, class: inputs.glucose > 125 ? 'high' : 'low' });

    if (inputs.bmi > 30) {
      recs.push({ issue: 'Clinical Obesity Level', desc: 'BMI indicates excess weight strain.', imp: 'Target calorie deficit and 150 mins active cardio per week.', priority: 'high' });
    }
    if (inputs.stress > 7) {
      recs.push({ issue: 'High Stress Load', desc: 'Stress index at critical levels.', imp: 'Incorporate mindfulness, sleep hygiene checks, or professional consult.', priority: 'medium' });
    }
    if (inputs.smoking > 0) {
      recs.push({ issue: 'Active Smoking Status', desc: 'Tobacco accelerates vascular hardening.', imp: 'Consult cessation clinical pathway programs.', priority: 'high' });
    }
  } 
  // Parse Diabetes
  else if (result.disease === 'diabetes') {
    factorList.push({ name: 'Blood Glucose Level', val: (inputs.glucose - 50) / 2.5, class: inputs.glucose > 140 ? 'high' : inputs.glucose > 100 ? 'medium' : 'low' });
    factorList.push({ name: 'Body Mass Index (BMI)', val: inputs.bmi * 1.6, class: inputs.bmi > 30 ? 'high' : 'low' });
    factorList.push({ name: 'Diabetes Pedigree Function', val: inputs.dpf * 40, class: inputs.dpf > 0.6 ? 'high' : 'low' });
    factorList.push({ name: 'Age Coefficient', val: inputs.age * 0.8, class: inputs.age > 45 ? 'medium' : 'low' });

    if (inputs.glucose > 140) {
      recs.push({ issue: 'Elevated Post-Load Glucose', desc: 'Blood sugar values in pre-diabetic ranges.', imp: 'Consult physician for fasting HbA1c test immediately.', priority: 'high' });
    }
    if (inputs.bmi > 30) {
      recs.push({ issue: 'Obesity Index', desc: 'Elevated weight BMI strain.', imp: 'Focus on low glycaemic index nutrition plans.', priority: 'medium' });
    }
  }

  // Draw explainability bars
  factorList.forEach(factor => {
    const clampVal = Math.min(Math.max(Math.round(factor.val), 5), 100);
    const wrap = document.createElement('div');
    wrap.className = 'factor-bar-wrapper';
    wrap.innerHTML = `
      <div class="factor-bar-header">
        <span class="factor-bar-title">${factor.name}</span>
        <span class="factor-bar-impact">${factor.class.toUpperCase()} IMPACT</span>
      </div>
      <div class="factor-bar-track">
        <div class="factor-bar-fill ${factor.class}" style="width: ${clampVal}%;"></div>
      </div>
    `;
    explainContainer.appendChild(wrap);
  });

  // Default recommendation if empty
  if (recs.length === 0) {
    recs.push({ issue: 'Cardioprotective Maintenance', desc: 'No critical lifestyle risk anomalies detected.', imp: 'Maintain physical exercise, hydration, and periodic annual checkups.', priority: 'low' });
  }

  // Draw action recommendation cards
  recs.forEach(rec => {
    const card = document.createElement('div');
    card.className = `rec-card ${rec.priority}`;
    card.innerHTML = `
      <div class="rec-icon">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      </div>
      <div class="rec-details">
        <h4>${rec.issue}</h4>
        <p>${rec.desc}</p>
        <div class="rec-improvement">
          <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:3;"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          Action: ${rec.imp}
        </div>
      </div>
    `;
    recList.appendChild(card);
  });
}

// ---- HISTORICAL REGISTRY (LOCAL STORAGE) ----
function loadHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';
  
  if (screeningHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-secondary);padding:30px 0;">No diagnostic logs in history registry.</td>
      </tr>
    `;
    return;
  }

  // Reverse list to show newest first
  screeningHistory.slice().reverse().forEach((item, index) => {
    const actualIndex = screeningHistory.length - 1 - index;
    const diseaseNames = { heart: 'Heart Disease', hypertension: 'Hypertension', diabetes: 'Diabetes' };
    const row = document.createElement('tr');
    
    let riskCat = 'Low Risk';
    let riskClass = 'low';
    if (item.riskScore >= 85) { riskCat = 'Critical Risk'; riskClass = 'high'; }
    else if (item.riskScore >= 65) { riskCat = 'High Risk'; riskClass = 'high'; }
    else if (item.riskScore >= 35) { riskCat = 'Moderate Risk'; riskClass = 'medium'; }

    row.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" class="history-select-check" data-idx="${actualIndex}" />
      </td>
      <td style="font-weight:600;">${item.timestamp.split(',')[0]}</td>
      <td>${diseaseNames[item.disease] || item.disease}</td>
      <td style="font-family:monospace;font-weight:700;">${item.riskScore}%</td>
      <td>
        <span class="recent-score-badge ${riskClass}">${riskCat}</span>
      </td>
      <td style="text-align:right;display:flex;gap:6px;justify-content:flex-end;">
        <button class="history-action-btn" onclick="viewHistoryItem(${actualIndex})" title="View result details">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="history-action-btn delete" onclick="deleteHistoryItem(${actualIndex})" title="Delete record">
          <svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function deleteHistoryItem(index) {
  if (confirm('Are you sure you want to permanently delete this screening record?')) {
    screeningHistory.splice(index, 1);
    localStorage.setItem('medai_history', JSON.stringify(screeningHistory));
    loadHistoryTable();
    updateDashboardRecentList();
  }
}

function clearAllHistory() {
  if (confirm('Warning: This action will permanently wipe out all clinical history records. Proceed?')) {
    screeningHistory = [];
    localStorage.removeItem('medai_history');
    alert('Local cache database successfully purged.');
    navigateTo('dashboard');
    updateDashboardRecentList();
  }
}

function viewHistoryItem(index) {
  const item = screeningHistory[index];
  if (item) {
    sessionStorage.setItem('current_screening_result', JSON.stringify(item));
    renderResultsScreen(item);
    navigateTo('results');
  }
}

// Side-by-Side compare
function compareSelectedHistory() {
  const checked = document.querySelectorAll('.history-select-check:checked');
  if (checked.length < 2 || checked.length > 3) {
    alert('Please select exactly 2 or 3 records to compare.');
    return;
  }

  const comparisonPane = document.getElementById('historyComparisonPane');
  const grid = document.getElementById('comparisonGrid');
  grid.innerHTML = '';
  comparisonPane.classList.add('active');

  const names = { heart: 'Heart Risk', hypertension: 'Hypertension', diabetes: 'Diabetes' };

  checked.forEach(check => {
    const idx = parseInt(check.getAttribute('data-idx'));
    const item = screeningHistory[idx];
    
    const col = document.createElement('div');
    col.className = 'comparison-col';
    
    let html = `
      <h4>${names[item.disease]} Assessment</h4>
      <div class="comparison-row"><strong>Date:</strong> <span>${item.timestamp.split(',')[0]}</span></div>
      <div class="comparison-row"><strong>Risk Score:</strong> <span style="font-weight:700;">${item.riskScore}%</span></div>
    `;

    // Render features dynamically
    Object.entries(item.inputs).forEach(([key, val]) => {
      html += `<div class="comparison-row"><strong>${key}:</strong> <span>${val}</span></div>`;
    });

    col.innerHTML = html;
    grid.appendChild(col);
  });
}

function closeComparisonPane() {
  document.getElementById('historyComparisonPane').classList.remove('active');
}

// CSV / JSON Exporters
function exportHistory(format) {
  if (screeningHistory.length === 0) {
    alert('No data in history logs to export.');
    return;
  }

  let dataStr = '';
  let filename = `MedAI_Diagnostic_Logs_${new Date().toISOString().split('T')[0]}`;
  let mime = 'application/json';

  if (format === 'json') {
    dataStr = JSON.stringify(screeningHistory, null, 2);
    filename += '.json';
  } else if (format === 'csv') {
    mime = 'text/csv';
    filename += '.csv';
    
    // Build CSV columns headers
    dataStr = 'Timestamp,AssessmentType,RiskPercent,ModelModel,InputsJSON\n';
    screeningHistory.forEach(item => {
      const sanitizedInputs = JSON.stringify(item.inputs).replace(/"/g, '""');
      dataStr += `"${item.timestamp}","${item.disease}",${item.riskScore},"${item.model}","${sanitizedInputs}"\n`;
    });
  }

  const blob = new Blob([dataStr], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---- PRINTABLE CLINICAL PDF REPORTS ----
function printReport() {
  const rawResult = sessionStorage.getItem('current_screening_result');
  if (!rawResult) {
    alert('No active screening result loaded in session.');
    return;
  }
  const result = JSON.parse(rawResult);
  
  // Populate print document fields
  document.getElementById('printReportId').textContent = 'MED-' + Math.floor(10000000 + Math.random() * 90000000);
  document.getElementById('printReportDate').textContent = result.timestamp.split(',')[0];
  
  const age = result.inputs.age || 'N/A';
  const sex = (result.inputs.sex !== undefined) ? (result.inputs.sex === 1 ? 'Male' : 'Female') : ((result.inputs.gender !== undefined) ? (result.inputs.gender === 1 ? 'Male' : 'Female') : 'N/A');
  const bmi = result.inputs.bmi || 'N/A';
  
  let bp = 'N/A';
  if (result.inputs.trestbps !== undefined) bp = result.inputs.trestbps + ' mmHg (resting)';
  else if (result.inputs.systolic_bp !== undefined && result.inputs.diastolic_bp !== undefined) bp = `${result.inputs.systolic_bp}/${result.inputs.diastolic_bp} mmHg`;
  else if (result.inputs.blood_pressure !== undefined) bp = result.inputs.blood_pressure + ' mmHg (diastolic)';
  
  document.getElementById('printPatientAge').textContent = age + ' Years';
  document.getElementById('printPatientGender').textContent = sex;
  document.getElementById('printPatientBmi').textContent = bmi + (bmi !== 'N/A' ? ' kg/m²' : '');
  document.getElementById('printPatientBp').textContent = bp;
  
  const labels = { heart: 'Heart Disease Risk Assessment', hypertension: 'Hypertension Clinical Screening', diabetes: 'Diabetes Metabolic Screening' };
  document.getElementById('printDiseaseTitle').textContent = labels[result.disease] || 'Clinical Screening';
  
  const percent = result.riskScore;
  document.getElementById('printGaugeValue').textContent = percent + '%';
  
  // Set print gauge circle offset
  const printCircle = document.getElementById('printGaugeCircle');
  const circ = 540;
  const offset = circ - (percent / 100) * circ;
  printCircle.style.strokeDashoffset = offset;
  
  let riskClass = 'LOW RISK';
  let conclusion = 'The client exhibits healthy baselines. Annual diagnostic screenings and standard physical routines are recommended.';
  let printColor = '#10B981';

  if (percent >= 85) { riskClass = 'CRITICAL RISK'; conclusion = 'Highly elevated biomarker indicators. Primary diagnostic follow-up and clinical intervention recommended.'; printColor = '#EF4444'; }
  else if (percent >= 65) { riskClass = 'HIGH RISK'; conclusion = 'Elevated screening factors. We advise physician consultation and dietary monitoring.'; printColor = '#EF4444'; }
  else if (percent >= 35) { riskClass = 'MODERATE RISK'; conclusion = 'Moderate clinical indicators. Lifestyle risk factors should be checked and controlled.'; printColor = '#F59E0B'; }
  
  document.getElementById('printRiskCategory').textContent = riskClass;
  document.getElementById('printRiskCategory').className = riskClass.toLowerCase().replace(' ', '-');
  document.getElementById('printDiagnosticConclusion').textContent = conclusion;
  printCircle.style.stroke = printColor;

  // Print Input Table
  const table = document.getElementById('printInputsTableBody');
  table.innerHTML = '';
  Object.entries(result.inputs).forEach(([key, val]) => {
    let standard = 'N/A';
    if (key === 'trestbps' || key === 'systolic_bp') standard = '90 - 120 mmHg';
    if (key === 'chol' || key === 'cholesterol') standard = '< 200 mg/dl';
    if (key === 'bmi') standard = '18.5 - 24.9';
    if (key === 'glucose') standard = '70 - 99 mg/dl';
    
    let displayVal = val;
    if (key === 'sex' || key === 'gender') displayVal = val === 1 ? 'Male' : 'Female';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${key}</td>
      <td style="font-weight:700;">${displayVal}</td>
      <td>${standard}</td>
    `;
    table.appendChild(row);
  });

  // Print recommendations
  const printRecs = document.getElementById('printRecommendationsList');
  printRecs.innerHTML = '';
  
  const recElements = document.querySelectorAll('#resultsRecommendationsList .rec-card');
  recElements.forEach(card => {
    const title = card.querySelector('h4').textContent;
    const body = card.querySelector('.rec-improvement').textContent;
    const li = document.createElement('li');
    li.innerHTML = `<strong>${title}:</strong> ${body}`;
    printRecs.appendChild(li);
  });

  // Launch browser native print dialog
  window.print();
}

// ---- DASHBOARD QUICK LIST UPDATE ----
function updateDashboardRecentList() {
  const container = document.getElementById('dashboardRecentList');
  if (!container) return;
  
  if (screeningHistory.length === 0) {
    container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-secondary);text-align:center;padding:20px 0;">No assessments run in this session yet.</div>`;
    return;
  }

  container.innerHTML = '';
  // Show last 3 items
  screeningHistory.slice().reverse().slice(0, 3).forEach((item) => {
    const names = { heart: 'Heart Risk', hypertension: 'Hypertension', diabetes: 'Diabetes' };
    
    let riskCat = 'Low Risk';
    let riskClass = 'low';
    if (item.riskScore >= 85) { riskCat = 'Critical'; riskClass = 'high'; }
    else if (item.riskScore >= 65) { riskCat = 'High'; riskClass = 'high'; }
    else if (item.riskScore >= 35) { riskCat = 'Moderate'; riskClass = 'medium'; }

    const div = document.createElement('div');
    div.className = `recent-item ${item.disease}`;
    div.innerHTML = `
      <div class="recent-info-block">
        <div class="recent-icon">
          <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div>
          <span class="recent-title">${names[item.disease] || item.disease}</span>
          <span class="recent-date">${item.timestamp.split(',')[0]}</span>
        </div>
      </div>
      <div class="recent-score-badge ${riskClass}">${item.riskScore}%</div>
    `;
    container.appendChild(div);
  });
}

// ---- SETTINGS ACTIONS ----
function setSettingDefaultGender(val) {
  defaultGenderPreset = val;
  alert('Default preset gender set successfully.');
}

function setSettingClinicalMode(val) {
  clinicalReviewMode = val;
  alert('Clinical verification screens updated.');
}

// ---- INITIALIZATION ----
async function checkBackendHealth() {
  const badge = document.getElementById('systemStatusBadge');
  const text = document.getElementById('systemStatusText');
  
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      backendConnected = data.status === 'ok';
      if (backendConnected) {
        badge.className = 'status-badge live';
        text.textContent = 'SYSTEM LIVE';
      }
    }
  } catch (e) {
    console.warn('Backend connection unavailable, running in offline demo mode.');
    backendConnected = false;
    badge.className = 'status-badge demo';
    text.textContent = 'OFFLINE DEMO';
  }
}

// Scroll to landing section smoothly
function scrollToLandingSection(sectionId) {
  // If we are not on the landing page, make it active first
  const landingPage = document.getElementById('view-landing');
  if (landingPage && !landingPage.classList.contains('active')) {
    navigateTo('landing');
  }
  
  const element = document.getElementById(sectionId);
  if (element) {
    const appContent = document.getElementById('appContent');
    if (appContent) {
      const elementRect = element.getBoundingClientRect();
      const parentRect = appContent.getBoundingClientRect();
      const scrollTop = appContent.scrollTop;
      const targetScroll = elementRect.top - parentRect.top + scrollTop;
      
      appContent.scrollTo({
        top: targetScroll - (sectionId === 'landing-features' ? 80 : 0),
        behavior: 'smooth'
      });
    } else {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Check backend connections
  checkBackendHealth();

  // Load History from localStorage
  const saved = localStorage.getItem('medai_history');
  if (saved) {
    try {
      screeningHistory = JSON.parse(saved);
      updateDashboardRecentList();
    } catch (e) {
      screeningHistory = [];
    }
  }

  // Clone mobile screen view lists if active
  const screenList = document.querySelector('#view-screenings-list .screening-options-list');
  const deskList = document.querySelector('.screening-options-list');
  if (screenList && deskList) {
    screenList.innerHTML = deskList.innerHTML;
  }

  // Sticky header scroll listener
  const appContent = document.getElementById('appContent');
  if (appContent) {
    appContent.addEventListener('scroll', () => {
      const header = document.getElementById('landingHeader');
      if (header) {
        if (appContent.scrollTop > 50) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    });
  }
});
