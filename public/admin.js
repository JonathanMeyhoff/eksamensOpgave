console.log('admin.js er loadet');

// DOM-elementer
const nyOplevelseTitelInput = document.getElementById('ny-oplevelse-titel');
const btnOpretOplevelse = document.getElementById('btn-opret-oplevelse');

const oplevelseSelect = document.getElementById('oplevelse-valg');
const expTitleInput = document.getElementById('exp-title');
const btnSaveExp = document.getElementById('btn-save-exp');

const btnShow = document.getElementById('btn-show');
const btnNotify = document.getElementById('btn-notify');
const output = document.getElementById('output');

let experiencesCache = [];

function setOutput(messageOrObject) {
  if (typeof messageOrObject === 'string') {
    output.textContent = messageOrObject;
  } else {
    output.textContent = JSON.stringify(messageOrObject, null, 2);
  }
}

function getSelectedExperienceId() {
  const value = oplevelseSelect.value;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// --------- Venteliste-tabel ----------

function renderVentelisteTabel(list) {
  const container = document.getElementById('result-table');

  if (!list || list.length === 0) {
    container.innerHTML = "<p>Ingen personer på ventelisten.</p>";
    return;
  }

  const rows = list
    .map(person => `
      <tr>
        <td>${person.name}</td>
        <td>${person.phone || '-'}</td>
        <td>${person.email || '-'}</td>
        <td><span class="status-badge status-${person.status}">${person.status}</span></td>
      </tr>
    `)
    .join('');

  container.innerHTML = `
    <table class="result-table">
      <thead>
        <tr>
          <th>Navn</th>
          <th>Telefon</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// --------- HENT OPLEVELSER ----------

async function hentOplevelser() {
  try {
    const res = await fetch('/api/oplevelser');
    const text = await res.text();

    if (!res.ok) {
      setOutput('Fejl ved hentning af oplevelser:\n' + text);
      return;
    }

    const data = JSON.parse(text);
    experiencesCache = data.oplevelser || [];

    if (experiencesCache.length === 0) {
      oplevelseSelect.innerHTML = '<option value="">Ingen oplevelser</option>';
      expTitleInput.value = '';
      return;
    }

    oplevelseSelect.innerHTML = experiencesCache
      .map(o => `<option value="${o.id}">${o.id} – ${o.title}</option>`)
      .join('');

    const first = experiencesCache[0];
    oplevelseSelect.value = String(first.id);
    expTitleInput.value = first.title;

  } catch (err) {
    console.error('Fejl ved hentOplevelser:', err);
    setOutput('Fejl ved hentning af oplevelser: ' + err.message);
  }
}

oplevelseSelect.addEventListener('change', () => {
  const valgtId = Number(oplevelseSelect.value);
  const exp = experiencesCache.find(e => e.id === valgtId);
  expTitleInput.value = exp ? exp.title : '';
});

// --------- OPRET OPLEVELSE ----------

btnOpretOplevelse.addEventListener('click', async () => {
  const title = nyOplevelseTitelInput.value.trim();
  if (!title) {
    return;
  }

  try {
    const res = await fetch('/api/oplevelser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });

    const text = await res.text();
    if (!res.ok) {
      setOutput('Fejl ved oprettelse af oplevelse:\n' + text);
      return;
    }

    const data = JSON.parse(text);
    setOutput({ nyOplevelse: data });
    nyOplevelseTitelInput.value = '';
    hentOplevelser();

  } catch (err) {
    console.error('Fejl ved oprettelse af oplevelse:', err);
    setOutput('Fejl ved oprettelse af oplevelse: ' + err.message);
  }
});

// --------- GEM NY TITEL ----------

btnSaveExp.addEventListener('click', async () => {
  const id = getSelectedExperienceId();
  if (!id) {
    return;
  }

  const newTitle = expTitleInput.value.trim();
  if (!newTitle) {
    return;
  }

  try {
    const res = await fetch(`/api/oplevelser/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });

    const text = await res.text();
    if (!res.ok) {
      setOutput('Fejl ved opdatering af oplevelse:\n' + text);
      return;
    }

    const data = JSON.parse(text);
    setOutput({ opdateretOplevelse: data });

    const idx = experiencesCache.findIndex(e => e.id === id);
    if (idx !== -1) {
      experiencesCache[idx].title = newTitle;
    }

    const option = oplevelseSelect.options[oplevelseSelect.selectedIndex];
    option.text = `${id} – ${newTitle}`;

  } catch (err) {
    console.error('Fejl ved opdatering af oplevelse:', err);
    setOutput('Fejl ved opdatering af oplevelse: ' + err.message);
  }
});

// --------- VIS VENTELISTE ----------

btnShow.addEventListener('click', async () => {
  const experienceId = getSelectedExperienceId();
  if (!experienceId) {
    return;
  }

  setOutput('Henter venteliste...');

  try {
    const res = await fetch(`/api/venteliste/${experienceId}`);
    const rawText = await res.text();

    if (!res.ok) {
      setOutput(`Fejl fra server (status ${res.status}):\n${rawText || '(ingen body)'}`);
      return;
    }

    if (!rawText) {
      setOutput('Serveren svarede med en tom body (ingen JSON).');
      return;
    }

    const data = JSON.parse(rawText);
    const list = data.waitlist || [];

    renderVentelisteTabel(list);
    setOutput('');

  } catch (err) {
    console.error(err);
    setOutput('Fejl ved fetch af venteliste: ' + err.message);
  }
});

// --------- SEND SMS ----------

btnNotify.addEventListener('click', async () => {
  const experienceId = getSelectedExperienceId();
  if (!experienceId) {
    return;
  }

  if (!confirm(`Send SMS til alle med status "waiting" for experienceId = ${experienceId}?`)) {
    return;
  }

  setOutput('Sender SMS til alle i køen...');

  try {
    const res = await fetch(`/api/venteliste/notify-all/${experienceId}`, {
      method: 'POST'
    });

    const rawText = await res.text();

    if (!res.ok) {
      setOutput(`Fejl fra server (status ${res.status}):\n${rawText || '(ingen body)'}`);
      return;
    }

    if (!rawText) {
      setOutput('Serveren svarede med en tom body (ingen JSON).');
      return;
    }

    const data = JSON.parse(rawText);

    setOutput({
      besked: `SMS-udsendelse fuldført for experienceId = ${experienceId}`,
      opsummering: data.summary || null,
      samletStatus: data.overallStats || null,
      detaljer: {
        successes: data.successes ? data.successes.length : 0,
        failures: data.failures ? data.failures.length : 0,
        skipped: data.skippedNoPhone ? data.skippedNoPhone.length : 0
      }
    });

  } catch (err) {
    console.error(err);
    setOutput('Fejl ved send af SMS: ' + err.message);
  }
});

// --------- INIT ----------

hentOplevelser();
