// Appointment Scheduling Module Controller

let selectedDate = getCurrentDate();
let allAppointments = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requirePermission('appointments')) return;

  initializeAppointments();
  loadCalendarView();
});

function initializeAppointments() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
  }

  allAppointments = DataManager.getAppointments();
  populateBookingSelects();
}

function loadSection(sectionName) {
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
  event.target.closest('.nav-item')?.classList.add('active');

  const titles = {
    calendar: 'Calendar View',
    schedule: 'All Appointments',
    book: 'Book New Appointment',
    analytics: 'Appointment Analytics'
  };
  document.getElementById('page-title').innerText = titles[sectionName] || 'Appointments';

  switch(sectionName) {
    case 'calendar':
      loadCalendarView();
      break;
    case 'schedule':
      loadScheduleSection();
      break;
    case 'book':
      resetBookingForm();
      break;
    case 'analytics':
      loadAnalyticsSection();
      break;
  }
}

// Calendar View
function loadCalendarView() {
  renderCalendar();
  displayDateAppointments(selectedDate);
}

function renderCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  let calendar = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;">';
  calendar += '<div style="font-weight: bold; text-align: center;">Sun</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Mon</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Tue</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Wed</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Thu</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Fri</div>';
  calendar += '<div style="font-weight: bold; text-align: center;">Sat</div>';

  for (let i = 0; i < startDay; i++) {
    calendar += '<div></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasAppointments = allAppointments.some(a => a.date === dateStr);
    const isSelected = dateStr === selectedDate;

    calendar += `<div class="calendar-day ${isSelected ? 'active' : ''} ${hasAppointments ? 'has-appointments' : ''}" onclick="selectDate('${dateStr}')" style="position: relative;">
      ${day}
      ${hasAppointments ? '<span style="position: absolute; top: 2px; right: 5px; color: var(--accent-green); font-weight: bold;">•</span>' : ''}
    </div>`;
  }

  calendar += '</div>';
  calendar += `<p style="text-align: center; margin-top: 15px; color: var(--text-secondary);">${months[month]} ${year}</p>`;

  document.getElementById('calendar-container').innerHTML = calendar;
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  renderCalendar();
  displayDateAppointments(dateStr);
}

