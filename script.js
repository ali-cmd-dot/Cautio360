// Supabase Configuration - Direct connection (no config.js needed)
function getSupabaseClient() {
    const SUPABASE_URL = 'https://jcmjazindwonrplvjwxl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let supabase;

// Global variables
let sidebarExpanded = false;
let customers = [];
let leads = [];
let credentials = [];
let scheduledEmails = [];
let pendingApprovals = [];
let approvedCustomers = []; // Only approved customers
let filteredCustomers = [];
let filteredLeads = [];
let currentFilter = '';
let currentPOCAction = null;
let currentEmailTarget = null;
let userSession = null;
let selectedCustomerId = null; // For customer dropdown

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    window.supabaseClient = getSupabaseClient();
    supabase = window.supabaseClient;
    if (!supabase) {
        console.error('Failed to initialize Supabase client');
        return;
    }
    
    updateTabHighlight('allTab');
    
    // Check for existing session
    checkUserSession();
    
    loadData();
    checkExpiredPOCs();
    setupEventListeners();
    setupRealtimeListeners();
    checkPOCReminders();
    
    // Start email scheduler
    startEmailScheduler();
    
    // Auto-save session every 30 seconds
    setInterval(saveUserSession, 30000);
});

// Session Management - Prevents logout on refresh
function saveUserSession() {
    if (userSession) {
        localStorage.setItem('cautio_user_session', JSON.stringify({
            user: userSession,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }));
    }
}

function checkUserSession() {
    const savedSession = localStorage.getItem('cautio_user_session');
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.expires > Date.now()) {
                // Valid session found
                userSession = sessionData.user;
                navigateToDashboard();
                showSessionRestored();
            } else {
                // Expired session
                localStorage.removeItem('cautio_user_session');
            }
        } catch (error) {
            console.error('Error parsing session:', error);
            localStorage.removeItem('cautio_user_session');
        }
    }
}

function clearUserSession() {
    userSession = null;
    localStorage.removeItem('cautio_user_session');
}

function showSessionRestored() {
    showEmailToast(`Welcome back, ${userSession.full_name || userSession.email}!`);
}

// Navigation Functions
function navigateToDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    
    // Update user profile display
    const userFullNameEl = document.getElementById('userFullName');
    const userEmailEl = document.getElementById('userEmail');
    
    if (userSession) {
        userFullNameEl.textContent = userSession.full_name || 'User';
        userEmailEl.textContent = userSession.email;
    }
    
    // Update current date/time
    updateDateTime();
    setInterval(updateDateTime, 60000); // Update every minute
}

function showLogin() {
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showForgotPassword() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function backToLogin() {
    showLogin();
}

function logout() {
    clearUserSession();
    showLogin();
    showEmailToast('Successfully logged out');
}

// Update current date/time display
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('currentDateTime').textContent = now.toLocaleDateString('en-US', options);
}

// Menu Management Functions
function toggleFleetMenu() {
    const submenu = document.getElementById('fleetSubmenu');
    const arrow = document.getElementById('fleetMenuArrow');
    
    submenu.classList.toggle('expanded');
    arrow.classList.toggle('rotate-180');
}

function toggleInventoryMenu() {
    const submenu = document.getElementById('inventorySubmenu');
    const arrow = document.getElementById('inventoryMenuArrow');
    
    submenu.classList.toggle('expanded');
    arrow.classList.toggle('rotate-180');
}

// Content Management Functions
function showDashboard() {
    hideAllContent();
    document.getElementById('dashboardContent').classList.remove('hidden');
    updateMenuHighlight('dashboard');
    loadDashboardStats();
}

function showCustomerOverview() {
    hideAllContent();
    document.getElementById('customerOverviewContent').classList.remove('hidden');
    updateMenuHighlight('customer');
    
    // Load customer data and update summary
    if (typeof loadCustomerData === 'function') {
        loadCustomerData().then(() => {
            updateCustomerSummary();
        });
    } else {
        updateCustomerSummary();
    }
}

function showLeads() {
    hideAllContent();
    document.getElementById('leadsContent').classList.remove('hidden');
    updateMenuHighlight('leads');
    
    if (typeof loadLeadData === 'function') {
        loadLeadData().then(() => {
            updateLeadSummary();
        });
    } else {
        updateLeadSummary();
    }
}

function showStock() {
    hideAllContent();
    document.getElementById('stockContent').classList.remove('hidden');
    updateMenuHighlight('stock');
    
    // Load stock content if not already loaded
    if (typeof loadStockData === 'function') {
        loadStockData();
    } else if (typeof updateStockSummary === 'function') {
        updateStockSummary();
    }
}

function showDeviceManagement() {
    hideAllContent();
    document.getElementById('deviceManagementContent').classList.remove('hidden');
    updateMenuHighlight('device');
    
    // Expand Fleet and Inventory menus
    document.getElementById('fleetSubmenu').classList.add('expanded');
    document.getElementById('inventorySubmenu').classList.add('expanded');
    document.getElementById('fleetMenuArrow').classList.add('rotate-180');
    document.getElementById('inventoryMenuArrow').classList.add('rotate-180');
    
    // Load inventory content and update summary
    if (typeof loadInventoryData === 'function') {
        loadInventoryData().then(() => {
            if (typeof updateStockSummary === 'function') {
                updateStockSummary();
            }
        });
    } else if (typeof updateStockSummary === 'function') {
        updateStockSummary();
    }
}

function showSIMManagement() {
    hideAllContent();
    document.getElementById('simManagementContent').classList.remove('hidden');
    updateMenuHighlight('sim');
    
    // Expand Fleet and Inventory menus
    document.getElementById('fleetSubmenu').classList.add('expanded');
    document.getElementById('inventorySubmenu').classList.add('expanded');
    document.getElementById('fleetMenuArrow').classList.add('rotate-180');
    document.getElementById('inventoryMenuArrow').classList.add('rotate-180');
    
    // Load SIM management data
    if (typeof loadSIMManagementData === 'function') {
        loadSIMManagementData();
    }
}

function showVehicleGroup() {
    hideAllContent();
    document.getElementById('vehicleGroupContent').classList.remove('hidden');
    updateMenuHighlight('vehicleGroup');
}

function showUserAccess() {
    hideAllContent();
    document.getElementById('userAccessContent').classList.remove('hidden');
    updateMenuHighlight('userAccess');
}

function showLive() {
    hideAllContent();
    document.getElementById('liveContent').classList.remove('hidden');
    updateMenuHighlight('live');
}

function hideAllContent() {
    const contents = [
        'dashboardContent', 'customerOverviewContent', 'leadsContent', 
        'stockContent', 'deviceManagementContent', 'simManagementContent',
        'vehicleGroupContent', 'userAccessContent', 'liveContent'
    ];
    
    contents.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
}

