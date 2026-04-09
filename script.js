// =============================================
// SECTION 1: DATA STORAGE HELPERS
// We use localStorage to save data in browser
// =============================================

// Helper to save data to localStorage
function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Helper to read data from localStorage
function loadFromStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        return null; // return nothing if error
    }
}


// =============================================
// SECTION 2: APP DATA (loaded from storage)
// =============================================

let allTransactions = loadFromStorage('kosha_txns')  || [];
let allBudgets      = loadFromStorage('kosha_buds')  || [];
let allGoals        = loadFromStorage('kosha_goals') || [];
let isLightTheme    = loadFromStorage('kosha_light') || false;

// This holds which transaction we are editing (null = adding new)
let currentEditId = null;

// Which type is selected in modal: 'income' or 'expense'
let selectedType = 'expense';

// Chart instances - we keep references to destroy old ones before redrawing
let chartInstances = {};


// =============================================
// SECTION 3: CATEGORY ICONS AND COLORS
// =============================================

// Emoji icons for each category
const categoryIcons = {
    'Food & Dining':  '🛒',
    'Transportation': '🚗',
    'Housing & Rent': '🏠',
    'Utilities':      '⚡',
    'Entertainment':  '🎮',
    'Shopping':       '🛍️',
    'Healthcare':     '🏥',
    'Education':      '📚',
    'Travel':         '✈️',
    'Salary':         '💼',
    'Freelance':      '💻',
    'Investment':     '📈',
    'EMI / Loan':     '🏦',
    'Insurance':      '🛡️',
    'Other':          '📝'
};

// Colors for charts
const chartColors = [
    '#d4af37', '#60a5fa', '#f87171', '#34d399', '#a78bfa',
    '#fb923c', '#38bdf8', '#4ade80', '#f472b6', '#818cf8',
    '#2dd4bf', '#facc15', '#e879f9', '#94a3b8'
];


// =============================================
// SECTION 4: STARTUP / INITIALIZATION
// =============================================

// Apply theme if saved
if (isLightTheme) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeToggleBtn').textContent = '◑ Dark Mode';
}

// Set today's date in the transaction form
document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

// Load saved name if any
var savedName = loadFromStorage('kosha_name');
if (savedName) {
    document.getElementById('userNameEl').textContent = savedName;
    document.getElementById('userAvatarEl').textContent = getInitials(savedName);
}

// First render
refreshAll();


// =============================================
// SECTION 5: UTILITY / HELPER FUNCTIONS
// =============================================

// Get first letter(s) of a name (for avatar)
function getInitials(name) {
    return name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
}

// Format number as Indian Rupee (full) e.g. ₹1,23,456.00
function formatAmount(number) {
    return '₹' + Math.abs(number).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format short version e.g. ₹1.23L or ₹50K
function formatShort(number) {
    var val = Math.abs(number);
    if (val >= 1e7) return '₹' + (val / 1e7).toFixed(2) + 'Cr';
    if (val >= 1e5) return '₹' + (val / 1e5).toFixed(2) + 'L';
    if (val >= 1e3) return '₹' + (val / 1e3).toFixed(1) + 'K';
    return '₹' + val.toFixed(0);
}

// Escape HTML to prevent XSS (injection attacks)
function safeText(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Show a toast notification at bottom-right
function showToast(message, type) {
    if (!type) type = 'success';
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto remove after 2.8 seconds
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2800);
}


// =============================================
// SECTION 6: PAGE NAVIGATION
// =============================================

// All page IDs
var allPages = ['dashboard', 'transactions', 'budgets', 'reports', 'goals'];

// Page titles shown in topbar
var pageTitles = {
    dashboard:    'Dashboard',
    transactions: 'Transactions',
    budgets:      'Budgets',
    reports:      'Reports',
    goals:        'Savings Goals'
};

var pageSubtitles = {
    dashboard:    'Your financial overview',
    transactions: 'All income & expense records',
    budgets:      'Monthly spending limits',
    reports:      'Financial analytics & insights',
    goals:        'Track your savings targets'
};

// Switch to a page
function goToPage(pageName, clickedBtn) {
    // Hide all pages
    allPages.forEach(function(p) {
        var el = document.getElementById('page-' + p);
        if (el) el.style.display = p === pageName ? '' : 'none';
    });

    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });

    // Set clicked one as active
    if (clickedBtn) clickedBtn.classList.add('active');

    // Update top bar text
    document.getElementById('pageTitleEl').textContent    = pageTitles[pageName];
    document.getElementById('pageSubtitleEl').textContent = pageSubtitles[pageName];

    // Load page-specific data
    if (pageName === 'transactions') renderTransactionsPage();
    if (pageName === 'reports')      renderReportsPage();
    if (pageName === 'budgets')      renderBudgetsPage();
    if (pageName === 'goals')        renderGoalsPage();
}


