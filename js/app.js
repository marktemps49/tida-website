/* TIDA Credit Checker — UI logic (no backend; deals persist in localStorage) */

const STORAGE_KEY = 'tida_credit_deals_v1';

const els = {
  tabNew: document.getElementById('tab-new'),
  tabSaved: document.getElementById('tab-saved'),
  panelNew: document.getElementById('panel-new'),
  panelSaved: document.getElementById('panel-saved'),
  dealName: document.getElementById('deal-name'),
  dealType: document.getElementById('deal-type'),
  fieldsContainer: document.getElementById('fields-container'),
  calcBtn: document.getElementById('calc-btn'),
  resetBtn: document.getElementById('reset-btn'),
  resultCard: document.getElementById('result-card'),
  scoreNumber: document.getElementById('score-number'),
  scoreBand: document.getElementById('score-band'),
  scoreProgress: document.getElementById('score-progress'),
  scoreCompleteness: document.getElementById('score-completeness'),
  incompleteWarning: document.getElementById('incomplete-warning'),
  categoryBreakdown: document.getElementById('category-breakdown'),
  saveDealBtn: document.getElementById('save-deal-btn'),
  savedDealsList: document.getElementById('saved-deals-list'),
  savedEmpty: document.getElementById('saved-empty'),
};

let currentAnswers = {};
let currentResult = null;

function switchTab(tab) {
  const isNew = tab === 'new';
  els.tabNew.classList.toggle('active', isNew);
  els.tabSaved.classList.toggle('active', !isNew);
  els.panelNew.hidden = !isNew;
  els.panelSaved.hidden = isNew;
  if (!isNew) renderSavedDeals();
}

function renderFields() {
  const dealType = els.dealType.value;
  const fields = fieldsForDealType(dealType);
  const grouped = {};
  CATEGORIES.forEach((c) => { grouped[c.id] = []; });
  fields.forEach((f) => grouped[f.category].push(f));

  els.fieldsContainer.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const catFields = grouped[cat.id];
    if (!catFields.length) return;

    const details = document.createElement('details');
    details.className = 'category-section';
    details.open = cat.id === 'asset';

    const summary = document.createElement('summary');
    summary.textContent = `${cat.name} (${catFields.length} fields)`;
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'fields-grid';

    catFields.forEach((f) => {
      const wrap = document.createElement('div');
      wrap.className = 'field' + (f.type === 'context' ? ' field-context' : '');

      const label = document.createElement('label');
      label.setAttribute('for', `field-${f.id}`);
      label.textContent = f.label + (f.type === 'context' ? ' (context only)' : '');
      wrap.appendChild(label);

      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        input.id = `field-${f.id}`;
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '— Select —';
        input.appendChild(blank);
        f.options.forEach((o) => {
          const opt = document.createElement('option');
          opt.value = o.label;
          opt.textContent = o.label;
          input.appendChild(opt);
        });
      } else if (f.type === 'context') {
        input = document.createElement('select');
        input.id = `field-${f.id}`;
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '— Select —';
        input.appendChild(blank);
        f.options.forEach((label) => {
          const opt = document.createElement('option');
          opt.value = label;
          opt.textContent = label;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.id = `field-${f.id}`;
        input.placeholder = f.unit ? `Value in ${f.unit}` : '';
      }

      input.value = currentAnswers[f.id] || '';
      input.addEventListener('input', () => {
        currentAnswers[f.id] = input.value;
      });
      wrap.appendChild(input);

      if (f.help) {
        const help = document.createElement('p');
        help.className = 'field-help';
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      grid.appendChild(wrap);
    });

    details.appendChild(grid);
    els.fieldsContainer.appendChild(details);
  });
}

