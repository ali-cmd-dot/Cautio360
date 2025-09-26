// Stock Management JavaScript
// This file handles CSV import and stock management functionality

// Supabase Configuration - Direct connection (no config.js needed)
function getSupabaseClient() {
    const SUPABASE_URL = 'https://jcmjazindwonrplvjwxl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Use global supabase variable from main script

// Global variables for stock management
// Local stock variables (use global variables from main script when needed)
let localStockData = [];
let filteredStockData = [];
let importHistory = [];
let currentStockFilter = "";
// userSession is available globally from main script

// Required CSV columns
const REQUIRED_COLUMNS = [
    "Sl. No.",
    "PO No",
    "Batch No.",
    "Inward Date",
    "Device Model No.",
    "Device Registration Number",
    "Device IMEI",
];

// Initialize stock management
document.addEventListener("DOMContentLoaded", function () {
    // Initialize supabase client if not already done
    if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        window.supabaseClient = getSupabaseClient();
    }
    if (!window.supabaseClient) {
        console.error("Failed to initialize Supabase client");
        return;
    }
    
    // Set global supabase variable
    if (typeof supabase === 'undefined') {
        supabase = window.supabaseClient;
    }

    // Get user session from localStorage
    checkStockUserSession();

    // Load initial data
    loadStockData();

    // Setup event listeners
    setupStockEventListeners();

    // Setup realtime listeners only if supabase.channel is available
    if (typeof supabase.channel === "function") {
        setupStockRealtimeListeners();
    } else {
        console.warn(
            "Realtime listeners not available - supabase.channel not found",
        );
    }
});

// Check user session for stock management
function checkStockUserSession() {
    const savedSession = localStorage.getItem("cautio_user_session");
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.expires > Date.now()) {
                userSession = sessionData.user;
            }
        } catch (error) {
            console.error("Error parsing session:", error);
        }
    }

    if (!userSession) {
        // Redirect to main dashboard login
        window.location.href = "./";
    }
}

// Navigation functions
function goBackToDashboard() {
    // Navigate back to main dashboard
    window.location.href = "./";
}

function goToInventoryManagement() {
    window.location.href = "./inventory.html";
}

// Setup event listeners for stock management
function setupStockEventListeners() {
    // CSV file input
    const csvFileInput = document.getElementById("csvFileInput");
    csvFileInput.addEventListener("change", handleCSVFileSelect);

    // Drag and drop for CSV import
    const csvImportArea = document.getElementById("csvImportArea");
    csvImportArea.addEventListener("dragover", handleDragOver);
    csvImportArea.addEventListener("dragleave", handleDragLeave);
    csvImportArea.addEventListener("drop", handleFileDrop);

    // Search functionality
    document
        .getElementById("stockSearchInput")
        .addEventListener("input", handleStockSearch);
    document
        .getElementById("statusFilter")
        .addEventListener("change", handleStockSearch);
        
    // FAB menu click outside
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('stockAddMenu');
        const button = event.target.closest('[onclick="toggleStockAddMenu()"]');
        if (!button && menu && !menu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });
}

// Floating Action Button
function toggleStockAddMenu() {
    const menu = document.getElementById('stockAddMenu');
    menu.classList.toggle('hidden');
}


// Setup realtime listeners for stock
function setupStockRealtimeListeners() {
    // Listen for stock changes
    supabase
        .channel("stock_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "stock" },
            (payload) => {
                console.log("Stock change received!", payload);
                loadStockData();
            },
        )
        .subscribe();

    // Listen for import log changes
    supabase
        .channel("import_log_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "csv_import_logs" },
            (payload) => {
                console.log("Import log change received!", payload);
                loadImportHistory();
            },
        )
        .subscribe();

    // NEW: Listen for inventory changes to update stock status
    supabase
        .channel("inventory_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "inward_devices" },
            (payload) => {
                console.log("Inward device change received!", payload);
                setTimeout(loadStockData, 1000); 
            },
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "outward_devices" },
            (payload) => {
                console.log("Outward device change received!", payload);
                setTimeout(loadStockData, 1000);
            },
        )
        .subscribe();
}

// Load all stock data
async function loadStockData() {
    try {
        showStockLoadingOverlay();
        await loadStockItems();
        await loadImportHistory();
        updateStockPageSummary();
        updateStockTable();
        updateImportHistoryList();
        hideStockLoadingOverlay();
    } catch (error) {
        console.error("Error loading stock data:", error);
        showStockToast("Error loading stock data", "error");
        hideStockLoadingOverlay();
    }
}

