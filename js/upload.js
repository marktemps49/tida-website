/* TIDA Credit Checker — document upload UI (no backend yet: submitting
   records a "pending extraction" deal; it does not analyse file content). */

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const submitBtn = document.getElementById('submit-deal-btn');

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

function submitDeal() {
  if (selectedFiles.length === 0) return;

  const nameInput = els.dealName;
  const name = nameInput.value.trim() || selectedFiles[0].name.replace(/\.[^./]+$/, '');

  const deals = loadDeals();
  deals.unshift({
    id: Date.now().toString(36),
    name,
    dealType: els.dealType.value,
    status: 'pending',
    files: selectedFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    savedAt: new Date().toISOString(),
  });
  saveDeals(deals);

  selectedFiles = [];
  renderFileList();
  nameInput.value = '';
  switchTab('saved');
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