function renderResult() {
  const dealType = els.dealType.value;
  currentResult = calculateScore(dealType, currentAnswers);
  const band = riskBand(currentResult.overall);

  els.resultCard.hidden = false;
  els.scoreNumber.textContent = currentResult.overall;
  els.scoreBand.textContent = band.label;
  els.scoreBand.className = 'score-band ' + band.className;
  els.scoreProgress.style.width = currentResult.overall + '%';
  els.scoreProgress.className = 'score-progress-bar ' + band.className;
  els.scoreCompleteness.textContent = `${currentResult.answered} of ${currentResult.totalFields} fields answered`;
  els.incompleteWarning.hidden = currentResult.answered === currentResult.totalFields;

  els.categoryBreakdown.innerHTML = '';
  currentResult.categories.forEach((c) => {
    if (c.total === 0) return;
    const row = document.createElement('div');
    row.className = 'category-row';
    row.innerHTML = `
      <div class="category-row-label">
        <span>${c.name}</span>
        <span>${c.score}/100</span>
      </div>
      <div class="category-row-bar">
        <div class="category-row-fill" style="width:${c.score}%"></div>
      </div>
      <div class="category-row-meta">${c.answered} of ${c.total} answered</div>
    `;
    els.categoryBreakdown.appendChild(row);
  });

  els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetForm() {
  currentAnswers = {};
  currentResult = null;
  els.dealName.value = '';
  els.resultCard.hidden = true;
  renderFields();
}

function loadDeals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveDeals(deals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function saveCurrentDeal() {
  if (!currentResult) return;
  const name = els.dealName.value.trim() || 'Untitled deal';
  const deals = loadDeals();
  deals.unshift({
    id: Date.now().toString(36),
    name,
    dealType: els.dealType.value,
    score: currentResult.overall,
    categories: currentResult.categories,
    answered: currentResult.answered,
    totalFields: currentResult.totalFields,
    answers: currentAnswers,
    savedAt: new Date().toISOString(),
  });
  saveDeals(deals);
  switchTab('saved');
}

function renderSavedDeals() {
  const deals = loadDeals();
  els.savedDealsList.innerHTML = '';
  els.savedEmpty.hidden = deals.length > 0;

  deals.forEach((deal) => {
    const row = document.createElement('div');
    row.className = 'saved-deal-row';

    if (deal.status === 'pending') {
      const fileSummary = deal.files.length === 1 ? deal.files[0].name : `${deal.files.length} files`;
      row.innerHTML = `
        <div class="saved-deal-main">
          <div class="saved-deal-name">${escapeHtml(deal.name)}</div>
          <div class="saved-deal-meta">${deal.dealType} · ${new Date(deal.savedAt).toLocaleDateString()} · ${escapeHtml(fileSummary)}</div>
        </div>
        <div class="saved-deal-status">Pending Extraction</div>
        <button class="btn-link btn-delete" data-id="${deal.id}">Delete</button>
      `;
    } else {
      const band = riskBand(deal.score);
      const sourceTag = deal.source === 'upload' ? ' · AI-extracted' : '';
      const unresolvedTag = deal.unresolved && deal.unresolved.length ? ` · ${deal.unresolved.length} unresolved` : '';
      row.innerHTML = `
        <div class="saved-deal-main">
          <div class="saved-deal-name">${escapeHtml(deal.name)}</div>
          <div class="saved-deal-meta">${deal.dealType} · ${new Date(deal.savedAt).toLocaleDateString()} · ${deal.answered}/${deal.totalFields} fields${sourceTag}${unresolvedTag}</div>
        </div>
        <div class="saved-deal-score ${band.className}">${deal.score}</div>
        <button class="btn-link btn-load" data-id="${deal.id}">Load</button>
        <button class="btn-link btn-delete" data-id="${deal.id}">Delete</button>
      `;
    }
    els.savedDealsList.appendChild(row);
  });

  els.savedDealsList.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      saveDeals(loadDeals().filter((d) => d.id !== id));
      renderSavedDeals();
    });
  });

  els.savedDealsList.querySelectorAll('.btn-load').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const deal = loadDeals().find((d) => d.id === id);
      if (!deal) return;
      currentAnswers = { ...deal.answers };
      els.dealName.value = deal.name;
      els.dealType.value = deal.dealType;
      switchTab('new');
      document.querySelector('.manual-entry').open = true;
      renderFields();
      renderResult();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

els.tabNew.addEventListener('click', () => switchTab('new'));
els.tabSaved.addEventListener('click', () => switchTab('saved'));
els.dealType.addEventListener('change', () => {
  currentAnswers = {};
  els.resultCard.hidden = true;
  renderFields();
});
els.calcBtn.addEventListener('click', renderResult);
els.resetBtn.addEventListener('click', resetForm);
els.saveDealBtn.addEventListener('click', saveCurrentDeal);

renderFields();
