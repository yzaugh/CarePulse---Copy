// Electronic Health Records (EHR) Module Controller

let currentRecord = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.requirePermission('records')) return;

  initializeEHR();
  loadRecordsSection();
});

function initializeEHR() {
  const user = AuthManager.getCurrentUser();
  if (user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0, 2).toUpperCase();
  }

  populatePatientSelect();
  populateDoctorSelect();
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
    records: 'Electronic Health Records',
    create: 'Create New Record',
    search: 'Search Records'
  };
  document.getElementById('page-title').innerText = titles[sectionName] || 'EHR';

  switch(sectionName) {
    case 'records':
      loadRecordsSection();
      break;
    case 'create':
      resetRecordForm();
      break;
    case 'search':
      clearSearchResults();
      break;
  }
}

function loadRecordsSection() {
  const records = DataManager.getMedicalRecords();
  const tbody = document.getElementById('records-table');

  tbody.innerHTML = records.map(record => `
    <tr>
      <td><strong>${record.id}</strong></td>
      <td>${formatDate(record.date)}</td>
      <td>${record.patientName}</td>
      <td>${record.doctorName}</td>
      <td>${record.type}</td>
      <td>${record.diagnosis.substring(0, 50)}...</td>
      <td>
        <button class="btn-small" onclick="viewRecord('${record.id}')">View</button>
        <button class="btn-small" onclick="editRecord('${record.id}')">Edit</button>
        <button class="btn-small danger" onclick="deleteRecord('${record.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No medical records found</td></tr>';
  }
}

function populatePatientSelect() {
  const patients = DataManager.getPatients();
  const select = document.getElementById('patient-select');
  
  patients.forEach(patient => {
    const option = document.createElement('option');
    option.value = patient.id;
    option.text = `${patient.name} (${patient.email})`;
    select.appendChild(option);
  });
}

function populateDoctorSelect() {
  const doctors = DataManager.getDoctors();
  const select = document.getElementById('doctor-select');
  
  doctors.forEach(doctor => {
    const option = document.createElement('option');
    option.value = doctor.id;
    option.text = `${doctor.name} (${doctor.specialization})`;
    select.appendChild(option);
  });
}

function submitRecordForm(event) {
  event.preventDefault();

  const patientId = document.getElementById('patient-select').value;
  const doctorId = document.getElementById('doctor-select').value;
  const patient = DataManager.getPatientById(patientId);
  const doctor = DataManager.getDoctorById(doctorId);

  if (!patient || !doctor) {
    alert('Please select both patient and doctor');
    return;
  }

  const record = {
    patientId: patientId,
    patientName: patient.name,
    doctorId: doctorId,
    doctorName: doctor.name,
    type: document.getElementById('record-type').value,
    date: document.getElementById('record-date').value,
    diagnosis: document.getElementById('record-diagnosis').value,
    prescription: document.getElementById('record-prescription').value || 'None',
    notes: document.getElementById('record-notes').value,
    vitals: {
      temperature: document.getElementById('vital-temp').value ? parseFloat(document.getElementById('vital-temp').value) : null,
      bloodPressure: document.getElementById('vital-bp').value,
      heartRate: document.getElementById('vital-hr').value ? parseInt(document.getElementById('vital-hr').value) : null,
      weight: document.getElementById('vital-weight').value ? parseInt(document.getElementById('vital-weight').value) : null
    }
  };

  const createdRecord = DataManager.addMedicalRecord(record);
  alert(`Medical record created successfully (ID: ${createdRecord.id})`);
  
  resetRecordForm();
  loadRecordsSection();
  loadSection('records');
}

function resetRecordForm() {
  document.getElementById('record-form').reset();
  document.getElementById('record-date').valueAsDate = new Date();
}

function viewRecord(recordId) {
  const record = DataManager.getMedicalRecords().find(r => r.id === recordId);
  if (!record) return;

  currentRecord = record;

  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <div style="background-color: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0;">Record Information</h3>
      <p><strong>Record ID:</strong> ${record.id}</p>
      <p><strong>Date:</strong> ${formatDate(record.date)}</p>
      <p><strong>Patient:</strong> ${record.patientName}</p>
      <p><strong>Doctor:</strong> ${record.doctorName}</p>
      <p><strong>Type:</strong> ${record.type}</p>
    </div>

    <div style="background-color: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0;">Clinical Information</h3>
      <p><strong>Diagnosis:</strong></p>
      <p>${record.diagnosis}</p>
      <p><strong>Prescription:</strong></p>
      <p>${record.prescription}</p>
      <p><strong>Notes:</strong></p>
      <p>${record.notes || 'N/A'}</p>
    </div>

    ${record.vitals ? `
      <div style="background-color: var(--bg-primary); padding: 15px; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0;">Vital Signs</h3>
        <p><strong>Temperature:</strong> ${record.vitals.temperature ? record.vitals.temperature + '°F' : 'N/A'}</p>
        <p><strong>Blood Pressure:</strong> ${record.vitals.bloodPressure || 'N/A'}</p>
        <p><strong>Heart Rate:</strong> ${record.vitals.heartRate ? record.vitals.heartRate + ' bpm' : 'N/A'}</p>
        <p><strong>Weight:</strong> ${record.vitals.weight ? record.vitals.weight + ' lbs' : 'N/A'}</p>
      </div>
    ` : ''}
  `;

  document.getElementById('record-modal').style.display = 'flex';
}

function editRecord(recordId) {
  alert('Edit record functionality - To be implemented with full form');
}

function deleteRecord(recordId) {
  if (confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
    const records = DataManager.getMedicalRecords();
    const filtered = records.filter(r => r.id !== recordId);
    localStorage.setItem(DataManager.STORAGE_PREFIX + 'medical_records', JSON.stringify(filtered));
    alert('Record deleted successfully');
    loadRecordsSection();
  }
}

function editCurrentRecord() {
  if (currentRecord) {
    alert(`Edit record ${currentRecord.id} - To be implemented`);
  }
}

function downloadCurrentRecord() {
  if (!currentRecord) return;

  const content = `MEDICAL RECORD
================
Record ID: ${currentRecord.id}
Date: ${formatDate(currentRecord.date)}
Patient: ${currentRecord.patientName}
Doctor: ${currentRecord.doctorName}
Type: ${currentRecord.type}

DIAGNOSIS/FINDINGS:
${currentRecord.diagnosis}

PRESCRIPTION:
${currentRecord.prescription}

NOTES:
${currentRecord.notes || 'None'}

VITAL SIGNS:
${currentRecord.vitals ? `
Temperature: ${currentRecord.vitals.temperature ? currentRecord.vitals.temperature + '°F' : 'N/A'}
Blood Pressure: ${currentRecord.vitals.bloodPressure || 'N/A'}
Heart Rate: ${currentRecord.vitals.heartRate ? currentRecord.vitals.heartRate + ' bpm' : 'N/A'}
Weight: ${currentRecord.vitals.weight ? currentRecord.vitals.weight + ' lbs' : 'N/A'}
` : 'N/A'}

Generated: ${new Date().toLocaleString()}
`;

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', `medical_record_${currentRecord.id}.txt`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  closeRecordModal();
}

function closeRecordModal() {
  document.getElementById('record-modal').style.display = 'none';
}

function performSearch() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const records = DataManager.getMedicalRecords();

  const filtered = records.filter(record => 
    record.patientName.toLowerCase().includes(searchTerm) ||
    record.doctorName.toLowerCase().includes(searchTerm) ||
    record.id.toLowerCase().includes(searchTerm) ||
    record.type.toLowerCase().includes(searchTerm)
  );

  const tbody = document.getElementById('search-results');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No records match your search</td></tr>';
  } else {
    tbody.innerHTML = filtered.map(record => `
      <tr>
        <td><strong>${record.id}</strong></td>
        <td>${formatDate(record.date)}</td>
        <td>${record.patientName}</td>
        <td>${record.doctorName}</td>
        <td>${record.type}</td>
        <td>${record.diagnosis.substring(0, 50)}...</td>
        <td>
          <button class="btn-small" onclick="viewRecord('${record.id}')">View</button>
          <button class="btn-small" onclick="downloadCurrentRecord()">Download</button>
        </td>
      </tr>
    `).join('');
  }
}

function clearSearchResults() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">Enter search terms to filter records</td></tr>';
}

function logoutUser() {
  AuthManager.logout();
}
