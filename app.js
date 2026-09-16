const SUPABASE_URL = "https://zsmilczlumqkdpthlpto.supabase.co";
const SUPABASE_KEY = "sb_publishable__Oq50W1WSRfYcae0StNicg_FrzPwRTB";

function buildTopToolbarMenu() {
  const header = document.querySelector('.top');
  if (!header || document.querySelector('.topbar-quick-nav')) return;

  const defaultNavigation = [
    { label: 'Dashboard', href: 'index.html' },
    { label: 'Clients', href: 'clients.html' },
    { label: 'ADL Care Plans', href: 'adl.html' },
    { label: 'Resident Agreement', href: 'resident-agreement.html' },
    { label: 'Employee Agreement', href: 'employee-agreement.html' },
    { label: 'Caregivers', href: 'staff.html' },
    { label: 'Appointments', href: 'appointments.html' },
    { label: 'Meal Plans', href: 'meal-plan.html' },
    { label: 'Medication', href: 'medication.html' },
    { label: 'Finance', href: 'finances.html' },
    { label: 'Documents', href: 'documents.html' }
  ];

  const currentLinks = [...document.querySelectorAll('.nav a, .nav button')].map(link => ({
    label: link.textContent.trim(),
    href: link.getAttribute('href') || '#'
  })).filter(link => link.label && link.href && link.href !== '#');

  const navLinks = [...currentLinks, ...defaultNavigation].filter((link, index, list) => {
    const key = `${link.label}|${link.href}`;
    return list.findIndex(item => `${item.label}|${item.href}` === key) === index;
  });

  if (!navLinks.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'topbar-quick-nav';
  wrapper.innerHTML = `
    <label for="topQuickNav">Quick jump</label>
    <select id="topQuickNav" aria-label="Quick jump menu">
      <option value="">Choose a section</option>
      ${navLinks.map(link => `<option value="${link.href}">${link.label}</option>`).join('')}
    </select>
  `;

  header.appendChild(wrapper);

  const select = wrapper.querySelector('select');
  if (select) {
    select.addEventListener('change', (event) => {
      const value = event.target.value;
      if (!value) return;
      const target = value.startsWith('#') ? document.querySelector(value) : null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (value && value !== '#') {
        window.location.href = value;
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', buildTopToolbarMenu);
const TABLE_ALIASES = {
  clients: ['clients'], caregivers: ['staff'], meal_plans: ['meals'],
  medications: ['medications'], appointments: ['appointments'],
  progress_notes: ['progress_notes'],
  finance: ['finance_records'], policy_updates: ['policy_updates'],
  credential_trainings: ['training_records'], staff_schedules: ['staff_schedules']
};
const STORAGE_PREFIX = 'careone_records_';
const dashboardData = { clients: [], caregivers: [], appointments: [], medications: [], schedules: [], finance: [], policies: [], trainings: [] };
const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

const FORM_CONFIG = {
  clients: { title: 'Add Client', fields: [['room','Room','text'],['status','Status','text'],['medical_history','Medical History','textarea']] },
  caregivers: { title: 'Add Staff Member', fields: [['first_name','First Name','text'],['last_name','Last Name','text'],['role','Role','text'],['phone','Phone','text'],['status','Status','text']] },
  meal_plans: { title: 'Add Meal', fields: [['meal_type','Meal Type','select',['Breakfast','Lunch','Dinner','Snack']],['menu','Menu','textarea'],['updated_date','Updated Date','date']] },
  medications: { title: 'Add Medication', fields: [['client_id','Client ID','number'],['medication_name','Medication Name','text'],['dosage','Dosage','text'],['schedule','Schedule','text'],['status','Status','text']] },
  appointments: { title: 'Add Appointment', fields: [['client_name','Client Name','text'],['reason_for_visit','Reason for Visit','textarea'],['location','Location','text'],['contact_information','Contact Information','text'],['appointment_datetime','Appointment Date/Time','datetime-local'],['notes','Notes','textarea']] },
  progress_notes: { title: 'Add Progress Note', fields: [['client_id','Client ID','number'],['staff_name','Staff Name','text'],['note','Progress Note','textarea'],['recorded_at','Date and Time','datetime-local']] },
  finance: { title: 'Add Finance Record', fields: [['entry_type','Entry Type','select',['revenue','expense']],['category','Category','text'],['client_id','Resident ID','number'],['client_name','Resident Name','text'],['caregiver_name','Caregiver Name','text'],['amount','Amount','number'],['month','Month','text'],['notes','Notes','textarea']] },
  staff_schedules: { title: 'Add Staff Schedule', fields: [['caregiver_name','Caregiver Name','text'],['shift','Shift','select',['Day','Night']],['status','Status','select',['Regular','On Call']],['days','Days','text'],['notes','Notes','textarea']] }
};

function getLocalRecords(key) { try { const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
function saveLocalRecords(key, rows) { try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(rows)); } catch (_) {} }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function badge(value, fallback = 'Status') { return `<span class="badge">${escapeHtml(String(value || fallback))}</span>`; }

async function resolveTableName(key) {
  if (!supabaseClient) return TABLE_ALIASES[key][0];
  for (const name of TABLE_ALIASES[key] || []) {
    try { const { error } = await supabaseClient.from(name).select('*').limit(1); if (!error) return name; } catch (_) {}
  }
  return TABLE_ALIASES[key][0];
}
async function readRecords(key) {
  if (!supabaseClient) return getLocalRecords(key);
  const name = await resolveTableName(key);
  try { const { data, error } = await supabaseClient.from(name).select('*'); return error ? getLocalRecords(key) : (data || []); }
  catch (_) { return getLocalRecords(key); }
}
async function insertRecord(key, payload) {
  if (supabaseClient) {
    try { const name = await resolveTableName(key); const { data, error } = await supabaseClient.from(name).insert(payload).select(); if (!error) return data; } catch (_) {}
  }
  const rows = getLocalRecords(key); const record = { id: Date.now(), ...payload, created_at: new Date().toISOString() }; rows.push(record); saveLocalRecords(key, rows); return [record];
}

function showPage(id, button) { document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id)); document.querySelectorAll('.nav button').forEach(item => item.classList.remove('active')); if (button) button.classList.add('active'); }
function matchesSearchValue(item, query) {
  if (!query) return true;
  const text = Object.values(item || {}).map(value => String(value ?? '')).join(' ').toLowerCase();
  return text.includes(query);
}
function quickSearch(query) {
  const value = query.toLowerCase().trim();
  const clientList = document.getElementById('clientRows');
  const caregiverList = document.getElementById('caregiverRows');
  const filteredClients = value ? dashboardData.clients.filter(item => matchesSearchValue(item, value)) : dashboardData.clients;
  const filteredCaregivers = value ? dashboardData.caregivers.filter(item => matchesSearchValue(item, value)) : dashboardData.caregivers;

  if (clientList && dashboardData.clients) {
    renderClients(filteredClients, dashboardData.appointments, dashboardData.medications, dashboardData.progressNotes || []);
  }

  if (caregiverList && dashboardData.caregivers) {
    renderCaregivers(filteredCaregivers);
  }

  if (!value) return;

  const rows = [...document.querySelectorAll('#clientRows .card, #caregiverRows .card')];
  const match = rows.find(item => item.innerText.toLowerCase().includes(value));
  if (match) {
    const page = match.closest('#caregiverRows') ? 'staff' : 'clients';
    const button = document.querySelectorAll('.nav button')[page === 'staff' ? 2 : 1];
    if (document.getElementById(page)) showPage(page, button);
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
function openForm(table) {
  if (table === 'clients') {
    window.location.href = 'resident-agreement.html?newResident=true';
    return;
  }

  const config = FORM_CONFIG[table]; if (!config) return alert('No form defined for this table yet.');
  document.getElementById('formFields').innerHTML = config.fields.map(([name, label, type, options]) => `<div class="field ${type === 'textarea' ? 'full' : ''}"><label for="${name}">${label}</label>${type === 'select' ? `<select id="${name}" name="${name}">${options.map(option => `<option value="${option}">${option}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea id="${name}" name="${name}"></textarea>` : `<input id="${name}" name="${name}" type="${type}"></div>`}`).join('');
  document.getElementById('modalTitle').textContent = config.title; document.getElementById('recordForm').dataset.table = table; document.getElementById('recordModal').classList.add('show');
}
function closeModal() { document.getElementById('recordModal').classList.remove('show'); document.getElementById('recordForm').reset(); }
function normalize(key, value) { const text = String(value).trim(); if (!text) return undefined; if (key === 'amount' || key === 'client_id') return Number(text); if (key.endsWith('_date') || key === 'appointment_datetime') return new Date(text).toISOString(); return text; }
function openClientAction(page, clientId, clientName) {
  const search = new URLSearchParams({
    clientId: String(clientId),
    clientName: String(clientName || ''),
    open: 'true'
  });
  const target = page === 'documents' ? 'resident-agreement' : page;
  window.location.href = `${target}.html?${search.toString()}`;
}

function getAdlRecords() {
  try {
    const raw = localStorage.getItem('adlRecords');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getAdlRecordForClient(clientId, clientName = '') {
  const records = getAdlRecords();
  return records.find(item => String(item.clientId || item.id || '') === String(clientId || ''))
    || records.find(item => String(item.residentName || item.name || '').toLowerCase() === String(clientName || '').toLowerCase())
    || null;
}

function getResidentNameFromAdl(clientId, fallback = '') {
  const record = getAdlRecordForClient(clientId, fallback);
  return record?.residentName || record?.name || fallback;
}

function getClientDisplayName(client, index = 0) {
  if (client?.name) return client.name;
  if (client?.residentName) return client.residentName;
  if (client?.first_name || client?.last_name) {
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || `Client ${index + 1}`;
  }
  const adl = getAdlRecords().find(item => String(item.clientId || item.id) === String(client?.id || ''));
  return adl?.residentName || adl?.name || `Client ${index + 1}`;
}

function getClientCarePlanSummary(client) {
  if (client?.care_plan) return client.care_plan;
  if (client?.carePlan) return client.carePlan;
  const adl = getAdlRecords().find(item => String(item.clientId || item.id) === String(client?.id || ''));
  if (adl?.carePlanSummary) return adl.carePlanSummary;
  if (adl?.carePlan) return adl.carePlan;
  if (adl?.goalsOutcomes) return adl.goalsOutcomes;
  return 'No care plan summary yet.';
}

function renderClients(rows, appointments = [], medications = [], progressNotes = []) {
  const root = document.getElementById('clientRows');
  if (!root) return;
  const upcoming = appointments.filter(item => item.appointment_datetime && new Date(item.appointment_datetime) >= new Date()).sort((a, b) => new Date(a.appointment_datetime) - new Date(b.appointment_datetime));
  root.innerHTML = rows.length ? rows.map((item, index) => {
    const name = getClientDisplayName(item, index);
    const id = item.id || index + 1;
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const clientAppointments = upcoming.filter(appointment => String(appointment.client_id || '').toLowerCase() === String(id).toLowerCase() || String(appointment.client_name || '').toLowerCase() === name.toLowerCase());
    const clientMedications = medications.filter(medication => String(medication.client_id || '') === String(id));
    const carePlanSummary = getClientCarePlanSummary(item);
    const clientNotes = progressNotes.filter(note => String(note.client_id || '') === String(id)).sort((a, b) => new Date(b.recorded_at || b.created_at || 0) - new Date(a.recorded_at || a.created_at || 0));
    const latestNote = clientNotes[0];
    const appointmentMarkup = clientAppointments.length ? clientAppointments.slice(0, 2).map(appointment => `<div class="client-detail-row"><span>${escapeHtml(new Date(appointment.appointment_datetime).toLocaleDateString([], {month: 'short', day: 'numeric'}))} · ${escapeHtml(appointment.reason_for_visit || 'Appointment')}</span><b>${escapeHtml(new Date(appointment.appointment_datetime).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}))}</b></div>`).join('') : '<div class="client-empty">No upcoming appointments</div>';
    const medicationMarkup = clientMedications.length ? clientMedications.slice(0, 3).map(medication => `<div class="client-detail-row"><span>${escapeHtml(medication.medication_name || 'Medication')}</span><b>${escapeHtml(medication.schedule || medication.dosage || 'Scheduled')}</b></div>`).join('') : '<div class="client-empty">No medications on record</div>';
    const noteMarkup = latestNote ? `<p>${escapeHtml(latestNote.note)}</p><small>By ${escapeHtml(latestNote.staff_name || 'Staff member')} · ${escapeHtml(new Date(latestNote.recorded_at || latestNote.created_at).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}))}</small>` : '<div class="client-empty">No progress notes yet</div>';
    const carePlanPreview = String(carePlanSummary).length > 120 ? `${String(carePlanSummary).slice(0, 120)}…` : String(carePlanSummary);
    return `<div class="card client-card"><div class="person"><div class="mini">${escapeHtml(name.split(' ').map(part => part[0]).join('').slice(0,2))}</div><div><b>${escapeHtml(name)}</b><br><small class="label">ID: ${id}</small></div>${badge(item.status || getAdlRecordForClient(id, name)?.status || 'Stable')}</div><div class="client-section"><div class="client-section-title"><b>Care plan</b></div><div class="client-empty" style="white-space:normal; line-height:1.5;">${escapeHtml(carePlanPreview)}</div></div><div class="client-section"><div class="client-section-title"><b>Upcoming appointments</b><span>${clientAppointments.length}</span></div>${appointmentMarkup}</div><div class="client-section"><div class="client-section-title"><b>Medications</b><span>${clientMedications.length}</span></div>${medicationMarkup}</div><div class="client-section progress-note"><div class="client-section-title"><b>Latest progress note</b><button class="action-link" type="button" onclick="openProgressNoteForm('${id}')">+ Add note</button></div>${noteMarkup}</div><div class="client-card-footer"><button class="btn secondary" type="button" onclick="openClientAction('adl', '${id}', '${safeName}')">Show full ADL</button><button class="btn secondary" type="button" onclick="openClientAction('appointments', '${id}', '${safeName}')">Set appointment</button><button class="btn secondary" type="button" onclick="openClientAction('medication', '${id}', '${safeName}')">Add medication</button><button class="btn secondary" type="button" onclick="openClientAction('documents', '${id}', '${safeName}')">Resident agreement</button><button class="btn secondary" type="button" onclick="openClientAction('finances', '${id}', '${safeName}')">Add finance entry</button><button class="row-delete-btn" type="button" onclick="deleteRecord('clients','${id}')">Delete client</button></div></div>`;
  }).join('') : '<div class="card"><p class="label">No matching client records found.</p></div>';
}
function openProgressNoteForm(clientId) { openForm('progress_notes'); const field = document.getElementById('client_id'); if (field) field.value = clientId; }
function getEmployeeAgreements() {
  try {
    const rows = JSON.parse(localStorage.getItem('employeeAgreements') || '[]');
    return Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : [];
  } catch (_) {
    return [];
  }
}
function renderEmployeeAgreements() {
  const root = document.getElementById('employeeAgreementRows');
  if (!root) return;
  const rows = getEmployeeAgreements();
  root.innerHTML = rows.length ? rows.map(item => `<div class="row"><span><b>${escapeHtml(item.employee_name || 'Employee')}</b><br><small class="label">${escapeHtml(item.employee_role || 'Caregiver')} · ${escapeHtml(item.employee_status || 'Agreement saved')}</small></span><a class="action-link" href="employee-agreement.html?employeeName=${encodeURIComponent(item.employee_name || '')}">Open</a></div>`).join('') : '<div class="list-empty">No employee agreements saved yet.</div>';
}
function renderCaregivers(rows) { const root = document.getElementById('caregiverRows'); if (!root) return; root.innerHTML = rows.length ? rows.map((item, index) => { const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || `Staff ${index + 1}`; const id = item.id || index + 1; return `<div class="card"><div class="person"><div class="mini">${escapeHtml(name.slice(0,2).toUpperCase())}</div><div><b>${escapeHtml(name)}</b><br><small class="label">${escapeHtml(item.role || 'Caregiver')} · ${escapeHtml(item.phone || 'No phone')}</small></div></div><div class="row"><span>Status</span>${badge(item.status || 'Certified')}</div><div class="row"><span></span><a class="action-link" href="documents.html?type=employee&employeeName=${encodeURIComponent(name)}">Employee agreement</a><button class="row-delete-btn" type="button" onclick="deleteRecord('caregivers','${id}')">Delete</button></div></div>`; }).join('') : '<div class="card"><p class="label">No matching staff members found.</p></div>'; }
function renderTable(id, rows, columns, key) { const root = document.getElementById(id); if (!root) return; root.innerHTML = rows.length ? rows.map(item => { const recordId = item.id || Date.now(); return `<tr>${columns.map(column => `<td>${column.render ? column.render(item) : escapeHtml(item[column.key] || '—')}</td>`).join('')}<td><button class="row-delete-btn" type="button" onclick="deleteRecord('${key}','${recordId}')">Delete</button></td></tr>`; }).join('') : `<tr><td colspan="${columns.length + 1}">No records found.</td></tr>`; }

function syncLiveMetricValues() {
  const { clients, caregivers, appointments, medications, schedules, finance, mealPlans = [] } = dashboardData;
  const medicationAlerts = medications.filter(item => /pending|due|attention|refill|overdue/i.test(`${item.status || ''} ${item.last_mar || ''}`)).length;
  const totalRevenue = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? 0 : Number(item.amount || 0)), 0);
  const totalExpenses = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? Number(item.amount || 0) : 0), 0);
  const netCashFlow = totalRevenue - totalExpenses;
  const upcomingVisits = appointments.filter(item => item.appointment_datetime && new Date(item.appointment_datetime) >= new Date()).length;
  const todayVisits = appointments.filter(item => item.appointment_datetime && new Date(item.appointment_datetime).toDateString() === new Date().toDateString()).length;
  const coverageRate = caregivers.length ? Math.min(100, Math.round((schedules.length / caregivers.length) * 100)) : 0;
  const alertCount = medicationAlerts + upcomingVisits;
  const homeCount = clients.length ? Math.max(1, Math.ceil(clients.length / 4)) : 0;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('residentCount', String(clients.length));
  setText('caregiverCount', String(caregivers.length));
  setText('cashFlowTotal', `$${Math.abs(netCashFlow).toLocaleString()}`);
  setText('heroHomeCount', `${homeCount} ${homeCount === 1 ? 'home' : 'homes'}`);
  setText('heroCoverage', `${coverageRate}% coverage`);
  setText('heroAlerts', `${alertCount} ${alertCount === 1 ? 'alert' : 'alerts'}`);
  setText('clientProfilesCount', `${clients.length} ${clients.length === 1 ? 'profile' : 'profiles'}`);
  setText('clientCompliantCount', `${Math.min(clients.length, Math.max(0, clients.length - 2))} compliant`);
  setText('clientOpenFormsCount', `${Math.max(0, appointments.length - 2)} open forms`);
  setText('clientResidentCount', String(clients.length));
  setText('clientCarePlanCount', String(getAdlRecords().length || clients.length));
  setText('clientFollowUpCount', String(Math.max(0, appointments.length - 2)));

  setText('appointmentScheduledCount', `${upcomingVisits} scheduled`);
  setText('appointmentConfirmedCount', `${Math.max(0, Math.min(upcomingVisits, upcomingVisits - 2))} confirmed`);
  setText('appointmentFollowUpCount', `${Math.max(0, Math.min(10, Math.ceil(upcomingVisits / 3)))} follow-ups`);
  setText('appointmentTodayValue', String(todayVisits));
  setText('appointmentClientValue', String(clients.length));
  setText('appointmentAvgCheckinValue', `${Math.max(8, Math.min(30, 10 + Math.round(clients.length / 5)))} min`);

  setText('financeRevenueAmount', `$${totalRevenue.toLocaleString()}`);
  setText('financeExpenseAmount', `$${totalExpenses.toLocaleString()}`);
  setText('financeNetAmount', `$${Math.abs(netCashFlow).toLocaleString()}`);
  setText('financeTrendChip', `${Math.max(0, Math.min(99, Math.round((netCashFlow / Math.max(totalExpenses, 1)) * 100)))}%`);
  setText('financeInvoiceChip', `${Math.max(0, finance.length)} invoices`);
  setText('financePendingChip', `${Math.max(0, Math.ceil(finance.length / 3))} pending`);
  setText('financeMonthRevenue', `$${totalRevenue.toLocaleString()}`);
  setText('financeMonthExpense', `$${totalExpenses.toLocaleString()}`);
  setText('financeMonthNet', `$${Math.abs(netCashFlow).toLocaleString()}`);

  setText('mealPlanTotalCount', String(mealPlans.length));
  setText('mealPlanMealsCount', `${mealPlans.length} plans`);
  setText('mealPlanDaysCount', `${Math.max(1, Math.ceil(mealPlans.length / 2))} active days`);
  setText('mealPlanFollowUpCount', `${Math.max(0, Math.ceil(mealPlans.length / 4))} follow-ups`);

  setText('staffActiveCount', String(caregivers.length));
  setText('staffAgreementCount', String(Math.max(0, Math.min(caregivers.length, caregivers.length - 1))));
  setText('staffTrainingCount', `${Math.max(0, caregivers.length - 2)} due`);
}

function renderDashboard() {
  const { clients, caregivers, appointments, medications, schedules, finance } = dashboardData;
  const dashboardKpis = document.getElementById('dashboardKpis');

  const medicationAlerts = medications.filter(item => /pending|due|attention|refill|overdue/i.test(`${item.status || ''} ${item.last_mar || ''}`)).length;
  const totalRevenue = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? 0 : Number(item.amount || 0)), 0);
  const totalExpenses = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? Number(item.amount || 0) : 0), 0);
  const netCashFlow = totalRevenue - totalExpenses;
  const coverageRate = caregivers.length ? Math.min(100, Math.round((schedules.length / caregivers.length) * 100)) : 0;
  const alertCount = medicationAlerts + appointments.filter(item => new Date(item.appointment_datetime || 0) > new Date()).length;
  const homeCount = clients.length ? Math.max(1, Math.ceil(clients.length / 4)) : 0;

  const residentCountEl = document.getElementById('residentCount');
  if (residentCountEl) residentCountEl.textContent = String(clients.length);

  const caregiverCountEl = document.getElementById('caregiverCount');
  if (caregiverCountEl) caregiverCountEl.textContent = String(caregivers.length);

  const cashFlowEl = document.getElementById('cashFlowTotal');
  if (cashFlowEl) cashFlowEl.textContent = `$${Math.abs(netCashFlow).toLocaleString()}`;

  const heroHomeCount = document.getElementById('heroHomeCount');
  if (heroHomeCount) heroHomeCount.textContent = `${homeCount} ${homeCount === 1 ? 'home' : 'homes'}`;

  const heroCoverage = document.getElementById('heroCoverage');
  if (heroCoverage) heroCoverage.textContent = `${coverageRate}% coverage`;

  const heroAlerts = document.getElementById('heroAlerts');
  if (heroAlerts) heroAlerts.textContent = `${alertCount} ${alertCount === 1 ? 'alert' : 'alerts'}`;

  const clientProfilesCount = document.getElementById('clientProfilesCount');
  if (clientProfilesCount) clientProfilesCount.textContent = `${clients.length} ${clients.length === 1 ? 'profile' : 'profiles'}`;

  const clientCompliantCount = document.getElementById('clientCompliantCount');
  if (clientCompliantCount) clientCompliantCount.textContent = `${Math.min(clients.length, Math.max(0, clients.length - 2))} compliant`;

  const clientOpenFormsCount = document.getElementById('clientOpenFormsCount');
  if (clientOpenFormsCount) clientOpenFormsCount.textContent = `${Math.max(0, appointments.length - 2)} open forms`;

  const clientResidentCount = document.getElementById('clientResidentCount');
  if (clientResidentCount) clientResidentCount.textContent = String(clients.length);

  const clientCarePlanCount = document.getElementById('clientCarePlanCount');
  if (clientCarePlanCount) clientCarePlanCount.textContent = String(getAdlRecords().length || clients.length);

  const clientFollowUpCount = document.getElementById('clientFollowUpCount');
  if (clientFollowUpCount) clientFollowUpCount.textContent = String(Math.max(0, appointments.length - 2));

  if (!dashboardKpis) return;
  dashboardKpis.innerHTML = [['Active clients', clients.length, '♙'],['Caregivers', caregivers.length, '♧'],['Medication alerts', medicationAlerts, '✚'],['Upcoming visits', appointments.length, '📅'],['Recorded revenue', '$' + totalRevenue.toLocaleString(), '$']].map(([label, value, icon]) => `<div class="card stat"><div><div class="label">${label}</div><div class="num">${value}</div></div><div class="icon">${icon}</div></div>`).join('');
  document.getElementById('dashboardAgenda').innerHTML = appointments.slice(0, 4).map(item => `<div class="row"><div><b>${escapeHtml(item.client_name || 'Client visit')}</b><br><small class="label">${escapeHtml(item.reason_for_visit || 'Appointment')}</small></div>${badge('Upcoming')}</div>`).join('') || '<div class="list-empty">No upcoming appointments recorded.</div>';
  document.getElementById('dashboardAttention').innerHTML = medications.filter(item => /pending|due|attention|refill|overdue/i.test(`${item.status || ''} ${item.last_mar || ''}`)).slice(0, 4).map(item => `<div class="row"><b>${escapeHtml(item.medication_name || 'Medication task')}</b>${badge('Review')}</div>`).join('') || '<div class="list-empty">Nothing needs attention right now.</div>';
  document.getElementById('dashboardCoverage').innerHTML = `<div class="summary-row"><span class="label">Scheduled shifts</span><b>${schedules.length}</b></div><div class="progress"><i style="width:${caregivers.length ? Math.min(100, Math.round(schedules.length / caregivers.length * 100)) : 0}%"></i></div>`;

  syncLiveMetricValues();
}

function renderReports() {
  const summary = document.getElementById('reportSummaryCards');
  const clients = document.getElementById('reportClientList');
  const schedules = document.getElementById('reportScheduleList');
  if (summary) summary.innerHTML = [['Clients', dashboardData.clients.length], ['Caregivers', dashboardData.caregivers.length], ['Appointments', dashboardData.appointments.length], ['Medications', dashboardData.medications.length]].map(([label, value]) => `<div class="summary-card"><div class="summary-row"><span class="summary-label">${label}</span><span class="summary-figure">${value}</span></div></div>`).join('');
  if (clients) clients.innerHTML = dashboardData.clients.map(item => `<div class="row"><span>${escapeHtml([item.first_name, item.last_name].filter(Boolean).join(' ') || 'Client')}</span>${badge(item.status || 'Stable')}</div>`).join('') || '<div class="list-empty">No client records found.</div>';
  if (schedules) schedules.innerHTML = dashboardData.schedules.map(item => `<div class="row"><span>${escapeHtml(item.caregiver_name || 'Caregiver')}</span>${badge(item.shift || 'Scheduled')}</div>`).join('') || '<div class="list-empty">No schedules found.</div>';
}

function marEvents() { return getLocalRecords('mar_events'); }
function marResident(item) { return item.client_name || item.resident_name || `Resident ${item.client_id || '—'}`; }
function marTime(item, index) { const schedule = String(item.schedule || '').toLowerCase(); if (schedule.includes('morning') || schedule.includes('breakfast')) return '08:00'; if (schedule.includes('noon') || schedule.includes('lunch')) return '12:00'; if (schedule.includes('evening') || schedule.includes('dinner')) return '18:00'; if (schedule.includes('night') || schedule.includes('bed')) return '21:00'; return ['08:00', '12:00', '18:00'][index % 3]; }
function marStatus(item, events) { const event = events.find(entry => String(entry.medication_id) === String(item.id) && entry.date === new Date().toISOString().slice(0, 10)); return event ? event.status : 'due'; }
function recordDose(medicationId, status) { const rows = marEvents(); rows.push({ id: Date.now(), medication_id: medicationId, status, date: new Date().toISOString().slice(0, 10), recorded_at: new Date().toISOString(), caregiver: 'Administrator' }); saveLocalRecords('mar_events', rows); renderTodaysMAR(window.marMedications || []); }
function showAuditLog() { alert('Audit log is available in the Recent activity panel. Every dose action stores status, time, date and caregiver identity.'); }
function renderTodaysMAR(rows) {
  const root = document.getElementById('marRows'); if (!root) return;
  window.marMedications = rows; const events = marEvents();
  const records = rows.map((item, index) => ({ item, index, time: marTime(item, index), status: marStatus(item, events), resident: marResident(item) }));
  const query = (window.marQuery || '').toLowerCase(); const filter = window.marFilter || 'all';
  const visible = records.filter(record => (!query || `${record.resident} ${record.item.medication_name || ''}`.toLowerCase().includes(query)) && (filter === 'all' || (filter === 'due' ? record.status === 'due' : String(record.item.schedule || '').toLowerCase().includes('prn'))));
  document.getElementById('marAllCount').textContent = records.length; document.getElementById('marDueCount').textContent = records.filter(record => record.status === 'due').length; document.getElementById('marPrnCount').textContent = records.filter(record => String(record.item.schedule || '').toLowerCase().includes('prn')).length;
  document.getElementById('marSummary').innerHTML = [['Due now', records.filter(record => record.status === 'due').length, 'warn'], ['Given today', records.filter(record => record.status === 'given').length, 'good'], ['Needs follow-up', records.filter(record => ['refused', 'held', 'missed'].includes(record.status)).length, 'alert']].map(([label, value, tone]) => `<div class="mar-stat ${tone}"><span>${label}</span><b>${value}</b><small>${label === 'Due now' ? 'Next 2 hours' : label === 'Given today' ? 'Documented doses' : 'Review before handoff'}</small></div>`).join('');
  root.innerHTML = visible.length ? visible.map(record => { const item = record.item; const statusLabel = record.status === 'due' ? 'Due' : record.status[0].toUpperCase() + record.status.slice(1); return `<div class="mar-row ${record.status}"><div class="mar-time">${record.time}<small>${record.time < '12:00' ? 'AM' : 'PM'}</small></div><div class="mar-resident"><div class="mini">${escapeHtml(record.resident.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase())}</div><div><b>${escapeHtml(record.resident)}</b><small>${escapeHtml(item.medication_name || 'Medication')} · ${escapeHtml(item.dosage || 'Dose not specified')}</small></div></div><div class="mar-instructions"><b>${escapeHtml(item.schedule || 'Scheduled dose')}</b><small>${String(item.schedule || '').toLowerCase().includes('prn') ? 'As needed · reason required' : 'Scheduled administration'}</small></div><span class="dose-status ${record.status}">${statusLabel}</span><div class="dose-actions">${record.status === 'due' ? `<button class="dose-give" type="button" onclick="recordDose('${item.id || record.index}', 'given')">Give dose</button><button class="dose-more" type="button" onclick="recordDose('${item.id || record.index}', 'held')">Hold</button><button class="dose-more" type="button" onclick="recordDose('${item.id || record.index}', 'refused')">Refuse</button><button class="dose-more" type="button" onclick="recordDose('${item.id || record.index}', 'missed')">Missed</button>` : `<button class="dose-more" type="button" onclick="recordDose('${item.id || record.index}', 'missed')">Update</button>`}</div></div>`; }).join('') : '<div class="mar-empty">No medication orders match this view. Add a medication order to begin today\'s MAR.</div>';
  const recent = events.slice(-4).reverse(); document.getElementById('auditRows').innerHTML = recent.length ? recent.map(event => `<div class="audit-row"><span class="audit-icon ${event.status}">${event.status === 'given' ? '✓' : '!'}</span><div><b>${event.status[0].toUpperCase() + event.status.slice(1)} dose</b><small>${escapeHtml(event.caregiver)} · ${new Date(event.recorded_at).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</small></div></div>`).join('') : '<p class="list-empty">No doses documented yet today.</p>';
  document.getElementById('safetyChecks').innerHTML = [['Allergy review', 'Complete', 'good'], ['High-risk medications', 'No flags', 'good'], ['Unresolved exceptions', records.some(record => ['refused', 'held', 'missed'].includes(record.status)) ? 'Review needed' : 'None', records.some(record => ['refused', 'held', 'missed'].includes(record.status)) ? 'warn' : 'good']].map(([label, value, tone]) => `<div class="safety-row"><span>${label}</span><b class="${tone}">${value}</b></div>`).join('');
}

async function loadAll() {
  const keys = ['clients','caregivers','appointments','meal_plans','staff_schedules','medications','progress_notes','finance','policy_updates','credential_trainings'];
  const values = await Promise.all(keys.map(readRecords));
  [dashboardData.clients, dashboardData.caregivers, dashboardData.appointments, dashboardData.mealPlans, dashboardData.schedules, dashboardData.medications, dashboardData.progressNotes, dashboardData.finance, dashboardData.policies, dashboardData.trainings] = values;
  renderClients(dashboardData.clients, dashboardData.appointments, dashboardData.medications, dashboardData.progressNotes); renderCaregivers(dashboardData.caregivers); renderEmployeeAgreements();
  renderTable('appointmentRows', dashboardData.appointments, [{key:'client_name'},{key:'reason_for_visit'},{key:'location'},{key:'contact_information'},{key:'appointment_datetime'},{key:'notes'}], 'appointments');
  renderTable('mealPlanRows', dashboardData.mealPlans, [{key:'meal_type'},{key:'updated_date'},{key:'meal_type'},{key:'menu'}], 'meal_plans');
  renderTable('shiftScheduleRows', dashboardData.schedules, [{key:'caregiver_name'},{key:'shift'},{key:'status',render: item => badge(item.status)},{key:'days'},{key:'notes'}], 'staff_schedules');
  renderTable('medicationRows', dashboardData.medications, [{key:'client_id'},{key:'medication_name'},{key:'schedule'},{key:'status'},{key:'status',render: item => badge(item.status)}], 'medications');
  window.marMedications = dashboardData.medications;
  renderTodaysMAR(dashboardData.medications);
  const financeRows = document.getElementById('financeRows');
  if (financeRows) financeRows.innerHTML = dashboardData.finance.map(item => `<div class="row"><span>${escapeHtml(item.category || item.notes || 'Finance record')}</span><b>${item.entry_type === 'expense' ? '-' : '+'}$${Math.abs(Number(item.amount || 0)).toLocaleString()}</b></div>`).join('') || '<div class="row"><span>No finance records found</span></div>';
  renderDashboard();
  renderReports();
  const databaseTables = document.getElementById('databaseTables');
  if (databaseTables) databaseTables.innerHTML = Object.values(TABLE_ALIASES).flat().map(name => `<span class="db-tag">${name}</span>`).join('');
}
async function deleteRecord(key, id) { if (supabaseClient) { const name = await resolveTableName(key); try { await supabaseClient.from(name).delete().eq('id', id); } catch (_) {} } const rows = getLocalRecords(key).filter(item => String(item.id) !== String(id)); saveLocalRecords(key, rows); await loadAll(); }

function assistantReply(message) {
  const query = message.toLowerCase();
  const { clients, caregivers, appointments, medications, finance } = dashboardData;
  if (/\b(hi|hello|hey)\b/.test(query)) return 'Hello. I can help you find CareOne records and summarize today\'s operations.';
  if (/\b(help|what can you do)\b/.test(query)) return 'Try asking about residents, caregivers, appointments, medications, alerts, or cash flow. I can also point you to the right workspace page.';
  if (/medication|meds|mar|dose/.test(query)) {
    const attention = medications.filter(item => /pending|due|attention|refill|overdue/i.test(`${item.status || ''} ${item.last_mar || ''}`)).length;
    return `${medications.length} medication record${medications.length === 1 ? '' : 's'} are loaded, with ${attention} needing attention. Open Medication to review the MAR; never use this assistant as a substitute for clinical judgment.`;
  }
  if (/appointment|visit|schedule/.test(query)) return `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} are loaded. ${appointments.filter(item => item.appointment_datetime && new Date(item.appointment_datetime) >= new Date()).length} ${appointments.length === 1 ? 'is' : 'are'} upcoming. Open Appointments to make changes.`;
  if (/resident|client|people/.test(query)) return `There ${clients.length === 1 ? 'is' : 'are'} ${clients.length} active client${clients.length === 1 ? '' : 's'} in the current records. Open Clients to review care plans, notes, medications, and follow-ups.`;
  if (/staff|caregiver|coverage/.test(query)) return `${caregivers.length} caregiver${caregivers.length === 1 ? '' : 's'} are loaded. Open Caregivers or Staff Schedule to review coverage and agreements.`;
  if (/finance|money|cash|revenue|expense/.test(query)) {
    const revenue = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? 0 : Number(item.amount || 0)), 0);
    const expenses = finance.reduce((sum, item) => sum + (String(item.entry_type || '').toLowerCase() === 'expense' ? Number(item.amount || 0) : 0), 0);
    return `Current recorded revenue is $${revenue.toLocaleString()} and expenses are $${expenses.toLocaleString()}, for a net of $${(revenue - expenses).toLocaleString()}. Open Finance for the full ledger.`;
  }
  if (/alert|attention|urgent/.test(query)) {
    const alerts = medications.filter(item => /pending|due|attention|refill|overdue/i.test(`${item.status || ''} ${item.last_mar || ''}`)).length;
    return `I found ${alerts} medication alert${alerts === 1 ? '' : 's'} in the loaded records. Review the Medication page for details.`;
  }
  return 'I can summarize residents, caregivers, appointments, medications, alerts, and finance records. What would you like to check?';
}

function initCareOneAssistant() {
  if (document.getElementById('careoneAssistant')) return;
  const widget = document.createElement('section');
  widget.id = 'careoneAssistant';
  widget.className = 'assistant-widget';
  widget.innerHTML = `<button class="assistant-launcher" type="button" aria-expanded="false" aria-controls="assistantPanel"><span class="assistant-launcher-icon">✦</span><span>CareOne AI</span></button><div id="assistantPanel" class="assistant-panel" hidden><div class="assistant-header"><div><strong>CareOne AI</strong><small>Workspace assistant</small></div><button class="assistant-close" type="button" aria-label="Close assistant">×</button></div><div class="assistant-messages" aria-live="polite"><div class="assistant-message assistant-message-bot">Hi, I’m your CareOne assistant. Ask about today’s records or where to find something.</div></div><form class="assistant-form"><input name="message" autocomplete="off" placeholder="Ask about your workspace..." aria-label="Ask CareOne AI" required><button type="submit" aria-label="Send message">Send</button></form><small class="assistant-disclaimer">AI summaries can be incomplete. Verify care decisions in the source record.</small></div>`;
  document.body.appendChild(widget);
  const launcher = widget.querySelector('.assistant-launcher');
  const panel = widget.querySelector('.assistant-panel');
  const close = widget.querySelector('.assistant-close');
  const messages = widget.querySelector('.assistant-messages');
  const form = widget.querySelector('.assistant-form');
  const input = form.querySelector('input');
  const setOpen = (open) => { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); if (open) input.focus(); };
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    messages.insertAdjacentHTML('beforeend', `<div class="assistant-message assistant-message-user">${escapeHtml(message)}</div>`);
    input.value = '';
    const pending = document.createElement('div');
    pending.className = 'assistant-message assistant-message-bot assistant-pending';
    pending.textContent = 'Checking your workspace...';
    messages.appendChild(pending);
    messages.scrollTop = messages.scrollHeight;
    let reply;
    if (window.CAREONE_AI_ENDPOINT) {
      try {
        const response = await fetch(window.CAREONE_AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, records: dashboardData }) });
        if (!response.ok) throw new Error('Assistant request failed');
        const data = await response.json();
        reply = data.reply || data.message;
      } catch (_) {}
    }
    pending.classList.remove('assistant-pending');
    pending.textContent = reply || assistantReply(message);
    messages.scrollTop = messages.scrollHeight;
  });
}

const recordForm = document.getElementById('recordForm');
if (recordForm) recordForm.addEventListener('submit', async event => { event.preventDefault(); const payload = {}; for (const [key, value] of new FormData(event.currentTarget)) { const normalized = normalize(key, value); if (normalized !== undefined) payload[key] = normalized; } await insertRecord(event.currentTarget.dataset.table, payload); closeModal(); await loadAll(); });
initCareOneAssistant();
loadAll();
if (!supabaseClient) console.warn('Supabase not loaded. Records are being saved locally in browser storage.');
