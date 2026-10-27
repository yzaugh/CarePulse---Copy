// ============================================
// CarePulse - Shared System Core
// Role-Based Access Control & Authentication
// ============================================

const UserRoles = {
  ADMIN: 'admin',
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  INVENTORY_MANAGER: 'inventory_manager'
};

const ROLE_PERMISSIONS = {
  [UserRoles.ADMIN]: ['users'],
  [UserRoles.DOCTOR]: ['dashboard', 'patients', 'appointments', 'records'],
  [UserRoles.PATIENT]: ['dashboard', 'my_records', 'my_appointments'],
  [UserRoles.RECEPTIONIST]: ['dashboard', 'patients', 'appointments', 'queue'],
  [UserRoles.INVENTORY_MANAGER]: ['dashboard', 'medicine', 'medical_supplies', 'utility_supplies']
};

const ROLE_DISPLAY = {
  admin: 'System Administrator',
  patient: 'Patient',
  doctor: 'Physician / Doctor',
  receptionist: 'Receptionist / Front Desk',
  inventory_manager: 'Inventory Manager'
};

const ROLE_COLORS = {
  admin: '#4CAF50',
  patient: '#2196F3',
  doctor: '#FF9800',
  receptionist: '#9C27B0',
  inventory_manager: '#00BCD4'
};

// ============================================
// SESSION MANAGEMENT
// ============================================

class AuthManager {
  static LOGIN_STORAGE_KEY = 'carepulse_user';
  static SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  static login(email, password, role) {
    // Validate credentials
    const users = this.getAllUsers();
    const user = users.find(u => u.email === email && u.password === password && u.role === role);

    if (!user) {
      return { success: false, message: 'Invalid credentials or role mismatch' };
    }

    const session = {
      id: this.generateSessionId(),
      email: user.email,
      name: user.name,
      role: user.role,
      timestamp: Date.now(),
      lastActivity: Date.now()
    };

    localStorage.setItem(this.LOGIN_STORAGE_KEY, JSON.stringify(session));
    this.startSessionTimeout();
    return { success: true, user: session };
  }

  static logout() {
    localStorage.removeItem(this.LOGIN_STORAGE_KEY);
    window.location.href = 'login.html';
  }

  static getCurrentUser() {
    const stored = localStorage.getItem(this.LOGIN_STORAGE_KEY);
    if (!stored) return null;

    try {
      const session = JSON.parse(stored);
      // Check session timeout
      if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
        this.logout();
        return null;
      }
      session.lastActivity = Date.now();
      localStorage.setItem(this.LOGIN_STORAGE_KEY, JSON.stringify(session));
      return session;
    } catch (e) {
      return null;
    }
  }

  static isAuthenticated() {
    return this.getCurrentUser() !== null;
  }

  static hasPermission(permission) {
    const user = this.getCurrentUser();
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) || false;
  }

  static requireRole(...roles) {
    const user = this.getCurrentUser();
    if (!user || !roles.includes(user.role)) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  static requirePermission(permission) {
    if (!this.hasPermission(permission)) {
      alert('You do not have permission to access this resource');
      return false;
    }
    return true;
  }

  static generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
  }

  static startSessionTimeout() {
    if (window.sessionTimeoutId) clearTimeout(window.sessionTimeoutId);
    window.sessionTimeoutId = setTimeout(() => {
      alert('Your session has expired. Please log in again.');
      this.logout();
    }, this.SESSION_TIMEOUT);
  }

  static getAllUsers() {
    const stored = localStorage.getItem('carepulse_all_users');
    if (stored) return JSON.parse(stored);
    return this.initDefaultUsers();
  }

  static initDefaultUsers() {
    const defaultUsers = [
      { id: 'user_001', email: 'admin@carepulse.com', password: 'admin123', name: 'Sarah Jenkins', role: UserRoles.ADMIN },
      { id: 'user_002', email: 'doctor@carepulse.com', password: 'doctor123', name: 'Dr. James Wilson', role: UserRoles.DOCTOR },
      { id: 'user_003', email: 'patient@carepulse.com', password: 'patient123', name: 'John Smith', role: UserRoles.PATIENT },
      { id: 'user_004', email: 'receptionist@carepulse.com', password: 'rec123', name: 'Emma Davis', role: UserRoles.RECEPTIONIST },
      { id: 'user_005', email: 'pharmacist@carepulse.com', password: 'pharm123', name: 'Michael Brown', role: UserRoles.INVENTORY_MANAGER },
      { id: 'user_006', email: 'inventory@carepulse.com', password: 'inv123', name: 'Lisa Anderson', role: UserRoles.INVENTORY_MANAGER }
    ];
    localStorage.setItem('carepulse_all_users', JSON.stringify(defaultUsers));
    return defaultUsers;
  }
}

