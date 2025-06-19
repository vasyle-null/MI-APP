// =============== DATA STRUCTURES ===============

// Data version for migrations
const DATA_VERSION = 2;

// Default jobs and demo data
const DEMO_JOBS = [
  {
    id: genID(),
    name: "Barista",
    salary: 16,
    currency: "$",
    payment_type: "hour",
    period: "week",
    active: true,
    records: [
      // last 5 days
      ...Array.from({length: 5}, (_,i)=>({
        id: genID(),
        date: dateNDaysAgo(i),
        start: "09:00",
        end: "17:00",
        break: 30,
        isManual: false,
        closed: false
      }))
    ],
    closedPeriods: []
  },
  {
    id: genID(),
    name: "Freelance Design",
    salary: 1200,
    currency: "$",
    payment_type: "month",
    period: "month",
    active: false,
    records: [],
    closedPeriods: []
  }
];

function genID() {
  return "id"+Math.random().toString(36).substr(2,9);
}

function dateNDaysAgo(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return dt.toISOString().slice(0,10);
}

// =============== STATE AND STORAGE ===============

let state = {
  jobs: [],
  activeJobId: null,
  running: null, // { jobId, start, breakStart, breaks: [], running: true }
  settings: {
    darkMode: false
  },
  dataVersion: DATA_VERSION
};

function saveState() {
  localStorage.setItem('tt_state', JSON.stringify(state));
}
function loadState() {
  const s = localStorage.getItem('tt_state');
  if (s) {
    try {
      state = JSON.parse(s);
      // Migrate if needed
      if (!state.dataVersion || state.dataVersion < DATA_VERSION) migrateState();
    } catch(e) {
      state = {};
    }
  } else {
    // Demo data
    state.jobs = DEMO_JOBS;
    state.activeJobId = state.jobs[0].id;
    state.running = null;
    state.settings = { darkMode: false };
    state.dataVersion = DATA_VERSION;
    saveState();
  }
}

// Migrations for future structure changes
function migrateState() {
  // v2: ensure closedPeriods key exists, and all records have isManual, closed
  for (const job of state.jobs) {
    if (!job.closedPeriods) job.closedPeriods = [];
    if (job.records)
      for (const rec of job.records) {
        if (rec.isManual == null) rec.isManual = false;
        if (rec.closed == null) rec.closed = false;
      }
  }
  state.dataVersion = DATA_VERSION;
  saveState();
}

// =============== UTILITIES ===============

function formatTimeHM(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return t || "";
  let [h,m]=t.split(":").map(Number);
  let ampm = h >= 12 ? "PM":"AM";
  if (h>12) h-=12;
  if (h==0) h=12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}
function pad(num) { return String(num).padStart(2,'0'); }
function formatHMFromMins(mins) {
  if (mins==null) return "0:00";
  let h = Math.floor(mins/60), m = Math.round(mins%60);
  return h+":"+pad(m);
}
function parseTimeHM(str) {
  let [h,m]=str.split(":").map(Number);
  return h*60+m;
}
function formatCurrency(val, curr) {
  let sign = curr||"$";
  return `${sign}${Number(val).toFixed(2)}`;
}
function getJobById(id) {
  return state.jobs.find(j => j.id === id);
}
function getActiveJob() {
  let job = state.jobs.find(j=>j.id===state.activeJobId);
  if (!job && state.jobs.length) {
    job = state.jobs[0];
    state.activeJobId = job.id;
    saveState();
  }
  return job;
}
function getActiveJobIdx() {
  return state.jobs.findIndex(j=>j.id===state.activeJobId);
}
function todayStr() {
  return (new Date()).toISOString().slice(0,10);
}
function getMonday(dateStr){
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() - ((dt.getDay()||7)-1));
  return dt.toISOString().slice(0,10);
}
function getPeriodRange(period, refDate) {
  // Returns [start, end] date string for current period
  const dt = refDate ? new Date(refDate) : new Date();
  let start, end;
  if (period==="week") {
    let d = new Date(dt);
    d.setDate(d.getDate() - ((d.getDay()||7)-1));
    start = d.toISOString().slice(0,10);
    d.setDate(d.getDate()+6);
    end = d.toISOString().slice(0,10);
  }
  else if (period==="biweekly") {
    let d = new Date(dt);
    let week = Math.floor((d.getDate()-1)/7);
    d.setDate(1 + week*14 - (d.getDay()||7)+1);
    start = d.toISOString().slice(0,10);
    d.setDate(d.getDate()+13);
    end = d.toISOString().slice(0,10);
  }
  else if (period==="month") {
    let d = new Date(dt.getFullYear(), dt.getMonth(), 1);
    start = d.toISOString().slice(0,10);
    d.setMonth(d.getMonth()+1);
    d.setDate(0);
    end = d.toISOString().slice(0,10);
  }
  return [start,end];
}
function dateInRange(date, start, end) {
  return date >= start && date <= end;
}
// =============== INITIALIZATION ===============