// =============================================
// SECTION 7: SUMMARY CARDS
// =============================================

// Get this month's income and expense totals
function getThisMonthTotals() {
    var today = new Date();
    var thisMonth = today.getMonth();
    var thisYear  = today.getFullYear();

    var income  = 0;
    var expense = 0;

    allTransactions.forEach(function(txn) {
        var d = new Date(txn.date);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
            if (txn.type === 'income') {
                income += txn.amount;
            } else {
                expense += txn.amount;
            }
        }
    });

    return { income: income, expense: expense };
}

// Draw the 4 summary cards at the top of dashboard
function renderSummaryCards() {
    var totals = getThisMonthTotals();
    var income  = totals.income;
    var expense = totals.expense;

    // Total balance = all income minus all expense
    var balance = allTransactions.reduce(function(sum, txn) {
        return txn.type === 'income' ? sum + txn.amount : sum - txn.amount;
    }, 0);

    // Savings rate = what % of income was saved
    var savingsRate = income > 0 ? ((income - expense) / income * 100).toFixed(1) : '0.0';

    document.getElementById('summaryGridEl').innerHTML =
        '<div class="summary-card card-balance">' +
            '<div class="card-icon">₹</div>' +
            '<div class="card-label">Total Balance</div>' +
            '<div class="card-amount text-gold">' + formatShort(balance) + '</div>' +
            '<div class="card-meta">All-time net worth</div>' +
        '</div>' +
        '<div class="summary-card card-income">' +
            '<div class="card-icon" style="font-size:22px">↑</div>' +
            '<div class="card-label">Monthly Income</div>' +
            '<div class="card-amount text-green">' + formatShort(income) + '</div>' +
            '<div class="card-meta">This month</div>' +
        '</div>' +
        '<div class="summary-card card-expense">' +
            '<div class="card-icon" style="font-size:22px">↓</div>' +
            '<div class="card-label">Monthly Expenses</div>' +
            '<div class="card-amount text-red">' + formatShort(expense) + '</div>' +
            '<div class="card-meta">This month</div>' +
        '</div>' +
        '<div class="summary-card card-savings">' +
            '<div class="card-icon" style="font-size:22px">◎</div>' +
            '<div class="card-label">Savings Rate</div>' +
            '<div class="card-amount text-purple">' + savingsRate + '%</div>' +
            '<div class="card-meta">Of monthly income</div>' +
        '</div>';

    // Update transaction count badge
    document.getElementById('txnCountBadge').textContent = allTransactions.length;
}


// =============================================
// SECTION 8: DONUT CHART
// =============================================

// Get expenses grouped by category for a given period
function getExpensesByCategory(period) {
    var today = new Date();
    var result = {};

    allTransactions.filter(function(txn) {
        return txn.type === 'expense';
    }).forEach(function(txn) {
        var d = new Date(txn.date);
        var isInPeriod = false;

        if (period === 'month') {
            isInPeriod = d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        } else if (period === '3months') {
            isInPeriod = (today - d) <= (90 * 24 * 60 * 60 * 1000);
        } else if (period === 'year') {
            isInPeriod = d.getFullYear() === today.getFullYear();
        } else {
            isInPeriod = true; // 'all'
        }

        if (isInPeriod) {
            if (!result[txn.category]) result[txn.category] = 0;
            result[txn.category] += txn.amount;
        }
    });

    return result;
}