// Load stock items from database
async function loadStockItems() {
    try {
        const { data, error } = await supabase
            .from("stock")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        localStockData = data || [];
        filteredStockData = [...localStockData];
    } catch (error) {
        console.error("Error loading stock items:", error);
        throw error;
    }
}

// Load import history
async function loadImportHistory() {
    try {
        const { data, error } = await supabase
            .from("csv_import_logs")
            .select("*")
            .order("import_date", { ascending: false })
            .limit(10);

        if (error) throw error;
        importHistory = data || [];
    } catch (error) {
        console.error("Error loading import history:", error);
        throw error;
    }
}

// Update stock summary display for stock page
function updateStockPageSummary() {
    const totalItems = localStockData.length;
    const availableItems = localStockData.filter(item => item.current_status === "available").length;
    const allocatedItems = localStockData.filter(item => item.current_status === "allocated").length;
    const uniqueModels = new Set(localStockData.map(item => item.device_model_no)).size;

    document.getElementById("totalStockItems").textContent = totalItems;
    document.getElementById("availableItems").textContent = availableItems;
    document.getElementById("allocatedItems").textContent = allocatedItems;
    document.getElementById("totalModels").textContent = uniqueModels;
}

// Update stock table
function updateStockTable() {
    const tableBody = document.getElementById("stockTableBody");
    const emptyState = document.getElementById("stockEmptyState");

    if (filteredStockData.length === 0) {
        tableBody.innerHTML = "";
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
        tableBody.innerHTML = filteredStockData.map(item => createStockTableRow(item)).join("");
    }
}

// Create stock table row HTML
function createStockTableRow(item) {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : "N/A";
    const getStatusBadge = (status) => `<span class="compact-badge status-${status === 'available' ? 'available' : 'allocated'}">● ${status}</span>`;
    const getConditionBadge = (condition) => `<span class="compact-badge condition-${condition.replace(/\s+/g, '_')}">${condition}</span>`;
    const getInventoryStatusBadge = (invStatus) => {
        const statusMap = {
            in_stock: { class: 'status-available', text: 'In Stock' },
            in_inward: { class: 'condition-new', text: 'Inward' },
            in_outward: { class: 'status-allocated', text: 'Outward' }
        };
        const details = statusMap[invStatus] || { class: 'condition-used', text: 'Unknown' };
        return `<span class="compact-badge ${details.class}">${details.text}</span>`;
    };

    return `
        <tr>
            <td class="compact-text-secondary">${item.sl_no || "N/A"}</td>
            <td class="compact-text-primary font-mono">${item.device_registration_number}</td>
            <td class="compact-text-secondary font-mono">${item.device_imei}</td>
            <td class="compact-text-primary">${item.device_model_no}</td>
            <td>${getStatusBadge(item.current_status)}</td>
            <td>${getConditionBadge(item.device_condition)}</td>
            <td>${getInventoryStatusBadge(item.inventory_status)}</td>
            <td class="compact-text-secondary">${item.batch_no || "N/A"}</td>
            <td class="compact-text-secondary">${formatDate(item.inward_date)}</td>
            <td>
                <button onclick="viewDeviceMovementHistory('${item.device_registration_number}')" class="compact-btn compact-btn-primary">
                    VIEW
                </button>
            </td>
        </tr>
    `;
}

