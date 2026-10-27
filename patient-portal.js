// Patient Portal Controller

let currentPatientId = null;
let bookingDoctors = [];
let patientAppointments = [];
let reschedulingAppointmentId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requireRole(UserRoles.PATIENT)) return;
  initializePatientPortal();
  loadDashboardSection();
  document.getElementById('profile-form').addEventListener('submit', saveProfile);
});

function initializePatientPortal() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
    
    // Find patient record
    const patients = DataManager.getPatients();
    const patient = patients.find(p => p.email === user.email);
    if (patient) {
      currentPatientId = patient.id;
    } else if (typeof user.email === 'string' && user.email.trim()) {
      currentPatientId = `patient:${user.email.trim().toLowerCase()}`;
    }
  }
}

function loadSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });

  // Show selected section
  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.closest('.nav-item')?.classList.add('active');

  // Update page title
  const titles = {
    dashboard: 'My Dashboard',
    'my-records': 'My Medical Records',
    'my-appointments': 'My Appointments',
    profile: 'My Profile'
  };
  document.getElementById('page-title').innerText = titles[sectionName] || 'Dashboard';

  // Load section-specific data
  switch(sectionName) {
    case 'dashboard':
      loadDashboardSection();
      break;
    case 'my-records':
      loadMyRecordsSection();
      break;
    case 'my-appointments':
      loadMyAppointmentsSection();
      break;
    case 'profile':
      loadProfileSection();
      break;
  }
}

async function loadDashboardSection() {
  if (!currentPatientId) return;

  try {
    await loadPatientAppointments();
  } catch (error) {
    document.getElementById('upcoming-appointments').innerHTML =
      `<tr><td colspan="6" style="text-align: center;">${escapePatientHtml(error.message)}</td></tr>`;
    return;
  }

  renderPatientDashboard();
}

function renderPatientDashboard() {
  const myRecords = DataManager.getRecordsByPatient(currentPatientId);
  const myAppointments = patientAppointments;
  const upcomingAppointments = getUpcomingAppointments(myAppointments)
    .filter(apt => ['Pending', 'Confirmed', 'scheduled'].includes(apt.status));

  document.getElementById('my-records-count').innerText = myRecords.length;
  document.getElementById('my-upcoming-count').innerText = upcomingAppointments.length;
  // Load upcoming appointments
  const tbody = document.getElementById('upcoming-appointments');
  if (upcomingAppointments.length > 0) {
    tbody.innerHTML = upcomingAppointments.slice(0, 5).map(apt => `
      <tr>
        <td>${escapePatientHtml(apt.doctorName)}</td>
        <td>${formatDate(apt.date)}</td>
        <td>${formatTime(apt.time)}</td>
        <td>${escapePatientHtml(apt.reason || '')}</td>
        <td><span class="status ${getPatientAppointmentStatusClass(apt.status)}">${escapePatientHtml(apt.status)}</span></td>
        <td>
          <button class="btn-small" onclick="viewAppointmentDetails('${apt.id}')">View</button>
          <button class="btn-small danger" onclick="cancelAppointment('${apt.id}')">Cancel</button>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No upcoming appointments</td></tr>';
  }
}

function loadMyRecordsSection() {
  if (!currentPatientId) return;

  const myRecords = DataManager.getRecordsByPatient(currentPatientId);
  const tbody = document.getElementById('my-records-table');

  tbody.innerHTML = myRecords.map(record => `
    <tr>
      <td>${formatDate(record.date)}</td>
      <td>${record.doctorName}</td>
      <td>${record.type}</td>
      <td>${record.diagnosis}</td>
      <td>${record.prescription}</td>
      <td>
        <button class="btn-small" onclick="viewRecord('${record.id}')">View</button>
        <button class="btn-small" onclick="downloadRecord('${record.id}')">Download</button>
      </td>
    </tr>
  `).join('');

  if (myRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No medical records available</td></tr>';
  }
}

async function loadMyAppointmentsSection() {
  if (!currentPatientId) return;

  const tbody = document.getElementById('my-appointments-table');

  try {
    await loadPatientAppointments();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${escapePatientHtml(error.message)}</td></tr>`;
    return;
  }

  renderMyAppointments();
}

function renderMyAppointments() {
  const tbody = document.getElementById('my-appointments-table');
  const myAppointments = patientAppointments.filter(apt => !['Cancelled', 'cancelled'].includes(apt.status));
  tbody.innerHTML = myAppointments.map(apt => `
    <tr>
      <td>${escapePatientHtml(apt.doctorName)}</td>
      <td>${formatDate(apt.date)}</td>
      <td>${formatTime(apt.time)}</td>
      <td>${escapePatientHtml(apt.reason || '')}</td>
      <td><span class="status ${getPatientAppointmentStatusClass(apt.status)}">${escapePatientHtml(apt.status)}</span></td>
      <td>
        <button class="btn-small" onclick="viewAppointmentDetails('${apt.id}')">View</button>
        ${['Pending', 'Confirmed', 'scheduled'].includes(apt.status) ? `<button class="btn-small danger" onclick="cancelAppointmentConfirm('${apt.id}')">Cancel</button>` : ''}
      </td>
    </tr>
  `).join('');

  if (myAppointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No appointments scheduled</td></tr>';
  }
}

async function loadPatientAppointments() {
  const response = await fetch('get-patient-appointments.php');
  const result = await response.json();
  if (!response.ok || !result.success || !Array.isArray(result.appointments)) {
    throw new Error(result.error || 'Unable to load appointments.');
  }
  patientAppointments = result.appointments;
}

function getPatientAppointmentStatusClass(status) {
  return {
    Pending: 'pending',
    Confirmed: 'confirmed',
    'Checked In': 'checked-in',
    Completed: 'completed',
    Cancelled: 'cancelled',
    Absent: 'absent',
    scheduled: 'scheduled',
    cancelled: 'cancelled'
  }[status] || 'pending';
}

function escapePatientHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function loadProfileSection() {
  const message = document.getElementById('profile-message');
  message.textContent = 'Loading profile...';
  fetch('patient-profile.php')
    .then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to load your profile.');
      }
      return result.profile;
    })
    .then(profile => {
      document.getElementById('profile-name').value = profile.name || '';
      document.getElementById('profile-email').value = profile.email || '';
      document.getElementById('profile-phone').value = profile.phone || '';
      document.getElementById('profile-dob').value = profile.dob || '';
      document.getElementById('profile-gender').value = profile.gender || '';
      document.getElementById('profile-blood-type').value = profile.blood_type || '';
      document.getElementById('profile-address').value = profile.address || '';
      message.textContent = '';
    })
    .catch(error => {
      message.textContent = error.message;
    });
}

