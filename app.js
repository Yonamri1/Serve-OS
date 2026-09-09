const SUPABASE_URL = "https://zsmilczlumqkdpthlpto.supabase.co";
const SUPABASE_KEY = "sb_publishable__Oq50W1WSRfYcae0StNicg_FrzPwRTB";
const TABLE_ALIASES = {
  clients: ['clients'], caregivers: ['staff'], meal_plans: ['meals'],
  medications: ['medications'], appointments: ['appointments'],
  finance: ['finance_records'], policy_updates: ['policy_updates'],
  credential_trainings: ['training_records'], staff_schedules: ['staff_schedules']
};
const STORAGE_PREFIX = 'careone_records_';
const dashboardData = { clients: [], caregivers: [], appointments: [], medications: [], schedules: [], finance: [], policies: [], trainings: [] };
const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

const FORM_CONFIG = {
  clients: { title: 'Add Client', fields: [['first_name','First Name','text'],['last_name','Last Name','text'],['room','Room','text'],['admission_date','Admission Date','date'],['status','Status','text'],['medical_history','Medical History','textarea'],['care_plan','Care Plan','textarea']] },
  caregivers: { title: 'Add Staff Member', fields: [['first_name','First Name','text'],['last_name','Last Name','text'],['role','Role','text'],['phone','Phone','text'],['status','Status','text']] },
  meal_plans: { title: 'Add Meal', fields: [['meal_type','Meal Type','select',['Breakfast','Lunch','Dinner','Snack']],['menu','Menu','textarea'],['updated_date','Updated Date','date']] },
  medications: { title: 'Add Medication', fields: [['client_id','Client ID','number'],['medication_name','Medication Name','text'],['dosage','Dosage','text'],['schedule','Schedule','text'],['status','Status','text']] },
  appointments: { title: 'Add Appointment', fields: [['client_name','Client Name','text'],['reason_for_visit','Reason for Visit','textarea'],['location','Location','text'],['contact_information','Contact Information','text'],['appointment_datetime','Appointment Date/Time','datetime-local'],['notes','Notes','textarea']] },
  finance: { title: 'Add Finance Record', fields: [['entry_type','Entry Type','select',['revenue','expense']],['category','Category','text'],['client_name','Client Name','text'],['caregiver_name','Caregiver Name','text'],['amount','Amount','number'],['month','Month','text'],['notes','Notes','textarea']] },
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
function quickSearch(query) { const value = query.toLowerCase().trim(); if (!value) return; const row = [...document.querySelectorAll('#clientRows .card')].find(item => item.innerText.toLowerCase().includes(value)); if (row) { showPage('clients', document.querySelectorAll('.nav button')[1]); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
function openForm(table) {
  const config = FORM_CONFIG[table]; if (!config) return alert('No form defined for this table yet.');
  document.getElementById('formFields').innerHTML = config.fields.map(([name, label, type, options]) => `<div class="field ${type === 'textarea' ? 'full' : ''}"><label for="${name}">${label}</label>${type === 'select' ? `<select id="${name}" name="${name}">${options.map(option => `<option value="${option}">${option}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea id="${name}" name="${name}"></textarea>` : `<input id="${name}" name="${name}" type="${type}"></div>`}`).join('');
  document.getElementById('modalTitle').textContent = config.title; document.getElementById('recordForm').dataset.table = table; document.getElementById('recordModal').classList.add('show');
}
function closeModal() { document.getElementById('recordModal').classList.remove('show'); document.getElementById('recordForm').reset(); }
function normalize(key, value) { const text = String(value).trim(); if (!text) return undefined; if (key === 'amount' || key === 'client_id') return Number(text); if (key.endsWith('_date') || key === 'appointment_datetime') return new Date(text).toISOString(); return text; }

function renderClients(rows) { const root = document.getElementById('clientRows'); root.innerHTML = rows.length ? rows.map((item, index) => { const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || `Client ${index + 1}`; const id = item.id || index + 1; return `<div class="card"><div class="person"><div class="mini">${escapeHtml(name.split(' ').map(part => part[0]).join('').slice(0,2))}</div><div><b>${escapeHtml(name)}</b><br><small class="label">ID: ${id}</small></div></div><hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><div class="row"><span>Room</span><b>${escapeHtml(item.room || '-')}</b></div><div class="row"><span>Care plan</span><b>${escapeHtml(item.care_plan || 'Not available')}</b></div><div class="row"><span>Status</span>${badge(item.status || 'Stable')}</div><div class="row"><span></span><button class="row-delete-btn" type="button" onclick="deleteRecord('clients','${id}')">Delete</button></div></div>`; }).join('') : '<div class="card"><p class="label">No client records found.</p></div>'; }
function renderCaregivers(rows) { const root = document.getElementById('caregiverRows'); root.innerHTML = rows.length ? rows.map((item, index) => { const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || `Staff ${index + 1}`; const id = item.id || index + 1; return `<div class="card"><div class="person"><div class="mini">${escapeHtml(name.slice(0,2).toUpperCase())}</div><div><b>${escapeHtml(name)}</b><br><small class="label">${escapeHtml(item.role || 'Caregiver')} · ${escapeHtml(item.phone || 'No phone')}</small></div></div><div class="row"><span>Status</span>${badge(item.status || 'Certified')}</div><div class="row"><span></span><button class="row-delete-btn" type="button" onclick="deleteRecord('caregivers','${id}')">Delete</button></div></div>`; }).join('') : '<div class="card"><p class="label">No staff members found.</p></div>'; }
function renderTable(id, rows, columns, key) { const root = document.getElementById(id); if (!root) return; root.innerHTML = rows.length ? rows.map(item => { const recordId = item.id || Date.now(); return `<tr>${columns.map(column => `<td>${column.render ? column.render(item) : escapeHtml(item[column.key] || '—')}</td>`).join('')}<td><button class="row-delete-btn" type="button" onclick="deleteRecord('${key}','${recordId}')">Delete</button></td></tr>`; }).join('') : `<tr><td colspan="${columns.length + 1}">No records found.</td></tr>`; }

function renderDashboard() {
  const { clients, caregivers, appointments, medications, schedules, finance } = dashboardData;
  document.getElementById('dashboardKpis').innerHTML = [['Active clients', clients.length, '♙'],['Caregivers', caregivers.length, '♧'],['Medication alerts', medications.filter(item => /pending|due|attention|refill/i.test(`${item.status} ${item.last_mar}`)).length, '✚'],['Upcoming visits', appointments.length, '📅'],['Recorded revenue', '$' + finance.reduce((sum, item) => sum + (item.entry_type === 'expense' ? 0 : Number(item.amount || 0)), 0).toLocaleString(), '$']].map(([label, value, icon]) => `<div class="card stat"><div><div class="label">${label}</div><div class="num">${value}</div></div><div class="icon">${icon}</div></div>`).join('');
  document.getElementById('dashboardAgenda').innerHTML = appointments.slice(0, 4).map(item => `<div class="row"><div><b>${escapeHtml(item.client_name || 'Client visit')}</b><br><small class="label">${escapeHtml(item.reason_for_visit || 'Appointment')}</small></div>${badge('Upcoming')}</div>`).join('') || '<div class="list-empty">No upcoming appointments recorded.</div>';
  document.getElementById('dashboardAttention').innerHTML = medications.filter(item => /pending|due|attention|refill/i.test(`${item.status} ${item.last_mar}`)).slice(0, 4).map(item => `<div class="row"><b>${escapeHtml(item.medication_name || 'Medication task')}</b>${badge('Review')}</div>`).join('') || '<div class="list-empty">Nothing needs attention right now.</div>';
  document.getElementById('dashboardCoverage').innerHTML = `<div class="summary-row"><span class="label">Scheduled shifts</span><b>${schedules.length}</b></div><div class="progress"><i style="width:${caregivers.length ? Math.min(100, Math.round(schedules.length / caregivers.length * 100)) : 0}%"></i></div>`;
}

function renderReports() {
  const summary = document.getElementById('reportSummaryCards');
  const clients = document.getElementById('reportClientList');
  const schedules = document.getElementById('reportScheduleList');
  if (summary) summary.innerHTML = [['Clients', dashboardData.clients.length], ['Caregivers', dashboardData.caregivers.length], ['Appointments', dashboardData.appointments.length], ['Medications', dashboardData.medications.length]].map(([label, value]) => `<div class="summary-card"><div class="summary-row"><span class="summary-label">${label}</span><span class="summary-figure">${value}</span></div></div>`).join('');
  if (clients) clients.innerHTML = dashboardData.clients.map(item => `<div class="row"><span>${escapeHtml([item.first_name, item.last_name].filter(Boolean).join(' ') || 'Client')}</span>${badge(item.status || 'Stable')}</div>`).join('') || '<div class="list-empty">No client records found.</div>';
  if (schedules) schedules.innerHTML = dashboardData.schedules.map(item => `<div class="row"><span>${escapeHtml(item.caregiver_name || 'Caregiver')}</span>${badge(item.shift || 'Scheduled')}</div>`).join('') || '<div class="list-empty">No schedules found.</div>';
}

async function loadAll() {
  const keys = ['clients','caregivers','appointments','meal_plans','staff_schedules','medications','finance','policy_updates','credential_trainings'];
  const values = await Promise.all(keys.map(readRecords));
  [dashboardData.clients, dashboardData.caregivers, dashboardData.appointments, dashboardData.mealPlans, dashboardData.schedules, dashboardData.medications, dashboardData.finance, dashboardData.policies, dashboardData.trainings] = values;
  renderClients(dashboardData.clients); renderCaregivers(dashboardData.caregivers);
  renderTable('appointmentRows', dashboardData.appointments, [{key:'client_name'},{key:'reason_for_visit'},{key:'location'},{key:'contact_information'},{key:'appointment_datetime'},{key:'notes'}], 'appointments');
  renderTable('mealPlanRows', dashboardData.mealPlans, [{key:'meal_type'},{key:'updated_date'},{key:'meal_type'},{key:'menu'}], 'meal_plans');
  renderTable('shiftScheduleRows', dashboardData.schedules, [{key:'caregiver_name'},{key:'shift'},{key:'status',render: item => badge(item.status)},{key:'days'},{key:'notes'}], 'staff_schedules');
  renderTable('medicationRows', dashboardData.medications, [{key:'client_id'},{key:'medication_name'},{key:'schedule'},{key:'status'},{key:'status',render: item => badge(item.status)}], 'medications');
  const financeRows = document.getElementById('financeRows');
  if (financeRows) financeRows.innerHTML = dashboardData.finance.map(item => `<div class="row"><span>${escapeHtml(item.category || item.notes || 'Finance record')}</span><b>${item.entry_type === 'expense' ? '-' : '+'}$${Math.abs(Number(item.amount || 0)).toLocaleString()}</b></div>`).join('') || '<div class="row"><span>No finance records found</span></div>';
  renderDashboard();
  renderReports();
  document.getElementById('databaseTables').innerHTML = Object.values(TABLE_ALIASES).flat().map(name => `<span class="db-tag">${name}</span>`).join('');
}
async function deleteRecord(key, id) { if (supabaseClient) { const name = await resolveTableName(key); try { await supabaseClient.from(name).delete().eq('id', id); } catch (_) {} } const rows = getLocalRecords(key).filter(item => String(item.id) !== String(id)); saveLocalRecords(key, rows); await loadAll(); }

document.getElementById('recordForm').addEventListener('submit', async event => { event.preventDefault(); const payload = {}; for (const [key, value] of new FormData(event.currentTarget)) { const normalized = normalize(key, value); if (normalized !== undefined) payload[key] = normalized; } await insertRecord(event.currentTarget.dataset.table, payload); closeModal(); await loadAll(); });
loadAll();
if (!supabaseClient) console.warn('Supabase not loaded. Records are being saved locally in browser storage.');