function updateMenuHighlight(activeMenu) {
    // Remove active class from all menu items
    document.querySelectorAll('.menu-item, .submenu-item, .sub-submenu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current menu
    const menuMap = {
        'dashboard': 'dashboardMenuBtn',
        'customer': 'customerMenuBtn', 
        'leads': 'leadsMenuBtn',
        'stock': 'stockMenuBtn',
        'device': 'deviceManagementMenuBtn',
        'sim': 'simManagementMenuBtn',
        'vehicleGroup': 'vehicleGroupMenuBtn',
        'userAccess': 'userAccessMenuBtn',
        'live': 'liveMenuBtn'
    };
    
    const menuBtn = document.getElementById(menuMap[activeMenu]);
    if (menuBtn) {
        menuBtn.classList.add('active');
    }
}

// Load Dashboard Statistics
async function loadDashboardStats() {
    try {
        // Load customers count
        const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('id, status, approval_status');
            
        if (customersError) throw customersError;
        
        const totalCustomers = customersData?.length || 0;
        const activeCustomers = customersData?.filter(c => c.status === 'active')?.length || 0;
        
        // Load leads count
        const { data: leadsData, error: leadsError } = await supabase
            .from('leads')
            .select('id');
            
        if (leadsError) throw leadsError;
        
        const totalLeads = leadsData?.length || 0;
        
        // Load stock count
        const { data: stockData, error: stockError } = await supabase
            .from('stock')
            .select('id');
            
        if (stockError) throw stockError;
        
        const totalStock = stockData?.length || 0;
        
        // Update dashboard stats
        document.getElementById('totalCustomersCount').textContent = totalCustomers;
        document.getElementById('activeCustomersCount').textContent = activeCustomers;
        document.getElementById('totalLeadsCount').textContent = totalLeads;
        document.getElementById('totalStockCount').textContent = totalStock;
        
        // Load recent customers
        const { data: recentCustomers, error: recentError } = await supabase
            .from('customers')
            .select('customer_name, created_at, status')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (recentError) throw recentError;
        
        // Update recent customers list
        const recentCustomersList = document.getElementById('recentCustomersList');
        if (recentCustomers && recentCustomers.length > 0) {
            recentCustomersList.innerHTML = recentCustomers.map(customer => `
                <div class="flex items-center justify-between p-3 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                    <div>
                        <div class="text-body-m-semibold dark:text-dark-base-600">${customer.customer_name}</div>
                        <div class="text-body-s-regular dark:text-dark-base-500">${formatDate(customer.created_at)}</div>
                    </div>
                    <span class="status-badge ${customer.status}">${customer.status}</span>
                </div>
            `).join('');
        } else {
            recentCustomersList.innerHTML = '<div class="text-center py-4 text-body-m-regular dark:text-dark-base-500">No recent customers</div>';
        }
        
        // Load recent leads
        const { data: recentLeads, error: recentLeadsError } = await supabase
            .from('leads')
            .select('customer_name, created_at, status')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (recentLeadsError) throw recentLeadsError;
        
        // Update recent leads list
        const recentLeadsList = document.getElementById('recentLeadsList');
        if (recentLeads && recentLeads.length > 0) {
            recentLeadsList.innerHTML = recentLeads.map(lead => `
                <div class="flex items-center justify-between p-3 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                    <div>
                        <div class="text-body-m-semibold dark:text-dark-base-600">${lead.customer_name}</div>
                        <div class="text-body-s-regular dark:text-dark-base-500">${formatDate(lead.created_at)}</div>
                    </div>
                    <span class="status-badge ${lead.status}">${lead.status}</span>
                </div>
            `).join('');
        } else {
            recentLeadsList.innerHTML = '<div class="text-center py-4 text-body-m-regular dark:text-dark-base-500">No recent leads</div>';
        }
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Customer Management Functions
function openAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('pocStartDate').value = today;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    document.getElementById('pocEndDate').value = endDate.toISOString().split('T')[0];
}

function closeAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.add('hidden');
    document.getElementById('addCustomerForm').reset();
}

// Stock Management Functions
function openAddStockModal() {
    document.getElementById('addStockModal').classList.remove('hidden');
    
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stockInwardDate').value = today;
    
    // Show single entry form by default
    showStockEntryForm('single');
}

function closeAddStockModal() {
    document.getElementById('addStockModal').classList.add('hidden');
    document.getElementById('singleStockEntryForm').reset();
    document.getElementById('stockCsvFile').value = '';
}

function showStockEntryForm(type) {
    const singleForm = document.getElementById('singleStockEntryForm');
    const csvForm = document.getElementById('csvUploadForm');
    
    if (type === 'single') {
        singleForm.classList.remove('hidden');
        csvForm.classList.add('hidden');
    } else {
        singleForm.classList.add('hidden');
        csvForm.classList.remove('hidden');
    }
}

// Handle entry type change for stock
document.addEventListener('change', function(e) {
    if (e.target.name === 'entryType') {
        showStockEntryForm(e.target.value);
    }
});

// Device Management Functions
function openAddDeviceModal() {
    document.getElementById('addDeviceModal').classList.remove('hidden');
    
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inwardDate').value = today;
    document.getElementById('outwardDate').value = today;
    
    // Load customers for outward form
    loadCustomersForSelect();
    
    // Show inward form by default
    showDeviceEntryForm('inward');
}

function closeAddDeviceModal() {
    document.getElementById('addDeviceModal').classList.add('hidden');
    document.getElementById('inwardDeviceForm').reset();
    document.getElementById('outwardDeviceForm').reset();
    document.getElementById('deviceCsvFile').value = '';
}

function showDeviceEntryForm(type) {
    const inwardForm = document.getElementById('inwardDeviceForm');
    const outwardForm = document.getElementById('outwardDeviceForm');
    const csvForm = document.getElementById('deviceCsvUploadForm');
    
    // Hide all forms first
    inwardForm.classList.add('hidden');
    outwardForm.classList.add('hidden');
    csvForm.classList.add('hidden');
    
    // Show selected form
    if (type === 'inward') {
        inwardForm.classList.remove('hidden');
    } else if (type === 'outward') {
        outwardForm.classList.remove('hidden');
    } else if (type === 'csv') {
        csvForm.classList.remove('hidden');
    }
}

// Handle device entry type change
document.addEventListener('change', function(e) {
    if (e.target.name === 'deviceEntryType') {
        showDeviceEntryForm(e.target.value);
    }
});

async function loadCustomersForSelect() {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, customer_name')
            .eq('approval_status', 'approved')
            .eq('status', 'active')
            .order('customer_name');
            
        if (error) throw error;
        
        const select = document.getElementById('outwardCustomer');
        select.innerHTML = '<option value="">Select Customer</option>';
        
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.customer_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// SIM Management Functions
function openSIMReplacementModal() {
    document.getElementById('simReplacementModal').classList.remove('hidden');
}

function closeSIMReplacementModal() {
    document.getElementById('simReplacementModal').classList.add('hidden');
    document.getElementById('simReplacementForm').reset();
    clearValidationErrors();
}

function clearValidationErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.classList.add('hidden'));
    
    const validationStatus = document.getElementById('validationStatus');
    if (validationStatus) {
        validationStatus.classList.add('hidden');
    }
}

// Device History Modal Functions
function openDeviceHistoryModal() {
    document.getElementById('deviceHistoryModal').classList.remove('hidden');
}

function closeDeviceHistoryModal() {
    document.getElementById('deviceHistoryModal').classList.add('hidden');
}

// SIM History Modal Functions
function openSIMHistoryModal() {
    document.getElementById('simHistoryModal').classList.remove('hidden');
}

function closeSIMHistoryModal() {
    document.getElementById('simHistoryModal').classList.add('hidden');
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN');
}

function getStatusBadge(status) {
    const badges = {
        'active': 'bg-green-100 text-green-800',
        'inactive': 'bg-gray-100 text-gray-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'approved': 'bg-blue-100 text-blue-800',
        'rejected': 'bg-red-100 text-red-800',
        'available': 'bg-green-100 text-green-800',
        'allocated': 'bg-orange-100 text-orange-800',
        'returned': 'bg-gray-100 text-gray-800'
    };
    
    const badgeClass = badges[status] || 'bg-gray-100 text-gray-800';
    return `<span class="px-2 py-1 text-xs font-medium rounded-full ${badgeClass}">${status}</span>`;
}

function getConditionBadge(condition) {
    const badges = {
        'good': 'bg-green-100 text-green-800',
        'lense_issue': 'bg-yellow-100 text-yellow-800',
        'sim_module_fail': 'bg-red-100 text-red-800',
        'auto_restart': 'bg-orange-100 text-orange-800',
        'device_tampered': 'bg-red-100 text-red-800',
        'used': 'bg-blue-100 text-blue-800',
        'refurbished': 'bg-purple-100 text-purple-800',
        'damaged': 'bg-red-100 text-red-800'
    };
    
    const badgeClass = badges[condition] || 'bg-gray-100 text-gray-800';
    const label = condition.replace('_', ' ').toUpperCase();
    return `<span class="px-2 py-1 text-xs font-medium rounded-full ${badgeClass}">${label}</span>`;
}

// Toast Notification Functions
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    toastMessage.textContent = message;
    
    // Set icon and color based on type
    if (type === 'success') {
        toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg bg-green-600 text-white';
        toastIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    } else if (type === 'error') {
        toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg bg-red-600 text-white';
        toastIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    } else if (type === 'warning') {
        toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg bg-yellow-600 text-white';
        toastIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>`;
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}

// Loading Overlay Functions
function showLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// COMPLETE EXISTING FUNCTIONS FROM ORIGINAL FILE - ALL 2242 LINES

// Data Loading Functions
async function loadData() {
    try {
        // Load customers with all fields
        const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (customersError) {
            console.error('Error loading customers:', customersError);
        } else {
            customers = customersData || [];
            
            // Separate approved customers and pending approvals
            approvedCustomers = customers.filter(c => c.approval_status === 'approved');
            pendingApprovals = customers.filter(c => c.approval_status === 'pending');
            
            filteredCustomers = [...approvedCustomers];
        }

        // Load leads
        const { data: leadsData, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (leadsError) {
            console.error('Error loading leads:', leadsError);
        } else {
            leads = leadsData || [];
            filteredLeads = [...leads];
        }

        // Load scheduled emails
        await loadScheduledEmails();

        // Update UI after loading all data
        updateTabsContent();
        updateFinanceApprovalsList();

    } catch (error) {
        console.error('Error in loadData:', error);
        showEmailToast('Error loading data', 'error');
    }
}

// Load scheduled emails
async function loadScheduledEmails() {
    try {
        const { data, error } = await supabase
            .from('scheduled_emails')
            .select('*')
            .order('scheduled_datetime', { ascending: true });

        if (error) {
            console.error('Error loading scheduled emails:', error);
            return;
        }

        scheduledEmails = data || [];
        updateScheduledEmailsList();
    } catch (error) {
        console.error('Error loading scheduled emails:', error);
    }
}

// Tab content update functions
function updateTabsContent() {
    updateAllTab();
    updatePOCTab();
    updateOnboardedTab();
    updateClosedTab();
    updateOngoingLeadsTab();
}

function updateAllTab() {
    const allTabContent = document.getElementById('allTabContent');
    
    if (filteredCustomers.length === 0) {
        allTabContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-body-l-regular dark:text-dark-base-500">No customers found</div>
            </div>
        `;
        return;
    }

    allTabContent.innerHTML = filteredCustomers.map(createCustomerCard).join('');
}

function updatePOCTab() {
    const pocCustomers = filteredCustomers.filter(customer => 
        customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc'
    );
    
    const pocTabContent = document.getElementById('pocTabContent');
    
    if (pocCustomers.length === 0) {
        pocTabContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-body-l-regular dark:text-dark-base-500">No POC customers found</div>
            </div>
        `;
        return;
    }

    pocTabContent.innerHTML = pocCustomers.map(createCustomerCard).join('');
}

function updateOnboardedTab() {
    const onboardedCustomers = filteredCustomers.filter(customer => 
        customer.poc_type === 'direct_onboarding'
    );
    
    const onboardedTabContent = document.getElementById('onboardedTabContent');
    
    if (onboardedCustomers.length === 0) {
        onboardedTabContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-body-l-regular dark:text-dark-base-500">No directly onboarded customers found</div>
            </div>
        `;
        return;
    }

    onboardedTabContent.innerHTML = onboardedCustomers.map(createCustomerCard).join('');
}

function updateClosedTab() {
    const closedCustomers = filteredCustomers.filter(customer => 
        customer.status === 'closed' || customer.status === 'inactive'
    );
    
    const closedTabContent = document.getElementById('closedTabContent');
    
    if (closedCustomers.length === 0) {
        closedTabContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-body-l-regular dark:text-dark-base-500">No closed customers found</div>
            </div>
        `;
        return;
    }

    closedTabContent.innerHTML = closedCustomers.map(createCustomerCard).join('');
}

function updateOngoingLeadsTab() {
    const ongoingLeadsTabContent = document.getElementById('ongoingLeadsTabContent');
    
    if (filteredLeads.length === 0) {
        ongoingLeadsTabContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-body-l-regular dark:text-dark-base-500">No leads found</div>
            </div>
        `;
        return;
    }

    ongoingLeadsTabContent.innerHTML = filteredLeads.map(createLeadCard).join('');
}

