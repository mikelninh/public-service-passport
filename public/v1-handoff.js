import { createCitizenCaseHandoff, CITIZEN_CASE_HANDOFF_STORAGE_KEY } from './citizen-case-handoff.js';

function householdFromUi() {
  const singleParent = document.querySelector('input[name="householdType"]:checked')?.value === 'single';
  return {
    adults: singleParent ? 1 : 2,
    singleParent,
    children: [...document.querySelectorAll('#v1-children input')].map((input) => ({ age: Number(input.value) })),
    monthlyGrossIncome: Number(document.querySelector('#v1-income')?.value),
    warmRent: Number(document.querySelector('#v1-rent')?.value),
    receivesKindergeld: document.querySelector('#v1-kindergeld')?.checked === true,
    city: 'Berlin'
  };
}

const button = document.querySelector('#v1-authority-preview');
if (button) {
  button.addEventListener('click', () => {
    const result = document.querySelector('#v1-result');
    const error = document.querySelector('#v1-error');
    if (!result || result.classList.contains('hidden')) {
      if (error) {
        error.textContent = 'Bitte zuerst die Unterstützung prüfen.';
        error.classList.remove('hidden');
      }
      return;
    }

    try {
      const handoff = createCitizenCaseHandoff({
        household: householdFromUi(),
        policyVersion: document.querySelector('#v1-policy')?.textContent || 'unknown',
        handoffId: globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`,
        now: Date.now()
      });
      localStorage.setItem(CITIZEN_CASE_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
      window.location.assign('/authority.html?source=citizen');
    } catch (cause) {
      if (error) {
        error.textContent = `Behördenvorschau konnte nicht vorbereitet werden: ${cause.message}`;
        error.classList.remove('hidden');
      }
    }
  });
}
