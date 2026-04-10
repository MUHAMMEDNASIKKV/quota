// ============================================
// PG WORKSHOP REGISTRATION PORTAL
// Frontend JavaScript (app.js) - Week 4 Only Optimized
// ============================================

// Configuration
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-WTK-NtpOcnBoBOV9hadURWomIJnMq8ra1w8wxOxYo4Uc4rGBNcio-WwoBoLK6sqMkQ/exec";
const CSV_STUDENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn9theJ-8Yp_ZMaao7Mq9AM69QId1_R2M7YXKEuabzMKRm_3l7buLPUHsHbiMSPS4vDFEX84AbQ5mo/pub?gid=0&single=true&output=csv";

// Slot limits based on year (Week 4 only)
const SLOT_RULES = {
    "PG Second Year": {
        "week-4": 15
    },
    "PG First Year": {
        "week-4": 12
    }
};

const WEEKS = ["week-4"];
const WEEK_DISPLAY_NAMES = {
    "week-4": "Week 4"
};

// PG Second Year students list
const PG_SECOND_YEAR = [16074, 16075, 16077, 16078, 16082, 16110, 16122, 16128, 16138, 16146, 16148, 16150, 16156, 16158, 16160, 16172, 16176, 16178, 16179, 16185, 16187, 16194, 16207, 16215, 16219, 16222, 16227, 16232, 16234, 16245, 16248, 16262, 16271, 16273, 16274, 16279, 16297, 16300, 16308, 16334, 16382, 16383, 16552, 16612];

// PG First Year students list
const PG_FIRST_YEAR = [16620, 16622, 16628, 16635, 16648, 16649, 16651, 16663, 16666, 16668, 16678, 16683, 16691, 16696, 16701, 16709, 16715, 16739, 16751, 16770, 16784, 16798, 16807, 16821, 16823, 16835, 16846, 16855, 16875, 16889, 16960, 17028, 17047, 17106, 17195];

// ============================================
// GLOBAL STATE (Optimized)
// ============================================
let studentsDataFromCSV = new Map();   // enrol -> { name, mode }
let registrationsData = [];            // registration data from sheet
let slotUsageCache = {
    "PG Second Year": { "week-4": 0 },
    "PG First Year": { "week-4": 0 }
};

let currentStudent = null;
let selectedWeek = null;
let dataReady = false;
let pendingEnrol = null;

// DOM Elements
const enrolInput = document.getElementById('enrolNo');
const studentNameField = document.getElementById('studentName');
const modeField = document.getElementById('modeField');
const yearField = document.getElementById('yearField');
const weekContainer = document.getElementById('weekContainer');
const weekSlotInfo = document.getElementById('weekSlotInfo');
const submitBtn = document.getElementById('submitBtn');
const alertPopup = document.getElementById('alertPopup');
const enrolError = document.getElementById('enrolError');
const statusContainer = document.getElementById('statusContainer');
const statusDisplay = document.getElementById('statusDisplay');

// ============================================
// 🚀 INIT – PARALLEL LOAD, INPUT ENABLED IMMEDIATELY
// ============================================
setupEventListeners();

