/* TIDA Credit Checker — document upload UI. Submits files to the
   methodology server (see server/), which runs CREDIT_METHODOLOGY.md
   against them via the Claude API and returns extracted scoring
   parameters. Falls back to a "pending extraction" record if the server
   is unreachable, so an upload is never silently lost. */

// TODO: point this at your deployed server (see server/README.md) once
// it's hosted somewhere other than localhost.
const SCORING_API_URL = 'http://localhost:8787/api/score-deal';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const submitBtn = document.getElementById('submit-deal-btn');
const uploadStatusEl = document.getElementById('upload-status');

let selectedFiles = [];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDuplicate(file) {
  return selectedFiles.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified);
}

function addFiles(fileList) {
  Array.from(fileList).forEach((file) => {
    if (!isDuplicate(file)) selectedFiles.push(file);
  });
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = '';
  fileListEl.hidden = selectedFiles.length === 0;

  selectedFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <span class="file-row-name">${escapeHtml(file.name)}</span>
      <span class="file-row-size">${formatBytes(file.size)}</span>
      <button type="button" class="file-row-remove" data-idx="${idx}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
    `;
    fileListEl.appendChild(row);
  });

  fileListEl.querySelectorAll('.file-row-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.getAttribute('data-idx')), 1);
      renderFileList();
    });
  });

  submitBtn.disabled = selectedFiles.length === 0;
}

function setUploadStatus(text, isError) {
  uploadStatusEl.hidden = !text;
  uploadStatusEl.textContent = text;
  uploadStatusEl.classList.toggle('upload-status-error', Boolean(isError));
}

function savePendingDeal(name, dealType, files, note) {
  const deals = loadDeals();
  deals.unshift({
    id: Date.now().toString(36),
    name,
    dealType,
    status: 'pending',
    files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    note,
    savedAt: new Date().toISOString(),
  });
  saveDeals(deals);
}

async function submitDeal() {
  if (selectedFiles.length === 0) return;

  const nameInput = els.dealName;
  const dealType = els.dealType.value;
  const typedName = nameInput.value.trim();
  const fallbackName = typedName || selectedFiles[0].name.replace(/\.[^./]+$/, '');
  const filesForThisSubmit = selectedFiles;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Scoring…';
  setUploadStatus('Uploading documents and running the methodology agent — this can take a minute for larger deal packs.', false);

  const formData = new FormData();
  filesForThisSubmit.forEach((f) => formData.append('files', f));
  if (typedName) formData.append('dealName', typedName);
  formData.append('dealType', dealType);

  try {
    const res = await fetch(SCORING_API_URL, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);

    const result = calculateScore(data.dealType, data.answers || {});
    const deals = loadDeals();
    deals.unshift({
      id: Date.now().toString(36),
      name: data.dealName || fallbackName,
      dealType: data.dealType,
      source: 'upload',
      score: result.overall,
      categories: result.categories,
      answered: result.answered,
      totalFields: result.totalFields,
      answers: data.answers,
      extraction: data.extraction || {},
      unresolved: data.unresolved || [],
      notes: data.notes || '',
      warnings: data.warnings || [],
      savedAt: new Date().toISOString(),
    });
    saveDeals(deals);

    selectedFiles = [];
    renderFileList();
    nameInput.value = '';
    setUploadStatus('', false);
    switchTab('saved');
  } catch (err) {
    setUploadStatus(`Could not score this deal automatically (${err.message}). It's been saved as pending — retry once the scoring server is reachable, or use "Enter deal details manually instead" below.`, true);
    savePendingDeal(fallbackName, dealType, filesForThisSubmit, err.message);
  } finally {
    submitBtn.disabled = selectedFiles.length === 0;
    submitBtn.textContent = 'Submit for Scoring';
  }
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

submitBtn.addEventListener('click', submitDeal);
