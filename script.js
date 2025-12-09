// Data Storage (In a real app, this would be a database)
let students = JSON.parse(localStorage.getItem('students')) || [];
let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
let attendance = JSON.parse(localStorage.getItem('attendance')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// School Location Settings (replace with your actual school coordinates)
const SCHOOL_LOCATION = {
    latitude: 40.1792, // Example: Yerevan, Armenia coordinates
    longitude: 44.4991,
    radius: 200 // meters - distance from school to allow "present" marking
};

// Location tracking
let userLocation = null;
let isLocationEnabled = false;

// Function to get available classrooms for each grade (dynamically from registered students)
function getAvailableClassrooms(grade) {
    const gradeStudents = students.filter(s => s.grade === grade);
    const classrooms = [...new Set(gradeStudents.map(s => s.classroom))];
    return classrooms.sort();
}


// Automatic attendance system settings
const ATTENDANCE_WINDOW = {
    startTime: 8 * 60, // 8:00 AM in minutes
    endTime: 9 * 60,   // 9:00 AM in minutes
    autoAbsentDelay: 5 * 60 * 1000 // 5 minutes after end time in milliseconds
};

// Global timer for automatic absence marking
let autoAbsentTimer = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    
    // Set today's date for teacher dashboard
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = today;
    
    // Add secret admin access (press Ctrl + Alt + A)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.altKey && e.key === 'a') {
            e.preventDefault();
            showAdminAccess();
        }
    });
    
    // Check if user is already logged in
    if (currentUser) {
        if (currentUser.role === 'student') {
            showStudentDashboard();
        } else if (currentUser.role === 'teacher') {
            showTeacherDashboard();
        } else if (currentUser.role === 'admin') {
            showAdminDashboard();
        }
    } else {
        showRoleSelection();
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize automatic attendance system
    initializeAutoAttendanceSystem();
});

function setupEventListeners() {
    // Student forms
    document.getElementById('student-login-form').addEventListener('submit', handleStudentLogin);
    document.getElementById('student-register-form').addEventListener('submit', handleStudentRegister);
    
    // Teacher forms
    document.getElementById('teacher-login-form').addEventListener('submit', handleTeacherLogin);
    document.getElementById('teacher-register-form').addEventListener('submit', handleTeacherRegister);
    
    // No longer need grade selection listener for student registration since classroom is now text input
    
    // Grade selection for teacher dashboard
    document.getElementById('teacher-grade-select').addEventListener('change', updateTeacherClassrooms);
    document.getElementById('teacher-classroom-select').addEventListener('change', enableLoadButton);
}

// Navigation functions
function showRoleSelection() {
    hideAllSections();
    document.querySelector('.role-selection').classList.remove('hidden');
}

function showStudentLogin() {
    hideAllSections();
    document.getElementById('student-section').classList.remove('hidden');
    document.getElementById('student-login-form').classList.remove('hidden');
    document.getElementById('student-register-form').classList.add('hidden');
    document.getElementById('student-login-tab').classList.add('active');
    document.getElementById('student-register-tab').classList.remove('active');
}

function showStudentRegister() {
    document.getElementById('student-login-form').classList.add('hidden');
    document.getElementById('student-register-form').classList.remove('hidden');
    document.getElementById('student-login-tab').classList.remove('active');
    document.getElementById('student-register-tab').classList.add('active');
}

// Admin password for teacher access (in production, this should be more secure)
const ADMIN_PASSWORD = "teacher2024";
const MAIN_ADMIN_PASSWORD = "admin2024";

function showTeacherAccess() {
    document.getElementById('teacher-access-modal').classList.remove('hidden');
    document.getElementById('admin-password').focus();
    
    // Add enter key listener for admin password
    document.getElementById('admin-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyAdminAccess();
        }
    });
}

function closeTeacherAccess() {
    document.getElementById('teacher-access-modal').classList.add('hidden');
    document.getElementById('admin-password').value = '';
}

function verifyAdminAccess() {
    const enteredPassword = document.getElementById('admin-password').value;
    
    if (enteredPassword === ADMIN_PASSWORD) {
        closeTeacherAccess();
        showTeacherLogin();
        showCustomAlert('Բարեհաջող մուտք ուսուցչական բաժին', 'success', 'Մուտք Լիազորված');
    } else {
        showCustomAlert('Սխալ ադմինի գաղտնաբառ: Միայն լիազորված ուսուցիչներն են կարող մուտք գործել', 'error', 'Մուտք Մերժված');
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-password').focus();
    }
}

// Secret admin access counter
let adminClickCount = 0;
let adminClickTimer = null;

function adminSecretClick() {
    adminClickCount++;
    
    // Reset counter after 2 seconds of no clicks
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => {
        adminClickCount = 0;
    }, 2000);
    
    // Show admin access after 5 clicks
    if (adminClickCount >= 5) {
        adminClickCount = 0;
        showAdminAccess();
    }
}

// Admin Access Functions
function showAdminAccess() {
    document.getElementById('admin-access-modal').classList.remove('hidden');
    document.getElementById('admin-main-password').focus();
    
    document.getElementById('admin-main-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyAdminMainAccess();
        }
    });
}

function closeAdminAccess() {
    document.getElementById('admin-access-modal').classList.add('hidden');
    document.getElementById('admin-main-password').value = '';
}

function verifyAdminMainAccess() {
    const enteredPassword = document.getElementById('admin-main-password').value;
    
    if (enteredPassword === MAIN_ADMIN_PASSWORD) {
        closeAdminAccess();
        currentUser = { role: 'admin', name: 'Administrator' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        try {
            showAdminDashboard();
            showCustomAlert('Բարեհաջող մուտք ադմինիստրատիվ վահանակ', 'success', 'Ադմինի Մուտք');
        } catch (error) {
            console.error('Error showing admin dashboard:', error);
            showCustomAlert('Ադմինի վահանակի բեռնման սխալ', 'error', 'Սխալ');
            showRoleSelection();
        }
    } else {
        showCustomAlert('Սխալ ադմինի գաղտնաբառ: Մուտքը մերժված է', 'error', 'Մուտք Մերժված');
        document.getElementById('admin-main-password').value = '';
        document.getElementById('admin-main-password').focus();
    }
}

// Admin Dashboard Functions
function showAdminDashboard() {
    try {
        hideAllSections();
        
        // Check if admin dashboard exists
        const adminDashboard = document.getElementById('admin-dashboard');
        if (!adminDashboard) {
            throw new Error('Admin dashboard not found');
        }
        
        adminDashboard.classList.remove('hidden');
        
        // Set today's date for attendance overview
        const today = new Date().toISOString().split('T')[0];
        const dateElement = document.getElementById('admin-attendance-date');
        if (dateElement) {
            dateElement.value = today;
        }
        
        // Load admin data
        loadAdminStatistics();
        loadStudentsManagement();
        loadAttendanceOverview();
        
        console.log('Admin dashboard loaded successfully');
    } catch (error) {
        console.error('Error in showAdminDashboard:', error);
        showCustomAlert('Ադմինի վահանակի բեռնման սխալ: ' + error.message, 'error', 'Սխալ');
        showRoleSelection();
    }
}

function loadAdminStatistics() {
    document.getElementById('total-students').textContent = students.length;
    document.getElementById('total-teachers').textContent = teachers.length;
    document.getElementById('total-records').textContent = attendance.length;
    
    // Calculate today's attendance
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today && a.status === 'present').length;
    document.getElementById('today-attendance').textContent = todayAttendance;
}

