// Doctor Portal Controller

let currentDoctorId = null;
let doctorAppointments = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requireRole(UserRoles.DOCTOR)) return;
  initializeDoctorPortal();
  loadDashboardSection();
  window.setInterval(() => {
    if (document.getElementById('section-dashboard').style.display !== 'none') {
      loadDashboardSection();
    } else if (document.getElementById('section-appointments').style.display !== 'none') {
      loadAppointmentsSection();
    }
  }, 15000);
});

function initializeDoctorPortal() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
    
    const doctors = DataManager.getDoctors();
    const doctor = doctors.find(d => d.email === user.email);
    if (doctor) {
      currentDoctorId = doctor.id;
    } else if (typeof user.email === 'string' && user.email.trim()) {
      currentDoctorId = `doctor:${user.email.trim().toLowerCase()}`;
    }
  }
}

function loadSection(sectionName, navItem) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });

  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  navItem?.classList.add('active');

  const titles = {
    dashboard: 'Doctor Dashboard',
    patients: 'My Patients',
    appointments: 'My Appointments',
    schedule: 'My Working Hours',
    records: 'Medical Records'
  };
  document.getElementById('page-title').innerText = titles[sectionName] || 'Dashboard';

  switch(sectionName) {
    case 'dashboard':
      loadDashboardSection();
      break;
    case 'patients':
      loadPatientsSection();
      break;
    case 'appointments':
      loadAppointmentsSection();
      break;
    case 'schedule':
      loadScheduleSection();
      break;
    case 'records':
      loadRecordsSection();
      break;
  }
}


async function loadDashboardSection() {
  const tbody = document.getElementById('todays-schedule');
  try {
    await loadDoctorAppointments();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${escapeDoctorHtml(error.message)}</td></tr>`;
    return;
  }

  const appointments = doctorAppointments;
  const records = DataManager.getMedicalRecords().filter(r => r.doctorId === currentDoctorId);
  const today = getCurrentDate();
  const todayAppointments = appointments.filter(a =>
    a.date === today && ['Pending', 'Confirmed', 'Checked In'].includes(a.status)
  );
  const upcomingAppointments = appointments.filter(a =>
    a.date >= today && ['Pending', 'Confirmed', 'Checked In'].includes(a.status)
  ).slice(0, 5);

  document.getElementById('my-patients-count').innerText = new Set(appointments.map(a => a.patientId)).size;
  document.getElementById('today-appointments-count').innerText = todayAppointments.length;
  document.getElementById('reviewed-count').innerText = records.length;

  if (upcomingAppointments.length > 0) {
    tbody.innerHTML = upcomingAppointments.map(apt => `
      <tr>
        <td>${formatDate(apt.date)}</td>
        <td>${formatTime(apt.time)}</td>
        <td>${escapeDoctorHtml(apt.patientName)}</td>
        <td>${escapeDoctorHtml(apt.reason || '')}</td>
        <td><span class="status ${getAppointmentStatusClass(apt.status)}">${escapeDoctorHtml(apt.status)}</span></td>
        <td>
          <button class="btn-small" onclick="viewAppointmentDetails('${apt.id}')">View</button>
          <button class="btn-small" onclick="completeAppointment('${apt.id}')">Complete</button>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No upcoming appointments</td></tr>';
  }
}

async function loadDoctorAppointments() {
  const response = await fetch('get-doctor-appointments.php');
  const result = await response.json();
  if (!response.ok || !result.success || !Array.isArray(result.appointments)) {
    throw new Error(result.error || 'Unable to load appointments.');
  }
  doctorAppointments = result.appointments;
}

function escapeDoctorHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getAppointmentStatusClass(status) {
  return {
    Pending: 'pending',
    Confirmed: 'confirmed',
    'Checked In': 'checked-in',
    Completed: 'completed',
    Cancelled: 'cancelled',
    Absent: 'absent'
  }[status] || 'pending';
}

function loadPatientsSection() {
  if (!currentDoctorId) return;

  const appointments = DataManager.getAppointmentsByDoctor(currentDoctorId);
  const patientIds = [...new Set(appointments.map(a => a.patientId))];
  const patients = DataManager.getPatients().filter(p => patientIds.includes(p.id));

  const tbody = document.getElementById('patients-table');
  tbody.innerHTML = patients.map(patient => `
    <tr>
      <td>${patient.name}</td>
      <td>${patient.email}</td>
      <td>${patient.phone}</td>
      <td>${formatDate(patient.lastVisit)}</td>
      <td>${patient.bloodType}</td>
      <td>
        <button class="btn-small" onclick="viewPatientRecord('${patient.id}')">View Records</button>
        <button class="btn-small" onclick="scheduleAppointment('${patient.id}')">Schedule</button>
      </td>
    </tr>
  `).join('');

  if (patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No patients assigned</td></tr>';
  }
}