loadState();
if (state.settings.darkMode)
  document.documentElement.setAttribute("data-theme","dark");

// =============== PAGE NAVIGATION ===============

const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');
navBtns.forEach(btn=>{
  btn.onclick = ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    window.scrollTo({top:0,behavior:"smooth"});
  };
});

// =============== CLOCK IN PAGE ===============

function renderJobSelector() {
  const sel = document.getElementById('job-selector');
  sel.innerHTML = "";
  for (const job of state.jobs) {
    let opt = document.createElement('option');
    opt.value = job.id;
    opt.textContent = job.name;
    if (job.id === state.activeJobId) opt.selected = true;
    sel.appendChild(opt);
  }
}
function setActiveJob(id) {
  if (!getJobById(id)) return;
  state.activeJobId = id;
  saveState();
  render();
}
document.getElementById('job-selector').onchange = (e)=>{
  setActiveJob(e.target.value);
};
document.getElementById('edit-jobs-btn').onclick = ()=>{
  showJobsModal();
};

function renderClockInPage() {
  const job = getActiveJob();
  if (!job) return;
  // Total hours
  let hours = 0, earnings = 0;
  for (const rec of job.records) {
    if (rec.closed) continue;
    const mins = parseTimeHM(rec.end)-parseTimeHM(rec.start)-Number(rec.break||0);
    hours += mins/60;
    if (job.payment_type==="hour")
      earnings += (mins/60)*job.salary;
    else if (job.payment_type==="month")
      earnings = Number(job.salary); // Estimated
  }
  document.getElementById('total-hours').textContent = formatHMFromMins(hours*60);
  document.getElementById('total-earnings').textContent =
    formatCurrency(earnings, job.currency);

  // Button states
  const clockin = document.getElementById('clockin-btn');
  const startBreak = document.getElementById('start-break-btn');
  const endBreak = document.getElementById('end-break-btn');
  const clockout = document.getElementById('clockout-btn');
  const running = state.running && state.running.jobId===job.id && state.running.running;
  clockin.disabled = !!running;
  clockout.disabled = !running;
  startBreak.disabled = !running || !!state.running.breakStart;
  endBreak.disabled = !running || !state.running.breakStart;
}
document.getElementById('clockin-btn').onclick = ()=>{
  const job = getActiveJob();
  if (!job) return;
  if (state.running && state.running.running) return;
  state.running = {
    jobId: job.id,
    start: new Date().toISOString(),
    breakStart: null,
    breaks: [],
    running: true
  };
  saveState();
  render();
};
document.getElementById('clockout-btn').onclick = ()=>{
  const job = getActiveJob();
  if (!job) return;
  if (!state.running || !state.running.running) return;
  // End break if on break
  if (state.running.breakStart) {
    endBreak();
  }
  // Save record
  const start = new Date(state.running.start);
  const end = new Date();
  let breakMins = state.running.breaks.reduce((a,b)=>
    a + Math.round((b[1]-b[0])/60000), 0);
  job.records.push({
    id: genID(),
    date: start.toISOString().slice(0,10),
    start: pad(start.getHours())+":"+pad(start.getMinutes()),
    end: pad(end.getHours())+":"+pad(end.getMinutes()),
    break: breakMins,
    isManual: false,
    closed: false
  });
  state.running = null;
  saveState();
  render();
};
function startBreak() {
  if (!state.running || state.running.breakStart) return;
  state.running.breakStart = new Date().toISOString();
  saveState();
  render();
}
function endBreak() {
  if (!state.running || !state.running.breakStart) return;
  let s = new Date(state.running.breakStart);
  let e = new Date();
  state.running.breaks.push([s,e]);
  state.running.breakStart = null;
  saveState();
  render();
}
document.getElementById('start-break-btn').onclick = startBreak;
document.getElementById('end-break-btn').onclick = endBreak;
document.getElementById('manual-entry-btn').onclick = ()=>showManualEntryModal();