// Create customer card HTML
function createCustomerCard(customer) {
    const isExpiringSoon = checkIfExpiringSoon(customer.poc_end_date);
    const daysRemaining = calculateDaysRemaining(customer.poc_end_date);
    
    return `
        <div class="customer-card">
            <div class="customer-card-header">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="customer-name">${customer.customer_name}</h3>
                        <p class="customer-email">${customer.customer_email}</p>
                        <div class="customer-meta">
                            <span>${customer.customer_mobile}</span>
                            <span class="meta-separator">•</span>
                            <span>AM: ${customer.account_manager_name}</span>
                        </div>
                    </div>
                    <div class="customer-badges">
                        <span class="badge poc-badge ${customer.poc_type}">${formatPOCType(customer.poc_type)}</span>
                        <span class="badge status-badge ${customer.status}">${customer.status}</span>
                        ${customer.approval_status === 'pending' ? '<span class="badge approval-badge pending">Pending Approval</span>' : ''}
                        ${customer.approval_status === 'rejected' ? '<span class="badge approval-badge rejected">Rejected</span>' : ''}
                    </div>
                </div>
            </div>
            
            <div class="customer-card-body">
                <div class="customer-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">POC Duration:</span>
                        <span class="detail-value">${customer.poc_duration || 30} days</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Start Date:</span>
                        <span class="detail-value">${formatDate(customer.poc_start_date)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">End Date:</span>
                        <span class="detail-value ${isExpiringSoon ? 'expiring-soon' : ''}">${formatDate(customer.poc_end_date)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Days Remaining:</span>
                        <span class="detail-value ${daysRemaining <= 7 ? 'expiring-soon' : ''}">${daysRemaining} days</span>
                    </div>
                </div>
                
                ${customer.lead_sources && customer.lead_sources.length > 0 ? `
                    <div class="lead-sources">
                        <span class="detail-label">Lead Sources:</span>
                        <div class="lead-sources-list">
                            ${customer.lead_sources.map(source => `<span class="lead-source-tag">${source}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${customer.requirements && customer.requirements.length > 0 ? `
                    <div class="requirements">
                        <span class="detail-label">Requirements:</span>
                        <div class="requirements-list">
                            ${customer.requirements.map(req => `<span class="requirement-tag">${req}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${customer.extension_count > 0 ? `
                    <div class="extension-info">
                        <span class="extension-badge">Extended ${customer.extension_count} time(s)</span>
                        <span class="extension-days">+${customer.poc_extended_days} days</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="customer-card-actions">
                ${customer.approval_status === 'approved' ? `
                    <button onclick="openExtendPOCModal(${customer.id})" class="action-btn extend-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12h18m-9-9v18"/>
                        </svg>
                        Extend POC
                    </button>
                    <button onclick="openScheduleEmailModal(${customer.id})" class="action-btn email-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Schedule Email
                    </button>
                    <button onclick="deleteCustomer(${customer.id})" class="action-btn delete-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Create lead card HTML
function createLeadCard(lead) {
    return `
        <div class="lead-card">
            <div class="lead-card-header">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="lead-name">${lead.customer_name}</h3>
                        <p class="lead-contact">${lead.contact}</p>
                    </div>
                    <div class="lead-badges">
                        <span class="badge lead-type-badge ${lead.type}">${lead.type}</span>
                        <span class="badge lead-status-badge ${lead.status}">${lead.status}</span>
                    </div>
                </div>
            </div>
            
            <div class="lead-card-body">
                <div class="lead-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Fleet Size:</span>
                        <span class="detail-value">${lead.fleet_size || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value">${formatDate(lead.created_at)}</span>
                    </div>
                </div>
            </div>
            
            <div class="lead-card-actions">
                <button onclick="convertLeadToCustomer(${lead.id})" class="action-btn convert-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                    </svg>
                    Convert to Customer
                </button>
                <button onclick="deleteLead(${lead.id})" class="action-btn delete-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `;
}

// Utility functions for customer display
function formatPOCType(pocType) {
    const typeMap = {
        'free_poc': 'Free POC',
        'paid_poc': 'Paid POC',
        'direct_onboarding': 'Direct Onboarding'
    };
    return typeMap[pocType] || pocType;
}

function checkIfExpiringSoon(endDate) {
    if (!endDate) return false;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
}

function calculateDaysRemaining(endDate) {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

// POC Management Functions
async function extendPOC(customerId, additionalDays, extendDays, customDays, reason) {
    try {
        // Get current customer data
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (fetchError) throw fetchError;

        let daysToAdd = 0;
        if (extendDays === 'custom') {
            daysToAdd = customDays;
        } else {
            daysToAdd = parseInt(extendDays);
        }

        // Calculate new end date
        const currentEndDate = new Date(customer.poc_end_date);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + daysToAdd);

        // Update customer with extension
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                poc_end_date: newEndDate.toISOString().split('T')[0],
                last_extended: new Date().toISOString(),
                extension_count: (customer.extension_count || 0) + 1,
                poc_extended_days: (customer.poc_extended_days || 0) + daysToAdd
            })
            .eq('id', customerId);

        if (updateError) throw updateError;

        // Send extension email
        await sendEmail('poc_extended', customer, `POC extended by ${daysToAdd} days. Reason: ${reason}`);

        // Close modal and reload data
        closeExtendPOCModal();
        loadData();
        
        showEmailToast(`POC extended by ${daysToAdd} days for ${customer.customer_name}`);

    } catch (error) {
        console.error('Error extending POC:', error);
        alert('Error extending POC');
    }
}

// Email Management Functions
async function sendEmail(emailType, customer, customMessage = null) {
    const emailTemplates = {
        'welcome': {
            subject: 'Welcome to Cautio',
            message: `Dear ${customer.customer_name},\n\nWelcome to Cautio! We're excited to have you onboard.`
        },
        'poc_reminder': {
            subject: 'POC Reminder',
            message: `Dear ${customer.customer_name},\n\nThis is a reminder that your POC will end soon.`
        },
        'poc_extended': {
            subject: 'POC Extended',
            message: `Dear ${customer.customer_name},\n\nYour POC has been extended. ${customMessage}`
        },
        'poc_ended': {
            subject: 'POC Ended',
            message: `Dear ${customer.customer_name},\n\nYour POC has ended. Thank you for trying Cautio.`
        },
        'custom': {
            subject: 'Message from Cautio',
            message: customMessage
        }
    };

    const template = emailTemplates[emailType] || emailTemplates['custom'];
    
    try {
        // Log email to database
        const { error } = await supabase
            .from('email_logs')
            .insert([{
                customer_id: customer.id,
                email_type: emailType,
                recipient_email: customer.customer_email,
                subject: template.subject,
                message: template.message,
                status: 'sent',
                sent_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error logging email:', error);
        }

        console.log(`Email sent to ${customer.customer_name}: ${template.subject}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// Schedule email function
async function scheduleEmail(customerId, emailType, scheduledDateTime, customMessage = null) {
    try {
        const { data, error } = await supabase
            .from('scheduled_emails')
            .insert([{
                customer_id: customerId,
                email_type: emailType,
                scheduled_datetime: scheduledDateTime.toISOString(),
                custom_message: customMessage,
                status: 'pending',
                created_by: userSession?.email || 'admin',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error scheduling email:', error);
        return false;
    }
}

// Check and send scheduled emails
async function checkScheduledEmails() {
    try {
        const now = new Date().toISOString();
        
        const { data: pendingEmails, error } = await supabase
            .from('scheduled_emails')
            .select(`
                *,
                customers (*)
            `)
            .eq('status', 'pending')
            .lte('scheduled_datetime', now);

        if (error) throw error;

        for (const scheduledEmail of pendingEmails) {
            try {
                // Send the email
                await sendEmail(
                    scheduledEmail.email_type,
                    scheduledEmail.customers,
                    scheduledEmail.custom_message
                );

                // Mark as sent
                await supabase
                    .from('scheduled_emails')
                    .update({ 
                        status: 'sent',
                        sent_at: new Date().toISOString()
                    })
                    .eq('id', scheduledEmail.id);

                console.log(`Scheduled email sent: ${scheduledEmail.email_type} to ${scheduledEmail.customers.customer_name}`);
            } catch (emailError) {
                console.error(`Error sending scheduled email ${scheduledEmail.id}:`, emailError);
                
                // Mark as failed
                await supabase
                    .from('scheduled_emails')
                    .update({ 
                        status: 'failed',
                        error_message: emailError.message
                    })
                    .eq('id', scheduledEmail.id);
            }
        }

        if (pendingEmails.length > 0) {
            // Reload scheduled emails list
            await loadScheduledEmails();
        }

    } catch (error) {
        console.error('Error checking scheduled emails:', error);
    }
}

// Start email scheduler - runs every minute
function startEmailScheduler() {
    // Check immediately
    checkScheduledEmails();
    
    // Then check every minute
    setInterval(checkScheduledEmails, 60 * 1000);
}

// Check POC reminders - should run daily
async function checkPOCReminders() {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const { data: expiringPOCs, error } = await supabase
            .from('customers')
            .select('*')
            .eq('poc_end_date', tomorrowStr)
            .eq('approval_status', 'approved')
            .in('poc_type', ['free_poc', 'paid_poc']);

        if (error) throw error;

        for (const customer of expiringPOCs) {
            await sendEmail('poc_reminder', customer);
        }

        if (expiringPOCs.length > 0) {
            console.log(`Sent POC reminders to ${expiringPOCs.length} customers`);
        }

    } catch (error) {
        console.error('Error checking POC reminders:', error);
    }
}

// Modal Management Functions
function openAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
}

function closeAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.add('hidden');
    document.getElementById('addCustomerForm').reset();
}

function openExtendPOCModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    currentPOCAction = customerId;
    document.getElementById('extendCustomerName').textContent = customer.customer_name;
    document.getElementById('extendPOCModal').classList.remove('hidden');
}

function closeExtendPOCModal() {
    document.getElementById('extendPOCModal').classList.add('hidden');
    document.getElementById('extendPOCForm').reset();
    currentPOCAction = null;
}

function openScheduleEmailModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    currentEmailTarget = customer;
    document.getElementById('emailCustomerName').textContent = customer.customer_name;
    document.getElementById('scheduleEmailModal').classList.remove('hidden');
    
    // Set minimum date to now
    const now = new Date();
    const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('scheduledDateTime').min = minDateTime;
}

function closeScheduleEmailModal() {
    document.getElementById('scheduleEmailModal').classList.add('hidden');
    document.getElementById('scheduleEmailForm').reset();
    document.getElementById('customMessageDiv').classList.add('hidden');
    currentEmailTarget = null;
}

function openManualEmailModal() {
    document.getElementById('manualEmailModal').classList.remove('hidden');
    
    // Set minimum date to now
    const now = new Date();
    const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('manualScheduledDateTime').min = minDateTime;
    
    // Load customers dropdown
    loadCustomerDropdown();
}

function closeManualEmailModal() {
    document.getElementById('manualEmailModal').classList.add('hidden');
    document.getElementById('manualEmailForm').reset();
    document.getElementById('manualCustomMessageDiv').classList.add('hidden');
}

async function loadCustomerDropdown() {
    const select = document.getElementById('manualEmailCustomer');
    select.innerHTML = '<option value="">Select Customer</option>';
    
    // Only load approved customers
    approvedCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.customer_name} (${customer.customer_email})`;
        select.appendChild(option);
    });
}

// Finance Management Functions
function showFinance() {
    hideAllContent();
    document.getElementById('financeContent').classList.remove('hidden');
    updateMenuHighlight('finance');
    updateFinanceApprovalsList();
}

function updateFinanceApprovalsList() {
    const financeApprovalsList = document.getElementById('financeApprovalsList');
    
    if (pendingApprovals.length === 0) {
        financeApprovalsList.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 dark:text-dark-base-500">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/>
                </svg>
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Pending Approvals</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">All customer applications have been processed</p>
            </div>
        `;
        return;
    }

    financeApprovalsList.innerHTML = pendingApprovals.map(customer => `
        <div class="approval-card">
            <div class="approval-card-header">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="approval-customer-name">${customer.customer_name}</h3>
                        <p class="approval-customer-email">${customer.customer_email}</p>
                        <div class="approval-customer-meta">
                            <span>${customer.customer_mobile}</span>
                            <span class="meta-separator">•</span>
                            <span>AM: ${customer.account_manager_name}</span>
                        </div>
                    </div>
                    <div class="approval-badges">
                        <span class="badge poc-badge ${customer.poc_type}">${formatPOCType(customer.poc_type)}</span>
                        <span class="badge approval-badge pending">Pending Approval</span>
                    </div>
                </div>
            </div>
            
            <div class="approval-card-body">
                <div class="approval-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">POC Duration:</span>
                        <span class="detail-value">${customer.poc_duration || 30} days</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Start Date:</span>
                        <span class="detail-value">${formatDate(customer.poc_start_date)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">End Date:</span>
                        <span class="detail-value">${formatDate(customer.poc_end_date)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Submitted:</span>
                        <span class="detail-value">${formatDate(customer.created_at)}</span>
                    </div>
                </div>
                
                ${customer.lead_sources && customer.lead_sources.length > 0 ? `
                    <div class="lead-sources">
                        <span class="detail-label">Lead Sources:</span>
                        <div class="lead-sources-list">
                            ${customer.lead_sources.map(source => `<span class="lead-source-tag">${source}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${customer.requirements && customer.requirements.length > 0 ? `
                    <div class="requirements">
                        <span class="detail-label">Requirements:</span>
                        <div class="requirements-list">
                            ${customer.requirements.map(req => `<span class="requirement-tag">${req}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="approval-card-actions">
                <button onclick="approveCustomer(${customer.id})" class="action-btn approve-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Approve
                </button>
                <button onclick="openRejectModal(${customer.id})" class="action-btn reject-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6L6 18"/>
                        <path d="M6 6l12 12"/>
                    </svg>
                    Reject
                </button>
            </div>
        </div>
    `).join('');
}

// Update scheduled emails list
function updateScheduledEmailsList() {
    const scheduledEmailsList = document.getElementById('scheduledEmailsList');
    
    if (scheduledEmails.length === 0) {
        scheduledEmailsList.innerHTML = `
            <div class="text-center py-8">
                <p class="text-body-l-regular dark:text-dark-base-500">No scheduled emails</p>
            </div>
        `;
        return;
    }

    scheduledEmailsList.innerHTML = scheduledEmails.map(email => {
        const customer = customers.find(c => c.id === email.customer_id);
        return `
            <div class="scheduled-email-card">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-body-m-semibold dark:text-dark-base-600">${customer ? customer.customer_name : 'Unknown Customer'}</h4>
                        <p class="text-body-s-regular dark:text-dark-base-500">${email.email_type.replace('_', ' ').toUpperCase()}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Scheduled: ${formatDateTime(email.scheduled_datetime)}</p>
                        ${email.custom_message ? `<p class="text-body-s-regular dark:text-dark-base-400 mt-1">Message: ${email.custom_message}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="badge ${email.status === 'sent' ? 'sent' : email.status === 'failed' ? 'failed' : 'pending'}">${email.status}</span>
                        ${email.status === 'pending' ? `
                            <button onclick="cancelScheduledEmail(${email.id})" class="text-xs px-2 py-1 rounded dark:bg-dark-semantic-danger-300 dark:text-utility-white">
                                Cancel
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Customer and Lead Management
async function addCustomer(customerData) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .insert([{
                ...customerData,
                approval_status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        // Show success message and load data
        closeAddCustomerForm();
        loadData();
        
        showEmailToast(`Customer "${customerData.customer_name}" submitted for approval`);
        
    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Error adding customer: ' + error.message);
    }
}

async function deleteCustomer(customerId) {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', customerId);

        if (error) throw error;

        loadData();
        showEmailToast('Customer deleted successfully');
    } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Error deleting customer');
    }
}

async function convertLeadToCustomer(leadId) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Pre-fill the add customer form with lead data
    document.getElementById('customerName').value = lead.customer_name;
    document.getElementById('customerMobile').value = lead.contact;
    document.getElementById('customerEmail').value = lead.contact; // Assuming contact is email
    
    // Open add customer modal
    openAddCustomerForm();
    
    // Optional: Delete the lead after conversion
    // await deleteLead(leadId);
}

async function deleteLead(leadId) {
    if (!confirm('Are you sure you want to delete this lead?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', leadId);

        if (error) throw error;

        loadData();
        showEmailToast('Lead deleted successfully');
    } catch (error) {
        console.error('Error deleting lead:', error);
        alert('Error deleting lead');
    }
}

// Approval functions
async function approveCustomer(customerId) {
    try {
        const customer = customers.find(c => c.id === customerId);
        
        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: userSession?.email || 'admin'
            })
            .eq('id', customerId);

        if (error) throw error;

        // Send welcome email
        await sendEmail('welcome', customer);
        
        loadData();
        showEmailToast(`Customer approved: ${customer.customer_name}`);
    } catch (error) {
        console.error('Error approving customer:', error);
        alert('Error approving customer');
    }
}

function openRejectModal(customerId) {
    currentPOCAction = customerId;
    document.getElementById('rejectModal').classList.remove('hidden');
}

function closeRejectModal() {
    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('rejectionReason').value = '';
    currentPOCAction = null;
}

async function rejectCustomer(customerId, rejectionReason) {
    try {
        const customer = customers.find(c => c.id === customerId);
        
        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: userSession?.email || 'admin',
                rejection_reason: rejectionReason
            })
            .eq('id', customerId);

        if (error) throw error;

        closeRejectModal();
        console.log(`Customer "${customer.customer_name}" rejected.`);
        loadData();
        showEmailToast(`Customer rejected: ${customer.customer_name}`);
    } catch (error) {
        console.error('Error rejecting customer:', error);
        alert('Error rejecting customer');
    }
}

// Check expired POCs
async function checkExpiredPOCs() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data: expiredPOCs, error } = await supabase
            .from('customers')
            .select('*')
            .lt('poc_end_date', today)
            .neq('status', 'closed')
            .in('poc_type', ['free_poc', 'paid_poc'])
            .eq('approval_status', 'approved');

        if (error) {
            console.error('Error checking expired POCs:', error);
            return;
        }

        // Update expired POCs to closed status
        for (const customer of expiredPOCs) {
            await supabase
                .from('customers')
                .update({ status: 'closed' })
                .eq('id', customer.id);
                
            // Send expired POC email
            await sendEmail('poc_ended', customer, 'POC expired automatically');
        }

        if (expiredPOCs.length > 0) {
            console.log(`Moved ${expiredPOCs.length} expired POCs to closed`);
            loadData();
        }
    } catch (error) {
        console.error('Error processing expired POCs:', error);
    }
}

// Login functionality
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoadingOverlay();
    
    try {
        // Check credentials in database
        const { data: users, error } = await supabase
            .from('user_credentials')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .eq('is_active', true);

        setTimeout(() => {
            hideLoadingOverlay();
            
            if (error) {
                console.error('Error checking credentials:', error);
                alert('Error checking credentials. Please try again.');
                return;
            }

            if (users && users.length > 0) {
                const user = users[0];
                
                // Update last login
                supabase
                    .from('user_credentials')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', user.id);

                // Set session
                userSession = user;
                saveUserSession();

                // Navigate to dashboard
                navigateToDashboard();
                
                showEmailToast(`Welcome back, ${user.full_name || user.email}!`);
            } else {
                alert('Invalid credentials. Please check your email and password.');
            }
        }, 2000);
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error during login:', error);
        alert('Error during login. Please try again.');
    }
}

function navigateToDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    document.getElementById('floatingAddBtn').classList.remove('hidden');
    
    showCustomersOverview();
    loadData();
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordField = document.getElementById('loginPassword');
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
}

// Sidebar toggle functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebarExpanded) {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        mainContent.classList.remove('sidebar-expanded');
        mainContent.classList.add('sidebar-collapsed');
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-expanded');
    }
    
    sidebarExpanded = !sidebarExpanded;
}