// Draw or redraw the donut chart
function drawDonutChart(period) {
    var catData = getExpensesByCategory(period);
    var labels  = Object.keys(catData);
    var values  = Object.values(catData);
    var total   = values.reduce(function(a, b) { return a + b; }, 0);
    var colors  = labels.map(function(_, i) { return chartColors[i % chartColors.length]; });

    // Show total in center
    document.getElementById('donutTotalEl').textContent = formatShort(total);

    // Destroy old chart if exists
    if (chartInstances.donut) chartInstances.donut.destroy();

    // Draw new chart
    chartInstances.donut = new Chart(
        document.getElementById('donutChartCanvas').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8,
                    borderRadius: 4
                }]
            },
            options: {
                cutout: '73%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ' ' + ctx.label + ': ' + formatAmount(ctx.raw);
                            }
                        }
                    }
                },
                animation: { duration: 700, easing: 'easeOutQuart' }
            }
        }
    );

    // Build legend
    if (labels.length > 0) {
        document.getElementById('donutLegendEl').innerHTML = labels.map(function(label, i) {
            var pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : 0;
            return '<div class="legend-row">' +
                '<div class="legend-dot" style="background:' + colors[i] + '"></div>' +
                '<span class="legend-name">' + label + '</span>' +
                '<div class="legend-right">' +
                    '<div class="legend-amount">' + formatAmount(values[i]) + '</div>' +
                    '<div class="legend-percent">' + pct + '%</div>' +
                '</div>' +
            '</div>';
        }).join('');
    } else {
        document.getElementById('donutLegendEl').innerHTML =
            '<div style="color:var(--text-faint);font-size:13px;padding:10px">No expenses this period</div>';
    }
}


// =============================================
// SECTION 9: BAR CHART (Income vs Expenses)
// =============================================

// Get monthly data for last N months
function getMonthlyData(numMonths) {
    var today = new Date();
    var result = [];

    for (var i = numMonths - 1; i >= 0; i--) {
        var date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        var label = date.toLocaleDateString('en-IN', {
            month: 'short',
            year: numMonths > 6 ? '2-digit' : undefined
        });

        var monthIncome  = 0;
        var monthExpense = 0;

        allTransactions.forEach(function(txn) {
            var txnDate = new Date(txn.date);
            if (txnDate.getMonth() === date.getMonth() && txnDate.getFullYear() === date.getFullYear()) {
                if (txn.type === 'income') {
                    monthIncome += txn.amount;
                } else {
                    monthExpense += txn.amount;
                }
            }
        });

        result.push({ label: label, income: monthIncome, expense: monthExpense });
    }

    return result;
}

// Draw or redraw the bar chart
function drawBarChart(numMonths) {
    numMonths = parseInt(numMonths);
    var data     = getMonthlyData(numMonths);
    var gridColor   = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    var tickColor   = isLightTheme ? '#9e998f' : '#4a4e63';

    if (chartInstances.bar) chartInstances.bar.destroy();

    chartInstances.bar = new Chart(
        document.getElementById('barChartCanvas').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: data.map(function(d) { return d.label; }),
                datasets: [
                    {
                        label: 'Income',
                        data: data.map(function(d) { return d.income; }),
                        backgroundColor: 'rgba(52,211,153,0.75)',
                        borderRadius: 6,
                        barPercentage: 0.5
                    },
                    {
                        label: 'Expenses',
                        data: data.map(function(d) { return d.expense; }),
                        backgroundColor: 'rgba(248,113,113,0.75)',
                        borderRadius: 6,
                        barPercentage: 0.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } }
                    }
                },
                scales: {
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, callback: function(v) { return '₹' + v.toLocaleString('en-IN'); } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: tickColor }
                    }
                },
                animation: { duration: 700 }
            }
        }
    );
}


// =============================================
// SECTION 10: TRANSACTION TABLE HTML BUILDER
// =============================================