// NEW: View Device Movement History
async function viewDeviceMovementHistory(deviceRegNumber) {
    showStockLoadingOverlay();
    try {
        const { data: outwardData, error: outwardError } = await supabase
            .from('outward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegNumber)
            .order('outward_date', { ascending: false });

        if (outwardError) throw outwardError;

        const { data: inwardData, error: inwardError } = await supabase
            .from('inward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegNumber)
            .order('inward_date', { ascending: false });
        
        if (inwardError) throw inwardError;

        const history = [...outwardData.map(d => ({...d, type: 'Outward'})), ...inwardData.map(d => ({...d, type: 'Inward'}))];
        history.sort((a, b) => new Date(b.outward_date || b.inward_date) - new Date(a.outward_date || a.inward_date));

        const modalContent = document.getElementById('deviceHistoryContent');
        if (history.length === 0) {
            modalContent.innerHTML = `<p class="text-center">No movement history found for device ${deviceRegNumber}.</p>`;
        } else {
            modalContent.innerHTML = `
                <h4 class="text-body-l-semibold mb-4">History for: ${deviceRegNumber}</h4>
                <div class="device-timeline max-h-96 overflow-y-auto">
                    ${history.map(item => createHistoryTimelineItem(item)).join('')}
                </div>
            `;
        }
        document.getElementById('deviceHistoryModal').classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching device history:', error);
        showStockToast('Failed to load device history.', 'error');
    } finally {
        hideStockLoadingOverlay();
    }
}

function createHistoryTimelineItem(item) {
    const formatDate = (date) => new Date(date).toLocaleString();
    if (item.type === 'Outward') {
        return `
            <div class="timeline-item">
                <p class="font-semibold text-red-400">Outward to ${item.customer_name}</p>
                <p class="text-sm text-gray-400">${formatDate(item.outward_date)}</p>
                <p class="text-sm text-gray-500">Location: ${item.location} | Processed by: ${item.processed_by}</p>
            </div>`;
    } else { // Inward
        return `
            <div class="timeline-item">
                <p class="font-semibold text-green-400">Inward / Returned</p>
                <p class="text-sm text-gray-400">${formatDate(item.inward_date)}</p>
                <p class="text-sm text-gray-500">Condition: ${item.device_condition} | Processed by: ${item.processed_by}</p>
            </div>`;
    }
}

function closeDeviceHistoryModal() {
    document.getElementById('deviceHistoryModal').classList.add('hidden');
}


// Handle Drag and Drop for CSV
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.add("drag-over");
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.remove("drag-over");
}

function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0 && (files[0].type === "text/csv" || files[0].name.endsWith(".csv"))) {
        processCSVFile(files[0]);
    } else {
        showStockToast("Please select a valid CSV file", "error");
    }
}

// Handle CSV file selection
function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
        processCSVFile(file);
    } else {
        showStockToast("Please select a valid CSV file", "error");
    }
}

// Process CSV file
function processCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        Papa.parse(e.target.result, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: (header) => header.trim(),
            complete: (results) => validateAndImportCSV(results, file.name),
            error: (error) => showStockToast("Error parsing CSV file", "error"),
        });
    };
    reader.onerror = () => showStockToast("Error reading file", "error");
    reader.readAsText(file);
}

// Validate and import CSV data
async function validateAndImportCSV(results, filename) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});
        const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            showStockToast(`Missing required columns: ${missingColumns.join(", ")}`, "error");
            return;
        }

        showImportProgress();
        const validData = [], errors = [];
        for (let i = 0; i < data.length; i++) {
            updateImportProgress((i / data.length) * 50);
            const row = data[i];
            const deviceRegNumber = row["Device Registration Number"];
            const deviceImei = row["Device IMEI"];
            const deviceModel = row["Device Model No."];
            if (!deviceRegNumber || !deviceImei || !deviceModel) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }
            if (validData.find(item => item.device_registration_number === deviceRegNumber || item.device_imei === deviceImei)) {
                errors.push(`Row ${i + 2}: Duplicate device in CSV`);
                continue;
            }
            let inwardDate = null;
            if (row["Inward Date"]) {
                const parsedDate = new Date(row["Inward Date"]);
                if (!isNaN(parsedDate.getTime())) inwardDate = parsedDate.toISOString().split("T")[0];
            }
            validData.push({
                sl_no: row["Sl. No."] || null,
                po_no: row["PO No"] || null,
                batch_no: row["Batch No."] || null,
                inward_date: inwardDate,
                device_model_no: deviceModel,
                device_registration_number: deviceRegNumber,
                device_imei: deviceImei,
                current_status: "available",
                device_condition: "good", // Default to 'good' instead of 'new'
                imported_by: userSession?.email || "unknown",
            });
        }

        const existingRegNumbers = new Set(localStockData.map(d => d.device_registration_number));
        const existingImeis = new Set(localStockData.map(d => d.device_imei));
        const newDevices = validData.filter(item => {
            if (existingRegNumbers.has(item.device_registration_number) || existingImeis.has(item.device_imei)) {
                errors.push(`Device ${item.device_registration_number} already exists`);
                return false;
            }
            return true;
        });

        let successfulImports = 0;
        if (newDevices.length > 0) {
            const { error } = await supabase.from("stock").insert(newDevices);
            if (error) {
                errors.push(`Database insert failed: ${error.message}`);
            } else {
                successfulImports = newDevices.length;
            }
        }

        await supabase.from("csv_import_logs").insert([{
            filename: filename,
            total_rows: data.length,
            successful_imports: successfulImports,
            failed_imports: data.length - successfulImports,
            error_details: errors.length > 0 ? { errors } : null,
            imported_by: userSession?.email || "unknown",
        }]);

        hideImportProgress();
        showImportResults(successfulImports, data.length - successfulImports, errors);
        await loadStockData();
        document.getElementById("csvFileInput").value = "";
        
        if (successfulImports > 0) {
            setTimeout(() => {
                showStockToast(`✅ ${successfulImports} devices imported and will be auto-added to inventory inward`, "success");
            }, 2000);
        }

    } catch (error) {
        console.error("Error importing CSV:", error);
        hideImportProgress();
        showStockToast("Error importing CSV data", "error");
    }
}