// =============== MANUAL ENTRY MODAL ===============
function showManualEntryModal() {
  showModal('modal-manual-entry');
  const form = document.getElementById('manual-entry-form');
  form.reset();
  form.date.value = todayStr();
  form.start.value = "09:00";
  form.end.value = "17:00";
  form.break.value = "0";
}
document.getElementById('cancel-manual-entry').onclick = ()=>hideModal();
document.getElementById('manual-entry-form').onsubmit = function(e){
  e.preventDefault();
  const job = getActiveJob();
  if (!job) return;
  let {date, start, end, break: brk} = this;
  if (!date.value || !start.value || !end.value) return;
  if (parseTimeHM(end.value) <= parseTimeHM(start.value)) {
    alert("End time must be after start time.");
    return;
  }
  job.records.push({
    id: genID(),
    date: date.value,
    start: start.value,
    end: end.value,
    break: Number(brk.value),
    isManual: true,
    closed: false
  });
  saveState();
  hideModal();
  render();
};

// =============== HISTORY PAGE ===============

let periodTab = "week";
document.querySelectorAll('.tab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    periodTab = tab.dataset.period;
    renderHistoryPage();
  };
});

function renderHistoryPage() {
  const job = getActiveJob();
  if (!job) return;
  // Show records in current period
  let [start,end] = getPeriodRange(periodTab);
  const hlist = document.getElementById('history-list');
  hlist.innerHTML = "";
  let records = job.records.filter(r=>!r.closed && dateInRange(r.date, start, end));
  // Group by date
  let byDay = {};
  for (const rec of records) {
    if (!byDay[rec.date]) byDay[rec.date]=[];
    byDay[rec.date].push(rec);
  }
  let dates = Object.keys(byDay).sort().reverse();
  for (const date of dates) {
    let dayrecs = byDay[date];
    let mins=0, earn=0;
    for (const r of dayrecs) {
      let m = parseTimeHM(r.end)-parseTimeHM(r.start)-Number(r.break||0);
      mins+=m;
      if (job.payment_type==="hour")
        earn += (m/60)*job.salary;
      else if (job.payment_type==="month")
        earn = Number(job.salary)/30; // estimate per day
    }
    let dayDiv = document.createElement('div');
    dayDiv.className = "history-day";
    dayDiv.innerHTML = `
      <div class="date">${date}</div>
      <div class="record-row">
        <span class="record-hours">${formatHMFromMins(mins)}</span>
        <span class="record-earnings">${formatCurrency(earn,job.currency)}</span>
      </div>
      <div class="records-list"></div>
    `;
    let recsList = dayDiv.querySelector('.records-list');
    for (const r of dayrecs) {
      const ent = document.createElement('div');
      ent.style.fontSize = ".97em";
      ent.style.color = r.isManual ? "var(--accent)" : "var(--fg)";
      ent.innerHTML = (r.isManual ? 'Manual: ' : '')
        + `${formatTimeHM(r.start)} - ${formatTimeHM(r.end)} (${r.break||0} min break)`;
      recsList.appendChild(ent);
    }
    hlist.appendChild(dayDiv);
  }
  // Closed periods
  renderClosedPeriods();
}
function renderClosedPeriods() {
  const job = getActiveJob();
  const clist = document.getElementById('closed-periods-list');
  clist.innerHTML = "";
  for (const cp of job.closedPeriods.slice().reverse()) {
    let div = document.createElement('div');
    div.className = "closed-period";
    div.innerHTML = `
      <div class="date">${cp.periodName||cp.period}</div>
      <div class="record-row">
        <span class="record-hours">${formatHMFromMins(cp.totalMins)}</span>
        <span class="record-earnings">${formatCurrency(cp.earnings,job.currency)}</span>
      </div>
    `;
    clist.appendChild(div);
  }
}
document.getElementById('close-period-btn').onclick = ()=>{
  const job = getActiveJob();
  if (!job) return;
  let [start,end] = getPeriodRange(periodTab);
  let records = job.records.filter(r=>!r.closed && dateInRange(r.date,start,end));
  if (!records.length) { alert("No records to close for this period."); return; }
  // Sum
  let mins=0, earn=0;
  for (const r of records) {
    let m = parseTimeHM(r.end)-parseTimeHM(r.start)-Number(r.break||0);
    mins+=m;
    if (job.payment_type==="hour")
      earn += (m/60)*job.salary;
    else if (job.payment_type==="month")
      earn = Number(job.salary);
  }
  // Mark closed
  for (const r of records) r.closed=true;
  job.closedPeriods.push({
    period: periodTab,
    periodName: `${start} to ${end}`,
    totalMins: mins,
    earnings: earn
  });
  saveState();
  render();
};