// Build HTML rows for a list of transactions
// showActions: true = show Edit and Delete buttons
function buildTableHTML(transactions, showActions) {
    var actionsHeader = showActions ? '<th>Actions</th>' : '';

    var rows = transactions.map(function(txn) {
        var icon     = categoryIcons[txn.category] || '📝';
        var iconBg   = txn.type === 'income' ? 'var(--green-bg)' : 'var(--red-bg)';
        var amtClass = txn.type === 'income' ? 'amount-income' : 'amount-expense';
        var sign     = txn.type === 'income' ? '+' : '-';
        var noteHtml = txn.note ? '<div class="txn-note">' + safeText(txn.note) + '</div>' : '';
        var dateStr  = new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        var actionButtons = showActions ?
            '<td>' +
                '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
                    '<button class="action-btn" onclick="openEditModal(\'' + txn.id + '\')">Edit</button>' +
                    '<button class="action-btn delete" onclick="deleteTransaction(\'' + txn.id + '\')">Delete</button>' +
                '</div>' +
            '</td>' : '';

        return '<tr>' +
            '<td>' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                    '<div class="txn-icon" style="background:' + iconBg + '">' + icon + '</div>' +
                    '<div>' +
                        '<div class="txn-name">' + safeText(txn.description) + '</div>' +
                        noteHtml +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td><span class="category-tag">' + txn.category + '</span></td>' +
            '<td style="color:var(--text-faint)">' + dateStr + '</td>' +
            '<td style="text-align:right"><span class="' + amtClass + '">' + sign + formatAmount(txn.amount) + '</span></td>' +
            actionButtons +
        '</tr>';
    }).join('');

    return '<thead><tr>' +
        '<th>Transaction</th>' +
        '<th>Category</th>' +
        '<th>Date</th>' +
        '<th style="text-align:right">Amount</th>' +
        actionsHeader +
    '</tr></thead><tbody>' + rows + '</tbody>';
}

// Show last 5 transactions on dashboard
function renderDashboardTransactions() {
    var recent = [...allTransactions]
        .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
        .slice(0, 5);

    if (recent.length > 0) {
        document.getElementById('dashboardTxnTable').innerHTML = buildTableHTML(recent, false);
    } else {
        document.getElementById('dashboardTxnTable').innerHTML =
            '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-faint)">' +
            '<div style="font-size:32px;margin-bottom:8px">◎</div>' +
            '<div style="font-family:Cormorant Garamond,serif;font-size:18px">No transactions yet</div>' +
            '</td></tr>';
    }
}


// =============================================
// SECTION 11: TRANSACTIONS PAGE
// =============================================

// Populate filter dropdowns with real data
function fillTransactionFilters() {
    // Get unique categories from transactions
    var categories = [...new Set(allTransactions.map(function(t) { return t.category; }))].sort();

    // Get unique months (like "2024-03")
    var months = [...new Set(allTransactions.map(function(t) { return t.date.slice(0, 7); }))].sort().reverse();

    // Fill category dropdown
    document.getElementById('categoryFilter').innerHTML =
        '<option value="">All Categories</option>' +
        categories.map(function(c) { return '<option>' + c + '</option>'; }).join('');

    // Fill month dropdown
    document.getElementById('monthFilter').innerHTML =
        '<option value="">All Time</option>' +
        months.map(function(m) {
            var label = new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            return '<option value="' + m + '">' + label + '</option>';
        }).join('');
}

// Render transactions page with current filters applied
function renderTransactionsPage() {
    fillTransactionFilters();

    var searchText = document.getElementById('searchInput').value.toLowerCase();
    var filterCat  = document.getElementById('categoryFilter').value;
    var filterType = document.getElementById('typeFilter').value;
    var filterMonth = document.getElementById('monthFilter').value;

    // Start with all, sort newest first
    var filtered = [...allTransactions].sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    // Apply search text filter
    if (searchText) {
        filtered = filtered.filter(function(t) {
            return t.description.toLowerCase().includes(searchText) ||
                   t.category.toLowerCase().includes(searchText) ||
                   (t.note || '').toLowerCase().includes(searchText);
        });
    }

    // Apply category filter
    if (filterCat)   filtered = filtered.filter(function(t) { return t.category === filterCat; });

    // Apply type filter
    if (filterType)  filtered = filtered.filter(function(t) { return t.type === filterType; });

    // Apply month filter
    if (filterMonth) filtered = filtered.filter(function(t) { return t.date.startsWith(filterMonth); });

    var tableEl = document.getElementById('fullTxnTable');
    var emptyEl = document.getElementById('txnEmptyState');

    if (filtered.length === 0) {
        tableEl.innerHTML = '';
        emptyEl.style.display = '';
    } else {
        emptyEl.style.display = 'none';
        tableEl.innerHTML = buildTableHTML(filtered, true);
    }
}