async function loadAppointmentsSection() {
  const tbody = document.getElementById('appointments-table');

  try {
    await loadDoctorAppointments();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${escapeDoctorHtml(error.message)}</td></tr>`;
    return;
  }

  const appointments = doctorAppointments;
  tbody.innerHTML = appointments.map(apt => `
    <tr>
      <td>${formatDate(apt.date)}</td>
      <td>${formatTime(apt.time)}</td>
      <td>${escapeDoctorHtml(apt.patientName)}</td>
      <td>${escapeDoctorHtml(apt.reason || '')}</td>
      <td><span class="status ${getAppointmentStatusClass(apt.status)}">${escapeDoctorHtml(apt.status)}</span></td>
      <td>
        <button class="btn-small" onclick="viewAppointmentDetails('${apt.id}')">View</button>
        ${['Pending', 'Confirmed', 'Checked In'].includes(apt.status) ? `<button class="btn-small" onclick="completeAppointment('${apt.id}')">Complete</button>` : ''}
      </td>
    </tr>
  `).join('');

  if (appointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No appointments scheduled</td></tr>';
  }
}

function loadRecordsSection() {
  if (!currentDoctorId) return;

  const records = DataManager.getMedicalRecords().filter(r => r.doctorId === currentDoctorId);
  const tbody = document.getElementById('records-table');

  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${formatDate(record.date)}</td>
      <td>${record.patientName}</td>
      <td>${record.type}</td>
      <td>${record.diagnosis}</td>
      <td>${record.prescription}</td>
      <td>
        <button class="btn-small" onclick="editRecord('${record.id}')">Edit</button>
        <button class="btn-small" onclick="viewFullRecord('${record.id}')">View</button>
      </td>
    </tr>
  `).join('');

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records created yet</td></tr>';
  }
}

async function loadScheduleSection() {
  const container = document.getElementById('availability-editor');
  if (!currentDoctorId) {
    container.textContent = 'Unable to load your schedule. Please sign in again.';
    return;
  }

  container.textContent = 'Loading your saved schedule...';
  try {
    const response = await fetch('doctor-availability.php');
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.availability)) {
      throw new Error(result.error || 'Unable to load your schedule.');
    }
    let availability = result.availability;
    if (availability.length === 0 && currentDoctorId.startsWith('doctor:')) {
      const legacySlots = DataManager.getDoctorAvailability(currentDoctorId);
      if (legacySlots.length > 0) {
        const dayNumbers = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const migrationResponse = await fetch('doctor-availability.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            availability: legacySlots.map(slot => ({
              dayOfWeek: dayNumbers.indexOf(slot.day) + 1,
              startTime: slot.startTime,
              endTime: slot.endTime
            }))
          })
        });
        const migrationResult = await migrationResponse.json();
        if (!migrationResponse.ok || !migrationResult.success) {
          throw new Error(migrationResult.error || 'Unable to migrate your saved schedule.');
        }
        availability = legacySlots.map(slot => ({
          dayOfWeek: dayNumbers.indexOf(slot.day) + 1,
          startTime: slot.startTime,
          endTime: slot.endTime
        }));
      }
    }
    renderAvailabilityEditor(availability);
  } catch (error) {
    container.textContent = error.message;
  }
}

function renderAvailabilityEditor(availability) {
  const dayNumbers = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7
  };
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const availabilityByDay = new Map(availability.map(slot => [Number(slot.dayOfWeek), slot]));
  const container = document.getElementById('availability-editor');

  container.innerHTML = days.map(day => {
    const slot = availabilityByDay.get(dayNumbers[day]) || { startTime: '', endTime: '' };
    const isActive = !!slot.startTime;

    return `
      <div class="availability-row" data-day="${day}">
        <div class="day-label">
          <input type="checkbox" id="check-${day}" ${isActive ? 'checked' : ''} onchange="toggleDay('${day}')">
          <label for="check-${day}">${day}</label>
        </div>
        <div class="time-inputs ${isActive ? '' : 'disabled'}" id="times-${day}">
          <input type="time" class="start-time" value="${slot.startTime}" ${isActive ? '' : 'disabled'}>
          <span>to</span>
          <input type="time" class="end-time" value="${slot.endTime}" ${isActive ? '' : 'disabled'}>
        </div>
      </div>
    `;
  }).join('');
}

function toggleDay(day) {
  const checkbox = document.getElementById(`check-${day}`);
  const timeContainer = document.getElementById(`times-${day}`);
  const inputs = timeContainer.querySelectorAll('input');

  if (checkbox.checked) {
    timeContainer.classList.remove('disabled');
    inputs.forEach(i => i.disabled = false);
  } else {
    timeContainer.classList.add('disabled');
    inputs.forEach(i => {
      i.disabled = true;
      i.value = '';
    });
  }
}

