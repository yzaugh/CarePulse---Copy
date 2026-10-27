let queueRefreshTimer = null;
let queueIsLoading = false;

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requireRole(UserRoles.RECEPTIONIST)) return;
  initializeReceptionistPortal();
  loadQueueSection();
  queueRefreshTimer = setInterval(() => {
    if (!document.hidden) loadQueueSection();
  }, 30000);
  document.addEventListener('visibilitychange', refreshQueueWhenVisible);
});

function initializeReceptionistPortal() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
  }
}

async function loadQueueSection() {
  if (queueIsLoading) return;
  queueIsLoading = true;
  const tbody = document.getElementById('queue-table');
  const refreshButton = document.getElementById('queue-refresh-button');
  const refreshStatus = document.getElementById('queue-refresh-status');
  refreshButton.disabled = true;
  refreshStatus.textContent = 'Updating queue...';
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading appointments...</td></tr>';

  try {
    const appointments = await fetchReceptionistAppointments();
    const sortedAppointments = sortQueueAppointments(appointments);

    if (sortedAppointments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No appointments found</td></tr>';
      refreshStatus.textContent = `Updated ${new Date().toLocaleTimeString()}`;
      return;
    }

    tbody.innerHTML = sortedAppointments.map((apt, index) => {
      const status = String(apt.status || '');
      const isAwaitingAttendance = ['pending', 'confirmed'].includes(status.toLowerCase());
      const isCancelled = status.toLowerCase() === 'cancelled';
      const appointmentDateTime = new Date(`${apt.date}T${apt.time}:00`);
      const canCheckIn = isAwaitingAttendance && apt.date === getReceptionistCurrentDate();
      const canMarkAbsent = isAwaitingAttendance && appointmentDateTime <= new Date();
      const actions = [
        canCheckIn
          ? `<button class="btn-small" onclick="updateReceptionistAppointment('${apt.id}', 'checked_in')">Checked In</button>`
          : '',
        canMarkAbsent
          ? `<button class="btn-small danger" onclick="updateReceptionistAppointment('${apt.id}', 'absent')">Absent</button>`
          : '',
        isCancelled
          ? `<button class="btn-small danger" onclick="removeCancelledAppointment('${apt.id}')">Remove</button>`
          : ''
      ].filter(Boolean).join(' ');

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${formatDate(apt.date)}</td>
          <td>${formatTime(apt.time)}</td>
          <td>${escapeReceptionistHtml(apt.patientName)}</td>
          <td>${escapeReceptionistHtml(apt.doctorName)}</td>
          <td><span class="status ${status.toLowerCase().replace(/\s+/g, '-')}">${escapeReceptionistHtml(status)}</span></td>
          <td>${actions || (isAwaitingAttendance ? 'Not due' : '—')}</td>
        </tr>
      `;
    }).join('');
    refreshStatus.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">${escapeReceptionistHtml(error.message)}</td></tr>`;
    refreshStatus.textContent = 'Update failed';
  } finally {
    refreshButton.disabled = false;
    queueIsLoading = false;
  }
}

function sortQueueAppointments(appointments) {
  const now = new Date();
  const getPriority = appointment => {
    const status = String(appointment.status || '').toLowerCase();
    const timestamp = new Date(`${appointment.date}T${appointment.time}:00`).getTime();
    if (['pending', 'confirmed'].includes(status)) {
      return timestamp >= now.getTime() ? 0 : 1;
    }
    if (status === 'checked in') return 2;
    if (status === 'cancelled') return 4;
    return 3;
  };

  return [...appointments].sort((a, b) =>
    getPriority(a) - getPriority(b)
    || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    || Number(a.id) - Number(b.id)
  );
}

function refreshQueueWhenVisible() {
  if (!document.hidden) loadQueueSection();
}

function getReceptionistCurrentDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function fetchReceptionistAppointments() {
  const response = await fetch('get-receptionist-appointments.php');
  const result = await response.json();
  if (!response.ok || !result.success || !Array.isArray(result.appointments)) {
    throw new Error(result.error || 'Unable to load appointments.');
  }
  return result.appointments;
}

async function updateReceptionistAppointment(appointmentId, action) {
  const confirmation = action === 'checked_in'
    ? 'Confirm that this patient attended their appointment?'
    : 'Confirm that this patient was absent from their appointment?';
  if (!confirm(confirmation)) return;

  try {
    const response = await fetch('update-receptionist-appointment.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appointmentId, action })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to update the appointment.');
    }
    await loadQueueSection();
  } catch (error) {
    alert(error.message);
  }
}

async function removeCancelledAppointment(appointmentId) {
  if (!confirm('Remove this cancelled appointment from the records? This cannot be undone.')) return;

  try {
    const response = await fetch('remove-cancelled-appointment.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appointmentId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to remove the cancelled appointment.');
    }
    await loadQueueSection();
  } catch (error) {
    alert(error.message);
  }
}

function escapeReceptionistHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function logoutUser() {
  AuthManager.logout();
}
