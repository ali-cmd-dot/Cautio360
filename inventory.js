// Inventory Management JavaScript
// This file handles all inventory-related functionality

// Supabase Configuration
function getSupabaseClient() {
    const SUPABASE_URL = 'https://jcmjazindwonrplvjwxl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global variables for inventory
let stockData = [];
let inwardDevices = [];
let outwardDevices = [];
let simData = []; // For SIM Management
let filteredInwardDevices = [];
let filteredOutwardDevices = [];
let filteredSimData = [];
let currentInventoryFilter = '';
// approvedCustomers and userSession are available globally from main script

// Device condition mapping (REMOVED 'new' condition)
const DEVICE_CONDITIONS = {
    'good': 'Good',
    'lense_issue': 'Lense issue',
    'sim_module_fail': 'SIM module fail',
    'auto_restart': 'Auto restart',
    'device_tampered': 'Device tampered',
};

// Initialize inventory management
document.addEventListener('DOMContentLoaded', function() {
    if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        window.supabaseClient = getSupabaseClient();
    }
    if (typeof supabase === 'undefined') {
        supabase = window.supabaseClient;
    }
    
    checkInventoryUserSession();
    loadAllData();
    setupInventoryEventListeners();
    setupInventoryRealtimeListeners();
    showDeviceManagementSubTab(); // Default to Device Management view
});

// Check user session
function checkInventoryUserSession() {
    const savedSession = localStorage.getItem('cautio_user_session');
    if (savedSession) {
        userSession = JSON.parse(savedSession).user;
    }
    if (!userSession) {
        window.location.href = './';
    }
}

function goBackToDashboard() {
    window.location.href = './';
}

// Setup event listeners
function setupInventoryEventListeners() {
    document.getElementById('inventorySearchInput').addEventListener('input', handleInventorySearch);
    document.getElementById('addInwardForm').addEventListener('submit', handleAddInward);
    document.getElementById('addOutwardForm').addEventListener('submit', handleAddOutward);
    document.getElementById('simReplacementForm').addEventListener('submit', handleSimReplacement);
    
    // FAB Menu
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('inventoryAddMenu');
        const button = event.target.closest('[onclick="toggleInventoryAddMenu()"]');
        if (!button && menu && !menu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });
}

// Floating Action Button
function toggleInventoryAddMenu() {
    const menu = document.getElementById('inventoryAddMenu');
    menu.classList.toggle('hidden');
}


// Realtime Listeners
function setupInventoryRealtimeListeners() {
    const reloadAllData = (payload) => {
        console.log('Change detected, reloading all inventory data:', payload);
        loadAllData();
    };
    supabase.channel('public_stock').on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, reloadAllData).subscribe();
    supabase.channel('public_inward_devices').on('postgres_changes', { event: '*', schema: 'public', table: 'inward_devices' }, reloadAllData).subscribe();
    supabase.channel('public_outward_devices').on('postgres_changes', { event: '*', schema: 'public', table: 'outward_devices' }, reloadAllData).subscribe();
    supabase.channel('public_device_sim_management').on('postgres_changes', { event: '*', schema: 'public', table: 'device_sim_management' }, reloadAllData).subscribe();
}

// Load all necessary data
async function loadAllData() {
    showInventoryLoadingOverlay();
    try {
        await Promise.all([
            loadStockData(),
            loadInwardDevicesData(),
            loadOutwardDevicesData(),
            loadSimData(),
            loadApprovedCustomers()
        ]);
        updateUI();
    } catch (error) {
        console.error('Error loading inventory data:', error);
        showInventoryToast('Error loading data', 'error');
    } finally {
        hideInventoryLoadingOverlay();
    }
}

// Data loading functions
async function loadStockData() { /* ... unchanged ... */ }
async function loadInwardDevicesData() { /* ... unchanged ... */ }
async function loadOutwardDevicesData() { /* ... unchanged ... */ }
async function loadApprovedCustomers() { /* ... unchanged ... */ }
async function loadSimData() {
    const { data, error } = await supabase.from('device_sim_management').select('*');
    if (error) throw error;
    simData = data || [];
    filteredSimData = [...simData];
}

