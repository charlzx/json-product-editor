// DOM Elements
const uploadContainer = document.getElementById('upload-container');
const fileInput = document.getElementById('file-input');
const editorContainer = document.getElementById('editor-container');
const tableBody = document.getElementById('product-table-body');
const addProductBtn = document.getElementById('add-product-btn');
const downloadBtn = document.getElementById('download-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const sortSelect = document.getElementById('sort-select');
const shuffleBtn = document.getElementById('shuffle-btn');
const searchInput = document.getElementById('search-input');
const brandFilter = document.getElementById('brand-filter');
const categoryFilter = document.getElementById('category-filter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const bulkEditBtn = document.getElementById('bulk-edit-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Modal Elements
const descriptionModal = document.getElementById('description-modal');
const specsModal = document.getElementById('specs-modal');
const featuresModal = document.getElementById('features-modal');
const deleteModal = document.getElementById('delete-modal');
const bulkEditModal = document.getElementById('bulk-edit-modal');
const descriptionTextarea = document.getElementById('description-textarea');
const specsList = document.getElementById('specs-list');
const featuresList = document.getElementById('features-list');
const deleteModalTitle = document.getElementById('delete-modal-title');
const deleteModalText = document.getElementById('delete-modal-text');

// App State
let allProducts = [];
let displayedProducts = [];
let currentFileName = 'products.json';
let currentlyEditingIndex = -1;
let indexToDelete = -1;
let selectedProductIds = new Set();
let history = [];
let historyIndex = -1;

// --- Toast Notification Function ---
function showToast(message, type = 'info') {
   const toastContainer = document.getElementById('toast-container');
   const toast = document.createElement('div');
   toast.className = `toast ${type}`;
   toast.textContent = message;
   toastContainer.appendChild(toast);
   setTimeout(() => { toast.remove(); }, 4000);
}

// --- Event Listeners ---
uploadContainer.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));
['dragover', 'dragleave', 'drop'].forEach(eventName => {
   uploadContainer.addEventListener(eventName, (e) => {
         e.preventDefault();
         e.stopPropagation();
         if (eventName === 'dragover') uploadContainer.classList.add('border-orange-500', 'bg-orange-50');
         if (eventName === 'dragleave' || eventName === 'drop') uploadContainer.classList.remove('border-orange-500', 'bg-orange-50');
         if (eventName === 'drop') {
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/json') handleFile(file);
            else if (file) showToast('Invalid file type. Please upload a .json file.', 'error');
         }
   });
});

addProductBtn.addEventListener('click', addProduct);
downloadBtn.addEventListener('click', downloadJson);
downloadCsvBtn.addEventListener('click', downloadCsv);
sortSelect.addEventListener('change', handleSort);
shuffleBtn.addEventListener('click', shuffleProducts);
searchInput.addEventListener('input', filterAndRender);
brandFilter.addEventListener('change', filterAndRender);
categoryFilter.addEventListener('change', filterAndRender);
selectAllCheckbox.addEventListener('change', handleSelectAll);
deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
bulkEditBtn.addEventListener('click', () => bulkEditModal.style.display = 'flex');
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Modal Listeners
document.getElementById('save-description').addEventListener('click', saveDescription);
document.getElementById('cancel-description').addEventListener('click', () => descriptionModal.style.display = 'none');
document.getElementById('save-specs').addEventListener('click', saveSpecs);
document.getElementById('cancel-specs').addEventListener('click', () => specsModal.style.display = 'none');
document.getElementById('add-spec-btn').addEventListener('click', () => specsList.appendChild(createKeyValueItem('', '')));
document.getElementById('save-features').addEventListener('click', saveFeatures);
document.getElementById('cancel-features').addEventListener('click', () => featuresModal.style.display = 'none');
document.getElementById('add-feature-btn').addEventListener('click', () => featuresList.appendChild(createFeatureItem('')));
document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
document.getElementById('cancel-delete').addEventListener('click', () => deleteModal.style.display = 'none');
document.getElementById('apply-bulk-edit').addEventListener('click', applyBulkEdit);
document.getElementById('cancel-bulk-edit').addEventListener('click', () => bulkEditModal.style.display = 'none');

