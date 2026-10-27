let workerAccounts = [];
const WORKER_ROLES = ['Physician', 'Receptionist', 'InventoryManager'];

document.addEventListener('DOMContentLoaded', initializeWorkerAccounts);

async function initializeWorkerAccounts() {
  try {
    const response = await fetch('check_session.php');
    const session = await response.json();
    if (!response.ok || !session.loggedIn || session.role !== 'Admin') {
      window.location.href = 'login.html';
      return;
    }

    document.getElementById('user-name').innerText = session.name || 'Admin';
    document.getElementById('user-avatar').innerText = (session.name || 'AD').substring(0, 2).toUpperCase();
    await loadWorkerAccounts();
  } catch (error) {
    console.error('Unable to verify the admin session:', error);
    window.location.href = 'login.html';
  }
}

async function loadWorkerAccounts() {
  const tbody = document.getElementById('users-table');
  try {
    const response = await fetch('get_admin_data.php');
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Unable to load worker accounts');
    }

    workerAccounts = (data.users || [])
      .filter(user => WORKER_ROLES.includes(user.role) || user.role === 'Pharmacist')
      .map(user => user.role === 'Pharmacist' ? { ...user, role: 'InventoryManager' } : user);
    renderWorkerAccounts();
  } catch (error) {
    console.error('Failed to load worker accounts:', error);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Unable to load worker accounts.</td></tr>';
  }
}

function renderWorkerAccounts() {
  const tbody = document.getElementById('users-table');
  if (workerAccounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No worker accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = workerAccounts.map(user => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.role)}</td>
      <td>
        <button class="btn-small" onclick="editUser(${Number(user.id)})">Edit</button>
        <button class="btn-small danger" onclick="deleteUser(${Number(user.id)})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function showAddUserModal() {
  if (document.getElementById('add-user-modal')) return;
  const modalHtml = `
    <div id="add-user-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add Worker Account</h2>
          <button onclick="closeModal('add-user-modal')" style="background:none;border:none;cursor:pointer;font-size:24px;">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="new-user-name" placeholder="Enter full name" required>
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="new-user-email" placeholder="Enter email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="new-user-password" placeholder="Default: default123">
          </div>
          <div class="form-group">
            <label>Role *</label>
            <select id="new-user-role" required>
              <option value="">Select role...</option>
              <option value="Physician">Physician</option>
              <option value="Receptionist">Receptionist</option>
              <option value="InventoryManager">Inventory Manager</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-small" style="background-color:#707ebe;" onclick="closeModal('add-user-modal')">Cancel</button>
          <button class="btn-small" onclick="submitAddUser()">Add Account</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitAddUser() {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value.trim() || 'default123';
  const role = document.getElementById('new-user-role').value;
  if (!name || !email || !role) {
    alert('Name, email, and role are required');
    return;
  }

  await submitAccountRequest('add-user.php', { name, email, password, role }, 'Worker account added successfully.');
}

function editUser(userId) {
  const user = workerAccounts.find(account => String(account.id) === String(userId));
  if (!user || !WORKER_ROLES.includes(user.role) || document.getElementById('edit-user-modal')) return;

  const roleOptions = [
    ['Physician', 'Physician'],
    ['Receptionist', 'Receptionist'],
    ['InventoryManager', 'Inventory Manager']
  ];
  const options = roleOptions.map(([value, label]) =>
    `<option value="${value}" ${user.role === value ? 'selected' : ''}>${label}</option>`
  ).join('');

  const modalHtml = `
    <div id="edit-user-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Edit Worker Account</h2>
          <button onclick="closeModal('edit-user-modal')" style="background:none;border:none;cursor:pointer;font-size:24px;">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="edit-user-name" value="${escapeHtml(user.name)}" required>
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="edit-user-email" value="${escapeHtml(user.email)}" required>
          </div>
          <div class="form-group">
            <label>Role *</label>
            <select id="edit-user-role" required>${options}</select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-small" style="background-color:#707ebe;" onclick="closeModal('edit-user-modal')">Cancel</button>
          <button class="btn-small" onclick="submitEditUser(${Number(user.id)})">Save Changes</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitEditUser(userId) {
  const name = document.getElementById('edit-user-name').value.trim();
  const email = document.getElementById('edit-user-email').value.trim();
  const role = document.getElementById('edit-user-role').value;
  if (!name || !email || !role) {
    alert('All fields are required');
    return;
  }

  await submitAccountRequest('update-user.php', { id: userId, name, email, role }, 'Worker account updated successfully.');
}

async function deleteUser(userId) {
  const user = workerAccounts.find(account => String(account.id) === String(userId));
  if (!user || !WORKER_ROLES.includes(user.role)) return;
  if (!confirm('Are you sure you want to delete this worker account? This action cannot be undone.')) return;

  await submitAccountRequest('delete-user.php', { id: userId }, 'Worker account deleted successfully.');
}

async function submitAccountRequest(endpoint, payload, successMessage) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }

    alert(successMessage);
    closeModal('add-user-modal');
    closeModal('edit-user-modal');
    await loadWorkerAccounts();
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

function closeModal(modalId) {
  document.getElementById(modalId)?.remove();
}

function logoutUser() {
  window.location.href = 'logout.php';
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.showAddUserModal = showAddUserModal;
window.submitAddUser = submitAddUser;
window.editUser = editUser;
window.submitEditUser = submitEditUser;
window.deleteUser = deleteUser;
window.closeModal = closeModal;
window.logoutUser = logoutUser;
