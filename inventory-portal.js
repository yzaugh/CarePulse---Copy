const INVENTORY_CATEGORIES = [
  'Medicine',
  'Medical Supplies',
  'Utility and Maintenance Supplies'
];

const INVENTORY_SECTIONS = {
  medicine: { category: 'Medicine', tableId: 'medicine-table', title: 'Medicine' },
  'medical-supplies': { category: 'Medical Supplies', tableId: 'medical-supplies-table', title: 'Medical Supplies' },
  'utility-supplies': {
    category: 'Utility and Maintenance Supplies',
    tableId: 'utility-supplies-table',
    title: 'Utility and Maintenance Supplies'
  }
};

let inventoryItems = [];
let inventoryPatients = [];
let inventoryData = {};
let activeInventorySection = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requireRole(UserRoles.INVENTORY_MANAGER)) return;
  initializeInventoryPortal();
  loadSection('dashboard');
});

function initializeInventoryPortal() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
  }
}

function loadSection(sectionName, navItem = null) {
  activeInventorySection = sectionName;
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });

  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) targetSection.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  (navItem || document.querySelector(`.nav-item[data-section="${sectionName}"]`))?.classList.add('active');

  const titles = {
    dashboard: 'Inventory Dashboard',
    medicine: 'Medicine',
    'medical-supplies': 'Medical Supplies',
    'utility-supplies': 'Utility and Maintenance Supplies'
  };
  document.getElementById('page-title').innerText = titles[sectionName] || titles.dashboard;
  loadInventoryData(sectionName);
}

async function loadInventoryData(sectionName) {
  const responseBodies = sectionName === 'dashboard'
    ? ['medicine-dispense-summary', 'expiring-batches', 'expired-batches', 'recent-stock-activity']
    : [INVENTORY_SECTIONS[sectionName]?.tableId];
  responseBodies.filter(Boolean).forEach(tableId => {
    document.getElementById(tableId).innerHTML =
      '<tr><td colspan="11" style="text-align: center;">Loading inventory...</td></tr>';
  });

  try {
    const response = await fetch('inventory-items.php');
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.items)) {
      throw new Error(result.error || 'Unable to load inventory.');
    }

    inventoryData = result;
    inventoryItems = result.items;
    inventoryPatients = Array.isArray(result.patients) ? result.patients : [];
    renderInventoryDashboard();
    if (sectionName !== 'dashboard') renderInventorySection(sectionName);
  } catch (error) {
    if (sectionName === 'dashboard') {
      ['stock-numbers', 'received-today', 'dispensed-today', 'expiring-batches-count',
        'expired-units', 'medicine-count'].forEach(id => {
        document.getElementById(id).innerText = '-';
      });
    }
    responseBodies.filter(Boolean).forEach(tableId => {
      const tbody = document.getElementById(tableId);
      if (tbody) tbody.innerHTML =
        `<tr><td colspan="11" style="text-align: center;">${escapeInventoryHtml(error.message)}</td></tr>`;
    });
  }
}