async function saveAvailability() {
  if (!currentDoctorId) {
    alert('Unable to save your schedule. Please sign in again.');
    return;
  }

  const rows = document.querySelectorAll('#availability-editor .availability-row');
  const slots = [];

  for (const row of rows) {
    const day = row.dataset.day;
    const checkbox = row.querySelector('input[type="checkbox"]');
    const startTime = row.querySelector('.start-time').value;
    const endTime = row.querySelector('.end-time').value;

    if (checkbox.checked && (!startTime || !endTime)) {
      alert(`Enter both start and end times for ${day}`);
      return;
    }
    if (checkbox.checked) {
      if (startTime >= endTime) {
        alert(`End time must be after start time for ${day}`);
        return;
      }
      slots.push({
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day) + 1,
        startTime,
        endTime
      });
    }
  }

  try {
    const response = await fetch('doctor-availability.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: slots })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to save your schedule.');
    }
    alert('Availability schedule saved successfully!');
  } catch (error) {
    alert(error.message);
  }
}


function startConsultation(appointmentId) {
  alert('Starting consultation - To be implemented');
}

async function completeAppointment(appointmentId) {
  const apt = doctorAppointments.find(a => String(a.id) === String(appointmentId));
  if (!apt || !confirm('Mark this appointment as completed?')) return;

  try {
    const response = await fetch('complete-doctor-appointment.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appointmentId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to complete the appointment.');
    }

    apt.status = 'Completed';
    alert('Appointment marked as completed');
    if (document.getElementById('section-appointments').style.display === 'none') {
      await loadDashboardSection();
    } else {
      await loadAppointmentsSection();
    }
  } catch (error) {
    alert(error.message);
  }
}

function viewPatientRecord(patientId) {
  const patient = DataManager.getPatientById(patientId);
  if (patient) {
    alert(`Patient: ${patient.name}\nEmail: ${patient.email}\nPhone: ${patient.phone}\nBlood Type: ${patient.bloodType}`);
  }
}

function scheduleAppointment(patientId) {
  alert('Schedule appointment - To be implemented');
}

function viewAppointmentDetails(appointmentId) {
  const apt = doctorAppointments.find(a => String(a.id) === String(appointmentId));
  if (!apt) return;

  showAppointmentDetails({
    title: 'Appointment details',
    personLabel: 'Patient',
    personName: apt.patientName,
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
          <h2 id="appointment-details-title">${escapeDoctorHtml(appointment.title)}</h2>
        </div>
        <button class="appointment-details-close" type="button" aria-label="Close appointment details" onclick="closeAppointmentDetails()">&times;</button>
      </header>
      <div class="appointment-details-body">
        <div class="appointment-details-person">
          <span class="appointment-details-avatar" aria-hidden="true">${escapeDoctorHtml((appointment.personName || '?').trim().charAt(0).toUpperCase())}</span>
          <div><span class="appointment-details-label">${escapeDoctorHtml(appointment.personLabel)}</span><strong>${escapeDoctorHtml(appointment.personName || 'Not available')}</strong></div>
        </div>
        <div class="appointment-details-grid">
          <div class="appointment-details-item"><span class="appointment-details-label">Date</span><strong>${escapeDoctorHtml(formatDate(appointment.date))}</strong></div>
          <div class="appointment-details-item"><span class="appointment-details-label">Time</span><strong>${escapeDoctorHtml(formatTime(appointment.time))}</strong></div>
        </div>
        <div class="appointment-details-item appointment-details-reason"><span class="appointment-details-label">Reason for visit</span><p>${escapeDoctorHtml(appointment.reason || 'No reason provided')}</p></div>
        <div class="appointment-details-status"><span class="appointment-details-label">Status</span><span class="status ${getAppointmentStatusClass(appointment.status)}">${escapeDoctorHtml(appointment.status)}</span></div>
      </div>
      <footer class="appointment-details-footer"><button class="btn-primary" type="button" onclick="closeAppointmentDetails()">Done</button></footer>
    </section>`;
  modal.addEventListener('click', event => {
    if (event.target === modal) closeAppointmentDetails();
  });
  document.addEventListener('keydown', handleAppointmentDetailsKeydown);
  document.body.appendChild(modal);
}

function handleAppointmentDetailsKeydown(event) {
  if (event.key === 'Escape') closeAppointmentDetails();
}

function closeAppointmentDetails() {
  const modal = document.getElementById('appointment-details-modal');
  if (modal) modal.remove();
  document.removeEventListener('keydown', handleAppointmentDetailsKeydown);
}

function createNewRecord() {
  alert('Create medical record form - To be implemented');
}

function editRecord(recordId) {
  alert('Edit medical record - To be implemented');
}

function viewFullRecord(recordId) {
  const record = DataManager.getMedicalRecords().find(r => r.id === recordId);
  if (record) {
    alert(`Medical Record\nDate: ${formatDate(record.date)}\nPatient: ${record.patientName}\nDiagnosis: ${record.diagnosis}\nPrescription: ${record.prescription}\nNotes: ${record.notes}`);
  }
}

function logoutUser() {
  AuthManager.logout();
}