// Main UI Update Function
function updateUI() {
    updateStockSummary();
    populateCustomerDropdown();
    // Update the currently active tab
    if (!document.getElementById('deviceManagementContent').classList.contains('hidden')) {
        updateDeviceManagementUI();
    } else {
        updateSimManagementUI();
    }
}

function updateDeviceManagementUI() {
    updateInwardTab();
    updateOutwardTab();
    updateTabCounts();
}

function updateSimManagementUI() {
    updateSimManagementTab();
}


// Tab Switching
function showDeviceManagementSubTab() {
    document.getElementById('deviceManagementContent').classList.remove('hidden');
    document.getElementById('simManagementContent').classList.add('hidden');
    document.getElementById('deviceMgmtSubTab').classList.add('active');
    document.getElementById('simMgmtSubTab').classList.remove('active');
    showInwardTab(); // Default to inward view
}

function showSimManagementSubTab() {
    document.getElementById('deviceManagementContent').classList.add('hidden');
    document.getElementById('simManagementContent').classList.remove('hidden');
    document.getElementById('deviceMgmtSubTab').classList.remove('active');
    document.getElementById('simMgmtSubTab').classList.add('active');
    updateSimManagementTab();
}

function showInwardTab() { /* ... unchanged ... */ }
function showOutwardTab() { /* ... unchanged ... */ }

// Update content for each tab
function updateInwardTab() { /* ... unchanged, ensure createInwardDeviceCard uses new condition map ... */ }
function updateOutwardTab() { /* ... unchanged ... */ }
function updateTabCounts() { /* ... unchanged ... */ }

// SIM Management UI
function updateSimManagementTab() {
    const list = document.getElementById('simManagementList');
    const emptyState = document.getElementById('simEmptyState');
    if (filteredSimData.length === 0) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        list.innerHTML = filteredSimData.map(createSimRow).join('');
    }
}

function createSimRow(sim) {
    return `
        <tr>
            <td class="compact-text-primary">${sim.device_registration_number}</td>
            <td class="compact-text-secondary">${sim.device_imei}</td>
            <td class="compact-text-primary">${sim.current_sim_no || 'N/A'}</td>
            <td>
                <button onclick="showSimReplacementModal('${sim.device_registration_number}', '${sim.device_imei}', '${sim.current_sim_no || ''}')" class="compact-btn compact-btn-primary">Replace</button>
                <button onclick="viewSimHistory('${sim.device_registration_number}')" class="compact-btn compact-btn-primary ml-2">History</button>
            </td>
        </tr>
    `;
}

// SIM Replacement Functions
function showSimReplacementModal(regNo, imei, oldSim) {
    const form = document.getElementById('simReplacementForm');
    form.reset();
    form.querySelector('[name="deviceRegistrationNumber"]').value = regNo;
    form.querySelector('[name="deviceImei"]').value = imei;
    form.querySelector('[name="oldSimNo"]').value = oldSim;
    document.getElementById('simReplaceRegNo').textContent = regNo;
    document.getElementById('simReplacementModal').classList.remove('hidden');
}

function closeSimReplacementModal() {
    document.getElementById('simReplacementModal').classList.add('hidden');
}

async function handleSimReplacement(e) {
    e.preventDefault();
    showInventoryLoadingOverlay();
    const formData = new FormData(e.target);
    const regNo = formData.get('deviceRegistrationNumber');
    const imei = formData.get('deviceImei');
    const oldSimNo = formData.get('oldSimNo');
    const newSimNo = formData.get('newSimNo');

    try {
        // Validation 1: Check if device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('id, sim_no')
            .eq('device_registration_number', regNo)
            .eq('device_imei', imei)
            .single();

        if (stockError || !stockDevice) {
            throw new Error('Device not found in stock or IMEI mismatch.');
        }

        // Validation 2: Check if old SIM number matches the current one in stock
        if (stockDevice.sim_no !== (oldSimNo === 'null' ? null : oldSimNo)) {
           throw new Error(`Validation failed: The device's current SIM is (${stockDevice.sim_no || 'None'}), not ${oldSimNo}.`);
        }
        
        // Insert into history table (trigger will handle the rest)
        const { error: insertError } = await supabase
            .from('sim_replacement_history')
            .insert([{
                device_registration_number: regNo,
                device_imei: imei,
                old_sim_no: oldSimNo,
                new_sim_no: newSimNo,
                replaced_by: userSession?.email || 'unknown',
                replacement_reason: 'Manual Replacement'
            }]);

        if (insertError) throw insertError;

        showInventoryToast('SIM replaced successfully!', 'success');
        closeSimReplacementModal();
        await loadSimData(); // Reload data
        updateSimManagementTab();

    } catch (error) {
        console.error('Error replacing SIM:', error);
        showInventoryToast(error.message, 'error');
    } finally {
        hideInventoryLoadingOverlay();
    }
}