// =============================================
// SECTION 12: BUDGETS PAGE
// =============================================

function renderBudgetsPage() {
    var gridEl  = document.getElementById('budgetGridEl');
    var emptyEl = document.getElementById('budgetEmptyState');

    if (allBudgets.length === 0) {
        gridEl.innerHTML = '';
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';

    // Calculate spending this month per category
    var today = new Date();
    var monthlySpending = {};

    allTransactions.filter(function(txn) {
        return txn.type === 'expense';
    }).forEach(function(txn) {
        var d = new Date(txn.date);
        if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
            if (!monthlySpending[txn.category]) monthlySpending[txn.category] = 0;
            monthlySpending[txn.category] += txn.amount;
        }
    });

    gridEl.innerHTML = allBudgets.map(function(budget) {
        var spent   = monthlySpending[budget.category] || 0;
        var percent = Math.min((spent / budget.limit) * 100, 100);
        var isOver  = spent > budget.limit;

        // Color: red if over, amber if > 75%, green otherwise
        var barColor;
        if (isOver) {
            barColor = 'var(--red)';
        } else if (percent > 75) {
            barColor = '#f59e0b';
        } else {
            barColor = 'var(--green)';
        }

        var statusText = isOver
            ? '⚠ Over by ' + formatAmount(spent - budget.limit)
            : formatAmount(budget.limit - spent) + ' remaining';

        return '<div class="budget-card">' +
            '<div class="budget-header">' +
                '<div class="budget-name">' + (categoryIcons[budget.category] || '📝') + ' ' + budget.category + '</div>' +
                '<button class="action-btn delete" onclick="deleteBudget(\'' + budget.id + '\')">×</button>' +
            '</div>' +
            '<div class="budget-numbers">' +
                '<span class="budget-spent">' + formatAmount(spent) + '</span>' +
                ' <span style="color:var(--text-faint)">of ' + formatAmount(budget.limit) + '</span>' +
            '</div>' +
            '<div class="progress-bar">' +
                '<div class="progress-fill" style="width:0;background:' + barColor + ';" data-width="' + percent + '"></div>' +
            '</div>' +
            '<div class="budget-footer">' +
                '<span style="color:' + (isOver ? 'var(--red)' : 'var(--text-faint)') + '">' + statusText + '</span>' +
                '<span style="color:' + barColor + ';font-weight:700">' + percent.toFixed(0) + '%</span>' +
            '</div>' +
        '</div>';
    }).join('');

    // Animate progress bars (set width after render)
    requestAnimationFrame(function() {
        document.querySelectorAll('.progress-fill[data-width]').forEach(function(el) {
            el.style.width = el.dataset.width + '%';
        });
    });
}


// =============================================
// SECTION 13: REPORTS PAGE
// =============================================