async function saveProfile(event) {
  event.preventDefault();
  const message = document.getElementById('profile-message');
  const button = document.getElementById('save-profile-button');
  const profile = {
    name: document.getElementById('profile-name').value.trim(),
    phone: document.getElementById('profile-phone').value.trim(),
    dob: document.getElementById('profile-dob').value,
    gender: document.getElementById('profile-gender').value.trim(),
    address: document.getElementById('profile-address').value.trim()
  };

  message.textContent = 'Saving profile...';
  button.disabled = true;
  try {
    const response = await fetch('patient-profile.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to save your profile.');
    }

    const user = AuthManager.getCurrentUser();
    if (user) {
      user.name = profile.name;
      localStorage.setItem(AuthManager.LOGIN_STORAGE_KEY, JSON.stringify(user));
      document.getElementById('user-name').innerText = profile.name;
      document.getElementById('user-avatar').innerText = profile.name.substring(0, 2).toUpperCase();
    }
    message.textContent = result.message;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function bookAppointment(appointmentId = null) {
  const appointment = appointmentId === null
    ? null
    : patientAppointments.find(apt => String(apt.id) === String(appointmentId));
  if (appointmentId !== null && (!appointment || appointment.status !== 'Absent')) {
    alert('Only an absent appointment can be rescheduled.');
    return;
  }
  reschedulingAppointmentId = appointment ? String(appointment.id) : null;
  bookingDoctors = [];
  const isRescheduling = Boolean(appointment);
  const modalHtml = `
    <div id="booking-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>${isRescheduling ? 'Reschedule Appointment' : 'Book Appointment'}</h2>
          <button onclick="closeBookingModal()" style="background:none; border:none; cursor:pointer;"><i data-feather="x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Select Physician</label>
            <select id="book-doctor" onchange="updateBookingDates()">
              <option value="">Loading registered doctors...</option>
            </select>
          </div>
          <div class="form-group">
            <label>Select Available Day</label>
            <select id="book-date" onchange="loadAvailableTimes()" disabled>
              <option value="">Select a doctor first</option>
            </select>
          </div>
          <div class="form-group">
            <label>Select Available Time</label>
            <select id="book-time" onchange="updateBookingFormState()" disabled>
              <option value="">Select a date first</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reason for Visit</label>
            <textarea id="book-reason" maxlength="2000" oninput="updateBookingFormState()" placeholder="Briefly describe your symptoms or reason for visit"></textarea>
          </div>
          <p id="booking-error" role="alert" style="color: #ee5d50;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" style="background-color: #707ebe;" onclick="closeBookingModal()">Cancel</button>
          <button class="btn-primary" id="confirm-booking-btn" onclick="confirmBooking()" disabled>${isRescheduling ? 'Reschedule Appointment' : 'Confirm Booking'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  feather.replace();

  const doctorSelect = document.getElementById('book-doctor');
  try {
    const response = await fetch('get-doctors.php');
    const result = await response.json();
    if (!document.getElementById('booking-modal')) return;
    if (!response.ok || !result.success || !Array.isArray(result.doctors)) {
      throw new Error(result.error || 'Unable to load registered doctors.');
    }

    bookingDoctors = result.doctors;
    doctorSelect.innerHTML = '<option value="">Choose a doctor...</option>';
    bookingDoctors.forEach(doctor => {
      const option = document.createElement('option');
      option.value = doctor.id;
      option.textContent = `${doctor.name} (${doctor.specialization || 'Physician'})`;
      doctorSelect.appendChild(option);
    });

    if (bookingDoctors.length === 0) {
      doctorSelect.innerHTML = '<option value="">No doctors are registered</option>';
      document.getElementById('booking-error').textContent = 'No registered doctors are available to book.';
    } else if (appointment) {
      doctorSelect.value = String(appointment.doctorId);
      document.getElementById('book-reason').value = appointment.reason || '';
      await updateBookingDates();
    }
  } catch (error) {
    if (!document.getElementById('booking-modal')) return;
    doctorSelect.innerHTML = '<option value="">Doctors could not be loaded</option>';
    document.getElementById('booking-error').textContent = error.message;
  }
  updateBookingFormState();
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) modal.remove();
}

function formatBookingDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function updateBookingDates() {
  const doctor = bookingDoctors.find(d => String(d.id) === document.getElementById('book-doctor').value);
  const dateSelect = document.getElementById('book-date');
  const timeSelect = document.getElementById('book-time');
  document.getElementById('booking-error').textContent = '';
  dateSelect.innerHTML = '';
  timeSelect.innerHTML = '<option value="">Select a date first</option>';
  timeSelect.disabled = true;

  if (!doctor || !Array.isArray(doctor.availability) || doctor.availability.length === 0) {
    dateSelect.disabled = true;
    dateSelect.innerHTML = `<option value="">${doctor ? 'This doctor has no saved available days' : 'Select a doctor first'}</option>`;
    updateBookingFormState();
    return;
  }

  const availableDays = new Set(doctor.availability.map(slot => Number(slot.dayOfWeek)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + 90);
  dateSelect.innerHTML = '<option value="">Choose an available day...</option>';
  for (let date = new Date(today); date <= lastDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    if (!availableDays.has(dayOfWeek)) continue;

    const dateValue = formatBookingDate(date);
    const option = document.createElement('option');
    option.value = dateValue;
    option.textContent = `${date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}`;
    dateSelect.appendChild(option);
  }
  dateSelect.disabled = false;
  updateBookingFormState();
}

async function loadAvailableTimes() {
  const doctorId = document.getElementById('book-doctor').value;
  const date = document.getElementById('book-date').value;
  const timeSelect = document.getElementById('book-time');
  document.getElementById('booking-error').textContent = '';
  timeSelect.disabled = true;
  timeSelect.innerHTML = '<option value="">Loading available times...</option>';

  if (!doctorId || !date) {
    timeSelect.innerHTML = '<option value="">Select a date first</option>';
    updateBookingFormState();
    return;
  }

  try {
    const query = new URLSearchParams({ doctorId, date });
    const response = await fetch(`get-available-slots.php?${query}`);
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.slots)) {
      throw new Error(result.error || 'Unable to load available times.');
    }

    timeSelect.innerHTML = result.slots.length
      ? '<option value="">Choose an available time...</option>'
      : '<option value="">No available times for this day</option>';
    result.slots.forEach(time => {
      const option = document.createElement('option');
      option.value = time;
      option.textContent = formatTime(time);
      timeSelect.appendChild(option);
    });
    timeSelect.disabled = result.slots.length === 0;
  } catch (error) {
    timeSelect.innerHTML = '<option value="">Times could not be loaded</option>';
    document.getElementById('booking-error').textContent = error.message;
  }
  updateBookingFormState();
}

function updateBookingFormState() {
  const doctorId = document.getElementById('book-doctor').value;
  const date = document.getElementById('book-date').value;
  const time = document.getElementById('book-time').value;
  const reason = document.getElementById('book-reason').value.trim();
  const confirmBtn = document.getElementById('confirm-booking-btn');
  confirmBtn.disabled = !doctorId || !date || !time || !reason;
}

async function confirmBooking() {
  const doctorId = document.getElementById('book-doctor').value;
  const date = document.getElementById('book-date').value;
  const time = document.getElementById('book-time').value;
  const reason = document.getElementById('book-reason').value.trim();
  const doctor = bookingDoctors.find(d => String(d.id) === doctorId);
  const confirmButton = document.getElementById('confirm-booking-btn');
  const errorMessage = document.getElementById('booking-error');
  const appointmentId = reschedulingAppointmentId;
  const isRescheduling = appointmentId !== null;

  if (!doctor || !date || !time || !reason) {
    alert('Please fill in all fields');
    return;
  }

  confirmButton.disabled = true;
  errorMessage.textContent = '';
  try {
    const response = await fetch(isRescheduling ? 'reschedule-appointment.php' : 'add-appointment.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(isRescheduling ? { id: appointmentId } : {}), doctorId, date, time, reason })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to book the appointment.');
    }

    closeBookingModal();
    reschedulingAppointmentId = null;
    await loadPatientAppointments();
    renderMyAppointments();
    renderPatientDashboard();
    const savedAppointment = patientAppointments.find(appointment => String(appointment.id) === String(result.id));
    if (!savedAppointment || (isRescheduling && savedAppointment.status !== 'Pending')) {
      throw new Error('The appointment was saved, but is missing from your refreshed appointment list. Please refresh the page.');
    }
    alert(isRescheduling ? 'Appointment rescheduled successfully!' : 'Appointment booked successfully!');
  } catch (error) {
    if (document.getElementById('booking-modal')) {
      errorMessage.textContent = error.message;
      confirmButton.disabled = false;
    } else {
      alert(error.message);
    }
  }
}


function viewAppointmentDetails(appointmentId) {
  const apt = patientAppointments.find(a => String(a.id) === String(appointmentId));
  if (!apt) return;

  showAppointmentDetails({
    title: 'Appointment details',
    appointmentId: apt.id,
    personLabel: 'Doctor',
    personName: apt.doctorName,
    date: apt.date,
    time: apt.time,
    reason: apt.reason,
    status: apt.status
  });
}

function showAppointmentDetails(appointment) {
  closeAppointmentDetails();
  const modal = document.createElement('div');
  modal.id = 'appointment-details-modal';
  modal.className = 'modal-overlay appointment-details-overlay';
  modal.setAttribute('role', 'presentation');
  modal.innerHTML = `
    <section class="modal-content appointment-details-card" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
      <header class="appointment-details-header">
        <div>
          <span class="appointment-details-eyebrow">CAREPULSE APPOINTMENT</span>
          <h2 id="appointment-details-title">${escapePatientHtml(appointment.title)}</h2>
        </div>
        <button class="appointment-details-close" type="button" aria-label="Close appointment details" onclick="closeAppointmentDetails()">&times;</button>
      </header>
      <div class="appointment-details-body">
        <div class="appointment-details-person">
          <span class="appointment-details-avatar" aria-hidden="true">${escapePatientHtml((appointment.personName || '?').trim().charAt(0).toUpperCase())}</span>
          <div><span class="appointment-details-label">${escapePatientHtml(appointment.personLabel)}</span><strong>${escapePatientHtml(appointment.personName || 'Not available')}</strong></div>
        </div>
        <div class="appointment-details-grid">
          <div class="appointment-details-item"><span class="appointment-details-label">Date</span><strong>${escapePatientHtml(formatDate(appointment.date))}</strong></div>
          <div class="appointment-details-item"><span class="appointment-details-label">Time</span><strong>${escapePatientHtml(formatTime(appointment.time))}</strong></div>
        </div>
        <div class="appointment-details-item appointment-details-reason"><span class="appointment-details-label">Reason for visit</span><p>${escapePatientHtml(appointment.reason || 'No reason provided')}</p></div>
        <div class="appointment-details-status"><span class="appointment-details-label">Status</span><span class="status ${getPatientAppointmentStatusClass(appointment.status)}">${escapePatientHtml(appointment.status)}</span></div>
      </div>
      <footer class="appointment-details-footer">
        ${appointment.status === 'Absent' ? `<button class="btn-primary" type="button" onclick="rescheduleAbsentAppointment('${escapePatientHtml(appointment.appointmentId)}')">Reschedule</button>` : ''}
        <button class="btn-primary" type="button" onclick="closeAppointmentDetails()">Done</button>
      </footer>
    </section>`;
  modal.addEventListener('click', event => {
    if (event.target === modal) closeAppointmentDetails();
  });
  document.addEventListener('keydown', handleAppointmentDetailsKeydown);
  document.body.appendChild(modal);
}

function rescheduleAbsentAppointment(appointmentId) {
  closeAppointmentDetails();
  bookAppointment(appointmentId);
}

function handleAppointmentDetailsKeydown(event) {
  if (event.key === 'Escape') closeAppointmentDetails();
}

function closeAppointmentDetails() {
  const modal = document.getElementById('appointment-details-modal');
  if (modal) modal.remove();
  document.removeEventListener('keydown', handleAppointmentDetailsKeydown);
}

function cancelAppointment(appointmentId) {
  cancelAppointmentConfirm(appointmentId);
}

async function cancelAppointmentConfirm(appointmentId) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;

  try {
    const response = await fetch('cancel-appointment.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appointmentId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to cancel the appointment.');
    }

    patientAppointments = patientAppointments.map(appointment =>
      String(appointment.id) === String(appointmentId)
        ? { ...appointment, status: 'Cancelled' }
        : appointment
    );
    await Promise.all([loadMyAppointmentsSection(), loadDashboardSection()]);
    alert('Appointment cancelled successfully');
  } catch (error) {
    alert(error.message);
  }
}

function viewRecord(recordId) {
  const record = DataManager.getMedicalRecords().find(r => r.id === recordId);
  if (record) {
    alert(`Medical Record\nDate: ${formatDate(record.date)}\nDoctor: ${record.doctorName}\nDiagnosis: ${record.diagnosis}\nPrescription: ${record.prescription}`);
  }
}

function downloadRecord(recordId) {
  const record = DataManager.getMedicalRecords().find(r => r.id === recordId);
  if (record) {
    const content = `MEDICAL RECORD\n================\nDate: ${formatDate(record.date)}\nDoctor: ${record.doctorName}\nType: ${record.type}\nDiagnosis: ${record.diagnosis}\nPrescription: ${record.prescription}\nNotes: ${record.notes}`;
    downloadFile(content, `medical_record_${recordId}.txt`);
  }
}

function downloadRecords() {
  if (!currentPatientId) return;

  const patient = DataManager.getPatientById(currentPatientId);
  const records = DataManager.getRecordsByPatient(currentPatientId);

  let content = `PATIENT MEDICAL RECORDS\n`;
  content += `========================\n`;
  content += `Name: ${patient.name}\n`;
  content += `Email: ${patient.email}\n`;
  content += `Phone: ${patient.phone}\n`;
  content += `DOB: ${patient.dob}\n`;
  content += `Blood Type: ${patient.bloodType}\n\n`;
  content += `MEDICAL RECORDS:\n`;
  content += `----------------\n`;

  records.forEach(record => {
    content += `\nDate: ${formatDate(record.date)}\n`;
    content += `Doctor: ${record.doctorName}\n`;
    content += `Type: ${record.type}\n`;
    content += `Diagnosis: ${record.diagnosis}\n`;
    content += `Prescription: ${record.prescription}\n`;
    content += `Notes: ${record.notes}\n`;
    content += `---\n`;
  });

  downloadFile(content, `medical_records_${patient.name.replace(/\s/g, '_')}.txt`);
}

function downloadFile(content, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function logoutUser() {
  AuthManager.logout();
}