(async function init() {
    enrolInput.disabled = false;
    enrolInput.placeholder = "Enter your enrolment number";

    const csvPromise = loadCSVDataFast();
    const regPromise = loadRegistrationsData();

    await Promise.all([csvPromise, regPromise]);

    dataReady = true;
    computeSlotUsage();

    if (pendingEnrol) {
        lookupStudentFast(pendingEnrol);
        pendingEnrol = null;
    } else {
        resetStudentUI();
    }

    // Background refresh to keep slot counts updated
    setInterval(async () => {
        await loadRegistrationsData();
        computeSlotUsage();

        if (currentStudent && currentStudent.year) {
            const existingRegistration = registrationsData.find(r =>
                String(r.enrol).trim().toLowerCase() === String(currentStudent.enrol).trim().toLowerCase()
            );

            currentStudent.status = existingRegistration?.status || currentStudent.status || "";

            if (currentStudent.status && currentStudent.status !== "") {
                statusContainer.classList.remove("hidden");
                const statusText = WEEK_DISPLAY_NAMES[currentStudent.status] || currentStudent.status;
                statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${statusText}</span>`;
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.6";
                submitBtn.style.cursor = "not-allowed";
            }

            renderWeekCards(currentStudent.year);
        }
    }, 30000);

    console.log('✅ Portal ready - CSV and registrations loaded');
})();

// ============================================
// 🎧 EVENT LISTENERS (Optimized)
// ============================================
function setupEventListeners() {
    let debounceTimeout;

    enrolInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearTimeout(debounceTimeout);

        debounceTimeout = setTimeout(() => {
            if (window.requestIdleCallback) {
                requestIdleCallback(() => {
                    if (val.length > 0) {
                        lookupStudentFast(val);
                    } else {
                        resetStudentUI();
                    }
                });
            } else {
                if (val.length > 0) {
                    lookupStudentFast(val);
                } else {
                    resetStudentUI();
                }
            }
        }, 60);
    });

    submitBtn.addEventListener('click', submitRegistration);
}

// ============================================
// 📥 FAST CSV LOADING
// ============================================
async function loadCSVDataFast() {
    try {
        const response = await fetch(CSV_STUDENTS_URL);
        const csvText = await response.text();

        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
        const enrolIdx = headers.findIndex(h => h.includes('enrol') || h === 'enrl no');
        const nameIdx = headers.findIndex(h => h === 'name');
        const modeIdx = headers.findIndex(h => h === 'mode');

        studentsDataFromCSV.clear();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = fastCSVParse(line);

            const enrolNo = values[enrolIdx]?.trim() || '';
            const name = values[nameIdx]?.trim() || '';
            const mode = values[modeIdx]?.trim() || '';

            if (enrolNo && name) {
                studentsDataFromCSV.set(String(enrolNo).trim(), {
                    name: name,
                    mode: mode || 'Not Specified'
                });
            }
        }

        console.log(`⚡ Fast-loaded ${studentsDataFromCSV.size} students from CSV`);
    } catch (err) {
        console.error("CSV fetch error:", err);
        showAlert("Failed to load student data. Please refresh.", true);
    }
}

// Optimized CSV row parsing
function fastCSVParse(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// ============================================
// 📥 LOAD REGISTRATIONS
// ============================================
async function loadRegistrationsData() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllRegistrations&t=${Date.now()}`);
        const data = await response.json();

        if (data.error) {
            console.error("Error loading registrations:", data.error);
            registrationsData = [];
            return;
        }

        if (Array.isArray(data)) {
            registrationsData = data;
        } else if (data.data && Array.isArray(data.data)) {
            registrationsData = data.data;
        } else {
            registrationsData = [];
        }

        console.log(`📋 Loaded ${registrationsData.length} registrations`);
    } catch (err) {
        console.warn("Registrations fetch failed, using last known data");
    }
}

// ============================================
// 📊 SLOT CACHE
// ============================================
function computeSlotUsage() {
    slotUsageCache = {
        "PG Second Year": { "week-4": 0 },
        "PG First Year": { "week-4": 0 }
    };

    for (const registration of registrationsData) {
        const year = registration.year;
        const week = registration.status;

        if (year && week && slotUsageCache[year] && slotUsageCache[year][week] !== undefined) {
            slotUsageCache[year][week]++;
        }
    }
}

// ============================================
// 🔍 FAST STUDENT LOOKUP & YEAR DETECTION
// ============================================
function getYearFromEnrol(enrol) {
    const enrolNum = parseInt(enrol);
    if (PG_SECOND_YEAR.includes(enrolNum)) return "PG Second Year";
    if (PG_FIRST_YEAR.includes(enrolNum)) return "PG First Year";
    return null;
}

function lookupStudentFast(enrol) {
    const cleanEnrol = String(enrol).trim();

    if (!cleanEnrol) {
        resetStudentUI();
        return false;
    }

    if (!dataReady) {
        pendingEnrol = cleanEnrol;
        enrolInput.placeholder = "Loading data...";
        return false;
    }

    const csvStudent = studentsDataFromCSV.get(cleanEnrol);

    if (!csvStudent) {
        enrolError.textContent = "❌ Enrolment number not found in registry";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        return false;
    }

    enrolError.classList.add("hidden");

    const year = getYearFromEnrol(cleanEnrol);
    if (!year) {
        enrolError.textContent = "❌ Enrolment number not recognized for year classification";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        return false;
    }

    const existingRegistration = registrationsData.find(r =>
        String(r.enrol).trim().toLowerCase() === cleanEnrol.toLowerCase()
    );

    currentStudent = {
        enrol: cleanEnrol,
        name: csvStudent.name,
        mode: csvStudent.mode,
        year: year,
        status: existingRegistration?.status || ""
    };

    studentNameField.value = currentStudent.name;
    modeField.value = currentStudent.mode;
    yearField.value = currentStudent.year;

    if (currentStudent.status && currentStudent.status !== "") {
        statusContainer.classList.remove("hidden");
        const statusText = WEEK_DISPLAY_NAMES[currentStudent.status] || currentStudent.status;
        statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${statusText}</span>`;
        selectedWeek = null;
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
        showAlert(`ℹ️ You have already registered for ${statusText}. Registration cannot be changed.`, false);
    } else {
        statusContainer.classList.add("hidden");
        statusDisplay.innerHTML = "";
        selectedWeek = null;
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
    }

    renderWeekCards(currentStudent.year);
    return true;
}

function resetStudentUI() {
    studentNameField.value = '';
    modeField.value = '';
    yearField.value = '';
    currentStudent = null;
    selectedWeek = null;
    statusContainer.classList.add("hidden");
    statusDisplay.innerHTML = "";
    renderWeekCards(null);
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
}

// ============================================
// 🎨 RENDER WEEK CARDS & SLOT MANAGEMENT
// ============================================
function isSlotAvailable(week, year) {
    const current = slotUsageCache[year]?.[week] || 0;
    const limit = SLOT_RULES[year]?.[week] || 0;
    return current < limit;
}

function getRemainingSlots(week, year) {
    const current = slotUsageCache[year]?.[week] || 0;
    const limit = SLOT_RULES[year]?.[week] || 0;
    return Math.max(0, limit - current);
}

function renderWeekCards(year) {
    if (!year) {
        weekContainer.innerHTML = `
            <div class="col-span-1 text-center text-gray-400 py-8">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Enter your enrolment number to see available week</p>
            </div>
        `;
        weekSlotInfo.innerHTML = '';
        return;
    }

    let cardsHtml = '';

    WEEKS.forEach(week => {
        const limit = SLOT_RULES[year]?.[week] || 0;
        const current = slotUsageCache[year]?.[week] || 0;
        const available = current < limit;
        const remaining = limit - current;
        const isSelected = (selectedWeek === week);
        const isAlreadyRegistered = currentStudent?.status && currentStudent.status !== "";

        let disabledClass = '';
        let clickHandler = '';

        if (!available || isAlreadyRegistered) {
            disabledClass = 'week-card disabled';
            clickHandler = '';
        } else {
            disabledClass = 'week-card cursor-pointer hover:shadow-md transition-all';
            clickHandler = `onclick="selectWeek('${week}')"`;
        }

        const selectedClass = isSelected ? 'selected' : '';

        cardsHtml += `
            <div class="${disabledClass} ${selectedClass}" ${clickHandler} data-week="${week}">
                <div class="flex flex-col items-center">
                    <h3 class="font-bold text-gray-800 text-lg mb-2">${WEEK_DISPLAY_NAMES[week]}</h3>
                    <div class="slot-badge ${!available ? 'slot-full' : 'bg-emerald-100 text-emerald-700'}">
                        ${available ? `${remaining} slots left` : 'Full'}
                    </div>
                    <div class="mt-2 text-xs text-gray-500">
                        ${available ? `Available: ${remaining} / ${limit}` : `No slots available`}
                    </div>
                </div>
            </div>
        `;
    });

    weekContainer.innerHTML = cardsHtml;

    const secondYearW4Remaining = getRemainingSlots("week-4", "PG Second Year");
    const firstYearW4Remaining = getRemainingSlots("week-4", "PG First Year");

    weekSlotInfo.innerHTML = `
        <div class="flex flex-wrap gap-3 justify-between w-full">
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG Second Year: 
                Week 4 (${secondYearW4Remaining}/15 slots)
            </span>
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG First Year: 
                Week 4 (${firstYearW4Remaining}/12 slots)
            </span>
        </div>
    `;
}

// Global function for week selection
window.selectWeek = function(week) {
    if (!currentStudent) {
        showAlert("Please enter a valid enrolment number first");
        return;
    }

    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`You have already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}. Registration cannot be changed.`);
        return;
    }

    if (!isSlotAvailable(week, currentStudent.year)) {
        showAlert(`No available slots for ${WEEK_DISPLAY_NAMES[week]}. This week is full.`);
        renderWeekCards(currentStudent.year);
        return;
    }

    selectedWeek = week;
    renderWeekCards(currentStudent.year);
    showAlert(`Selected: ${WEEK_DISPLAY_NAMES[week]}`, false);
};

// ============================================
// 📤 SUBMIT REGISTRATION TO GOOGLE SHEET
// ============================================
async function submitRegistration() {
    if (!currentStudent) {
        showAlert("❌ Please enter a valid enrolment number first.");
        return;
    }

    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`⚠️ You have already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}. Registration cannot be changed.`);
        return;
    }

    if (!selectedWeek) {
        showAlert("⚠️ Please select Week 4 before submitting.");
        return;
    }

    if (!isSlotAvailable(selectedWeek, currentStudent.year)) {
        showAlert(`❌ No available slots for ${WEEK_DISPLAY_NAMES[selectedWeek]}. Slots are full.`);
        renderWeekCards(currentStudent.year);
        return;
    }

    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Submitting...';

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                action: "updateStatus",
                enrolNo: currentStudent.enrol,
                status: selectedWeek,
                year: currentStudent.year,
                name: currentStudent.name,
                mode: currentStudent.mode
            })
        });

        const result = await response.json();

        if (result.success) {
            currentStudent.status = selectedWeek;

            registrationsData.push({
                enrol: currentStudent.enrol,
                name: currentStudent.name,
                year: currentStudent.year,
                mode: currentStudent.mode,
                status: selectedWeek,
                submission_date: new Date().toISOString()
            });

            computeSlotUsage();

            showAlert(`✅ Success! You have registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`, false);

            statusContainer.classList.remove("hidden");
            statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}</span>`;
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
        } else {
            showAlert(`❌ Registration failed: ${result.error || "Unknown error"}`);
            await loadRegistrationsData();
            computeSlotUsage();
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        }
    } catch (error) {
        console.error("Submit error:", error);
        showAlert("Network error: Could not register. Please try again later.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
    }
}

// ============================================
// 🔔 UI HELPERS
// ============================================
function showAlert(message, isError = true) {
    alertPopup.textContent = message;
    alertPopup.style.background = isError ? "#dc2626" : "#059669";
    alertPopup.classList.add('show');
    setTimeout(() => {
        alertPopup.classList.remove('show');
    }, 3000);
}

// ============================================
// 🔒 SECURITY (Optional)
// ============================================

// Disable right-click
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});

// Disable inspect shortcuts
document.addEventListener("keydown", function(e) {
    if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))
    ) {
        e.preventDefault();
    }
});

console.log('%c⚡ PG Workshop Registration Portal - Week 4 Only ⚡', 'color: #059669; font-size: 16px; font-weight: bold;');