function renderReportsPage() {
    var data       = getMonthlyData(6);
    var gridColor  = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    var tickColor  = isLightTheme ? '#9e998f' : '#4a4e63';

    // Helper to draw a line chart
    function drawLineChart(canvasId, chartId, label, values, lineColor) {
        if (chartInstances[chartId]) chartInstances[chartId].destroy();
        chartInstances[chartId] = new Chart(
            document.getElementById(canvasId).getContext('2d'),
            {
                type: 'line',
                data: {
                    labels: data.map(function(d) { return d.label; }),
                    datasets: [{
                        label: label,
                        data: values,
                        borderColor: lineColor,
                        backgroundColor: lineColor + '18',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: lineColor,
                        pointBorderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: tickColor, callback: function(v) { return '₹' + v.toLocaleString('en-IN'); } }
                        },
                        x: { grid: { display: false }, ticks: { color: tickColor } }
                    },
                    animation: { duration: 700 }
                }
            }
        );
    }

    // Income line chart
    drawLineChart('incomeChartCanvas', 'income', 'Income', data.map(function(d) { return d.income; }), '#34d399');

    // Expense line chart
    drawLineChart('expenseChartCanvas', 'expense', 'Expenses', data.map(function(d) { return d.expense; }), '#f87171');

    // Savings line chart
    drawLineChart('savingsChartCanvas', 'savings', 'Savings', data.map(function(d) { return d.income - d.expense; }), '#d4af37');

    // Top categories horizontal bar chart
    var catTotals = {};
    allTransactions.filter(function(t) { return t.type === 'expense'; }).forEach(function(t) {
        if (!catTotals[t.category]) catTotals[t.category] = 0;
        catTotals[t.category] += t.amount;
    });

    var sortedCats = Object.entries(catTotals)
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 6);

    if (chartInstances.topCats) chartInstances.topCats.destroy();
    chartInstances.topCats = new Chart(
        document.getElementById('topCatChartCanvas').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: sortedCats.map(function(c) { return c[0]; }),
                datasets: [{
                    data: sortedCats.map(function(c) { return c[1]; }),
                    backgroundColor: chartColors.slice(0, sortedCats.length),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: tickColor, callback: function(v) { return '₹' + v.toLocaleString('en-IN'); } } },
                    y: { grid: { display: false }, ticks: { color: tickColor } }
                },
                animation: { duration: 700 }
            }
        }
    );
}


// =============================================
// SECTION 14: GOALS PAGE
// =============================================

function renderGoalsPage() {
    var gridEl  = document.getElementById('goalsGridEl');
    var emptyEl = document.getElementById('goalEmptyState');

    if (allGoals.length === 0) {
        gridEl.innerHTML = '';
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';

    gridEl.innerHTML = allGoals.map(function(goal) {
        var percent = Math.min((goal.saved / goal.target) * 100, 100);
        var barColor = percent >= 100 ? 'var(--green)' : percent >= 50 ? 'var(--gold)' : 'var(--blue)';

        // Days remaining until deadline
        var deadlineHTML = '';
        if (goal.deadline) {
            var daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / (24 * 60 * 60 * 1000)));
            var deadlineIcon = daysLeft < 30 && daysLeft > 0 ? '⚠' : '⏰';
            var deadlineText = daysLeft === 0 ? 'Deadline today!' : daysLeft + ' days remaining';
            deadlineHTML = '<div class="goal-deadline">' + deadlineIcon + ' ' + deadlineText + '</div>';
        }

        return '<div class="goal-card">' +
            '<div class="goal-icon-wrap">' + (goal.icon || '🎯') + '</div>' +
            '<div class="goal-name">' + safeText(goal.name) + '</div>' +
            '<div class="goal-percent" style="color:' + barColor + '">' + percent.toFixed(0) + '%</div>' +
            '<div class="goal-amounts">' +
                '<span class="goal-saved" style="color:' + barColor + '">' + formatAmount(goal.saved) + '</span>' +
                '<span style="color:var(--text-faint)">of ' + formatAmount(goal.target) + '</span>' +
            '</div>' +
            '<div class="progress-bar"><div class="progress-fill" style="width:' + percent + '%;background:' + barColor + '"></div></div>' +
            deadlineHTML +
            '<div style="display:flex;gap:8px;margin-top:4px;">' +
                '<button class="action-btn" style="flex:1" onclick="addMoneyToGoal(\'' + goal.id + '\')">+ Add ₹</button>' +
                '<button class="action-btn delete" onclick="deleteGoal(\'' + goal.id + '\')">Delete</button>' +
            '</div>' +
        '</div>';
    }).join('');
}


// =============================================
// SECTION 15: TRANSACTION MODAL
// =============================================

// Open modal to add a new transaction
function openAddModal() {
    currentEditId = null;
    document.getElementById('modalTitleText').textContent = 'Add Transaction';
    selectType('expense');
    document.getElementById('amountInput').value   = '';
    document.getElementById('dateInput').value     = new Date().toISOString().split('T')[0];
    document.getElementById('descInput').value     = '';
    document.getElementById('noteInput').value     = '';
    document.getElementById('txnModal').classList.add('open');
    setTimeout(function() { document.getElementById('amountInput').focus(); }, 100);
}