// =============== SETTINGS PAGE / JOBS MANAGEMENT ===============

function renderJobsList() {
  const ul = document.getElementById('jobs-list');
  ul.innerHTML = "";
  for (const job of state.jobs) {
    let li = document.createElement('li');
    li.className = "job-row" + (job.id===state.activeJobId ? " active":"");
    li.innerHTML = `
      <div class="job-info">
        <span class="job-title">${job.name}</span>
        <span class="job-meta">${formatCurrency(job.salary,job.currency)}/
          ${job.payment_type=="hour"?"hr":"month"}, ${capitalize(job.period)}</span>
      </div>
      <div class="job-actions">
        <button class="outline set-active-btn" ${job.id===state.activeJobId?"disabled":""}>Set Active</button>
        <button class="outline edit-job-btn">Edit</button>
      </div>
    `;
    li.querySelector('.set-active-btn').onclick = ()=>{ setActiveJob(job.id); render(); };
    li.querySelector('.edit-job-btn').onclick = ()=>{ showJobModal(job.id); };
    ul.appendChild(li);
  }
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
document.getElementById('add-job-btn').onclick = ()=>showJobModal();

function showJobsModal() {
  navBtns[2].click();
}
function showJobModal(jobId) {
  showModal('modal-job');
  const form = document.getElementById('job-form');
  form.reset();
  const editing = !!jobId;
  const job = editing ? getJobById(jobId) : null;
  document.getElementById('job-form-title').textContent = editing ? "Edit Job":"New Job";
  form.name.value = job?.name || "";
  form.salary.value = job?.salary || "";
  form.currency.value = job?.currency || "$";
  form.payment_type.value = job?.payment_type || "hour";
  form.period.value = job?.period || "week";
  form._editingId = jobId || null;
  document.getElementById('delete-job').hidden = !editing;
}
document.getElementById('cancel-job').onclick = ()=>hideModal();
document.getElementById('delete-job').onclick = function(){
  const id = document.getElementById('job-form')._editingId;
  if (!id) return;
  if (!confirm("Delete this job and all times?")) return;
  state.jobs = state.jobs.filter(j=>j.id!==id);
  if (state.activeJobId===id) {
    if (state.jobs.length) state.activeJobId=state.jobs[0].id;
    else state.activeJobId=null;
  }
  saveState();
  hideModal();
  render();
};
document.getElementById('job-form').onsubmit = function(e){
  e.preventDefault();
  const {name, salary, currency, payment_type, period} = this;
  if (!name.value.trim() || Number(salary.value)<=0 || !currency.value.trim()) {
    alert("All fields must be valid.");
    return;
  }
  if (this._editingId) {
    // Edit existing
    let job = getJobById(this._editingId);
    job.name = name.value.trim();
    job.salary = Number(salary.value);
    job.currency = currency.value.trim();
    job.payment_type = payment_type.value;
    job.period = period.value;
  } else {
    // New
    let job = {
      id: genID(),
      name: name.value.trim(),
      salary: Number(salary.value),
      currency: currency.value.trim(),
      payment_type: payment_type.value,
      period: period.value,
      active: false,
      records: [],
      closedPeriods: []
    };
    state.jobs.push(job);
    if (!state.activeJobId) state.activeJobId = job.id;
  }
  saveState();
  hideModal();
  render();
};

// =============== SETTINGS: DARK MODE ===============
const darkToggle = document.getElementById('darkmode-toggle');
darkToggle.checked = !!state.settings.darkMode;
darkToggle.onchange = function() {
  state.settings.darkMode = this.checked;
  document.documentElement.setAttribute("data-theme",this.checked?"dark":"");
  saveState();
};

// =============== EXPORT PAGE ===============
document.getElementById('export-csv-btn').onclick = () => {
  const job = getActiveJob();
  let csv = "Date,Start,End,Break (min),Type,Closed,Hours Worked,Earnings\n";
  for (const r of job.records) {
    let mins = parseTimeHM(r.end)-parseTimeHM(r.start)-Number(r.break||0);
    let h = mins/60;
    let earn = job.payment_type==="hour"? (h*job.salary) : (job.salary);
    csv += [r.date, r.start, r.end, r.break, r.isManual?"Manual":"Auto", r.closed?"Yes":"No", h.toFixed(2), earn.toFixed(2)].join(",") + "\n";
  }
  let blob = new Blob([csv],{type:"text/csv"});
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${job.name.replace(/\s+/g,"_")}_records.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

document.getElementById('export-pdf-btn').onclick = () => {
  // Send data via fetch to backend /export-pdf, receive blob
  const job = getActiveJob();
  fetch("http://127.0.0.1:5000/export-pdf", {
    method:"POST",
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      job: {
        name: job.name,
        salary: job.salary,
        currency: job.currency,
        payment_type: job.payment_type,
        period: job.period
      },
      records: job.records
    })
  }).then(r=>r.blob()).then(blob=>{
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${job.name.replace(/\s+/g,"_")}_records.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setExportStatus('PDF exported!');
  }).catch(e=>{
    setExportStatus('PDF export failed. Is the backend running?');
  });
};
function setExportStatus(msg) {
  document.getElementById('export-status').textContent = msg;
  setTimeout(()=>{ document.getElementById('export-status').textContent=""; }, 3500);
}

// =============== MODAL HANDLING ===============
function showModal(id) {
  document.getElementById('modal-bg').hidden = false;
  document.getElementById(id).hidden = false;
}
function hideModal() {
  document.getElementById('modal-bg').hidden = true;
  document.querySelectorAll('.modal').forEach(m=>m.hidden=true);
}
document.getElementById('modal-bg').onclick = hideModal;

// =============== RENDER EVERYTHING ===============
function render() {
  renderJobSelector();
  renderClockInPage();
  renderHistoryPage();
  renderJobsList();
}
render();

// =============== LIVE CLOCKIN TIMER (optional) ===============
setInterval(()=>{
  // If running, update clockin page numbers
  if (state.running && state.running.running) {
    renderClockInPage();
  }
}, 30*1000);

// =============== DEMO: INIT WITH DATA ===============
// Already handled in loadState if empty

// =============== BACKEND PDF (Flask) REMINDER ===============
// User must run the backend for PDF export to work