function showStudentsManagement() {
    document.getElementById('students-management').classList.remove('hidden');
    document.getElementById('teachers-management').classList.add('hidden');
    document.getElementById('students-tab').classList.add('active');
    document.getElementById('teachers-tab').classList.remove('active');
    loadStudentsManagement();
}

function showTeachersManagement() {
    document.getElementById('students-management').classList.add('hidden');
    document.getElementById('teachers-management').classList.remove('hidden');
    document.getElementById('students-tab').classList.remove('active');
    document.getElementById('teachers-tab').classList.add('active');
    loadTeachersManagement();
}

function loadStudentsManagement() {
    const container = document.getElementById('students-list');
    
    if (students.length === 0) {
        container.innerHTML = '<p class="no-data">Աշակերտներ չկան</p>';
        return;
    }
    
    container.innerHTML = students.map(student => {
        const attendanceCount = attendance.filter(a => a.studentId === student.id).length;
        const presentCount = attendance.filter(a => a.studentId === student.id && a.status === 'present').length;
        const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <h4>${student.name}</h4>
                    <p><strong>Օգտատեր:</strong> ${student.username}</p>
                    <p><strong>Էլ. փոստ:</strong> ${student.email}</p>
                    <p><strong>Դասարան:</strong> ${student.grade}${student.classroom}</p>
                    <p><strong>Ներկայության տոկոս:</strong> ${attendanceRate}%</p>
                    <p><strong>Գրառումներ:</strong> ${attendanceCount}</p>
                </div>
                <div class="user-actions">
                    <button onclick="viewStudentAttendance(${student.id})" class="action-btn view">📊 Ներկայություն</button>
                    <button onclick="removeStudent(${student.id})" class="action-btn danger">🗑️ Հեռացնել</button>
                </div>
            </div>
        `;
    }).join('');
}

function loadTeachersManagement() {
    const container = document.getElementById('teachers-list');
    
    if (teachers.length === 0) {
        container.innerHTML = '<p class="no-data">Ուսուցիչներ չկան</p>';
        return;
    }
    
    container.innerHTML = teachers.map(teacher => {
        const registrationDate = new Date(teacher.id).toLocaleDateString('hy-AM');
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <h4>${teacher.name}</h4>
                    <p><strong>Օգտատեր:</strong> ${teacher.username}</p>
                    <p><strong>Էլ. փոստ:</strong> ${teacher.email}</p>
                    <p><strong>Առարկա:</strong> ${teacher.subject}</p>
                    <p><strong>Գրանցված:</strong> ${registrationDate}</p>
                </div>
                <div class="user-actions">
                    <button onclick="removeTeacher(${teacher.id})" class="action-btn danger">🗑️ Հեռացնել</button>
                </div>
            </div>
        `;
    }).join('');
}

function filterStudents() {
    const gradeFilter = document.getElementById('grade-filter').value;
    const searchTerm = document.getElementById('student-search').value.toLowerCase();
    
    const filteredStudents = students.filter(student => {
        const matchesGrade = !gradeFilter || student.grade === gradeFilter;
        const matchesSearch = !searchTerm || 
            student.name.toLowerCase().includes(searchTerm) ||
            student.username.toLowerCase().includes(searchTerm) ||
            student.email.toLowerCase().includes(searchTerm);
        return matchesGrade && matchesSearch;
    });
    
    displayFilteredStudents(filteredStudents);
}

function searchStudents() {
    filterStudents();
}

function searchTeachers() {
    const searchTerm = document.getElementById('teacher-search').value.toLowerCase();
    
    const filteredTeachers = teachers.filter(teacher => {
        return teacher.name.toLowerCase().includes(searchTerm) ||
               teacher.username.toLowerCase().includes(searchTerm) ||
               teacher.email.toLowerCase().includes(searchTerm) ||
               teacher.subject.toLowerCase().includes(searchTerm);
    });
    
    displayFilteredTeachers(filteredTeachers);
}

function displayFilteredStudents(filteredStudents) {
    const container = document.getElementById('students-list');
    
    if (filteredStudents.length === 0) {
        container.innerHTML = '<p class="no-data">Ոչ մի աշակերտ չի գտնվել</p>';
        return;
    }
    
    container.innerHTML = filteredStudents.map(student => {
        const attendanceCount = attendance.filter(a => a.studentId === student.id).length;
        const presentCount = attendance.filter(a => a.studentId === student.id && a.status === 'present').length;
        const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <h4>${student.name}</h4>
                    <p><strong>Օգտատեր:</strong> ${student.username}</p>
                    <p><strong>Էլ. փոստ:</strong> ${student.email}</p>
                    <p><strong>Դասարան:</strong> ${student.grade}${student.classroom}</p>
                    <p><strong>Ներկայության տոկոս:</strong> ${attendanceRate}%</p>
                    <p><strong>Գրառումներ:</strong> ${attendanceCount}</p>
                </div>
                <div class="user-actions">
                    <button onclick="viewStudentAttendance(${student.id})" class="action-btn view">📊 Ներկայություն</button>
                    <button onclick="removeStudent(${student.id})" class="action-btn danger">🗑️ Հեռացնել</button>
                </div>
            </div>
        `;
    }).join('');
}

function displayFilteredTeachers(filteredTeachers) {
    const container = document.getElementById('teachers-list');
    
    if (filteredTeachers.length === 0) {
        container.innerHTML = '<p class="no-data">Ոչ մի ուսուցիչ չի գտնվել</p>';
        return;
    }
    
    container.innerHTML = filteredTeachers.map(teacher => {
        const registrationDate = new Date(teacher.id).toLocaleDateString('hy-AM');
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <h4>${teacher.name}</h4>
                    <p><strong>Օգտատեր:</strong> ${teacher.username}</p>
                    <p><strong>Էլ. փոստ:</strong> ${teacher.email}</p>
                    <p><strong>Առարկա:</strong> ${teacher.subject}</p>
                    <p><strong>Գրանցված:</strong> ${registrationDate}</p>
                </div>
                <div class="user-actions">
                    <button onclick="removeTeacher(${teacher.id})" class="action-btn danger">🗑️ Հեռացնել</button>
                </div>
            </div>
        `;
    }).join('');
}

function removeStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    if (confirm(`Վստա՞հ եք, որ ուզում եք հեռացնել ${student.name}-ի հաշիվը: Այս գործողությունը չի կարող չեղարկվել:`)) {
        // Remove student from students array
        students = students.filter(s => s.id !== studentId);
        
        // Remove student's attendance records
        attendance = attendance.filter(a => a.studentId !== studentId);
        
        // Save to localStorage
        saveStudentData();
        saveAttendanceData();
        
        // Reload admin dashboard
        loadAdminStatistics();
        loadStudentsManagement();
        
        showCustomAlert(`${student.name}-ի հաշիվը հաջողությամբ հեռացվել է`, 'success', 'Հաշիվ Հեռացված');
    }
}

function removeTeacher(teacherId) {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    
    if (confirm(`Վստա՞հ եք, որ ուզում եք հեռացնել ${teacher.name}-ի հաշիվը: Այս գործողությունը չի կարող չեղարկվել:`)) {
        // Remove teacher from teachers array
        teachers = teachers.filter(t => t.id !== teacherId);
        
        // Save to localStorage
        saveTeacherData();
        
        // Reload admin dashboard
        loadAdminStatistics();
        loadTeachersManagement();
        
        showCustomAlert(`${teacher.name}-ի հաշիվը հաջողությամբ հեռացվել է`, 'success', 'Հաշիվ Հեռացված');
    }
}

function viewStudentAttendance(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const studentAttendance = attendance.filter(a => a.studentId === studentId);
    
    if (studentAttendance.length === 0) {
        showCustomAlert(`${student.name}-ը դեռ ներկայություն չի նշել`, 'info', 'Ներկայության Տվյալներ');
        return;
    }
    
    const attendanceDetails = studentAttendance
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10) // Show last 10 records
        .map(record => {
            const date = new Date(record.date).toLocaleDateString('hy-AM');
            const status = record.status === 'present' ? 'Ներկա' : 'Բացակա';
            return `${date} - ${status}`;
        }).join('\n');
    
    const presentCount = studentAttendance.filter(a => a.status === 'present').length;
    const totalCount = studentAttendance.length;
    const attendanceRate = Math.round((presentCount / totalCount) * 100);
    
    showCustomAlert(
        `${student.name}-ի Ներկայություն:\n\nՆերկայության տոկոս: ${attendanceRate}%\nՆերկա: ${presentCount}/${totalCount}\n\nՎերջին 10 գրառումները:\n${attendanceDetails}`,
        'info',
        'Ներկայության Տվյալներ'
    );
}