function displayDateAppointments(dateStr) {
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('selected-date-display').innerText = `Appointments for ${formattedDate}`;

  const dayAppointments = allAppointments.filter(a => a.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
  const tbody = document.getElementById('calendar-appointments');

  if (dayAppointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No appointments for this date</td></tr>';
  } else {
    tbody.innerHTML = dayAppointments.map(apt => `
      <tr>
        <td>${formatTime(apt.time)}</td>
        <td>${apt.patientName}</td>
        <td>${apt.doctorName}</td>
        <td><span class="status ${apt.status}">${apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}</span></td>
        <td>
          <button class="btn-small" onclick="viewAppointmentDetail('${apt.id}')">View</button>
          ${apt.status === 'scheduled' ? `<button class="btn-small danger" onclick="cancelAppointmentScheduler('${apt.id}')">Cancel</button>` : ''}
        </td>
      </tr>
    `).join('');
  }
}

// Schedule Section
function loadScheduleSection() {
  const tbody = document.getElementById('appointments-table');

  tbody.innerHTML = allAppointments.map(apt => `
    <tr>
      <td><strong>${apt.id}</strong></td>
      <td>${formatDate(apt.date)}</td>
      <td>${formatTime(apt.time)}</td>
      <td>${apt.patientName}</td>
      <td>${apt.doctorName}</td>
      <td>${apt.reason}</td>
      <td><span class="status ${apt.status}">${apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}</span></td>
      <td>
        <button class="btn-small" onclick="viewAppointmentDetail('${apt.id}')">View</button>
        ${apt.status === 'scheduled' ? `<button class="btn-small danger" onclick="cancelAppointmentScheduler('${apt.id}')">Cancel</button>` : ''}
        <button class="btn-small danger" onclick="deleteAppointmentScheduler('${apt.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterAppointments() {
  const statusFilter = document.getElementById('status-filter').value;
  const filtered = statusFilter ? allAppointments.filter(a => a.status === statusFilter) : allAppointments;
  const tbody = document.getElementById('appointments-table');

  tbody.innerHTML = filtered.map(apt => `
    <tr>
      <td><strong>${apt.id}</strong></td>
      <td>${formatDate(apt.date)}</td>
      <td>${formatTime(apt.time)}</td>
      <td>${apt.patientName}</td>
      <td>${apt.doctorName}</td>
      <td>${apt.reason}</td>
      <td><span class="status ${apt.status}">${apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}</span></td>
      <td>
        <button class="btn-small" onclick="viewAppointmentDetail('${apt.id}')">View</button>
        ${apt.status === 'scheduled' ? `<button class="btn-small danger" onclick="cancelAppointmentScheduler('${apt.id}')">Cancel</button>` : ''}
        <button class="btn-small danger" onclick="deleteAppointmentScheduler('${apt.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Booking Section
function populateBookingSelects() {
  const patients = DataManager.getPatients();
  const doctors = DataManager.getDoctors();

  const patientSelect = document.getElementById('booking-patient');
  patients.forEach(patient => {
    const option = document.createElement('option');
    option.value = patient.id;
    option.text = `${patient.name} (${patient.email})`;
    patientSelect.appendChild(option);
  });

  const doctorSelect = document.getElementById('booking-doctor');
  doctors.forEach(doctor => {
    const option = document.createElement('option');
    option.value = doctor.id;
    option.text = `${doctor.name} (${doctor.specialization})`;
    doctorSelect.appendChild(option);
  });
}

function resetBookingForm() {
  document.getElementById('booking-form').reset();
  document.getElementById('booking-date').valueAsDate = new Date();
}

function updateAvailableTimes() {
  // Enhancement: filter available times based on doctor's schedule
  const doctorId = document.getElementById('booking-doctor').value;
  const date = document.getElementById('booking-date').value;
  
  if (!doctorId || !date) return;

  const availableSlots = DataManager.getAvailableSlots(doctorId, date);
  const timeSelect = document.getElementById('booking-time');
  
  // Clear and repopulate time options
  timeSelect.innerHTML = '<option value="">Select time...</option>';
  availableSlots.forEach(slot => {
    const option = document.createElement('option');
    option.value = slot;
    option.text = formatTime(slot);
    timeSelect.appendChild(option);
  });
}

function submitBooking(event) {
  event.preventDefault();

  const patientId = document.getElementById('booking-patient').value;
  const doctorId = document.getElementById('booking-doctor').value;
  const date = document.getElementById('booking-date').value;
  const time = document.getElementById('booking-time').value;
  const reason = document.getElementById('booking-reason').value;

  const patient = DataManager.getPatientById(patientId);
  const doctor = DataManager.getDoctorById(doctorId);

  if (!patient || !doctor || !date || !time) {
    alert('Please fill in all required fields');
    return;
  }

  const conflict = allAppointments.some(a => a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'cancelled');
  if (conflict) {
    alert('This time slot is already booked. Please select another time.');
    return;
  }

  const appointment = {
    patientId: patientId,
    patientName: patient.name,
    doctorId: doctorId,
    doctorName: doctor.name,
    date: date,
    time: time,
    reason: reason,
    notes: document.getElementById('booking-notes').value
  };

  const created = DataManager.addAppointment(appointment);
  alert(`Appointment scheduled successfully!\nAppointment ID: ${created.id}\nDate: ${formatDate(created.date)} at ${formatTime(created.time)}`);

  resetBookingForm();
  allAppointments = DataManager.getAppointments();
  loadSection('schedule');
}

// Analytics Section
function loadAnalyticsSection() {
  const total = allAppointments.length;
  const completed = allAppointments.filter(a => a.status === 'completed').length;
  const scheduled = allAppointments.filter(a => a.status === 'scheduled').length;
  const cancelled = allAppointments.filter(a => a.status === 'cancelled').length;

  document.getElementById('total-appointments').innerText = total;
  document.getElementById('completed-appointments').innerText = completed;
  document.getElementById('scheduled-appointments').innerText = scheduled;
  document.getElementById('cancelled-appointments').innerText = cancelled;

  const doctors = DataManager.getDoctors();
  const doctorAnalytics = doctors.map(doctor => {
    const doctorApts = allAppointments.filter(a => a.doctorId === doctor.id);
    const thisWeekApts = doctorApts.filter(a => {
      const aptDate = new Date(a.date);
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekEnd = new Date(today.setDate(today.getDate() + 6));
      return aptDate >= weekStart && aptDate <= weekEnd;
    });

    return {
      ...doctor,
      totalApts: doctorApts.length,
      thisWeek: thisWeekApts.length,
      completed: doctorApts.filter(a => a.status === 'completed').length,
      upcoming: doctorApts.filter(a => a.status === 'scheduled').length
    };
  });

  const doctorTbody = document.getElementById('doctor-analytics');
  doctorTbody.innerHTML = doctorAnalytics.map(doc => `
    <tr>
      <td>${doc.name}</td>
      <td>${doc.specialization}</td>
      <td>${doc.totalApts}</td>
      <td>${doc.thisWeek}</td>
      <td>${doc.completed}</td>
      <td>${doc.upcoming}</td>
    </tr>
  `).join('');

  const patients = DataManager.getPatients();
  const patientAnalytics = patients.map(patient => {
    const patientApts = allAppointments.filter(a => a.patientId === patient.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastApt = patientApts[0];
    const nextApt = patientApts.find(a => a.status === 'scheduled' && new Date(a.date) >= new Date());

    return {
      name: patient.name,
      total: patientApts.length,
      lastApt: lastApt ? formatDate(lastApt.date) : 'N/A',
      nextApt: nextApt ? formatDate(nextApt.date) : 'None scheduled',
      status: nextApt ? 'Upcoming' : 'No upcoming'
    };
  }).filter(p => p.total > 0);

  const patientTbody = document.getElementById('patient-analytics');
  if (patientAnalytics.length > 0) {
    patientTbody.innerHTML = patientAnalytics.map(patient => `
      <tr>
        <td>${patient.name}</td>
        <td>${patient.total}</td>
        <td>${patient.lastApt}</td>
        <td>${patient.nextApt}</td>
        <td><span class="status ${patient.status === 'Upcoming' ? 'confirmed' : 'pending'}">${patient.status}</span></td>
      </tr>
    `).join('');
  } else {
    patientTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No patient appointment history</td></tr>';
  }
}

// Action functions
function viewAppointmentDetail(appointmentId) {
  const apt = allAppointments.find(a => a.id === appointmentId);
  if (apt) {
    alert(`Appointment Details\n\nID: ${apt.id}\nPatient: ${apt.patientName}\nDoctor: ${apt.doctorName}\nDate: ${formatDate(apt.date)} at ${formatTime(apt.time)}\nReason: ${apt.reason}\nStatus: ${apt.status}\nNotes: ${apt.notes || 'None'}`);
  }
}

function cancelAppointmentScheduler(appointmentId) {
  const apt = allAppointments.find(a => a.id === appointmentId);
  if (apt && confirm(`Cancel appointment for ${apt.patientName} on ${formatDate(apt.date)}?`)) {
    DataManager.cancelAppointment(appointmentId);
    allAppointments = DataManager.getAppointments();
    alert('Appointment cancelled successfully');
    loadCalendarView();
    loadScheduleSection();
  }
}

function deleteAppointmentScheduler(appointmentId) {
  const apt = allAppointments.find(a => a.id === appointmentId);
  if (apt && confirm(`Permanently delete appointment for ${apt.patientName}? This cannot be undone.`)) {
    const appointments = DataManager.getAppointments().filter(a => a.id !== appointmentId);
    localStorage.setItem(DataManager.STORAGE_PREFIX + 'appointments', JSON.stringify(appointments));
    allAppointments = DataManager.getAppointments();
    alert('Appointment deleted successfully');
    loadCalendarView();
    loadScheduleSection();
  }
}

// Edit appointment function
function editAppointment(appointmentId) {
  const apt = allAppointments.find(a => a.id === appointmentId);
  if (!apt) {
    alert('Appointment not found');
    return;
  }

  const modalHtml = `
    <div id="edit-apt-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Edit Appointment</h2>
          <button onclick="closeModal('edit-apt-modal')" style="background:none;border:none;cursor:pointer;font-size:24px;">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="edit-apt-date" value="${apt.date}">
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="time" id="edit-apt-time" value="${apt.time}">
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="edit-apt-status">
              <option value="scheduled" ${apt.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="completed" ${apt.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${apt.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reason</label>
            <textarea id="edit-apt-reason">${apt.reason}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-small" style="background-color:#707ebe;" onclick="closeModal('edit-apt-modal')">Cancel</button>
          <button class="btn-small" onclick="saveAppointmentEdit('${appointmentId}')">Save Changes</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveAppointmentEdit(appointmentId) {
  const date = document.getElementById('edit-apt-date').value;
  const time = document.getElementById('edit-apt-time').value;
  const status = document.getElementById('edit-apt-status').value;
  const reason = document.getElementById('edit-apt-reason').value;

  DataManager.updateAppointment(appointmentId, { date, time, status, reason });
  allAppointments = DataManager.getAppointments();
  closeModal('edit-apt-modal');
  alert('Appointment updated successfully');
  loadCalendarView();
  loadScheduleSection();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function logoutUser() {
  AuthManager.logout();
}

// Helper
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];