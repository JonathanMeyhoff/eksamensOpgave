console.log('brugerSide.js er loadet');

const form = document.getElementById('venteliste-form');
const result = document.getElementById('result');
const oplevelseSelect = document.getElementById('oplevelse-valg');
const hiddenExperienceInput = document.getElementById('experience-id-hidden');

// Hent oplevelser til dropdown
async function hentOplevelser() {
    try {
        const res = await fetch('/api/oplevelser');
        const text = await res.text();

        if (!res.ok) {
            result.textContent = 'Fejl ved hentning af oplevelser:\n' + text;
            return;
        }

        const data = JSON.parse(text);

        if (!data.oplevelser || data.oplevelser.length === 0) {
            oplevelseSelect.innerHTML = '<option value="">Ingen oplevelser tilgængelige</option>';
            hiddenExperienceInput.value = '';
            return;
        }

        oplevelseSelect.innerHTML = data.oplevelser
            .map(o => `<option value="${o.id}">${o.id} – ${o.title}</option>`)
            .join('');

        hiddenExperienceInput.value = data.oplevelser[0].id;
    } catch (err) {
        console.error(err);
        result.textContent = 'Fejl ved hentOplevelser: ' + err.message;
    }
}

oplevelseSelect.addEventListener('change', () => {
    const valgt = oplevelseSelect.value;
    hiddenExperienceInput.value = valgt || '';
});

// Submit – skriv på venteliste
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.experienceId = Number(data.experienceId);

    console.log('Sender data til /api/venteliste:', data);

    try {
        const res = await fetch('/api/venteliste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const text = await res.text();

        try {
            const json = JSON.parse(text);
            const valgtOption = oplevelseSelect.options[oplevelseSelect.selectedIndex];
            const oplevelseTekst = valgtOption ? valgtOption.text : 'valgt oplevelse';

            // Flot, venlig bekræftelsesboks
            result.innerHTML = `
        <div class="confirm-box">
             <strong>Du er nu tilmeldt!</strong><br><br>
               Du er skrevet på ventelisten til:<br>
             <span style="font-weight:600">• ${oplevelseTekst}</span>
        </div>`;

            // Ryd felterne efter success
            document.getElementById('name-input').value = '';
            document.getElementById('phone-input').value = '';
            document.getElementById('email-input').value = '';

            // Scroll så brugeren ser beskeden
            result.scrollIntoView({ behavior: 'smooth' });

        } catch (errParse) {
            console.error('Parse-fejl i svar:', errParse);
            result.textContent = 'Kunne ikke parse svar som JSON:\n' + text;
        }
    } catch (err) {
        console.error('Fejl ved fetch:', err);
        result.textContent = 'Fejl: ' + err.message;
    }
});

// start
hentOplevelser();