function loadAttendanceOverview() {
    const selectedDate = document.getElementById('admin-attendance-date').value;
    const container = document.getElementById('attendance-overview-content');
    
    if (!selectedDate) {
        container.innerHTML = '<p class="no-data">Ընտրեք ամսաթիվ</p>';
        return;
    }
    
    const dayAttendance = attendance.filter(a => a.date === selectedDate);
    
    if (dayAttendance.length === 0) {
        container.innerHTML = '<p class="no-data">Այս օրվա համար ներկայության գրառումներ չկան</p>';
        return;
    }
    
    const presentCount = dayAttendance.filter(a => a.status === 'present').length;
    const absentCount = dayAttendance.filter(a => a.status === 'absent').length;
    
    container.innerHTML = `
        <div class="attendance-summary">
            <div class="summary-stat">
                <span class="stat-label">Ներկա:</span>
                <span class="stat-value present">${presentCount}</span>
            </div>
            <div class="summary-stat">
                <span class="stat-label">Բացակա:</span>
                <span class="stat-value absent">${absentCount}</span>
            </div>
            <div class="summary-stat">
                <span class="stat-label">Ընդամենը:</span>
                <span class="stat-value">${dayAttendance.length}</span>
            </div>
        </div>
        <div class="attendance-details">
            ${dayAttendance.map(record => `
                <div class="attendance-record ${record.status} ${record.autoMarked ? 'auto-marked' : ''}">
                    <span class="student-name">${record.studentName}</span>
                    <span class="student-class">${record.grade}${record.classroom}</span>
                    <span class="attendance-status">
                        ${record.status === 'present' ? 'Ներկա' : 'Բացակա'}
                        ${record.autoMarked ? ' (ավտոմատ)' : ''}
                    </span>
                    <span class="attendance-time">${new Date(record.timestamp).toLocaleTimeString('hy-AM')}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Admin Actions
function exportAllAdminData() {
    const adminData = {
        students: students,
        teachers: teachers,
        attendance: attendance,
        statistics: {
            totalStudents: students.length,
            totalTeachers: teachers.length,
            totalAttendanceRecords: attendance.length,
            exportDate: new Date().toISOString()
        },
        exportedBy: 'Administrator',
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(adminData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `classlink-admin-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showCustomAlert('Ադմինիստրատիվ տվյալների արտահանումը հաջողվեց', 'success', 'Արտահանում');
}

function clearAllData() {
    if (confirm('ՎՏԱՆԳԱՎՈՐ ԳՈՐԾՈՂՈՒԹՅՈՒՆ!\n\nՎստա՞հ եք, որ ուզում եք մաքրել բոլոր տվյալները: Այս գործողությունը կհեռացնի:\n- Բոլոր աշակերտների հաշիվները\n- Բոլոր ուսուցիչների հաշիվները\n- Բոլոր ներկայության գրառումները\n\nԱյս գործողությունը ԱՆՎԵՐԱԴԱՐՁԵԼԻ է:')) {
        if (confirm('Վերջնական հաստատում: Մաքրե՞լ բոլոր տվյալները:')) {
            // Clear all data arrays
            students = [];
            teachers = [];
            attendance = [];
            
            // Clear localStorage
            localStorage.removeItem('students');
            localStorage.removeItem('teachers');
            localStorage.removeItem('attendance');
            
            // Reload admin dashboard
            loadAdminStatistics();
            loadStudentsManagement();
            loadAttendanceOverview();
            
            showCustomAlert('Բոլոր տվյալները մաքրվել են', 'warning', 'Տվյալներ Մաքրված');
        }
    }
}

function resetSystem() {
    if (confirm('Վստա՞հ եք, որ ուզում եք վերակայել ամբողջ համակարգը: Այս գործողությունը կհեռացնի բոլոր տվյալները և կվերականգնի սկզբնական կարգավորումները:')) {
        // Clear all data
        students = [];
        teachers = [];
        attendance = [];
        currentUser = null;
        
        // Clear all localStorage
        localStorage.clear();
        
        // Reload page
        location.reload();
    }
}

function showTeacherLogin() {
    hideAllSections();
    document.getElementById('teacher-section').classList.remove('hidden');
    document.getElementById('teacher-login-form').classList.remove('hidden');
    document.getElementById('teacher-register-form').classList.add('hidden');
    document.getElementById('teacher-login-tab').classList.add('active');
    document.getElementById('teacher-register-tab').classList.remove('active');
}

function showTeacherRegister() {
    document.getElementById('teacher-login-form').classList.add('hidden');
    document.getElementById('teacher-register-form').classList.remove('hidden');
    document.getElementById('teacher-login-tab').classList.remove('active');
    document.getElementById('teacher-register-tab').classList.add('active');
}

function hideAllSections() {
    document.querySelector('.role-selection').classList.add('hidden');
    document.getElementById('student-section').classList.add('hidden');
    document.getElementById('teacher-section').classList.add('hidden');
    document.getElementById('student-dashboard').classList.add('hidden');
    document.getElementById('teacher-dashboard').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
}

// Authentication functions
function handleStudentLogin(e) {
    e.preventDefault();
    const username = document.getElementById('student-username').value;
    const password = document.getElementById('student-password').value;
    
    const student = students.find(s => s.username === username && s.password === password);
    
    if (student) {
        currentUser = { ...student, role: 'student' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showStudentDashboard();
    } else {
        showCustomAlert('Սխալ օգտատիրոջ անուն կամ գաղտնաբառ', 'error', 'Մուտքի սխալ');
    }
}

function handleStudentRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-student-name').value.trim();
    const username = document.getElementById('reg-student-username').value.trim();
    const email = document.getElementById('reg-student-email').value.trim();
    const password = document.getElementById('reg-student-password').value;
    const grade = document.getElementById('reg-student-grade').value;
    const classroom = document.getElementById('reg-student-classroom').value.trim();
    
    // Validate all fields
    if (!name || !username || !email || !password || !grade || !classroom) {
        showCustomAlert('Խնդրում ենք լրացնել բոլոր դաշտերը', 'warning', 'Լրացման սխալ');
        return;
    }
    
    // Check if username already exists
    if (students.find(s => s.username === username)) {
        showCustomAlert('Այս օգտատիրոջ անունն արդեն գոյություն ունի', 'warning', 'Գրանցման սխալ');
        return;
    }
    
    // Check if email already exists
    if (students.find(s => s.email === email)) {
        showCustomAlert('Այս էլ. փոստի հասցեն արդեն գրանցված է', 'warning', 'Գրանցման սխալ');
        return;
    }
    
    const newStudent = {
        id: Date.now(),
        name,
        username,
        email,
        password,
        grade,
        classroom
    };
    
    students.push(newStudent);
    saveStudentData();
    
    showCustomAlert('Գրանցումը հաջող է: Խնդրում ենք մուտք գործել', 'success', 'Հաջող գրանցում');
    setTimeout(showStudentLogin, 1500);
}

function handleTeacherLogin(e) {
    e.preventDefault();
    const username = document.getElementById('teacher-username').value;
    const password = document.getElementById('teacher-password').value;
    
    const teacher = teachers.find(t => t.username === username && t.password === password);
    
    if (teacher) {
        currentUser = { ...teacher, role: 'teacher' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showTeacherDashboard();
    } else {
        showCustomAlert('Սխալ օգտատիրոջ անուն կամ գաղտնաբառ', 'error', 'Մուտքի սխալ');
    }
}

function handleTeacherRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-teacher-name').value.trim();
    const username = document.getElementById('reg-teacher-username').value.trim();
    const email = document.getElementById('reg-teacher-email').value.trim();
    const password = document.getElementById('reg-teacher-password').value;
    const subject = document.getElementById('reg-teacher-subject').value.trim();
    
    // Validate all fields
    if (!name || !username || !email || !password || !subject) {
        showCustomAlert('Խնդրում ենք լրացնել բոլոր դաշտերը', 'warning', 'Լրացման սխալ');
        return;
    }
    
    // Check if username already exists
    if (teachers.find(t => t.username === username)) {
        showCustomAlert('Այս օգտատիրոջ անունն արդեն գոյություն ունի', 'warning', 'Գրանցման սխալ');
        return;
    }
    
    // Check if email already exists
    if (teachers.find(t => t.email === email)) {
        showCustomAlert('Այս էլ. փոստի հասցեն արդեն գրանցված է', 'warning', 'Գրանցման սխալ');
        return;
    }
    
    const newTeacher = {
        id: Date.now(),
        name,
        username,
        email,
        password,
        subject
    };
    
    teachers.push(newTeacher);
    saveTeacherData();
    
    showCustomAlert('Գրանցումը հաջող է: Խնդրում ենք մուտք գործել', 'success', 'Հաջող գրանցում');
    setTimeout(showTeacherLogin, 1500);
}

// Dashboard functions
function showStudentDashboard() {
    hideAllSections();
    document.getElementById('student-dashboard').classList.remove('hidden');
    
    // Update student info display
    document.getElementById('student-name-display').textContent = currentUser.name;
    document.getElementById('student-grade-display').textContent = currentUser.grade + '-րդ դասարան';
    document.getElementById('student-classroom-display').textContent = currentUser.classroom;
    
    // Initialize dashboard settings
    initializeDashboardSettings();
    
    // Initialize location services
    initializeLocationServices();
    
    // Check today's attendance
    checkTodayAttendance();
    
    // Load attendance history
    loadStudentHistory();
}

function showTeacherDashboard() {
    hideAllSections();
    document.getElementById('teacher-dashboard').classList.remove('hidden');
    
    // Update teacher info display
    document.getElementById('teacher-name-display').textContent = currentUser.name;
    document.getElementById('teacher-subject-display').textContent = currentUser.subject;
    
    // Initialize dashboard settings
    initializeDashboardSettings();
    
    // Reset class selection
    document.getElementById('teacher-grade-select').value = '';
    document.getElementById('teacher-classroom-select').value = '';
    document.getElementById('teacher-classroom-select').innerHTML = '<option value="">Ընտրեք դասասենյակը</option>';
    document.getElementById('load-attendance-btn').disabled = true;
    document.getElementById('class-attendance').classList.add('hidden');
}

// Attendance functions
function checkTodayAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.find(a => 
        a.studentId === currentUser.id && a.date === today
    );
    
    const attendanceButtons = document.getElementById('attendance-buttons');
    const attendanceMessage = document.getElementById('attendance-message');
    
    if (todayAttendance) {
        const status = todayAttendance.status === 'present' ? 'ներկա' : 'բացակա';
        const statusClass = todayAttendance.status === 'present' ? 'status-present' : 'status-absent';
        const time = new Date(todayAttendance.timestamp).toLocaleTimeString('hy-AM', {hour: '2-digit', minute: '2-digit'});
        
        attendanceMessage.innerHTML = 
            `Այսօր դուք նշվել եք որպես <span class="${statusClass}">${status}</span> (${time})`;
        attendanceButtons.style.display = 'none';
    } else {
        // Check if within allowed time window (8:00-9:00 AM)
        if (isWithinAttendanceTime()) {
            attendanceButtons.style.display = 'flex';
            attendanceMessage.textContent = 'Տեղակայում ստուգվում է...';
            
            // Initialize location services and update buttons after a delay
            setTimeout(() => {
                if (isLocationEnabled) {
                    checkLocationAndUpdateButtons();
                } else {
                    // Show default state while location loads
                    const presentBtn = document.querySelector('.present-btn');
                    const absentBtn = document.querySelector('.absent-btn');
                    if (presentBtn && absentBtn) {
                        presentBtn.textContent = 'Ներկա';
                        absentBtn.textContent = 'Բացակա ⚠️';
                        attendanceMessage.textContent = 'Ընտրեք ձեր ներկայության կարգավիճակը:';
                    }
                }
            }, 2000);
        } else {
            attendanceButtons.style.display = 'none';
            const currentTime = new Date().toLocaleTimeString('hy-AM', {hour: '2-digit', minute: '2-digit'});
            attendanceMessage.textContent = `Ներկայության նշման ժամը 8:00-9:00 է: Ներկայիս ժամը՝ ${currentTime}`;
        }
    }
}

function isWithinAttendanceTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Convert current time to minutes since midnight
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    console.log(`Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTimeInMinutes} minutes)`);
    console.log(`Attendance window: 8:00-9:00 (${ATTENDANCE_WINDOW.startTime}-${ATTENDANCE_WINDOW.endTime} minutes)`);
    console.log(`Within time window: ${currentTimeInMinutes >= ATTENDANCE_WINDOW.startTime && currentTimeInMinutes <= ATTENDANCE_WINDOW.endTime}`);
    
    return currentTimeInMinutes >= ATTENDANCE_WINDOW.startTime && currentTimeInMinutes <= ATTENDANCE_WINDOW.endTime;
}

// Automatic Attendance System Functions
function initializeAutoAttendanceSystem() {
    console.log('Initializing automatic attendance system...');
    
    // Clear any existing timer
    if (autoAbsentTimer) {
        clearTimeout(autoAbsentTimer);
        autoAbsentTimer = null;
    }
    
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Calculate when the attendance window ends (9:05 AM = 9:00 + 5 minutes grace period)
    const autoAbsentTime = ATTENDANCE_WINDOW.endTime + 5; // 9:05 AM in minutes
    
    if (currentTimeInMinutes < autoAbsentTime) {
        // Calculate milliseconds until auto-absent time
        const minutesUntilAutoAbsent = autoAbsentTime - currentTimeInMinutes;
        const millisecondsUntilAutoAbsent = minutesUntilAutoAbsent * 60 * 1000;
        
        console.log(`Auto-absent timer set for ${minutesUntilAutoAbsent} minutes from now`);
        
        autoAbsentTimer = setTimeout(() => {
            processAutoAbsentStudents();
        }, millisecondsUntilAutoAbsent);
    } else {
        // If we're past the auto-absent time, run it immediately for today
        console.log('Past auto-absent time, checking immediately...');
        processAutoAbsentStudents();
    }
    
    // Set up daily recurring timer for tomorrow and subsequent days
    setupDailyAutoAbsentTimer();
}

function setupDailyAutoAbsentTimer() {
    // Calculate milliseconds until tomorrow at 9:05 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 5, 0, 0); // Set to 9:05 AM tomorrow
    
    const millisecondsUntilTomorrow = tomorrow.getTime() - now.getTime();
    
    console.log(`Next auto-absent check scheduled for: ${tomorrow.toLocaleString()}`);
    
    setTimeout(() => {
        processAutoAbsentStudents();
        // Set up the recurring daily timer
        setInterval(processAutoAbsentStudents, 24 * 60 * 60 * 1000); // Run daily
    }, millisecondsUntilTomorrow);
}

function processAutoAbsentStudents() {
    console.log('Processing automatic absent marking...');
    
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date();
    
    // Get all students who haven't marked attendance today
    const studentsWithoutAttendance = students.filter(student => {
        return !attendance.some(a => 
            a.studentId === student.id && 
            a.date === today
        );
    });
    
    if (studentsWithoutAttendance.length === 0) {
        console.log('No students need automatic absent marking');
        return;
    }
    
    console.log(`Marking ${studentsWithoutAttendance.length} students as automatically absent`);
    
    // Mark each student as absent
    studentsWithoutAttendance.forEach(student => {
        const autoAttendance = {
            studentId: student.id,
            studentName: student.name,
            grade: student.grade,
            classroom: student.classroom,
            date: today,
            status: 'absent',
            timestamp: currentTime.toISOString(),
            autoMarked: true, // Flag to indicate this was automatically marked
            location: {
                message: 'Automatically marked absent - no attendance submitted within time window'
            }
        };
        
        attendance.push(autoAttendance);
        console.log(`Auto-marked ${student.name} (${student.grade}${student.classroom}) as absent`);
    });
    
    // Save the updated attendance data
    saveAttendanceData();
    
    // Show notification if there's a current user and they're viewing the system
    if (currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin')) {
        showCustomAlert(
            `${studentsWithoutAttendance.length} աշակերտ ավտոմատ նշվել է որպես բացակա (ժամկետն ավարտվել է)`,
            'info',
            'Ավտոմատ Բացակայություն'
        );
        
        // Refresh admin statistics if admin dashboard is visible
        if (currentUser.role === 'admin') {
            loadAdminStatistics();
            loadAttendanceOverview();
        }
    }
    
    console.log('Automatic absent marking completed');
}

// Function to manually trigger auto-absent process (for testing)
function triggerAutoAbsentCheck() {
    console.log('Manually triggering auto-absent check...');
    processAutoAbsentStudents();
}

// Location Services
function initializeLocationServices() {
    if ("geolocation" in navigator) {
        console.log('Starting location detection...');
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                console.log('Location detected:', position.coords);
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                isLocationEnabled = true;
                
                const distance = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    SCHOOL_LOCATION.latitude,
                    SCHOOL_LOCATION.longitude
                );
                
                console.log(`Distance from school: ${distance} meters`);
                
                // Only update buttons if within attendance time
                if (isWithinAttendanceTime()) {
                    checkLocationAndUpdateButtons();
                }
                
                // Show location status to user
                const atSchool = distance <= SCHOOL_LOCATION.radius;
                const distanceKm = (distance / 1000).toFixed(2);
                showCustomAlert(
                    `Տեղակայում հաստատված: Դպրոցից հեռավորությունը՝ ${distanceKm} կմ ${atSchool ? '(դպրոցում)' : '(դպրոցից դուրս)'}`, 
                    'success', 
                    'Վայր Հայտնաբերված'
                );
            },
            function(error) {
                console.error('Location error:', error);
                isLocationEnabled = false;
                handleLocationError(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000 // 5 minutes
            }
        );
    } else {
        showCustomAlert('Ձեր թեթևարկիչն չի աջակցում տեղակայման ծառայություններին', 'warning', 'Տեղակայում Անհասանելի');
        isLocationEnabled = false;
        if (isWithinAttendanceTime()) {
            checkLocationAndUpdateButtons();
        }
    }
}

function handleLocationError(error) {
    let errorMessage = '';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'Տեղակայման մուտքն արգելվել է: Խնդրում ենք թույլատրել տեղակայման ծառայությունը:';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'Տեղակայման տեղեկությունն անհասանելի է:';
            break;
        case error.TIMEOUT:
            errorMessage = 'Տեղակայման հարցման ժամկետն ավարտվել է:';
            break;
        default:
            errorMessage = 'Տեղակայման ծառայության անհայտ սխալ:';
    }
    
    showCustomAlert(errorMessage, 'warning', 'Տեղակայման Սխալ');
    checkLocationAndUpdateButtons();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

function isStudentAtSchool() {
    if (!isLocationEnabled || !userLocation) {
        return false; // If location is disabled, assume not at school
    }
    
    const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        SCHOOL_LOCATION.latitude,
        SCHOOL_LOCATION.longitude
    );
    
    return distance <= SCHOOL_LOCATION.radius;
}

function checkLocationAndUpdateButtons() {
    const presentBtn = document.querySelector('.present-btn');
    const absentBtn = document.querySelector('.absent-btn');
    const attendanceMessage = document.getElementById('attendance-message');
    
    console.log('Checking location and updating buttons...');
    console.log('Location enabled:', isLocationEnabled);
    console.log('User location:', userLocation);
    
    if (!presentBtn || !absentBtn) {
        console.log('Attendance buttons not found');
        return;
    }
    
    // Check if within attendance time first
    if (!isWithinAttendanceTime()) {
        presentBtn.disabled = true;
        absentBtn.disabled = true;
        presentBtn.textContent = '⏰ Ժամկետ Անցել Է';
        absentBtn.textContent = '⏰ Ժամկետ Անցել Է';
        return;
    }
    
    const atSchool = isStudentAtSchool();
    console.log('Student at school:', atSchool);
    
    if (!isLocationEnabled || !userLocation) {
        // If location is disabled, allow both but warn
        presentBtn.disabled = false;
        absentBtn.disabled = false;
        presentBtn.textContent = 'Ներկա';
        absentBtn.textContent = 'Բացակա ⚠️';
        if (attendanceMessage && !attendanceMessage.innerHTML.includes('նշվել եք որպես')) {
            attendanceMessage.textContent = 'Տեղակայումն անհասանելի է: Ընտրեք ձեր կարգավիճակը:';
        }
    } else if (atSchool) {
        // At school - can only mark present
        presentBtn.disabled = false;
        absentBtn.disabled = true;
        presentBtn.textContent = 'Ներկա';
        absentBtn.textContent = '🚫 Դուք դպրոցում եք';
        if (attendanceMessage && !attendanceMessage.innerHTML.includes('նշվել եք որպես')) {
            attendanceMessage.textContent = 'Դուք գտնվում եք դպրոցում: Կարող եք նշել միայն "Ներկա":';
        }
    } else {
        // Away from school - can mark both
        presentBtn.disabled = false;
        absentBtn.disabled = false;
        presentBtn.textContent = 'Ներկա';
        absentBtn.textContent = 'Բացակա';
        if (attendanceMessage && !attendanceMessage.innerHTML.includes('նշվել եք որպես')) {
            const distance = userLocation ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                SCHOOL_LOCATION.latitude,
                SCHOOL_LOCATION.longitude
            ) : 0;
            const distanceKm = (distance / 1000).toFixed(2);
            attendanceMessage.textContent = `Դուք գտնվում եք դպրոցից ${distanceKm} կմ հեռավորության վրա: Ընտրեք ձեր կարգավիճակը:`;
        }
    }
}

function markAttendance(status) {
    if (!currentUser || currentUser.role !== 'student') {
        showCustomAlert('Միայն աշակերտներն են կարող նշել ներկայություն', 'warning', 'Սխալ');
        return;
    }
    
    // Check time restriction first
    if (!isWithinAttendanceTime()) {
        const currentTime = new Date().toLocaleTimeString('hy-AM', {hour: '2-digit', minute: '2-digit'});
        showCustomAlert(`Ներկայության նշման ժամը 8:00-9:00 է: Ներկայիս ժամը՝ ${currentTime}`, 'warning', 'Ժամկետ Անցել Է');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already marked today
    const existingAttendance = attendance.find(a => 
        a.studentId === currentUser.id && a.date === today
    );
    
    if (existingAttendance) {
        showCustomAlert('Այսօր արդեն ներկայություն եք նշել', 'warning', 'Ներկայության նշում');
        return;
    }
    
    const atSchool = isStudentAtSchool();
    
    // Location-based validation (only if location is working)
    if (isLocationEnabled && userLocation && status === 'absent' && atSchool) {
        const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            SCHOOL_LOCATION.latitude,
            SCHOOL_LOCATION.longitude
        );
        showCustomAlert(`Դուք չեք կարող նշել "Բացակա" երբ գտնվում եք դպրոցում (${Math.round(distance)}մ հեռավորությունը)`, 'warning', 'Սխալ Վայր');
        return;
    }
    
    // Get location details for record
    const distance = userLocation ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        SCHOOL_LOCATION.latitude,
        SCHOOL_LOCATION.longitude
    ) : null;
    
    const newAttendance = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        grade: currentUser.grade,
        classroom: currentUser.classroom,
        date: today,
        status: status,
        timestamp: new Date().toISOString(),
        location: userLocation ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            distanceFromSchool: Math.round(distance),
            atSchool: atSchool
        } : {
            message: 'Location not available'
        }
    };
    
    attendance.push(newAttendance);
    saveAttendanceData();
    
    checkTodayAttendance();
    loadStudentHistory();
    
    const statusText = status === 'present' ? 'ներկա' : 'բացակա';
    const locationText = userLocation && atSchool ? ' (դպրոցում)' : 
                        userLocation && !atSchool ? ' (դպրոցից դուրս)' : '';
    const timeText = new Date().toLocaleTimeString('hy-AM', {hour: '2-digit', minute: '2-digit'});
    showCustomAlert(`Դուք նշվել եք որպես ${statusText}${locationText} (${timeText})`, 'success', 'Ներկայության նշում');
}

function loadStudentHistory() {
    const studentAttendance = attendance
        .filter(a => a.studentId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historyContainer = document.getElementById('student-history');
    
    if (studentAttendance.length === 0) {
        historyContainer.innerHTML = '<p>Ներկայության պատմություն չկա</p>';
        return;
    }
    
    historyContainer.innerHTML = studentAttendance
        .map(a => {
            const statusText = a.status === 'present' ? 'Ներկա' : 'Բացակա';
            const statusClass = a.status === 'present' ? 'status-present' : 'status-absent';
            const autoMarkedClass = a.autoMarked ? 'auto-marked' : '';
            const date = new Date(a.date).toLocaleDateString('hy-AM');
            const autoText = a.autoMarked ? ' (ավտոմատ)' : '';
            
            return `
                <div class="history-item ${autoMarkedClass}">
                    <span>${date}</span>
                    <span class="${statusClass}">${statusText}${autoText}</span>
                </div>
            `;
        })
        .join('');
}

// Teacher functions
function updateTeacherClassrooms() {
    const grade = document.getElementById('teacher-grade-select').value;
    const classroomSelect = document.getElementById('teacher-classroom-select');
    
    classroomSelect.innerHTML = '<option value="">Ընտրեք դասասենյակը</option>';
    
    if (grade) {
        const availableClassrooms = getAvailableClassrooms(grade);
        
        if (availableClassrooms.length > 0) {
            availableClassrooms.forEach(classroom => {
                const option = document.createElement('option');
                option.value = classroom;
                option.textContent = grade + classroom;
                classroomSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Այս դասարանում դեռ աշակերտներ չկան";
            option.disabled = true;
            classroomSelect.appendChild(option);
        }
    }
    
    document.getElementById('load-attendance-btn').disabled = true;
    document.getElementById('class-attendance').classList.add('hidden');
}

function enableLoadButton() {
    const grade = document.getElementById('teacher-grade-select').value;
    const classroom = document.getElementById('teacher-classroom-select').value;
    
    document.getElementById('load-attendance-btn').disabled = !(grade && classroom);
}

function loadClassAttendance() {
    const grade = document.getElementById('teacher-grade-select').value;
    const classroom = document.getElementById('teacher-classroom-select').value;
    const date = document.getElementById('attendance-date').value;
    
    if (!grade || !classroom) {
        showCustomAlert('Խնդրում ենք ընտրել դասարանը և դասասենյակը', 'warning', 'Ընտրության սխալ');
        return;
    }
    
    // Get all students in this class
    const classStudents = students.filter(s => s.grade === grade && s.classroom === classroom);
    
    // Get attendance for this date and class
    const dayAttendance = attendance.filter(a => 
        a.grade === grade && a.classroom === classroom && a.date === date
    );
    
    // Create attendance map for quick lookup
    const attendanceMap = {};
    dayAttendance.forEach(a => {
        attendanceMap[a.studentId] = a.status;
    });
    
    // Display students
    const studentsContainer = document.getElementById('students-list');
    
    if (classStudents.length === 0) {
        studentsContainer.innerHTML = '<p>Այս դասարանում աշակերտներ չկան</p>';
    } else {
        studentsContainer.innerHTML = classStudents
            .map(student => {
                const attendanceStatus = attendanceMap[student.id] || 'not-marked';
                let statusText, statusClass;
                
                switch (attendanceStatus) {
                    case 'present':
                        statusText = 'Ներկա';
                        statusClass = 'badge-present';
                        break;
                    case 'absent':
                        statusText = 'Բացակա';
                        statusClass = 'badge-absent';
                        break;
                    default:
                        statusText = 'Չի նշվել';
                        statusClass = 'badge-not-marked';
                }
                
                return `
                    <div class="student-card">
                        <h4>${student.name}</h4>
                        <div class="student-info">
                            <p>Օգտատիրոջ անուն: ${student.username}</p>
                        </div>
                        <span class="attendance-badge ${statusClass}">${statusText}</span>
                    </div>
                `;
            })
            .join('');
    }
    
    document.getElementById('class-attendance').classList.remove('hidden');
}



// Data Export and Backup Functions
function exportAllData() {
    const allData = {
        students: students,
        teachers: teachers,
        attendance: attendance,
        exportDate: new Date().toISOString(),
        version: "1.0"
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `classlink-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showCustomAlert('Տվյալների արտահանումը հաջողվեց', 'success');
}

function exportAttendanceReport() {
    if (attendance.length === 0) {
        showCustomAlert('Ներկայության տվյալներ չկան', 'warning');
        return;
    }
    
    // Create CSV format
    const csvHeader = 'Ամսաթիվ,Աշակերտի անուն,Դասարան,Դասասենյակ,Կարգավիճակ,Ժամ\n';
    const csvContent = attendance.map(record => {
        const date = new Date(record.date).toLocaleDateString('hy-AM');
        const time = new Date(record.timestamp).toLocaleTimeString('hy-AM');
        const status = record.status === 'present' ? 'Ներկա' : 'Բացակա';
        
        return `"${date}","${record.studentName}","${record.grade}","${record.classroom}","${status}","${time}"`;
    }).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvBlob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showCustomAlert('Ներկայության հաշվետվությունը արտահանվեց', 'success');
}

function exportStudentsList() {
    if (students.length === 0) {
        showCustomAlert('Աշակերտների ցուցակ չկա', 'warning');
        return;
    }
    
    const csvHeader = 'Անուն,Օգտատիրոջ անուն,Դասարան,Դասասենյակ,Գրանցման ամսաթիվ\n';
    const csvContent = students.map(student => {
        const registrationDate = new Date(student.id).toLocaleDateString('hy-AM');
        return `"${student.name}","${student.username}","${student.grade}","${student.classroom}","${registrationDate}"`;
    }).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvBlob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `students-list-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showCustomAlert('Աշակերտների ցուցակը արտահանվեց', 'success');
}

function exportTeachersList() {
    if (teachers.length === 0) {
        showCustomAlert('Ուսուցիչների ցուցակ չկա', 'warning');
        return;
    }
    
    const csvHeader = 'Անուն,Օգտատիրոջ անուն,Առարկա,Գրանցման ամսաթիվ\n';
    const csvContent = teachers.map(teacher => {
        const registrationDate = new Date(teacher.id).toLocaleDateString('hy-AM');
        return `"${teacher.name}","${teacher.username}","${teacher.subject}","${registrationDate}"`;
    }).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvBlob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `teachers-list-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showCustomAlert('Ուսուցիչների ցուցակը արտահանվեց', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData.students && importedData.teachers && importedData.attendance) {
                    // Merge data (avoid duplicates)
                    importedData.students.forEach(student => {
                        if (!students.find(s => s.username === student.username)) {
                            students.push(student);
                        }
                    });
                    
                    importedData.teachers.forEach(teacher => {
                        if (!teachers.find(t => t.username === teacher.username)) {
                            teachers.push(teacher);
                        }
                    });
                    
                    importedData.attendance.forEach(record => {
                        if (!attendance.find(a => a.studentId === record.studentId && a.date === record.date)) {
                            attendance.push(record);
                        }
                    });
                    
                    // Save to localStorage
                    localStorage.setItem('students', JSON.stringify(students));
                    localStorage.setItem('teachers', JSON.stringify(teachers));
                    localStorage.setItem('attendance', JSON.stringify(attendance));
                    
                    showCustomAlert('Տվյալների ներմուծումը հաջողվեց', 'success');
                } else {
                    showCustomAlert('Անվավեր ֆայլի ֆորմատ', 'error');
                }
            } catch (error) {
                showCustomAlert('Ֆայլի կարդալու սխալ', 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Enhanced save functions with automatic backup
function saveStudentData() {
    localStorage.setItem('students', JSON.stringify(students));
    // Create automatic backup every 10 new registrations
    if (students.length % 10 === 0) {
        createAutomaticBackup('students');
    }
}

function saveTeacherData() {
    localStorage.setItem('teachers', JSON.stringify(teachers));
    // Create automatic backup every 5 new registrations
    if (teachers.length % 5 === 0) {
        createAutomaticBackup('teachers');
    }
}

function saveAttendanceData() {
    localStorage.setItem('attendance', JSON.stringify(attendance));
    // Create automatic backup every 50 new attendance records
    if (attendance.length % 50 === 0) {
        createAutomaticBackup('attendance');
    }
}

function createAutomaticBackup(dataType) {
    const backup = {
        type: dataType,
        data: dataType === 'students' ? students : dataType === 'teachers' ? teachers : attendance,
        timestamp: new Date().toISOString()
    };
    
    const backupKey = `backup_${dataType}_${new Date().toISOString().split('T')[0]}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));
    
    // Keep only last 5 backups
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith(`backup_${dataType}`));
    if (backupKeys.length > 5) {
        backupKeys.sort().slice(0, -5).forEach(key => localStorage.removeItem(key));
    }
}




// Initialize the app on page load
document.addEventListener('DOMContentLoaded', function() {
    // App initialization complete
});

// Dashboard settings initialization
function initializeDashboardSettings() {
    // Dashboard settings initialized
}

// Custom alert system with enhanced animations and sound
function showCustomAlert(message, type = 'info', title = 'Ծանուցում') {
    const alertOverlay = document.getElementById('custom-alert');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertIcon = document.getElementById('alert-icon-content');
    const alertIconContainer = document.querySelector('.alert-icon');
    const alertModal = document.querySelector('.alert-modal');
    
    // Visual indicator only (sound effects removed)
    
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    
    // Clear previous type classes
    alertIconContainer.className = 'alert-icon';
    alertModal.classList.remove('alert-success', 'alert-error', 'alert-warning', 'alert-info');
    
    // Set icon and animations based on type
    switch (type) {
        case 'success':
            alertIcon.textContent = '✅';
            alertIconContainer.classList.add('success');
            alertModal.classList.add('alert-success');
            // Add confetti animation
            createConfetti();
            break;
        case 'error':
            alertIcon.textContent = '❌';
            alertIconContainer.classList.add('error');
            alertModal.classList.add('alert-error');
            // Add shake animation
            alertModal.style.animation = 'alertShake 0.6s ease-in-out';
            break;
        case 'warning':
            alertIcon.textContent = '⚠️';
            alertIconContainer.classList.add('warning');
            alertModal.classList.add('alert-warning');
            // Add pulse animation
            alertModal.style.animation = 'alertPulse 0.8s ease-in-out';
            break;
        default:
            alertIcon.textContent = 'ℹ️';
            alertIconContainer.classList.add('info');
            alertModal.classList.add('alert-info');
            // Add slide animation
            alertModal.style.animation = 'alertSlideDown 0.5s ease-out';
    }
    
    alertOverlay.classList.remove('hidden');
    
    // Reset animation after it completes
    setTimeout(() => {
        alertModal.style.animation = '';
    }, 1000);
    
    // Close alert when OK button is clicked
    document.getElementById('alert-ok-btn').onclick = function() {
        alertOverlay.classList.add('hidden');
        clearConfetti();
    };
    
    // Close alert when clicking outside
    alertOverlay.onclick = function(e) {
        if (e.target === alertOverlay) {
            alertOverlay.classList.add('hidden');
            clearConfetti();
        }
    };
}

// Confetti animation for success alerts
function createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    confettiContainer.id = 'confetti-container';
    document.body.appendChild(confettiContainer);
    
    const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confettiContainer.appendChild(confetti);
    }
}

function clearConfetti() {
    const confettiContainer = document.getElementById('confetti-container');
    if (confettiContainer) {
        confettiContainer.remove();
    }
}

// Data statistics function
function getDataStatistics() {
    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalAttendanceRecords = attendance.length;
    
    const gradeStats = {};
    students.forEach(student => {
        gradeStats[student.grade] = (gradeStats[student.grade] || 0) + 1;
    });
    
    const subjectStats = {};
    teachers.forEach(teacher => {
        subjectStats[teacher.subject] = (subjectStats[teacher.subject] || 0) + 1;
    });
    
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
    const todayAbsent = todayAttendance.filter(a => a.status === 'absent').length;
    
    return {
        totalStudents,
        totalTeachers,
        totalAttendanceRecords,
        gradeStats,
        subjectStats,
        todayStats: {
            present: todayPresent,
            absent: todayAbsent,
            total: todayAttendance.length
        }
    };
}

// Show statistics modal
function showDataStatistics() {
    const stats = getDataStatistics();
    
    const modal = document.createElement('div');
    modal.className = 'stats-modal';
    modal.innerHTML = `
        <div class="stats-content">
            <h3>Համակարգի վիճակագրություն</h3>
            
            <div class="stats-grid">
                <div class="stats-card">
                    <h4>Ընդամենը աշակերտներ</h4>
                    <div class="stats-number">${stats.totalStudents}</div>
                </div>
                <div class="stats-card">
                    <h4>Ընդամենը ուսուցիչներ</h4>
                    <div class="stats-number">${stats.totalTeachers}</div>
                </div>
                <div class="stats-card">
                    <h4>Ներկայության գրառումներ</h4>
                    <div class="stats-number">${stats.totalAttendanceRecords}</div>
                </div>
                <div class="stats-card">
                    <h4>Այսօրվա ներկայություն</h4>
                    <div class="stats-number">${stats.todayStats.present}/${stats.todayStats.total}</div>
                </div>
            </div>
            
            <div class="stats-details">
                <h4>Դասարանների բաշխում</h4>
                <div class="stats-list">
                    ${Object.entries(stats.gradeStats).map(([grade, count]) => 
                        `<div class="stats-item">
                            <span>${grade}-րդ դասարան</span>
                            <span>${count} աշակերտ</span>
                        </div>`
                    ).join('')}
                </div>
                
                <h4>Առարկաների բաշխում</h4>
                <div class="stats-list">
                    ${Object.entries(stats.subjectStats).map(([subject, count]) => 
                        `<div class="stats-item">
                            <span>${subject}</span>
                            <span>${count} ուսուցիչ</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
            
            <button class="close-stats" onclick="this.closest('.stats-modal').remove()">Փակել</button>
        </div>
    `;
    
    // Close modal when clicking outside
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    document.body.appendChild(modal);
}

// Password visibility toggle function
function togglePasswordVisibility(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.parentElement.querySelector('.password-toggle');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = '🙈';
        toggleButton.classList.add('visible');
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = '👁️';
        toggleButton.classList.remove('visible');
    }
}


// Logout function
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showRoleSelection();
    
    // Clear forms
    document.querySelectorAll('form').forEach(form => form.reset());
}