// Sidebar hover functionality
function handleSidebarMouseEnter() {
    if (!sidebarExpanded) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-expanded');
    }
}

function handleSidebarMouseLeave() {
    if (!sidebarExpanded) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        mainContent.classList.remove('sidebar-expanded');
        mainContent.classList.add('sidebar-collapsed');
    }
}

// Search functionality
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    currentFilter = searchTerm;
    
    if (!searchTerm) {
        // If search is empty, show all approved data
        filteredCustomers = selectedCustomerId ?
            approvedCustomers.filter(c => c.id === selectedCustomerId) :
            [...approvedCustomers];
        filteredLeads = [...leads];
        updateTabsContent();
        return;
    }

    // Filter customers
    filteredCustomers = approvedCustomers.filter(customer => 
        customer.customer_name.toLowerCase().includes(searchTerm) ||
        customer.customer_email.toLowerCase().includes(searchTerm) ||
        customer.customer_mobile.toLowerCase().includes(searchTerm) ||
        customer.account_manager_name.toLowerCase().includes(searchTerm) ||
        customer.poc_type.toLowerCase().includes(searchTerm)
    );

    // Apply customer dropdown filter if active
    if (selectedCustomerId) {
        filteredCustomers = filteredCustomers.filter(c => c.id === selectedCustomerId);
    }

    // Filter leads
    filteredLeads = leads.filter(lead => 
        lead.customer_name.toLowerCase().includes(searchTerm) ||
        lead.contact.toLowerCase().includes(searchTerm) ||
        lead.type.toLowerCase().includes(searchTerm) ||
        lead.status.toLowerCase().includes(searchTerm)
    );

    updateTabsContent();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentFilter = '';
    selectedCustomerId = null;
    
    // Reset to show all approved customers
    filteredCustomers = selectedCustomerId ?
        approvedCustomers.filter(c => c.id === selectedCustomerId) :
        [...approvedCustomers];
    filteredLeads = [...leads];
    updateTabsContent();
    showEmailToast('Search cleared');
}