function renderInventoryDashboard() {
  const stockNumbers = inventoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const medicineItems = inventoryItems.filter(item => item.category === 'Medicine');
  const expiringBatches = inventoryData.expiringBatches || [];
  const expiredBatches = inventoryData.expiredBatches || [];

  document.getElementById('stock-numbers').innerText = stockNumbers.toLocaleString();
  document.getElementById('received-today').innerText = Number(inventoryData.receivedToday || 0).toLocaleString();
  document.getElementById('dispensed-today').innerText = Number(inventoryData.dispensedToday || 0).toLocaleString();
  document.getElementById('expiring-batches-count').innerText =
    Number(inventoryData.expiringBatchCount ?? expiringBatches.length).toLocaleString();
  document.getElementById('expired-units').innerText = Number(inventoryData.expiredUnits || 0).toLocaleString();
  document.getElementById('medicine-count').innerText = medicineItems.length.toLocaleString();

  document.getElementById('medicine-dispense-summary').innerHTML = medicineItems.length
    ? medicineItems.map(item => `
      <tr>
        <td>${escapeInventoryHtml(item.itemName)}</td>
        <td>${Number(item.patientCount || 0).toLocaleString()}</td>
        <td>${Number(item.dispensedQuantity || 0).toLocaleString()} ${escapeInventoryHtml(item.unit || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="text-align: center;">No medicines in inventory.</td></tr>';

  document.getElementById('expiring-batches').innerHTML = expiringBatches.length
    ? expiringBatches.map(batch => `
      <tr>
        <td>${escapeInventoryHtml(batch.itemName)}</td>
        <td>${escapeInventoryHtml(batch.category)}</td>
        <td>${formatDate(batch.expiryDate)}</td>
        <td>${Number(batch.quantity).toLocaleString()} ${escapeInventoryHtml(batch.unit || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" style="text-align: center;">No batches expiring in the next 30 days.</td></tr>';

  document.getElementById('expired-batches').innerHTML = expiredBatches.length
    ? expiredBatches.map(batch => `
      <tr>
        <td>${escapeInventoryHtml(batch.itemName)}</td>
        <td>${escapeInventoryHtml(batch.category)}</td>
        <td>${formatDate(batch.expiryDate)}</td>
        <td>${Number(batch.quantity).toLocaleString()} ${escapeInventoryHtml(batch.unit || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" style="text-align: center;">No expired commodities recorded.</td></tr>';

  const activity = inventoryData.recentActivity || [];
  document.getElementById('recent-stock-activity').innerHTML = activity.length
    ? activity.map(entry => `
      <tr>
        <td>${escapeInventoryHtml(entry.occurredAt)}</td>
        <td>${escapeInventoryHtml(entry.movementType)}</td>
        <td>${escapeInventoryHtml(entry.itemName)}</td>
        <td>${Number(entry.quantity).toLocaleString()} ${escapeInventoryHtml(entry.unit || '')}</td>
        <td>${escapeInventoryHtml(entry.patientName || '—')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" style="text-align: center;">No stock activity recorded yet.</td></tr>';
}

function renderInventorySection(sectionName) {
  const section = INVENTORY_SECTIONS[sectionName];
  if (!section) return;
  const items = inventoryItems.filter(item => item.category === section.category);
  const tbody = document.getElementById(section.tableId);

  tbody.innerHTML = items.length
    ? items.map(item => {
      const medicine = item.category === 'Medicine';
      const receiveButton = `<button class="btn-small" type="button" onclick="openInventoryMovementForm(${item.id}, 'Received')">Received</button>`;
      const dispenseButton = medicine
        ? `<button class="btn-small" type="button" onclick="openInventoryMovementForm(${item.id}, 'Dispensed')">Dispense</button>`
        : '';
      return `
        <tr>
          <td>${Number(item.id)}</td>
          <td>${escapeInventoryHtml(item.itemName)}</td>
          <td>${Number(item.quantity).toLocaleString()}</td>
          <td>${escapeInventoryHtml(item.unit || '—')}</td>
          <td>${formatInventoryCurrency(item.unitCost)}</td>
          <td>${item.expiryDate ? formatDate(item.expiryDate) : '—'}</td>
          <td>${Number(item.receivedQuantity || 0).toLocaleString()}</td>
          ${medicine ? `<td>${Number(item.dispensedQuantity || 0).toLocaleString()}</td>
                        <td>${Number(item.patientCount || 0).toLocaleString()}</td>` : ''}
          <td>${formatDate(item.lastUpdated)}</td>
          <td>
            ${receiveButton}
            ${dispenseButton}
            <button class="btn-small" type="button" onclick="openInventoryItemForm('${section.category}', ${item.id})">Edit</button>
            <button class="btn-small danger" type="button" onclick="deleteInventoryItem(${item.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('')
    : `<tr><td colspan="${sectionName === 'medicine' ? 11 : 9}" style="text-align: center;">No ${escapeInventoryHtml(section.title.toLowerCase())} items yet</td></tr>`;
}

function openInventoryItemForm(category, itemId = null) {
  const item = itemId === null
    ? null
    : inventoryItems.find(existingItem => Number(existingItem.id) === Number(itemId));
  if (itemId !== null && !item) {
    alert('Inventory item not found. Refresh the category and try again.');
    return;
  }
  if (document.getElementById('inventory-item-modal')) return;

  const categoryOptions = INVENTORY_CATEGORIES.map(optionCategory =>
    `<option value="${escapeInventoryHtml(optionCategory)}" ${category === optionCategory ? 'selected' : ''}>${escapeInventoryHtml(optionCategory)}</option>`
  ).join('');
  const modal = document.createElement('div');
  modal.id = 'inventory-item-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <section class="modal-content" role="dialog" aria-modal="true" aria-labelledby="inventory-item-title">
      <div class="modal-header">
        <h2 id="inventory-item-title">${item ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2>
        <button type="button" aria-label="Close" onclick="closeInventoryItemForm()" style="background:none;border:none;cursor:pointer;font-size:24px;">&times;</button>
      </div>
      <form id="inventory-item-form">
        <div class="modal-body">
          <div class="form-group">
            <label for="inventory-item-name">Item name *</label>
            <input id="inventory-item-name" name="itemName" type="text" maxlength="150" required value="${escapeInventoryHtml(item?.itemName || '')}">
          </div>
          <div class="form-group">
            <label for="inventory-item-category">Category *</label>
            <select id="inventory-item-category" name="category" required>${categoryOptions}</select>
          </div>
          <div class="form-group">
            <label for="inventory-item-quantity">${item ? 'Current stock (units)' : 'Opening stock (units)'} *</label>
            <input id="inventory-item-quantity" name="quantity" type="number" min="0" step="1" required
              value="${item?.quantity ?? 0}" ${item ? 'readonly' : ''}>
          </div>
          ${item
            ? '<p>Use Received or Dispense to change stock. Expiry dates are tracked per received batch.</p>'
            : `<div class="form-group">
                <label for="inventory-item-expiry">Opening batch expiry date</label>
                <input id="inventory-item-expiry" name="expiryDate" type="date">
              </div>`}
          <div class="form-group">
            <label for="inventory-item-unit">Unit</label>
            <input id="inventory-item-unit" name="unit" type="text" maxlength="50" value="${escapeInventoryHtml(item?.unit || '')}">
          </div>
          <div class="form-group">
            <label for="inventory-item-cost">Unit cost (PHP) *</label>
            <input id="inventory-item-cost" name="unitCost" type="number" min="0" max="99999999.99" step="0.01" required value="${item?.unitCost ?? 0}">
          </div>
          <p id="inventory-item-error" role="alert" style="color: #ee5d50;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" type="button" onclick="closeInventoryItemForm()">Cancel</button>
          <button class="btn-primary" id="save-inventory-item" type="submit">${item ? 'Save Changes' : 'Add Item'}</button>
        </div>
      </form>
    </section>
  `;
  modal.addEventListener('click', event => {
    if (event.target === modal) closeInventoryItemForm();
  });
  document.body.appendChild(modal);
  document.getElementById('inventory-item-form').addEventListener('submit', event => {
    saveInventoryItem(event, item?.id ?? null);
  });
}

function closeInventoryItemForm() {
  document.getElementById('inventory-item-modal')?.remove();
}

async function saveInventoryItem(event, itemId) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const item = Object.fromEntries(formData.entries());
  item.quantity = Number(item.quantity);
  item.unitCost = Number(item.unitCost);

  const saveButton = document.getElementById('save-inventory-item');
  const errorMessage = document.getElementById('inventory-item-error');
  saveButton.disabled = true;
  errorMessage.textContent = '';

  try {
    const response = await fetch('inventory-items.php', {
      method: itemId === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemId === null ? item : { ...item, id: itemId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to save inventory item.');
    }

    closeInventoryItemForm();
    await loadInventoryData(activeInventorySection);
  } catch (error) {
    errorMessage.textContent = error.message;
    saveButton.disabled = false;
  }
}

function openInventoryMovementForm(itemId, movementType) {
  const item = inventoryItems.find(existingItem => Number(existingItem.id) === Number(itemId));
  if (!item) {
    alert('Inventory item not found. Refresh the category and try again.');
    return;
  }
  if (movementType === 'Dispensed' && item.category !== 'Medicine') {
    alert('Only medicine can be dispensed to patients.');
    return;
  }
  if (document.getElementById('inventory-movement-modal')) return;

  const today = new Date();
  const minExpiryDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const patientField = movementType === 'Dispensed'
    ? `<div class="form-group">
         <label for="inventory-movement-patient">Patient *</label>
         <select id="inventory-movement-patient" name="patientId" required>
           <option value="">Select a patient</option>
           ${inventoryPatients.map(patient =>
             `<option value="${Number(patient.id)}">${escapeInventoryHtml(patient.name)}</option>`
           ).join('')}
         </select>
       </div>`
    : `<div class="form-group">
         <label for="inventory-movement-expiry">Batch expiry date</label>
         <input id="inventory-movement-expiry" name="expiryDate" type="date" min="${minExpiryDate}">
       </div>`;
  const modal = document.createElement('div');
  modal.id = 'inventory-movement-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <section class="modal-content" role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title">
      <div class="modal-header">
        <h2 id="inventory-movement-title">${movementType === 'Received' ? 'Receive Stock' : 'Dispense Medicine'}</h2>
        <button type="button" aria-label="Close" onclick="closeInventoryMovementForm()" style="background:none;border:none;cursor:pointer;font-size:24px;">&times;</button>
      </div>
      <form id="inventory-movement-form">
        <div class="modal-body">
          <p><strong>${escapeInventoryHtml(item.itemName)}</strong> — Current stock: ${Number(item.quantity).toLocaleString()} ${escapeInventoryHtml(item.unit || '')}</p>
          <div class="form-group">
            <label for="inventory-movement-quantity">Quantity (units) *</label>
            <input id="inventory-movement-quantity" name="quantity" type="number" min="1" step="1" required>
          </div>
          ${patientField}
          <p id="inventory-movement-error" role="alert" style="color: #ee5d50;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" type="button" onclick="closeInventoryMovementForm()">Cancel</button>
          <button class="btn-primary" id="save-inventory-movement" type="submit">${movementType === 'Received' ? 'Record Receipt' : 'Record Dispense'}</button>
        </div>
      </form>
    </section>
  `;
  modal.addEventListener('click', event => {
    if (event.target === modal) closeInventoryMovementForm();
  });
  document.body.appendChild(modal);
  document.getElementById('inventory-movement-form').addEventListener('submit', event => {
    recordInventoryMovement(event, item, movementType);
  });
}

function closeInventoryMovementForm() {
  document.getElementById('inventory-movement-modal')?.remove();
}

async function recordInventoryMovement(event, item, movementType) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    itemId: Number(item.id),
    movementType,
    quantity: Number(formData.get('quantity')),
    patientId: formData.get('patientId') ? Number(formData.get('patientId')) : null,
    expiryDate: formData.get('expiryDate') || ''
  };
  const saveButton = document.getElementById('save-inventory-movement');
  const errorMessage = document.getElementById('inventory-movement-error');
  saveButton.disabled = true;
  errorMessage.textContent = '';

  try {
    const response = await fetch('inventory-stock.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to record stock movement.');
    }
    closeInventoryMovementForm();
    await loadInventoryData(activeInventorySection);
  } catch (error) {
    errorMessage.textContent = error.message;
    saveButton.disabled = false;
  }
}

async function deleteInventoryItem(itemId) {
  const item = inventoryItems.find(existingItem => Number(existingItem.id) === Number(itemId));
  if (!item || !confirm(`Delete "${item.itemName}" from inventory? This cannot be undone.`)) return;

  try {
    const response = await fetch('inventory-items.php', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to delete inventory item.');
    }
    await loadInventoryData(activeInventorySection);
  } catch (error) {
    alert(error.message);
  }
}

function escapeInventoryHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatInventoryCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(Number(value) || 0);
}

function logoutUser() {
  AuthManager.logout();
}