// SIM History Functions
async function viewSimHistory(regNo) {
    showInventoryLoadingOverlay();
    try {
        const { data, error } = await supabase
            .from('sim_replacement_history')
            .select('*')
            .eq('device_registration_number', regNo)
            .order('replacement_date', { ascending: false });

        if (error) throw error;

        const modalContent = document.getElementById('simHistoryContent');
        if (data.length === 0) {
            modalContent.innerHTML = `<p class="text-center">No SIM replacement history for ${regNo}.</p>`;
        } else {
             modalContent.innerHTML = `
                <h4 class="text-body-l-semibold mb-4">History for: ${regNo}</h4>
                <div class="device-timeline max-h-96 overflow-y-auto">
                    ${data.map(item => `
                        <div class="timeline-item">
                            <p class="font-semibold">Replaced ${item.old_sim_no || 'None'} with ${item.new_sim_no}</p>
                            <p class="text-sm text-gray-400">On: ${new Date(item.replacement_date).toLocaleString()}</p>
                            <p class="text-sm text-gray-500">By: ${item.replaced_by}</p>
                        </div>
                    `).join('')}
                </div>`;
        }
        document.getElementById('simHistoryModal').classList.remove('hidden');

    } catch (error) {
        showInventoryToast('Failed to load SIM history.', 'error');
    } finally {
        hideInventoryLoadingOverlay();
    }
}

function closeSimHistoryModal() {
    document.getElementById('simHistoryModal').classList.add('hidden');
}


// Search, Modal, and Form Handling functions...
// (These remain mostly unchanged, just ensure they don't reference the 'new' condition)
function handleInventorySearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    currentInventoryFilter = searchTerm;
    
    // Filter device data
    filteredInwardDevices = inwardDevices.filter(d => JSON.stringify(d).toLowerCase().includes(searchTerm));
    filteredOutwardDevices = outwardDevices.filter(d => JSON.stringify(d).toLowerCase().includes(searchTerm));
    updateDeviceManagementUI();

    // Filter SIM data
    filteredSimData = simData.filter(s => JSON.stringify(s).toLowerCase().includes(searchTerm));
    updateSimManagementUI();
}

// ... other functions like handleAddInward, handleAddOutward, modals, toasts, etc. remain the same.
// Just ensure any mention of 'new' device condition is removed from them.
async function handleAddInward(e) { e.preventDefault(); /* ... same logic ... */ }
async function handleAddOutward(e) { e.preventDefault(); /* ... same logic ... */ }

// Make functions globally available
window.showInwardTab = showInwardTab;
window.showOutwardTab = showOutwardTab;
window.showDeviceManagementSubTab = showDeviceManagementSubTab;
window.showSimManagementSubTab = showSimManagementSubTab;
window.showAddInwardForm = showAddInwardForm;
window.closeAddInwardForm = closeAddInwardForm;
window.showAddOutwardForm = showAddOutwardForm;
window.closeAddOutwardForm = closeAddOutwardForm;
window.toggleInventoryAddMenu = toggleInventoryAddMenu;
window.showSimReplacementModal = showSimReplacementModal;
window.closeSimReplacementModal = closeSimReplacementModal;
window.viewSimHistory = viewSimHistory;
window.closeSimHistoryModal = closeSimHistoryModal;