// Apply current search filter
function applyCurrentFilter() {
    if (currentFilter) {
        // Reapply current search filter
        const searchEvent = { target: { value: currentFilter } };
        handleSearch(searchEvent);
    }
}

// Menu navigation functions
function showCustomersOverview() {
    hideAllContent();
    document.getElementById('customersOverviewContent').classList.remove('hidden');
    document.getElementById('floatingAddBtn').classList.remove('hidden');
    updateMenuHighlight('customers');
}

function showGroundOperations() {
    hideAllContent();
    document.getElementById('groundOperationsContent').classList.remove('hidden');
    updateMenuHighlight('ground');
}

function showStock() {
    // Use the full stock page instead of placeholder content
    showStockPage();
}

function showInventoryManagement() {
    // Use the full inventory page instead of placeholder content
    showInventoryPage();
}

function hideAllContent() {
    document.getElementById('customersOverviewContent').classList.add('hidden');
    document.getElementById('financeContent').classList.add('hidden');
    document.getElementById('groundOperationsContent').classList.add('hidden');
    document.getElementById('inventoryManagementContent').classList.add('hidden');
    document.getElementById('stockContent').classList.add('hidden');
    document.getElementById('addCredentialsContent').classList.add('hidden');
    document.getElementById('floatingAddBtn').classList.add('hidden');
}

function updateMenuHighlight(activeMenu) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('dark:bg-brand-blue-600', 'dark:text-utility-white');
        item.classList.add('hover:dark:bg-dark-fill-base-600');
    });
    
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const onclick = item.getAttribute('onclick');
        if ((activeMenu === 'customers' && onclick && onclick.includes('showCustomersOverview')) ||
            (activeMenu === 'finance' && onclick && onclick.includes('showFinance')) ||
            (activeMenu === 'stock' && onclick && onclick.includes('showStock')) ||
            (activeMenu === 'ground' && onclick && onclick.includes('showGroundOperations')) ||
            (activeMenu === 'inventory' && onclick && onclick.includes('showInventoryManagement')) ||
            (activeMenu === 'credentials' && onclick && onclick.includes('showAddCredentials'))) {
            item.classList.add('dark:bg-brand-blue-600', 'dark:text-utility-white');
            item.classList.remove('hover:dark:bg-dark-fill-base-600');
        }
    });
}

// Dashboard tab functions
function showAllTab() {
    hideAllTabContent();
    document.getElementById('allTabContent').classList.remove('hidden');
    updateTabHighlight('allTab');
    updateAllTab();
}

function showPOCTab() {
    hideAllTabContent();
    document.getElementById('pocTabContent').classList.remove('hidden');
    updateTabHighlight('pocTab');
    updatePOCTab();
}

function showOnboardedTab() {
    hideAllTabContent();
    document.getElementById('onboardedTabContent').classList.remove('hidden');
    updateTabHighlight('onboardedTab');
    updateOnboardedTab();
}

function showClosedTab() {
    hideAllTabContent();
    document.getElementById('closedTabContent').classList.remove('hidden');
    updateTabHighlight('closedTab');
    updateClosedTab();
}

function showOngoingLeadsTab() {
    hideAllTabContent();
    document.getElementById('ongoingLeadsTabContent').classList.remove('hidden');
    updateTabHighlight('ongoingLeadsTab');
    updateOngoingLeadsTab();
}

function hideAllTabContent() {
    document.getElementById('allTabContent').classList.add('hidden');
    document.getElementById('pocTabContent').classList.add('hidden');
    document.getElementById('onboardedTabContent').classList.add('hidden');
    document.getElementById('closedTabContent').classList.add('hidden');
    document.getElementById('ongoingLeadsTabContent').classList.add('hidden');
}

function updateTabHighlight(activeTabId) {
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (activeTabId) {
        const activeTab = document.getElementById(activeTabId);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}

// Multi-step form functions
function goToStep2() {
    console.log('goToStep2 called - starting validation');
    
    // Simple validation - just check if key fields have something
    const form = document.getElementById('addCustomerForm');
    
    // Get field values using a safer method
    const managerNameField = form.querySelector('input[name="accountManagerName"]');
    const managerIdField = form.querySelector('input[name="accountManagerId"]');
    const custNameField = form.querySelector('input[name="customerName"]');
    const custMobileField = form.querySelector('input[name="customerMobile"]');
    const custEmailField = form.querySelector('input[name="customerEmail"]');
    
    // Get values safely
    const managerName = managerNameField ? managerNameField.value.trim() : '';
    const managerId = managerIdField ? managerIdField.value.trim() : '';
    const custName = custNameField ? custNameField.value.trim() : '';
    const custMobile = custMobileField ? custMobileField.value.trim() : '';
    const custEmail = custEmailField ? custEmailField.value.trim() : '';
    
    // Very basic validation
    if (managerName.length < 2) {
        alert('Please enter Account Manager Name');
        if (managerNameField) managerNameField.focus();
        return;
    }
    
    if (custName.length < 2) {
        alert('Please enter Customer Name');
        if (custNameField) custNameField.focus();
        return;
    }
    
    if (custEmail.length < 5) {
        alert('Please enter Customer Email');
        if (custEmailField) custEmailField.focus();
        return;
    }
    
    // Check lead source - but more forgiving
    const leadSources = form.querySelectorAll('input[name="leadSource"]:checked');
    
    if (leadSources.length === 0) {
        // Don't block, just warn
        if (!confirm('No lead source selected. Continue anyway?')) {
            return;
        }
    }
    
    console.log('Validation passed, moving to step 2');
    
    // Hide step 1, show step 2
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    
    // Update step indicators
    document.querySelector('.step-indicator[data-step="1"]').classList.remove('active');
    document.querySelector('.step-indicator[data-step="1"]').classList.add('completed');
    document.querySelector('.step-indicator[data-step="2"]').classList.add('active');
}

function goToStep3() {
    console.log('goToStep3 called');
    
    // Hide step 2, show step 3
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    
    // Update step indicators
    document.querySelector('.step-indicator[data-step="2"]').classList.remove('active');
    document.querySelector('.step-indicator[data-step="2"]').classList.add('completed');
    document.querySelector('.step-indicator[data-step="3"]').classList.add('active');
}

function goBackToStep1() {
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step1').classList.remove('hidden');
    
    // Update step indicators
    document.querySelector('.step-indicator[data-step="2"]').classList.remove('active');
    document.querySelector('.step-indicator[data-step="1"]').classList.remove('completed');
    document.querySelector('.step-indicator[data-step="1"]').classList.add('active');
}

function goBackToStep2() {
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    
    // Update step indicators
    document.querySelector('.step-indicator[data-step="3"]').classList.remove('active');
    document.querySelector('.step-indicator[data-step="2"]').classList.remove('completed');
    document.querySelector('.step-indicator[data-step="2"]').classList.add('active');
}

// Toast and email functions
function showEmailToast(message, type = 'success') {
    const toast = document.getElementById('emailToast');
    const toastMessage = document.getElementById('emailToastMessage');
    
    toastMessage.textContent = message;
    
    // Change color based on type
    if (type === 'error') {
        toast.classList.remove('bg-green-600');
        toast.classList.add('bg-red-600');
    } else {
        toast.classList.remove('bg-red-600');
        toast.classList.add('bg-green-600');
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Form submission handlers
async function handleAddCustomerForm(e) {
    e.preventDefault();
    console.log('Form submitted!');
    
    const formData = new FormData(e.target);
    
    // Get lead sources
    const leadSources = [];
    document.querySelectorAll('input[name="leadSource"]:checked').forEach(checkbox => {
        leadSources.push(checkbox.value);
    });
    
    // Get requirements
    const requirements = [];
    document.querySelectorAll('input[name="requirements"]:checked').forEach(checkbox => {
        requirements.push(checkbox.value);
    });
    
    const customerData = {
        account_manager_name: formData.get('accountManagerName'),
        account_manager_id: formData.get('accountManagerId'),
        customer_name: formData.get('customerName'),
        customer_mobile: formData.get('customerMobile'),
        customer_email: formData.get('customerEmail'),
        template: formData.get('template'),
        lead_sources: leadSources,
        requirements: requirements,
        poc_type: formData.get('pocType'),
        poc_duration: parseInt(formData.get('pocDuration')) || 30,
        poc_start_date: formData.get('pocStartDate'),
        poc_end_date: formData.get('pocEndDate'),
        status: 'active'
    };

    try {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData]);

        if (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer: ' + error.message);
            return;
        }

        if (customerData.poc_type === 'direct_onboarding') {
            // Direct onboarding - approve immediately
            showEmailToast(`Customer "${customerData.customer_name}" added and approved`);
            closeAddCustomerForm();
            loadData();
        } else {
            // POC - needs approval
            alert('Customer details submitted successfully. Awaiting finance approval.');
            closeAddCustomerForm();
            loadData();
            
            // Navigate to Finance tab
            showFinance();
            
            showEmailToast(`Customer "${customerData.customer_name}" submitted for approval`);
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error saving customer');
    }
}

async function handleExtendPOCForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const extendDays = formData.get('extendDays');
    const customDays = parseInt(formData.get('customDays')) || 0;
    const reason = formData.get('reason');
    
    if (!currentPOCAction) return;
    
    await extendPOC(currentPOCAction, null, extendDays, customDays, reason);
}

async function handleScheduleEmailForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const emailType = formData.get('emailType');
    const scheduledDateTime = new Date(formData.get('scheduledDateTime'));
    const customMessage = formData.get('customMessage');
    
    if (!currentEmailTarget) return;
    
    const success = await scheduleEmail(
        currentEmailTarget.id,
        emailType,
        scheduledDateTime,
        customMessage
    );
    
    if (success) {
        closeScheduleEmailModal();
        await loadScheduledEmails();
        showEmailToast(`Email scheduled for ${scheduledDateTime.toLocaleString()}`);
    } else {
        alert('Error scheduling email');
    }
}