// Open modal to edit an existing transaction
function openEditModal(id) {
    var txn = allTransactions.find(function(t) { return t.id === id; });
    if (!txn) return;

    currentEditId = id;
    document.getElementById('modalTitleText').textContent = 'Edit Transaction';
    selectType(txn.type);
    document.getElementById('amountInput').value   = txn.amount;
    document.getElementById('dateInput').value     = txn.date;
    document.getElementById('descInput').value     = txn.description;
    document.getElementById('categoryInput').value = txn.category;
    document.getElementById('noteInput').value     = txn.note || '';
    document.getElementById('txnModal').classList.add('open');
}

// Close the transaction modal
function closeAddModal() {
    document.getElementById('txnModal').classList.remove('open');
    currentEditId = null;
}

// Select income or expense type
function selectType(type) {
    selectedType = type;
    document.getElementById('incomeTypeBtn').className  = 'type-btn' + (type === 'income' ? ' selected-income' : '');
    document.getElementById('expenseTypeBtn').className = 'type-btn' + (type === 'expense' ? ' selected-expense' : '');
}

// Save the transaction (add or update)
function saveTransaction() {
    var amount = parseFloat(document.getElementById('amountInput').value);
    var date   = document.getElementById('dateInput').value;
    var desc   = document.getElementById('descInput').value.trim();
    var cat    = document.getElementById('categoryInput').value;
    var note   = document.getElementById('noteInput').value.trim();

    // Validate inputs
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!date)  { showToast('Select a date', 'error'); return; }
    if (!desc)  { showToast('Enter a description', 'error'); return; }

    if (currentEditId) {
        // EDIT: find and update existing transaction
        var index = allTransactions.findIndex(function(t) { return t.id === currentEditId; });
        allTransactions[index] = {
            ...allTransactions[index],
            type: selectedType,
            amount: amount,
            date: date,
            description: desc,
            category: cat,
            note: note
        };
        showToast('Updated ✓', 'info');
    } else {
        // ADD: create new transaction object
        var newTxn = {
            id: Date.now().toString(),
            type: selectedType,
            amount: amount,
            date: date,
            description: desc,
            category: cat,
            note: note,
            createdAt: new Date().toISOString()
        };
        allTransactions.unshift(newTxn); // add at beginning
        showToast('Transaction added ✓');
    }

    // Save to storage and refresh
    saveToStorage('kosha_txns', allTransactions);
    closeAddModal();
    refreshAll();
}

// Delete a transaction
function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    allTransactions = allTransactions.filter(function(t) { return t.id !== id; });
    saveToStorage('kosha_txns', allTransactions);
    refreshAll();
    renderTransactionsPage();
    showToast('Deleted', 'error');
}


// =============================================
// SECTION 16: BUDGET MODAL
// =============================================

function openBudgetModal() {
    document.getElementById('budgetModal').classList.add('open');
}

function saveBudget() {
    var cat   = document.getElementById('budgetCategoryInput').value;
    var limit = parseFloat(document.getElementById('budgetLimitInput').value);

    if (!limit || limit <= 0) { showToast('Enter a valid limit', 'error'); return; }

    // If budget for this category already exists, update it
    var existingIndex = allBudgets.findIndex(function(b) { return b.category === cat; });
    if (existingIndex >= 0) {
        allBudgets[existingIndex].limit = limit;
    } else {
        allBudgets.push({ id: Date.now().toString(), category: cat, limit: limit });
    }

    saveToStorage('kosha_buds', allBudgets);
    document.getElementById('budgetModal').classList.remove('open');
    renderBudgetsPage();
    showToast('Budget saved ✓', 'info');
}

function deleteBudget(id) {
    allBudgets = allBudgets.filter(function(b) { return b.id !== id; });
    saveToStorage('kosha_buds', allBudgets);
    renderBudgetsPage();
    showToast('Removed', 'error');
}


// =============================================
// SECTION 17: GOAL MODAL
// =============================================

function openGoalModal() {
    document.getElementById('goalModal').classList.add('open');
}