// Global logout function for HTML onclick handlers
function logoutUser() {
  AuthManager.logout();
  window.location.href = 'login.html';
}

// ============================================
// DATA MANAGEMENT
// ============================================

class DataManager {
  static STORAGE_PREFIX = 'carepulse_';

    static initializeData() {
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'patients')) {
      this.initPatients();
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'doctors')) {
      this.initDoctors();
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'appointments')) {
      this.initAppointments();
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'medical_records')) {
      this.initMedicalRecords();
    }
    if (!localStorage.getItem(this.STORAGE_PREFIX + 'doctor_availability')) {
      this.initDoctorAvailability();
    }
  }

  static initDoctorAvailability() {
    const availability = [
      {
        doctorId: 'doc_001',
        slots: [
          { day: 'Monday', startTime: '09:00', endTime: '17:00' },
          { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
          { day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
          { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
          { day: 'Friday', startTime: '09:00', endTime: '17:00' }
        ]
      },
      {
        doctorId: 'doc_002',
        slots: [
          { day: 'Monday', startTime: '10:00', endTime: '16:00' },
          { day: 'Wednesday', startTime: '10:00', endTime: '16:00' },
          { day: 'Friday', startTime: '10:00', endTime: '16:00' }
        ]
      }
    ];
    localStorage.setItem(this.STORAGE_PREFIX + 'doctor_availability', JSON.stringify(availability));
  }


  static initPatients() {
    const patients = [
      {
        id: 'pat_001',
        name: 'John Smith',
        email: 'john.smith@email.com',
        phone: '+1-555-0101',
        dob: '1985-03-15',
        gender: 'Male',
        bloodType: 'O+',
        address: '123 Main St, Springfield, IL 62701',
        medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
        activeConditions: ['Hypertension'],
        lastVisit: '2025-09-10',
        registeredDate: '2023-01-15'
      },
      {
        id: 'pat_002',
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+1-555-0102',
        dob: '1992-07-22',
        gender: 'Female',
        bloodType: 'A-',
        address: '456 Oak Ave, Springfield, IL 62702',
        medicalHistory: ['Asthma'],
        activeConditions: [],
        lastVisit: '2025-09-05',
        registeredDate: '2024-03-20'
      },
      {
        id: 'pat_003',
        name: 'Michael Chen',
        email: 'm.chen@email.com',
        phone: '+1-555-0103',
        dob: '1988-11-10',
        gender: 'Male',
        bloodType: 'B+',
        address: '789 Pine Rd, Springfield, IL 62703',
        medicalHistory: [],
        activeConditions: [],
        lastVisit: '2025-09-08',
        registeredDate: '2024-06-10'
      }
    ];
    localStorage.setItem(this.STORAGE_PREFIX + 'patients', JSON.stringify(patients));
  }

  static initDoctors() {
    const doctors = [
      {
        id: 'doc_001',
        name: 'Dr. James Wilson',
        email: 'doctor@carepulse.com',
        phone: '+1-555-0201',
        specialization: 'General Medicine',
        licenseNo: 'LIC-12345',
        yearsExperience: 15,
        availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        consultationFee: 50
      },
      {
        id: 'doc_002',
        name: 'Dr. Emily Roberts',
        email: 'emily.roberts@carepulse.com',
        phone: '+1-555-0202',
        specialization: 'Cardiology',
        licenseNo: 'LIC-12346',
        yearsExperience: 12,
        availability: ['Monday', 'Wednesday', 'Friday'],
        consultationFee: 75
      },
      {
        id: 'doc_003',
        name: 'Dr. David Martinez',
        email: 'david.m@carepulse.com',
        phone: '+1-555-0203',
        specialization: 'Neurology',
        licenseNo: 'LIC-12347',
        yearsExperience: 10,
        availability: ['Tuesday', 'Thursday'],
        consultationFee: 80
      }
    ];
    localStorage.setItem(this.STORAGE_PREFIX + 'doctors', JSON.stringify(doctors));
  }

  static initAppointments() {
    const appointments = [
      {
        id: 'apt_001',
        patientId: 'pat_001',
        patientName: 'John Smith',
        doctorId: 'doc_001',
        doctorName: 'Dr. James Wilson',
        date: '2025-09-20',
        time: '10:00',
        status: 'scheduled',
        reason: 'Follow-up on blood pressure',
        notes: ''
      },
      {
        id: 'apt_002',
        patientId: 'pat_002',
        patientName: 'Sarah Johnson',
        doctorId: 'doc_002',
        doctorName: 'Dr. Emily Roberts',
        date: '2025-09-21',
        time: '14:30',
        status: 'scheduled',
        reason: 'Annual checkup',
        notes: ''
      },
      {
        id: 'apt_003',
        patientId: 'pat_003',
        patientName: 'Michael Chen',
        doctorId: 'doc_001',
        doctorName: 'Dr. James Wilson',
        date: '2025-09-22',
        time: '09:15',
        status: 'completed',
        reason: 'Initial consultation',
        notes: 'Patient in good health'
      }
    ];
    localStorage.setItem(this.STORAGE_PREFIX + 'appointments', JSON.stringify(appointments));
  }

  static initMedicalRecords() {
    const records = [
      {
        id: 'rec_001',
        patientId: 'pat_001',
        patientName: 'John Smith',
        doctorId: 'doc_001',
        doctorName: 'Dr. James Wilson',
        date: '2025-09-10',
        type: 'Consultation',
        diagnosis: 'Hypertension - controlled',
        prescription: 'Lisinopril 10mg daily',
        notes: 'BP readings have improved. Continue current medication.',
        vitals: {
          temperature: 98.6,
          bloodPressure: '138/88',
          heartRate: 72,
          weight: 185
        }
      },
      {
        id: 'rec_002',
        patientId: 'pat_002',
        patientName: 'Sarah Johnson',
        doctorId: 'doc_002',
        doctorName: 'Dr. Emily Roberts',
        date: '2025-09-05',
        type: 'Lab Results',
        diagnosis: 'Normal',
        prescription: 'None',
        notes: 'All blood tests within normal range',
        vitals: {
          temperature: 98.4,
          bloodPressure: '120/80',
          heartRate: 68,
          weight: 125
        }
      }
    ];
    localStorage.setItem(this.STORAGE_PREFIX + 'medical_records', JSON.stringify(records));
  }

  // Patients
  static getPatients() {
    return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'patients') || '[]');
  }

  static getPatientById(id) {
    return this.getPatients().find(p => p.id === id);
  }

  static addPatient(patient) {
    patient.id = 'pat_' + Date.now();
    patient.registeredDate = new Date().toISOString().split('T')[0];
    const patients = this.getPatients();
    patients.push(patient);
    localStorage.setItem(this.STORAGE_PREFIX + 'patients', JSON.stringify(patients));
    return patient;
  }

  static updatePatient(id, updates) {
    const patients = this.getPatients();
    const index = patients.findIndex(p => p.id === id);
    if (index !== -1) {
      patients[index] = { ...patients[index], ...updates };
      localStorage.setItem(this.STORAGE_PREFIX + 'patients', JSON.stringify(patients));
      return patients[index];
    }
  }

  // Doctors
  static getDoctors() {
    return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'doctors') || '[]');
  }

  static getDoctorById(id) {
    return this.getDoctors().find(d => d.id === id);
  }

  // Appointments
  static getAppointments() {
    return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'appointments') || '[]');
  }

  static getAppointmentsByPatient(patientId) {
    return this.getAppointments().filter(a => a.patientId === patientId);
  }

  static getAppointmentsByDoctor(doctorId) {
    return this.getAppointments().filter(a => a.doctorId === doctorId);
  }

  static addAppointment(appointment) {
    appointment.id = appointment.id || 'apt_' + Date.now();
    appointment.status = 'scheduled';
    const appointments = this.getAppointments();
    appointments.push(appointment);
    localStorage.setItem(this.STORAGE_PREFIX + 'appointments', JSON.stringify(appointments));
    return appointment;
  }

  static updateAppointment(id, updates) {
    const appointments = this.getAppointments();
    const index = appointments.findIndex(a => a.id === id);
    if (index !== -1) {
      appointments[index] = { ...appointments[index], ...updates };
      localStorage.setItem(this.STORAGE_PREFIX + 'appointments', JSON.stringify(appointments));
      return appointments[index];
    }
  }

  static cancelAppointment(id) {
    return this.updateAppointment(id, { status: 'cancelled' });
  }

    // Medical Records
  static getMedicalRecords() {
    return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'medical_records') || '[]');
  }

  static getRecordsByPatient(patientId) {
    return this.getMedicalRecords().filter(r => r.patientId === patientId);
  }

  static addMedicalRecord(record) {
    record.id = 'rec_' + Date.now();
    record.date = new Date().toISOString().split('T')[0];
    const records = this.getMedicalRecords();
    records.push(record);
    localStorage.setItem(this.STORAGE_PREFIX + 'medical_records', JSON.stringify(records));
    return record;
  }

  // Doctor Availability
  static getDoctorAvailability(doctorId) {
    const allAvailability = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'doctor_availability') || '[]');
    const doctorAvail = allAvailability.find(a => a.doctorId === doctorId);
    return doctorAvail ? doctorAvail.slots : [];
  }

  static updateDoctorAvailability(doctorId, slots) {
    const allAvailability = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'doctor_availability') || '[]');
    const index = allAvailability.findIndex(a => a.doctorId === doctorId);
    
    if (index !== -1) {
      allAvailability[index].slots = slots;
    } else {
      allAvailability.push({ doctorId, slots });
    }
    
    localStorage.setItem(this.STORAGE_PREFIX + 'doctor_availability', JSON.stringify(allAvailability));
  }

  static getAvailableSlots(doctorId, dateStr) {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[date.getDay()];
    
    const availability = this.getDoctorAvailability(doctorId);
    const daySlot = availability.find(s => s.day === dayName);
    
    if (!daySlot) return [];

    // Generate 30-minute slots
    const slots = [];
    let current = new Date(`${dateStr}T${daySlot.startTime}`);
    const end = new Date(`${dateStr}T${daySlot.endTime}`);
    
    const existingAppointments = this.getAppointmentsByDoctor(doctorId)
      .filter(a => a.date === dateStr && a.status !== 'cancelled');

    while (current < end) {
      const timeStr = current.toTimeString().substring(0, 5);
      const isBooked = existingAppointments.some(a => a.time === timeStr);
      
      if (!isBooked) {
        slots.push(timeStr);
      }
      
      current.setMinutes(current.getMinutes() + 30);
    }
    
    return slots;
  }
}


// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getUpcomingAppointments(appointments) {
  const today = getCurrentDate();
  return appointments.filter(a => a.date >= today && a.status !== 'cancelled').sort((a, b) => new Date(a.date) - new Date(b.date));
}

function generateId(prefix) {
  return prefix + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize data on page load
document.addEventListener('DOMContentLoaded', () => {
  if (AuthManager.isAuthenticated()) {
    DataManager.initializeData();
  }
});