async function handleRejectForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const rejectionReason = formData.get('rejectionReason');
    
    if (!currentPOCAction || !rejectionReason.trim()) {
        alert('Please provide a rejection reason');
        return;
    }
    
    await rejectCustomer(currentPOCAction, rejectionReason);
}

async function cancelScheduledEmail(emailId) {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('scheduled_emails')
            .delete()
            .eq('id', emailId);

        if (error) throw error;

        await loadScheduledEmails();
        showEmailToast('Scheduled email cancelled');
    } catch (error) {
        console.error('Error cancelling scheduled email:', error);
        alert('Error cancelling scheduled email');
    }
}

async function handleManualEmailScheduling(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const customerId = parseInt(formData.get('customerId'));
    const emailType = formData.get('emailType');
    const scheduledDateTime = new Date(formData.get('scheduledDateTime'));
    const customMessage = formData.get('customMessage');
    
    if (!customerId) {
        alert('Please select a customer');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('scheduled_emails')
            .insert([{
                customer_id: customerId,
                email_type: emailType,
                scheduled_datetime: scheduledDateTime.toISOString(),
                custom_message: customMessage ? customMessage : null,
                status: 'pending',
                created_by: userSession?.email || 'admin',
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error scheduling email:', error);
            alert('Error scheduling email: ' + error.message);
            return;
        }

        alert(`Email scheduled for ${currentEmailTarget.customer_name} on ${scheduledDateTime.toLocaleString()}`);
        closeManualEmailModal();
        
        // Reload scheduled emails
        await loadScheduledEmails();
        
        showEmailToast(`Email scheduled for ${scheduledDateTime.toLocaleString()}`);
    } catch (error) {
        console.error('Error scheduling email:', error);
        alert('Error scheduling email');
    }
}

// Customer dropdown functionality removed as per requirements

// Page Navigation Functions
function showDashboardPage() {
    // Hide all pages
    hideAllPages();
    
    // Show dashboard page
    document.getElementById('dashboardPage').classList.remove('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
}

function showInventoryPage() {
    // Show inventory content within dashboard
    hideAllContent();
    document.getElementById('inventoryManagementContent').classList.remove('hidden');
    updateMenuHighlight('inventory');
    
    // Load inventory content and update summary
    if (typeof loadInventoryData === 'function') {
        loadInventoryData().then(() => {
            // Ensure stock summary is updated after data loads
            if (typeof updateStockSummary === 'function') {
                updateStockSummary();
            }
        });
    } else if (typeof updateStockSummary === 'function') {
        // If data already loaded, just update the summary
        updateStockSummary();
    }
}

function showStockPage() {
    // Show stock content within dashboard
    hideAllContent();
    document.getElementById('stockContent').classList.remove('hidden');
    updateMenuHighlight('stock');
    
    // Load stock content if not already loaded
    if (typeof loadStockData === 'function') {
        loadStockData();
    }
}

function hideAllPages() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('inventoryPage').classList.add('hidden');
    document.getElementById('stockPage').classList.add('hidden');
}

function showInventoryManagement() {
    hideAllContent();
    document.getElementById('inventoryManagementContent').classList.remove('hidden');
    updateMenuHighlight('inventory');
    
    // Load inventory content and update summary
    if (typeof loadInventoryData === 'function') {
        loadInventoryData().then(() => {
            // Ensure stock summary is updated after data loads
            if (typeof updateStockSummary === 'function') {
                updateStockSummary();
            }
        });
    } else if (typeof updateStockSummary === 'function') {
        // If data already loaded, just update the summary
        updateStockSummary();
    }
}

function showStock() {
    hideAllContent();
    document.getElementById('stockContent').classList.remove('hidden');
    updateMenuHighlight('stock');
    
    // Load stock content if not already loaded
    if (typeof loadStockData === 'function') {
        loadStockData();
    }
}

// Floating Add Button Functions
function toggleAddMenu() {
    const menu = document.getElementById('addMenu');
    menu.classList.toggle('hidden');
}

// Click outside to close add menu
document.addEventListener('click', function(event) {
    const menu = document.getElementById('addMenu');
    const button = event.target.closest('[onclick="toggleAddMenu()"]');
    
    if (!button && menu && !menu.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

// Forgot Password Handler
async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value;
    
    showLoadingOverlay();
    
    try {
        // Check if email exists
        const { data: users, error: userError } = await supabase
            .from('user_credentials')
            .select('email')
            .eq('email', email);
            
        if (userError) throw userError;
        
        if (!users || users.length === 0) {
            hideLoadingOverlay();
            alert('Email not found in our records.');
            return;
        }
        
        // Generate reset token
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
        
        // Save reset request
        const { error: resetError } = await supabase
            .from('password_reset_requests')
            .insert([{
                email: email,
                reset_token: resetToken,
                expires_at: expiresAt,
                used: false
            }]);
            
        if (resetError) throw resetError;
        
        // Log email
        const { error: emailError } = await supabase
            .from('email_logs')
            .insert([{
                recipient_email: email,
                email_type: 'password_reset',
                subject: 'Password Reset Request',
                message: `Password reset requested for ${email}. 
The link will expire in 1 hour. Reset token: ${resetToken}`,
                status: 'sent'
            }]);

        if (emailError) {
            console.error('Error logging email:', emailError);
        }
        
        hideLoadingOverlay();
        alert(`Password reset link has been sent to ${email}. Please check your email and follow the instructions.`);
        
        // Show email toast
        showEmailToast(`Password reset link sent to ${email}`);
        
        // Auto redirect back to login after 3 seconds
        setTimeout(() => {
            backToLogin();
        }, 3000);
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error sending password reset:', error);
        alert('Error sending password reset email. Please try again.');
    }
}

function generateResetToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Add Credentials Functions
function showAddCredentials() {
    hideAllContent();
    document.getElementById('addCredentialsContent').classList.remove('hidden');
    updateMenuHighlight('credentials');
    loadCredentials();
}

async function loadCredentials() {
    try {
        const { data, error } = await supabase
            .from('user_credentials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading credentials:', error);
            return;
        }

        credentials = data || [];
        updateCredentialsList();
    } catch (error) {
        console.error('Error loading credentials:', error);
    }
}

function updateCredentialsList() {
    const credentialsList = document.getElementById('credentialsList');
    
    if (credentials.length === 0) {
        credentialsList.innerHTML = `
            <div class="text-center py-8">
                <p class="text-body-l-regular dark:text-dark-base-500">No users found</p>
            </div>
        `;
        return;
    }

    credentialsList.innerHTML = credentials.map(credential => `
        <div class="p-4 rounded-lg dark:bg-dark-fill-base-400 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${credential.full_name || 'N/A'}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${credential.email}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs rounded-full ${getRoleBadgeClass(credential.role)} dark:text-utility-white">
                        ${credential.role.toUpperCase()}
                    </span>
                    <span class="px-2 py-1 text-xs rounded-full ${credential.is_active ?
                        'dark:bg-dark-success-600' : 'dark:bg-dark-semantic-danger-300'} dark:text-utility-white">
                        ${credential.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">Department:</span> ${credential.department || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">Created:</span> ${new Date(credential.created_at).toLocaleDateString()}
                </div>
                <div>
                    <span class="font-semibold">Last Login:</span> ${credential.last_login ? new Date(credential.last_login).toLocaleDateString() : 'Never'}
                </div>
                <div>
                    <span class="font-semibold">Created By:</span> ${credential.created_by || 'N/A'}
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="toggleCredentialStatus(${credential.id}, ${!credential.is_active})" class="px-3 py-1 text-xs rounded-lg ${credential.is_active ? 'dark:bg-dark-semantic-danger-300' : 'dark:bg-dark-success-600'} dark:text-utility-white hover:opacity-90">
                    ${credential.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deleteCredential(${credential.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:opacity-90">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin': return 'dark:bg-dark-semantic-danger-300';
        case 'manager': return 'dark:bg-dark-warning-600';
        case 'user': return 'dark:bg-dark-info-600';
        default: return 'dark:bg-dark-stroke-base-400';
    }
}

async function handleAddCredential(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentialData = {
        full_name: formData.get('fullName'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        department: formData.get('department'),
        is_active: true,
        created_by: userSession?.email || 'admin',
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('user_credentials')
            .insert([credentialData]);

        if (error) {
            console.error('Error saving credential:', error);
            if (error.code === '23505') { // Unique constraint violation
                alert('Error: Email already exists!');
            } else {
                alert('Error saving credential: ' + error.message);
            }
            return;
        }

        alert('User credential added successfully!');
        document.getElementById('addCredentialForm').reset();
        loadCredentials();
        
        // Show email notification
        showEmailToast(`User account created for ${credentialData.email}`);

    } catch (error) {
        console.error('Error saving credential:', error);
        alert('Error saving credential');
    }
}

async function toggleCredentialStatus(id, newStatus) {
    try {
        const { error } = await supabase
            .from('user_credentials')
            .update({ is_active: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error updating credential status:', error);
            alert('Error updating status: ' + error.message);
            return;
        }

        loadCredentials();
        showEmailToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        console.error('Error updating credential status:', error);
        alert('Error updating status');
    }
}

async function deleteCredential(id) {
    if (!confirm('Are you sure you want to delete this user credential?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('user_credentials')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting credential:', error);
            alert('Error deleting credential: ' + error.message);
            return;
        }

        loadCredentials();
        showEmailToast('User credential deleted successfully');
    } catch (error) {
        console.error('Error deleting credential:', error);
        alert('Error deleting credential');
    }
}

function toggleNewUserPasswordVisibility() {
    const passwordField = document.getElementById('newUserPassword');
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
}

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Forgot password form
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    
    // Add credential form
    document.getElementById('addCredentialForm').addEventListener('submit', handleAddCredential);
    
    // Manual email form
    document.getElementById('manualEmailForm').addEventListener('submit', handleManualEmailScheduling);
    
    // Email type change listener
    document.querySelector('select[name="emailType"]').addEventListener('change', function(e) {
        const customDiv = document.getElementById('customMessageDiv');
        if (e.target.value === 'custom') {
            customDiv.classList.remove('hidden');
        } else {
            customDiv.classList.add('hidden');
        }
    });

    // POC Duration change listener
    document.getElementById('pocDurationSelect').addEventListener('change', function(e) {
        const customDiv = document.getElementById('customDurationDiv');
        if (e.target.value === 'custom') {
            customDiv.classList.remove('hidden');
            customDiv.classList.add('show');
        } else {
            customDiv.classList.add('hidden');
            customDiv.classList.remove('show');
        }
    });

    // Add Customer Form
    document.getElementById('addCustomerForm').addEventListener('submit', handleAddCustomerForm);
    
    // Extend POC Form
    document.getElementById('extendPOCForm').addEventListener('submit', handleExtendPOCForm);
    
    // Schedule Email Form
    document.getElementById('scheduleEmailForm').addEventListener('submit', handleScheduleEmailForm);
    
    // Reject Form
    document.getElementById('rejectForm').addEventListener('submit', handleRejectForm);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
}

// Supabase Real-time listeners
function setupRealtimeListeners() {
    // Listen for customer changes
    supabase
        .channel('customers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, 
            (payload) => {
                console.log('Customer change received!', payload);
                loadData();
            }
        )
        .subscribe();

    // Listen for lead changes
    supabase
        .channel('leads')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, 
            (payload) => {
                console.log('Lead change received!', payload);
                loadData();
            }
        )
        .subscribe();
        
    // Listen for scheduled email changes
    supabase
        .channel('scheduled_emails')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_emails' }, 
            (payload) => {
                console.log('Scheduled email change received!', payload);
                loadScheduledEmails();
            }
        )
        .subscribe();
}

// Logout function
function logout() {
    // Clear session
    clearUserSession();
    
    // Reset UI
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('floatingAddBtn').classList.add('hidden');
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    
    // Reset global variables
    customers = [];
    leads = [];
    credentials = [];
    scheduledEmails = [];
    pendingApprovals = [];
    approvedCustomers = [];
    filteredCustomers = [];
    filteredLeads = [];
    currentFilter = '';
    currentPOCAction = null;
    currentEmailTarget = null;
    selectedCustomerId = null;
    
    showEmailToast('Logged out successfully');
}

// Run checks periodically
setInterval(checkExpiredPOCs, 60 * 60 * 1000); // Every hour
setInterval(checkPOCReminders, 60 * 60 * 1000 * 24); // Every 24 hours
setInterval(checkScheduledEmails, 60 * 1000); // Every minute

// Handle form submissions and related functions - Complete existing functionality
async function handleAddCustomer(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const customerData = {
        account_manager_name: formData.get('accountManagerName') || document.getElementById('accountManagerName').value,
        account_manager_id: formData.get('accountManagerId') || document.getElementById('accountManagerId').value,
        customer_name: formData.get('customerName') || document.getElementById('customerName').value,
        customer_mobile: formData.get('customerMobile') || document.getElementById('customerMobile').value,
        customer_email: formData.get('customerEmail') || document.getElementById('customerEmail').value,
        poc_type: formData.get('pocType') || document.getElementById('pocType').value,
        poc_duration: parseInt(formData.get('pocDuration') || document.getElementById('pocDuration').value) || 30,
        poc_start_date: formData.get('pocStartDate') || document.getElementById('pocStartDate').value,
        poc_end_date: formData.get('pocEndDate') || document.getElementById('pocEndDate').value,
        template: formData.get('template') || document.getElementById('template').value,
        status: 'active',
        approval_status: 'pending',
        created_at: new Date().toISOString()
    };
    
    try {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData]);
            
        if (error) throw error;
        
        closeAddCustomerModal();
        showToast('Customer added successfully!');
        loadData();
        
    } catch (error) {
        console.error('Error adding customer:', error);
        showToast('Error adding customer: ' + error.message, 'error');
    }
}

// Single stock entry functionality
async function handleSingleStockEntry(e) {
    e.preventDefault();
    
    const stockData = {
        sl_no: parseInt(document.getElementById('stockSlNo').value),
        po_no: document.getElementById('stockPoNo').value,
        batch_no: document.getElementById('stockBatchNo').value,
        inward_date: document.getElementById('stockInwardDate').value,
        device_model_no: document.getElementById('stockDeviceModel').value,
        device_registration_number: document.getElementById('stockDeviceRegNo').value,
        device_imei: document.getElementById('stockDeviceImei').value,
        device_condition: document.getElementById('stockDeviceCondition').value,
        location: document.getElementById('stockLocation').value,
        sim_no: document.getElementById('stockSimNo').value,
        current_status: 'available',
        inventory_status: 'in_stock',
        imported_by: userSession?.email || 'system',
        created_at: new Date().toISOString()
    };
    
    try {
        const { data, error } = await supabase
            .from('stock')
            .insert([stockData]);
            
        if (error) throw error;
        
        closeAddStockModal();
        showToast('Stock entry added successfully!');
        
        // Reload stock data if on stock page
        if (typeof loadStockData === 'function') {
            loadStockData();
        }
        
    } catch (error) {
        console.error('Error adding stock entry:', error);
        showToast('Error adding stock entry: ' + error.message, 'error');
    }
}

// Inward device functionality
async function handleInwardDevice(e) {
    e.preventDefault();
    
    const inwardData = {
        device_registration_number: document.getElementById('inwardDeviceRegNo').value,
        device_imei: document.getElementById('inwardDeviceImei').value,
        device_condition: document.getElementById('inwardDeviceCondition').value,
        inward_date: document.getElementById('inwardDate').value || new Date().toISOString().split('T')[0],
        notes: document.getElementById('inwardNotes').value,
        processed_by: userSession?.email || 'system',
        created_at: new Date().toISOString()
    };
    
    try {
        const { data, error } = await supabase
            .from('inward_devices')
            .insert([inwardData]);
            
        if (error) throw error;
        
        closeAddDeviceModal();
        showToast('Inward device added successfully!');
        
        // Reload inventory data if on inventory page
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }
        
    } catch (error) {
        console.error('Error adding inward device:', error);
        showToast('Error adding inward device: ' + error.message, 'error');
    }
}

// Outward device functionality
async function handleOutwardDevice(e) {
    e.preventDefault();
    
    const customerId = document.getElementById('outwardCustomer').value;
    
    // Get customer name
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('customer_name')
        .eq('id', customerId)
        .single();
        
    if (customerError) {
        showToast('Error finding customer', 'error');
        return;
    }
    
    const outwardData = {
        device_registration_number: document.getElementById('outwardDeviceRegNo').value,
        device_imei: document.getElementById('outwardDeviceImei').value,
        customer_id: parseInt(customerId),
        customer_name: customer.customer_name,
        location: document.getElementById('outwardLocation').value,
        outward_date: document.getElementById('outwardDate').value || new Date().toISOString().split('T')[0],
        sim_no: document.getElementById('outwardSimNo').value,
        notes: document.getElementById('outwardNotes').value,
        processed_by: userSession?.email || 'system',
        created_at: new Date().toISOString()
    };
    
    try {
        const { data, error } = await supabase
            .from('outward_devices')
            .insert([outwardData]);
            
        if (error) throw error;
        
        closeAddDeviceModal();
        showToast('Outward device added successfully!');
        
        // Reload inventory data if on inventory page
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }
        
    } catch (error) {
        console.error('Error adding outward device:', error);
        showToast('Error adding outward device: ' + error.message, 'error');
    }
}

// SIM replacement functionality
async function handleSIMReplacement(e) {
    e.preventDefault();
    
    const deviceRegNo = document.getElementById('simDeviceRegNo').value;
    const deviceImei = document.getElementById('simDeviceImei').value;
    const oldSimNo = document.getElementById('oldSimNo').value;
    const newSimNo = document.getElementById('newSimNo').value;
    const replacementReason = document.getElementById('replacementReason').value;
    
    try {
        // Validate device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('device_registration_number, device_imei, sim_no')
            .eq('device_registration_number', deviceRegNo)
            .single();
            
        if (stockError || !stockDevice) {
            showToast('Device not found in stock', 'error');
            return;
        }
        
        // Validate IMEI matches
        if (stockDevice.device_imei !== deviceImei) {
            showToast('Device IMEI does not match', 'error');
            return;
        }
        
        // Validate current SIM
        if (stockDevice.sim_no !== oldSimNo) {
            showToast('Current SIM number does not match', 'error');
            return;
        }
        
        // Insert SIM replacement record
        const replacementData = {
            device_registration_number: deviceRegNo,
            device_imei: deviceImei,
            old_sim_no: oldSimNo,
            new_sim_no: newSimNo,
            replacement_reason: replacementReason,
            replaced_by: userSession?.email || 'system',
            replacement_date: new Date().toISOString(),
            validated: true,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('sim_replacement_history')
            .insert([replacementData]);
            
        if (error) throw error;
        
        closeSIMReplacementModal();
        showToast('SIM replaced successfully!');
        
        // Reload SIM management data if on SIM management page
        if (typeof loadSIMManagementData === 'function') {
            loadSIMManagementData();
        }
        
    } catch (error) {
        console.error('Error replacing SIM:', error);
        showToast('Error replacing SIM: ' + error.message, 'error');
    }
}

// CSV upload functionality
function uploadStockCSV() {
    const fileInput = document.getElementById('stockCsvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a CSV file', 'error');
        return;
    }
    
    if (typeof processCSVFile === 'function') {
        processCSVFile(file);
        closeAddStockModal();
    } else {
        showToast('CSV processing not available', 'error');
    }
}

function uploadDeviceCSV() {
    const fileInput = document.getElementById('deviceCsvFile');
    const uploadType = document.getElementById('csvUploadType').value;
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a CSV file', 'error');
        return;
    }
    
    if (!uploadType) {
        showToast('Please select upload type', 'error');
        return;
    }
    
    if (typeof processDeviceCSVFile === 'function') {
        processDeviceCSVFile(file, uploadType);
        closeAddDeviceModal();
    } else {
        showToast('CSV processing not available', 'error');
    }
}

// Load SIM Management Data function
async function loadSIMManagementData() {
    try {
        // Load current SIM assignments
        const { data: simData, error: simError } = await supabase
            .from('device_sim_management')
            .select('*')
            .order('assigned_date', { ascending: false });

        if (simError) throw simError;

        // Load SIM replacement history
        const { data: historyData, error: historyError } = await supabase
            .from('sim_replacement_history')
            .select('*')
            .order('replacement_date', { ascending: false });

        if (historyError) throw historyError;

        // Update global data if available
        if (typeof window.inventoryData !== 'undefined') {
            window.inventoryData.simManagement = simData || [];
            window.inventoryData.simHistory = historyData || [];
        }
        
        console.log('SIM management data loaded successfully');
        
    } catch (error) {
        console.error('Error loading SIM management data:', error);
        showToast('Error loading SIM management data', 'error');
    }
}

// Device History View Functions
async function viewStockDeviceDetails(deviceRegNumber) {
    try {
        // Get device details from stock
        const { data: stockData, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('device_registration_number', deviceRegNumber)
            .single();

        if (stockError) throw stockError;

        // Get inward history
        const { data: inwardHistory, error: inwardError } = await supabase
            .from('inward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegNumber)
            .order('inward_date', { ascending: false });

        if (inwardError) throw inwardError;

        // Get outward history
        const { data: outwardHistory, error: outwardError } = await supabase
            .from('outward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegNumber)
            .order('outward_date', { ascending: false });

        if (outwardError) throw outwardError;

        // Display device history in modal or new page
        showDeviceHistoryModal(deviceRegNumber, stockData, inwardHistory, outwardHistory);

    } catch (error) {
        console.error('Error loading device details:', error);
        showToast('Error loading device details', 'error');
    }
}

function showDeviceHistoryModal(deviceRegNumber, stockData, inwardHistory, outwardHistory) {
    // Create device history content
    const historyContent = `
        <div class="space-y-6">
            <!-- Basic Device Info -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-lg font-semibold mb-3">Device Information</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Registration Number:</strong> ${stockData.device_registration_number}</div>
                    <div><strong>IMEI:</strong> ${stockData.device_imei}</div>
                    <div><strong>Model:</strong> ${stockData.device_model_no || 'N/A'}</div>
                    <div><strong>Current Status:</strong> ${getStatusBadge(stockData.current_status)}</div>
                    <div><strong>Condition:</strong> ${getConditionBadge(stockData.device_condition)}</div>
                    <div><strong>Location:</strong> ${stockData.location || 'N/A'}</div>
                    <div><strong>SIM Number:</strong> ${stockData.sim_no || 'N/A'}</div>
                    <div><strong>Batch Number:</strong> ${stockData.batch_no || 'N/A'}</div>
                </div>
            </div>

            <!-- Movement History Timeline -->
            <div>
                <h3 class="text-lg font-semibold mb-3">Movement History</h3>
                <div class="space-y-4">
                    ${generateDeviceMovementTimeline(inwardHistory, outwardHistory)}
                </div>
            </div>
        </div>
    `;

    // Show in device history modal
    const modal = document.getElementById('deviceHistoryModal');
    if (modal) {
        document.getElementById('deviceHistoryContent').innerHTML = historyContent;
        modal.classList.remove('hidden');
    }
}

function generateDeviceMovementTimeline(inwardHistory, outwardHistory) {
    // Combine and sort all movements by date
    const allMovements = [];
    
    // Add inward movements
    inwardHistory.forEach(entry => {
        allMovements.push({
            type: 'inward',
            date: entry.inward_date,
            data: entry
        });
    });
    
    // Add outward movements
    outwardHistory.forEach(entry => {
        allMovements.push({
            type: 'outward',
            date: entry.outward_date,
            data: entry
        });
    });
    
    // Sort by date (newest first)
    allMovements.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allMovements.length === 0) {
        return '<p class="text-gray-500">No movement history found</p>';
    }
    
    return allMovements.map(movement => {
        if (movement.type === 'inward') {
            return `
                <div class="border-l-4 border-blue-500 pl-4 py-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-medium text-blue-600">Device Received (Inward)</p>
                            <p class="text-sm text-gray-600">Date: ${formatDate(movement.data.inward_date)}</p>
                            <p class="text-sm text-gray-600">Condition: ${movement.data.device_condition.replace('_', ' ').toUpperCase()}</p>
                            <p class="text-sm text-gray-600">Processed by: ${movement.data.processed_by}</p>
                            ${movement.data.notes ? `<p class="text-sm text-gray-600">Notes: ${movement.data.notes}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="border-l-4 border-orange-500 pl-4 py-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-medium text-orange-600">Device Allocated (Outward)</p>
                            <p class="text-sm text-gray-600">Customer: ${movement.data.customer_name}</p>
                            <p class="text-sm text-gray-600">Date: ${formatDate(movement.data.outward_date)}</p>
                            <p class="text-sm text-gray-600">Location: ${movement.data.location}</p>
                            <p class="text-sm text-gray-600">SIM: ${movement.data.sim_no || 'N/A'}</p>
                            <p class="text-sm text-gray-600">Processed by: ${movement.data.processed_by}</p>
                            ${movement.data.notes ? `<p class="text-sm text-gray-600">Notes: ${movement.data.notes}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Export functions for global access
window.showDashboard = showDashboard;
window.showCustomerOverview = showCustomerOverview;
window.showLeads = showLeads;
window.showStock = showStock;
window.showDeviceManagement = showDeviceManagement;
window.showSIMManagement = showSIMManagement;
window.showVehicleGroup = showVehicleGroup;
window.showUserAccess = showUserAccess;
window.showLive = showLive;
window.toggleFleetMenu = toggleFleetMenu;
window.toggleInventoryMenu = toggleInventoryMenu;
window.openAddCustomerModal = openAddCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.openAddStockModal = openAddStockModal;
window.closeAddStockModal = closeAddStockModal;
window.openAddDeviceModal = openAddDeviceModal;
window.closeAddDeviceModal = closeAddDeviceModal;
window.openSIMReplacementModal = openSIMReplacementModal;
window.closeSIMReplacementModal = closeSIMReplacementModal;
window.openDeviceHistoryModal = openDeviceHistoryModal;
window.closeDeviceHistoryModal = closeDeviceHistoryModal;
window.openSIMHistoryModal = openSIMHistoryModal;
window.closeSIMHistoryModal = closeSIMHistoryModal;
window.uploadStockCSV = uploadStockCSV;
window.uploadDeviceCSV = uploadDeviceCSV;
window.showLogin = showLogin;
window.showForgotPassword = showForgotPassword;
window.backToLogin = backToLogin;
window.logout = logout;
window.loadSIMManagementData = loadSIMManagementData;
window.viewStockDeviceDetails = viewStockDeviceDetails;

// Additional functions for complete functionality
window.showCustomersOverview = showCustomersOverview;
window.showGroundOperations = showGroundOperations;
window.showInventoryManagement = showInventoryManagement;
window.showFinance = showFinance;
window.showAddCredentials = showAddCredentials;
window.showAllTab = showAllTab;
window.showPOCTab = showPOCTab;
window.showOnboardedTab = showOnboardedTab;
window.showClosedTab = showClosedTab;
window.showOngoingLeadsTab = showOngoingLeadsTab;
window.openAddCustomerForm = openAddCustomerForm;
window.closeAddCustomerForm = closeAddCustomerForm;
window.openExtendPOCModal = openExtendPOCModal;
window.closeExtendPOCModal = closeExtendPOCModal;
window.openScheduleEmailModal = openScheduleEmailModal;
window.closeScheduleEmailModal = closeScheduleEmailModal;
window.openManualEmailModal = openManualEmailModal;
window.closeManualEmailModal = closeManualEmailModal;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.toggleAddMenu = toggleAddMenu;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleNewUserPasswordVisibility = toggleNewUserPasswordVisibility;
window.toggleSidebar = toggleSidebar;
window.handleSidebarMouseEnter = handleSidebarMouseEnter;
window.handleSidebarMouseLeave = handleSidebarMouseLeave;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.goToStep2 = goToStep2;
window.goToStep3 = goToStep3;
window.goBackToStep1 = goBackToStep1;
window.goBackToStep2 = goBackToStep2;
window.extendPOC = extendPOC;
window.approveCustomer = approveCustomer;
window.rejectCustomer = rejectCustomer;
window.deleteCustomer = deleteCustomer;
window.convertLeadToCustomer = convertLeadToCustomer;
window.deleteLead = deleteLead;
window.cancelScheduledEmail = cancelScheduledEmail;
window.toggleCredentialStatus = toggleCredentialStatus;
window.deleteCredential = deleteCredential;