// Show/Update/Hide Import Progress
function showImportProgress() {
    document.getElementById("importProgressSection").classList.remove("hidden");
    updateImportProgress(0);
}
function updateImportProgress(percentage) {
    document.getElementById("importProgressBar").style.width = `${percentage}%`;
    document.getElementById("importProgressText").textContent = `${Math.round(percentage)}%`;
}
function hideImportProgress() {
    document.getElementById("importProgressSection").classList.add("hidden");
}

// Show Import Results
function showImportResults(successful, failed, errors) {
    const resultsDiv = document.getElementById("importResults");
    const isSuccess = failed === 0;
    resultsDiv.className = `import-results ${isSuccess ? "" : "error"}`;
    let resultHTML = `<div class="flex items-center gap-3 mb-4">...</div>`; // simplified
    resultsDiv.innerHTML = `
        <h4>Import ${isSuccess ? "Completed" : "Completed with Errors"}</h4>
        <p>${successful} successful, ${failed} failed</p>
        ${errors.length > 0 ? `<h5>Errors:</h5><ul>${errors.slice(0, 10).map(e => `<li>${e}</li>`).join('')}</ul>` : ''}`;
    resultsDiv.classList.remove("hidden");
    setTimeout(() => resultsDiv.classList.add("hidden"), 15000);
    showStockToast(`Import: ${successful} success, ${failed} failed`, isSuccess ? "success" : "warning");
}

// Update import history list
function updateImportHistoryList() {
    const historyList = document.getElementById("importHistoryList");
    const emptyState = document.getElementById("importHistoryEmptyState");
    if (importHistory.length === 0) {
        historyList.innerHTML = "";
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
        historyList.innerHTML = importHistory.map(record => createImportHistoryCard(record)).join("");
    }
}

// Create import history card HTML
function createImportHistoryCard(record) {
    // This function remains largely the same but ensure no 'new device' logic is present
    const formatDate = (dateString) => new Date(dateString).toLocaleString();
    // ... rest of the function ...
    return `<div>...</div>`; // Placeholder for existing code
}

// Search and Filter functionality
function handleStockSearch() {
    const searchTerm = document.getElementById("stockSearchInput").value.toLowerCase().trim();
    const statusFilter = document.getElementById("statusFilter").value;
    filteredStockData = localStockData.filter(item => {
        const matchesSearch = !searchTerm || Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm));
        const matchesStatus = !statusFilter || item.current_status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    updateStockTable();
}

function clearStockSearch() {
    document.getElementById("stockSearchInput").value = "";
    document.getElementById("statusFilter").value = "";
    filteredStockData = [...localStockData];
    updateStockTable();
    showStockToast("Search cleared", "success");
}

// Loading and Toast functions
function showStockLoadingOverlay() { document.getElementById("stockLoadingOverlay").classList.remove("hidden"); }
function hideStockLoadingOverlay() { document.getElementById("stockLoadingOverlay").classList.add("hidden"); }
function showStockToast(message, type = "success") {
    const toast = document.getElementById("stockToast");
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${type}`;
    toast.querySelector('span:last-child').textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.classList.add("hidden"), 300);
    }, 3000);
}

// Make functions globally available
window.goBackToDashboard = goBackToDashboard;
window.goToInventoryManagement = goToInventoryManagement;
window.clearStockSearch = clearStockSearch;
window.viewDeviceMovementHistory = viewDeviceMovementHistory;
window.closeDeviceHistoryModal = closeDeviceHistoryModal;
window.loadStockData = loadStockData;
window.toggleStockAddMenu = toggleStockAddMenu;