// Delegated Event Listeners for Table Body
tableBody.addEventListener('change', handleTableChange);
tableBody.addEventListener('click', handleTableClick);

// --- Core Functions ---
function handleFile(file) {
   currentFileName = file.name;
   document.getElementById('file-name').textContent = `Loaded: ${file.name}`;
   document.getElementById('upload-text').textContent = 'File loaded successfully. You can now edit below or upload another file.';
   
   const reader = new FileReader();
   reader.onload = (e) => {
         try {
            const products = JSON.parse(e.target.result);
            products.forEach((p, i) => { if (p.id === undefined || p.id === null || p.id === '') p.id = `prod-${Date.now()}-${i}`; });
            saveState(products);
            editorContainer.classList.remove('hidden');
            showToast(`Successfully loaded ${file.name}`, 'success');
         } catch (error) { 
            showToast('Error parsing JSON file. Please check the file format.', 'error');
         }
   };
   reader.readAsText(file);
}

function renderTable() {
   tableBody.innerHTML = '';
   if (displayedProducts.length === 0) {
         tableBody.innerHTML = `<tr><td colspan="12" class="text-center p-8 text-gray-500">No products match your current filters.</td></tr>`;
         updateSelectionButtonsState();
         return;
   }
   displayedProducts.forEach((product, index) => {
         const row = document.createElement('tr');
         row.className = 'border-b border-gray-200 hover:bg-gray-50';
         const originalIndex = allProducts.findIndex(p => p.id === product.id);
         const imgSrc = product.img && (product.img.startsWith('data:image') || product.img.startsWith('http')) ? product.img : 'https://placehold.co/100x80/f3f4f6/9ca3af?text=Upload';
         const isChecked = selectedProductIds.has(product.id);

         row.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" class="product-checkbox" data-id="${product.id}" ${isChecked ? 'checked' : ''}></td>
            <td class="p-3 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="p-3 w-40"><input type="text" class="table-input" value="${product.id}" data-index="${originalIndex}" data-key="id"></td>
            <td class="p-3 w-48"><input type="text" class="table-input" value="${product.name || ''}" data-index="${originalIndex}" data-key="name"></td>
            <td class="p-3 w-32"><input type="text" class="table-input" value="${product.brand || ''}" data-index="${originalIndex}" data-key="brand"></td>
            <td class="p-3 w-32"><input type="text" class="table-input" value="${product.category || ''}" data-index="${originalIndex}" data-key="category"></td>
            <td class="p-3 w-32"><input type="number" step="0.01" class="table-input" value="${product.price || 0}" data-index="${originalIndex}" data-key="price"></td>
            <td class="p-3 w-40">
               <div class="flex items-center gap-2">
                     <img src="${imgSrc}" class="w-16 h-12 object-cover rounded-md bg-gray-100" onerror="this.src='https://placehold.co/100x80/f3f4f6/9ca3af?text=Error'">
                     <label class="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-semibold">
                        Upload
                        <input type="file" class="hidden" accept="image/*" data-index="${originalIndex}" data-key="img-upload">
                     </label>
               </div>
            </td>
            <td class="p-3 text-center w-24"><button class="text-blue-600 font-semibold" data-action="edit-description" data-index="${originalIndex}">Edit</button></td>
            <td class="p-3 text-center w-24"><button class="text-blue-600 font-semibold" data-action="edit-specs" data-index="${originalIndex}">Edit</button></td>
            <td class="p-3 text-center w-24"><button class="text-blue-600 font-semibold" data-action="edit-features" data-index="${originalIndex}">Edit</button></td>
            <td class="p-3 text-center w-24"><button class="text-red-500 font-bold" data-action="delete" data-index="${originalIndex}">Delete</button></td>
         `;
         tableBody.appendChild(row);
   });
   updateSelectionButtonsState();
}

// --- Delegated Event Handlers for Table ---
function handleTableChange(e) {
   const target = e.target;
   if (target.matches('input[type="text"], input[type="number"]')) {
         handleInputChange(e);
   } else if (target.matches('input[type="file"]')) {
         handleImageUpload(e);
   } else if (target.matches('.product-checkbox')) {
         const productId = target.dataset.id;
         if (target.checked) {
            selectedProductIds.add(productId);
         } else {
            selectedProductIds.delete(productId);
         }
         updateSelectionButtonsState();
   }
}

function handleTableClick(e) {
   const target = e.target;
   if (target.tagName === 'BUTTON' && target.dataset.action) {
         handleTableButtonClick(e);
   }
}

function handleInputChange(e) {
   const index = e.target.dataset.index;
   const key = e.target.dataset.key;
   let value = e.target.value;
   const newProducts = JSON.parse(JSON.stringify(allProducts));

   if (key === 'price') {
         value = parseFloat(value);
   }

   if (key === 'id') {
         const oldId = newProducts[index].id;
         const isDuplicate = newProducts.some((p, i) => p.id === value && i != index);
         if (isDuplicate) {
            showToast(`Error: ID "${value}" already exists.`, 'error');
            e.target.value = oldId;
            return;
         }
         if (selectedProductIds.has(oldId)) {
            selectedProductIds.delete(oldId);
            selectedProductIds.add(value);
         }
   }
   newProducts[index][key] = value;
   saveState(newProducts);
}

function handleImageUpload(e) {
   const index = e.target.dataset.index;
   const file = e.target.files[0];
   if (file) {
         const reader = new FileReader();
         reader.onload = (event) => {
            const newProducts = JSON.parse(JSON.stringify(allProducts));
            newProducts[index].img = event.target.result;
            saveState(newProducts);
         };
         reader.readAsDataURL(file);
   }
}

function handleTableButtonClick(e) {
   const action = e.target.dataset.action;
   const index = e.target.dataset.index;
   if (action === 'delete') {
         indexToDelete = index;
         deleteModalTitle.textContent = 'Delete Product';
         deleteModalText.textContent = `Are you sure you want to delete "${allProducts[index].name}"? This action cannot be undone.`;
         deleteModal.style.display = 'flex';
   } else if (action === 'edit-description') openDescriptionModal(index);
   else if (action === 'edit-specs') openSpecsModal(index);
   else if (action === 'edit-features') openFeaturesModal(index);
}

function confirmDelete() {
   let newProducts = JSON.parse(JSON.stringify(allProducts));
   if (indexToDelete > -1) { // Single delete
         const deletedProduct = newProducts.splice(indexToDelete, 1);
         selectedProductIds.delete(deletedProduct[0].id);
         showToast(`Product "${deletedProduct[0].name}" deleted.`, 'info');
   } else { // Multi-delete
         const count = selectedProductIds.size;
         newProducts = newProducts.filter(p => !selectedProductIds.has(p.id));
         selectedProductIds.clear();
         showToast(`${count} products deleted.`, 'info');
   }
   
   indexToDelete = -1;
   deleteModal.style.display = 'none';
   saveState(newProducts);
}

// --- Modal Logic ---
function saveModalData(key, value) {
   const newProducts = JSON.parse(JSON.stringify(allProducts));
   newProducts[currentlyEditingIndex][key] = value;
   saveState(newProducts);
}
function openDescriptionModal(index) { currentlyEditingIndex = index; descriptionTextarea.value = allProducts[index].description || ''; descriptionModal.style.display = 'flex'; }
function saveDescription() { saveModalData('description', descriptionTextarea.value); descriptionModal.style.display = 'none'; showToast('Description saved.', 'success'); }
function openSpecsModal(index) { currentlyEditingIndex = index; specsList.innerHTML = ''; const specs = allProducts[index].specs || {}; if (Object.keys(specs).length > 0) { for (const key in specs) { specsList.appendChild(createKeyValueItem(key, specs[key])); } } else { specsList.appendChild(createKeyValueItem('', '')); } specsModal.style.display = 'flex'; }
function createKeyValueItem(key, value) { const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = `<input type="text" class="table-input modal-input" placeholder="Key (e.g., Power)" value="${key}"><input type="text" class="table-input modal-input" placeholder="Value (e.g., 450W)" value="${value}"><button class="text-red-500 font-bold text-2xl p-1 leading-none flex items-center justify-center hover:bg-red-100 rounded-full w-6 h-6">&times;</button>`; div.querySelector('button').onclick = () => div.remove(); return div; }
function saveSpecs() { const newSpecs = {}; specsList.querySelectorAll('.list-item').forEach(item => { const key = item.children[0].value.trim(); const value = item.children[1].value.trim(); if (key) newSpecs[key] = value; }); saveModalData('specs', newSpecs); specsModal.style.display = 'none'; showToast('Specs saved.', 'success'); }
function openFeaturesModal(index) { currentlyEditingIndex = index; featuresList.innerHTML = ''; const features = allProducts[index].features || []; if (features.length > 0) { features.forEach(feature => featuresList.appendChild(createFeatureItem(feature))); } else { featuresList.appendChild(createFeatureItem('')); } featuresModal.style.display = 'flex'; }
function createFeatureItem(value) { const div = document.createElement('div'); div.className = 'feature-item'; div.innerHTML = `<input type="text" class="table-input modal-input" value="${value}"><button class="text-red-500 font-bold text-2xl p-1 leading-none flex items-center justify-center hover:bg-red-100 rounded-full w-6 h-6">&times;</button>`; div.querySelector('button').onclick = () => div.remove(); return div; }
function saveFeatures() { const newFeatures = Array.from(featuresList.querySelectorAll('.modal-input')).map(input => input.value.trim()).filter(Boolean); saveModalData('features', newFeatures); featuresModal.style.display = 'none'; showToast('Features saved.', 'success'); }

// --- Data Manipulation & History ---
function saveState(newProducts, fromUndoRedo = false) {
   if (!fromUndoRedo) {
         history = history.slice(0, historyIndex + 1);
         history.push(JSON.stringify(newProducts));
         historyIndex++;
   }
   allProducts = newProducts;
   populateFilters();
   filterAndRender();
   updateUndoRedoState();
}

function undo() {
   if (historyIndex > 0) {
         historyIndex--;
         const prevState = JSON.parse(history[historyIndex]);
         saveState(prevState, true);
         showToast('Undo successful.', 'info');
   }
}

function redo() {
   if (historyIndex < history.length - 1) {
         historyIndex++;
         const nextState = JSON.parse(history[historyIndex]);
         saveState(nextState, true);
         showToast('Redo successful.', 'info');
   }
}

function updateUndoRedoState() {
   undoBtn.disabled = historyIndex <= 0;
   redoBtn.disabled = historyIndex >= history.length - 1;
}

function addProduct() {
   const newId = `prod-${Date.now()}`;
   const newProducts = JSON.parse(JSON.stringify(allProducts));
   newProducts.unshift({ id: newId, name: "New Product", brand: "", category: "", price: 0, description: "", img: "", specs: {}, features: [] });
   saveState(newProducts);
   showToast('New product added at the top.', 'success');
}

function handleSort() {
   const [key, order] = sortSelect.value.split('_');
   const newProducts = JSON.parse(JSON.stringify(allProducts));
   
   if (key === 'price') {
         newProducts.sort((a, b) => {
            const valA = a.price || 0;
            const valB = b.price || 0;
            return order === 'asc' ? valA - valB : valB - valA;
         });
   } else {
         const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
         newProducts.sort((a, b) => {
            const valA = a[key] || '';
            const valB = b[key] || '';
            const result = collator.compare(String(valA), String(valB));
            return order === 'asc' ? result : -result;
         });
   }

   saveState(newProducts);
   sortSelect.value = 'default';
}

function shuffleProducts() {
   const newProducts = JSON.parse(JSON.stringify(allProducts));
   for (let i = newProducts.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [newProducts[i], newProducts[j]] = [newProducts[j], newProducts[i]];
   }
   saveState(newProducts);
   showToast('Products have been shuffled!', 'info');
}

function populateFilters() {
   const brands = ["All", ...new Set(allProducts.map(p => p.brand).filter(Boolean).sort())];
   const categories = ["All", ...new Set(allProducts.map(p => p.category).filter(Boolean).sort())];
   brandFilter.innerHTML = brands.map(b => `<option value="${b}">${b}</option>`).join('');
   categoryFilter.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterAndRender() {
   const searchTerm = searchInput.value.toLowerCase();
   const selectedBrand = brandFilter.value;
   const selectedCategory = categoryFilter.value;

   displayedProducts = allProducts.filter(p => {
         const matchesBrandFilter = selectedBrand === 'All' || p.brand === selectedBrand;
         const matchesCategoryFilter = selectedCategory === 'All' || p.category === selectedCategory;
         if (!matchesBrandFilter || !matchesCategoryFilter) return false;
         if (searchTerm === '') return true;
         const searchableContent = [ p.name, p.brand, p.category, p.description, ...(p.features || []), ...Object.values(p.specs || {}) ].join(' ').toLowerCase();
         return searchableContent.includes(searchTerm);
   });

   const allVisibleIds = new Set(displayedProducts.map(p => p.id));
   selectAllCheckbox.checked = displayedProducts.length > 0 && displayedProducts.every(p => selectedProductIds.has(p.id));

   renderTable();
}

// --- Selection & Bulk Actions ---
function handleSelectAll(e) {
   const isChecked = e.target.checked;
   const allVisibleIds = displayedProducts.map(p => p.id);
   allVisibleIds.forEach(id => {
         if (isChecked) { selectedProductIds.add(id); } 
         else { selectedProductIds.delete(id); }
   });
   renderTable();
}

function handleDeleteSelected() {
   if (selectedProductIds.size === 0) { showToast('No products selected.', 'error'); return; }
   indexToDelete = -1; // Multi-delete mode
   deleteModalTitle.textContent = `Delete ${selectedProductIds.size} Products`;
   deleteModalText.textContent = `Are you sure you want to delete the selected ${selectedProductIds.size} products? This action cannot be undone.`;
   deleteModal.style.display = 'flex';
}

function applyBulkEdit() {
   const field = document.getElementById('bulk-edit-field').value;
   let value = document.getElementById('bulk-edit-value').value;
   const count = selectedProductIds.size;

   if (count === 0) {
         showToast('No products selected for bulk edit.', 'error');
         return;
   }

   if (field === 'price') {
         value = parseFloat(value);
         if (isNaN(value)) {
            showToast('Invalid price. Please enter a number.', 'error');
            return;
         }
   }

   const newProducts = JSON.parse(JSON.stringify(allProducts));
   newProducts.forEach(p => {
         if (selectedProductIds.has(p.id)) {
            p[field] = value;
         }
   });
   
   saveState(newProducts);
   bulkEditModal.style.display = 'none';
   document.getElementById('bulk-edit-value').value = '';
   showToast(`Updated ${field} for ${count} products.`, 'success');
}

function updateSelectionButtonsState() {
   const count = selectedProductIds.size;
   if (count > 0) {
         deleteSelectedBtn.classList.remove('hidden');
         bulkEditBtn.classList.remove('hidden');
         deleteSelectedBtn.textContent = `Delete Selected (${count})`;
   } else {
         deleteSelectedBtn.classList.add('hidden');
         bulkEditBtn.classList.add('hidden');
   }

   const allVisibleIds = new Set(displayedProducts.map(p => p.id));
   selectAllCheckbox.checked = displayedProducts.length > 0 && displayedProducts.every(p => selectedProductIds.has(p.id));
   selectAllCheckbox.indeterminate = displayedProducts.length > 0 && !selectAllCheckbox.checked && displayedProducts.some(p => selectedProductIds.has(p.id));
}

// --- Exporting ---
function downloadJson() {
   const jsonString = JSON.stringify(allProducts, null, 4);
   const blob = new Blob([jsonString], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = currentFileName;
   a.click();
   URL.revokeObjectURL(url);
   showToast('Downloading JSON file...', 'success');
}

function downloadCsv() {
   const headers = ['id', 'name', 'brand', 'category', 'price', 'description', 'img', 'specs', 'features'];
   const csvRows = [headers.join(',')];

   allProducts.forEach(product => {
         const values = headers.map(header => {
            let value = product[header];
            if (typeof value === 'object' && value !== null) {
               value = JSON.stringify(value);
            }
            const stringValue = String(value || '');
            // Escape quotes and wrap in quotes if it contains commas or newlines
            if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
               return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
         });
         csvRows.push(values.join(','));
   });

   const csvString = csvRows.join('\n');
   const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = currentFileName.replace('.json', '.csv');
   a.click();
   URL.revokeObjectURL(url);
   showToast('Downloading CSV file...', 'success');
}