function saveGoal() {
    var name     = document.getElementById('goalNameInput').value.trim();
    var target   = parseFloat(document.getElementById('goalTargetInput').value);
    var saved    = parseFloat(document.getElementById('goalSavedInput').value) || 0;
    var deadline = document.getElementById('goalDeadlineInput').value;
    var icon     = document.getElementById('goalIconInput').value || '🎯';

    if (!name || !target) { showToast('Fill in name and target', 'error'); return; }

    allGoals.push({
        id: Date.now().toString(),
        name: name,
        target: target,
        saved: saved,
        deadline: deadline,
        icon: icon
    });

    saveToStorage('kosha_goals', allGoals);
    document.getElementById('goalModal').classList.remove('open');
    renderGoalsPage();
    showToast('Goal created ✓');
}

function deleteGoal(id) {
    allGoals = allGoals.filter(function(g) { return g.id !== id; });
    saveToStorage('kosha_goals', allGoals);
    renderGoalsPage();
    showToast('Removed', 'error');
}

// Prompt user to add money to a goal
function addMoneyToGoal(id) {
    var amount = parseFloat(prompt('Amount to add (₹):'));
    if (!amount || amount <= 0) return;

    var goal = allGoals.find(function(g) { return g.id === id; });
    if (goal) {
        goal.saved = Math.min(goal.target, goal.saved + amount);
        saveToStorage('kosha_goals', allGoals);
        renderGoalsPage();
        showToast('₹' + amount.toLocaleString('en-IN') + ' added!');
    }
}


// =============================================
// SECTION 18: CLOSE MODALS ON OUTSIDE CLICK
// =============================================

['txnModal', 'budgetModal', 'goalModal'].forEach(function(modalId) {
    document.getElementById(modalId).addEventListener('click', function(event) {
        if (event.target === event.currentTarget) {
            event.currentTarget.classList.remove('open');
        }
    });
});


// =============================================
// SECTION 19: THEME TOGGLE (Dark / Light)
// =============================================

function toggleTheme() {
    isLightTheme = !isLightTheme;
    saveToStorage('kosha_light', isLightTheme);

    if (isLightTheme) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.getElementById('themeToggleBtn').textContent = '◑ Dark Mode';
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('themeToggleBtn').textContent = '◑ Light Mode';
    }

    // Redraw charts with new colors after theme change
    setTimeout(refreshAll, 120);
}


// =============================================
// SECTION 20: EXPORT TO CSV
// =============================================

function exportToCSV() {
    if (allTransactions.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    // Build CSV rows
    var rows = [['Date', 'Description', 'Category', 'Type', 'Amount (INR)', 'Note']];

    [...allTransactions]
        .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
        .forEach(function(txn) {
            rows.push([txn.date, '"' + txn.description + '"', txn.category, txn.type, txn.amount, '"' + (txn.note || '') + '"']);
        });

    var csvContent = rows.map(function(row) { return row.join(','); }).join('\n');

    // Trigger download
    var link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    link.download = 'kosha-' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();

    showToast('Exported ✓', 'info');
}


// =============================================
// SECTION 21: CLEAR ALL DATA
// =============================================

function clearAllData() {
    if (!confirm('Clear ALL data? This cannot be undone!')) return;

    allTransactions = [];
    allBudgets = [];
    allGoals   = [];

    localStorage.removeItem('kosha_txns');
    localStorage.removeItem('kosha_buds');
    localStorage.removeItem('kosha_goals');

    refreshAll();
    showToast('Cleared', 'error');
}


// =============================================
// SECTION 22: EDIT USER NAME
// =============================================

function editUserName() {
    var currentName = document.getElementById('userNameEl').textContent;
    var newName = prompt('Your name:', currentName);

    if (newName && newName.trim()) {
        newName = newName.trim();
        document.getElementById('userNameEl').textContent  = newName;
        document.getElementById('userAvatarEl').textContent = getInitials(newName);
        saveToStorage('kosha_name', newName);
    }
}


// =============================================
// SECTION 23: REFRESH ALL (main update function)
// =============================================

// Called whenever data changes - updates dashboard charts and cards
function refreshAll() {
    renderSummaryCards();
    renderDashboardTransactions();
    drawDonutChart(document.getElementById('donutPeriodSelect')?.value || 'month');
    drawBarChart(6);

    // Show last updated time
    document.getElementById('lastUpdatedEl').textContent =
        'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
