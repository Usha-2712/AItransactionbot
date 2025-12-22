/**
 * Dashboard Module
 * Handles data fetching, aggregation, and chart rendering for the transaction dashboard
 */

// Chart instances
let expensesTrendChart = null;
let incomeExpensesChart = null;

/**
 * Main Dashboard Controller
 */
const Dashboard = {
    /**
     * Initialize dashboard on page load
     */
    init() {
        // Load userId from URL params if present
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        if (userId) {
            const userIdInput = document.getElementById('userIdInput');
            if (userIdInput) {
                userIdInput.value = userId;
            }
        }

        // Set up Enter key handler for userId input
        const userIdInput = document.getElementById('userIdInput');
        if (userIdInput) {
            userIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.loadDashboard();
                }
            });
        }

        // Load dashboard on initialization
        this.loadDashboard();
    },

    /**
     * Fetch transactions from API and load dashboard
     */
    async loadDashboard() {
        const userIdInput = document.getElementById('userIdInput');
        if (!userIdInput) {
            console.error('User ID input not found');
            return;
        }

        const userId = userIdInput.value.trim();
        if (!userId) {
            this.showError('Please enter a User ID');
            return;
        }

        // Show loading state
        this.setLoadingState(true);
        this.hideError();
        this.hideDashboard();
        this.hideEmpty();

        try {
            // Fetch transactions from API
            const transactions = await this.fetchTransactions(userId);

            if (!transactions || transactions.length === 0) {
                this.showEmpty();
                return;
            }

            // Process and display dashboard
            this.processAndDisplay(transactions);
            this.showDashboard();

        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('Error loading dashboard: ' + error.message);
        } finally {
            this.setLoadingState(false);
        }
    },

    /**
     * Fetch transactions from API endpoint
     * @param {string} userId - User ID to fetch transactions for
     * @returns {Promise<Array>} Array of transaction objects
     */
    async fetchTransactions(userId) {
        try {
            const response = await fetch(`/api/transactions/${encodeURIComponent(userId)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to load transactions');
            }

            return result.data?.transactions || [];
        } catch (error) {
            console.error('Fetch transactions error:', error);
            throw new Error('Failed to fetch transactions: ' + error.message);
        }
    },

    /**
     * Process transaction data and display dashboard
     * @param {Array} transactions - Array of transaction objects
     */
    processAndDisplay(transactions) {
        try {
            // Group transactions by year and month
            const monthlyData = DataAggregator.groupByMonth(transactions);

            // Calculate current month totals
            const currentMonthTotals = DataAggregator.getCurrentMonthTotals(transactions);

            // Update summary cards
            this.updateSummaryCards(currentMonthTotals, monthlyData);

            // Prepare chart data
            const chartData = DataAggregator.prepareChartData(monthlyData);

            // Render charts
            ChartRenderer.renderExpensesTrend(chartData.labels, chartData.expenses);
            ChartRenderer.renderIncomeExpenses(chartData.labels, chartData.income, chartData.expenses);

            // Generate and display insight
            this.generateInsight(currentMonthTotals, monthlyData);

        } catch (error) {
            console.error('Process dashboard data error:', error);
            throw new Error('Failed to process dashboard data: ' + error.message);
        }
    },

    /**
     * Update summary cards with current month data
     * @param {Object} currentMonthTotals - {expenses, income}
     * @param {Object} monthlyData - Aggregated monthly data
     */
    updateSummaryCards(currentMonthTotals, monthlyData) {
        const { expenses, income } = currentMonthTotals;

        // Update expense card
        const expensesElement = document.getElementById('monthlyExpenses');
        if (expensesElement) {
            expensesElement.textContent = '$' + expenses.toFixed(2);
        }

        // Update income card
        const incomeElement = document.getElementById('monthlyIncome');
        if (incomeElement) {
            incomeElement.textContent = '$' + income.toFixed(2);
        }

        // Update balance card
        const netBalance = income - expenses;
        const balanceElement = document.getElementById('netBalance');
        if (balanceElement) {
            balanceElement.textContent = '$' + netBalance.toFixed(2);
            balanceElement.style.color = netBalance >= 0 ? '#28a745' : '#dc3545';
        }

        // Update month-over-month change indicator
        this.updateExpensesMonthChange(expenses, monthlyData);
    },

    /**
     * Update month-over-month change indicator for expenses
     * @param {number} currentExpenses - Current month expenses
     * @param {Object} monthlyData - Aggregated monthly data
     */
    updateExpensesMonthChange(currentExpenses, monthlyData) {
        const changeElement = document.getElementById('expensesMonthChange');
        if (!changeElement) return;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate previous month key
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const previousMonthKey = `${previousMonthYear}-${String(previousMonth + 1).padStart(2, '0')}`;
        const previousMonthExpenses = monthlyData[previousMonthKey]?.expenses || 0;

        // Hide if no previous month data
        if (!previousMonthExpenses || previousMonthExpenses === 0) {
            changeElement.classList.remove('show', 'increase', 'decrease');
            return;
        }

        // Calculate change
        const change = currentExpenses - previousMonthExpenses;
        const changePercent = ((change / previousMonthExpenses) * 100).toFixed(1);
        const changeAmount = Math.abs(change).toFixed(2);

        // Determine if increase or decrease
        if (change > 0) {
            // Increase: show in red with up arrow
            changeElement.textContent = `↑ $${changeAmount} (${changePercent}%) vs last month`;
            changeElement.classList.add('show', 'increase');
            changeElement.classList.remove('decrease');
        } else if (change < 0) {
            // Decrease: show in green with down arrow
            changeElement.textContent = `↓ $${changeAmount} (${changePercent}%) vs last month`;
            changeElement.classList.add('show', 'decrease');
            changeElement.classList.remove('increase');
        } else {
            // No change: hide
            changeElement.classList.remove('show', 'increase', 'decrease');
        }
    },

    /**
     * UI State Management
     */
    setLoadingState(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    },

    showDashboard() {
        const dashboardElement = document.getElementById('dashboardContent');
        if (dashboardElement) {
            dashboardElement.style.display = 'block';
        }
    },

    hideDashboard() {
        const dashboardElement = document.getElementById('dashboardContent');
        if (dashboardElement) {
            dashboardElement.style.display = 'none';
        }
    },

    showEmpty() {
        const emptyElement = document.getElementById('empty');
        if (emptyElement) {
            emptyElement.style.display = 'block';
        }
    },

    hideEmpty() {
        const emptyElement = document.getElementById('empty');
        if (emptyElement) {
            emptyElement.style.display = 'none';
        }
    },

    showError(message) {
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    },

    hideError() {
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    },

    /**
     * Generate insight based on current month vs previous month expenses
     * @param {Object} currentMonthTotals - {expenses, income}
     * @param {Object} monthlyData - Aggregated monthly data
     */
    generateInsight(currentMonthTotals, monthlyData) {
        const insightElement = document.getElementById('insightContent');
        if (!insightElement) return;

        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Calculate previous month key
            const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const previousMonthKey = `${previousMonthYear}-${String(previousMonth + 1).padStart(2, '0')}`;

            const currentExpenses = currentMonthTotals.expenses || 0;
            const previousMonthData = monthlyData[previousMonthKey];
            const previousExpenses = previousMonthData?.expenses || 0;

            let insight = '';

            // Edge case: No previous month data
            if (!previousMonthData) {
                insight = 'This is your first month tracking expenses.';
            }
            // Edge case: Previous month had $0 expenses
            else if (previousExpenses === 0) {
                if (currentExpenses > 0) {
                    insight = 'You started tracking expenses this month after having none last month.';
                } else {
                    insight = 'Your expenses remain at $0 this month, same as last month.';
                }
            }
            // Edge case: Current month has $0 expenses
            else if (currentExpenses === 0) {
                insight = 'Great job! You had zero expenses this month, a significant improvement.';
            }
            // Normal case: Compare expenses
            else {
                const change = currentExpenses - previousExpenses;
                const changePercent = ((change / previousExpenses) * 100).toFixed(1);

                if (changePercent > 20) {
                    // Significant increase (>20%)
                    insight = `Your expenses increased by ${changePercent}% compared to last month.`;
                } else if (changePercent > 5) {
                    // Moderate increase (5-20%)
                    insight = `Your expenses are up ${changePercent}% from last month.`;
                } else if (changePercent < -20) {
                    // Significant decrease (>20%)
                    insight = `Excellent! Your expenses decreased by ${Math.abs(changePercent)}% compared to last month.`;
                } else if (changePercent < -5) {
                    // Moderate decrease (5-20%)
                    insight = `Great progress! Your expenses decreased by ${Math.abs(changePercent)}% from last month.`;
                } else {
                    // Stable (±5%)
                    insight = `Your expenses remain stable, with only a ${Math.abs(changePercent)}% change from last month.`;
                }
            }

            // Update the insight element
            insightElement.textContent = insight;
            insightElement.classList.remove('insight-loading');

        } catch (error) {
            console.error('Error generating insight:', error);
            insightElement.textContent = 'Unable to generate insight at this time.';
            insightElement.classList.remove('insight-loading');
        }
    }
};

/**
 * Data Aggregation Utilities
 * Handles grouping and calculating transaction data
 */
const DataAggregator = {
    /**
     * Group transactions by year and month
     * @param {Array} transactions - Array of transaction objects
     * @returns {Object} Object with month keys and aggregated data
     * @example { "2025-01": { expenses: 100, income: 200, label: "Jan 2025" } }
     */
    groupByMonth(transactions) {
        const monthlyData = {};

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return monthlyData;
        }

        transactions.forEach(transaction => {
            // Skip transactions without date
            if (!transaction || !transaction.date) {
                return;
            }

            try {
                // Parse date (format: YYYY-MM-DD)
                const [year, month, day] = transaction.date.split('-').map(Number);
                
                // Validate date components
                if (!year || !month || isNaN(year) || isNaN(month)) {
                    console.warn('Invalid date format:', transaction.date);
                    return;
                }

                // Create month key (YYYY-MM)
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;

                // Initialize month if not exists
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        expenses: 0,
                        income: 0,
                        label: this.getMonthLabel(year, month),
                        year,
                        month
                    };
                }

                // Parse and validate amount
                const amount = parseFloat(transaction.amount);
                if (isNaN(amount) || amount < 0) {
                    console.warn('Invalid amount:', transaction.amount);
                    return;
                }

                // Aggregate by transaction type
                const type = transaction.type?.toLowerCase();
                if (type === 'expense') {
                    monthlyData[monthKey].expenses += amount;
                } else if (type === 'income') {
                    monthlyData[monthKey].income += amount;
                }
                // Ignore unknown types

            } catch (error) {
                console.warn('Error processing transaction:', error, transaction);
            }
        });

        return monthlyData;
    },

    /**
     * Get current month totals
     * @param {Array} transactions - Array of transaction objects
     * @returns {Object} { expenses: number, income: number }
     */
    getCurrentMonthTotals(transactions) {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        let expenses = 0;
        let income = 0;

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return { expenses, income };
        }

        transactions.forEach(transaction => {
            if (!transaction || !transaction.date) {
                return;
            }

            try {
                const [year, month] = transaction.date.split('-').map(Number);
                
                // Only process current month transactions
                if (year === currentYear && month === currentMonth) {
                    const amount = parseFloat(transaction.amount) || 0;
                    const type = transaction.type?.toLowerCase();

                    if (type === 'expense') {
                        expenses += amount;
                    } else if (type === 'income') {
                        income += amount;
                    }
                }
            } catch (error) {
                console.warn('Error calculating current month totals:', error);
            }
        });

        return { expenses, income };
    },

    /**
     * Prepare chart data from monthly aggregation
     * @param {Object} monthlyData - Aggregated monthly data
     * @returns {Object} { labels: Array, expenses: Array, income: Array }
     */
    prepareChartData(monthlyData) {
        // Sort months chronologically
        const sortedMonths = Object.keys(monthlyData).sort();

        // Extract data arrays
        const labels = sortedMonths.map(key => monthlyData[key].label);
        const expenses = sortedMonths.map(key => monthlyData[key].expenses || 0);
        const income = sortedMonths.map(key => monthlyData[key].income || 0);

        return { labels, expenses, income };
    },

    /**
     * Get formatted month label
     * @param {number} year - Year (e.g., 2025)
     * @param {number} month - Month (1-12)
     * @returns {string} Formatted label (e.g., "Jan 2025")
     */
    getMonthLabel(year, month) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        if (month < 1 || month > 12) {
            console.warn('Invalid month:', month);
            return `Month ${month} ${year}`;
        }

        return `${monthNames[month - 1]} ${year}`;
    }
};

/**
 * Chart Rendering Utilities
 * Handles Chart.js integration and chart creation
 */
const ChartRenderer = {
    /**
     * Render expenses trend line chart
     * @param {Array} labels - Month labels
     * @param {Array} expensesData - Expense values
     */
    renderExpensesTrend(labels, expensesData) {
        const canvas = document.getElementById('expensesTrendChart');
        if (!canvas) {
            console.warn('Expenses trend chart canvas not found');
            return;
        }

        // Validate Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }

        // Validate data
        if (!Array.isArray(labels) || !Array.isArray(expensesData)) {
            console.warn('Invalid chart data provided');
            return;
        }

        // Destroy existing chart if it exists
        if (expensesTrendChart) {
            expensesTrendChart.destroy();
            expensesTrendChart = null;
        }

        try {
            const ctx = canvas.getContext('2d');
            
            expensesTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Expenses',
                        data: expensesData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#dc3545',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return 'Expenses: $' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering expenses trend chart:', error);
        }
    },

    /**
     * Render income vs expenses bar chart
     * @param {Array} labels - Month labels
     * @param {Array} incomeData - Income values
     * @param {Array} expensesData - Expense values
     */
    renderIncomeExpenses(labels, incomeData, expensesData) {
        const canvas = document.getElementById('incomeExpensesChart');
        if (!canvas) {
            console.warn('Income vs expenses chart canvas not found');
            return;
        }

        // Validate Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }

        // Validate data
        if (!Array.isArray(labels) || !Array.isArray(incomeData) || !Array.isArray(expensesData)) {
            console.warn('Invalid chart data provided');
            return;
        }

        // Destroy existing chart if it exists
        if (incomeExpensesChart) {
            incomeExpensesChart.destroy();
            incomeExpensesChart = null;
        }

        try {
            const ctx = canvas.getContext('2d');
            
            incomeExpensesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Income',
                            data: incomeData,
                            backgroundColor: 'rgba(40, 167, 69, 0.8)',
                            borderColor: '#28a745',
                            borderWidth: 2
                        },
                        {
                            label: 'Expenses',
                            data: expensesData,
                            backgroundColor: 'rgba(220, 53, 69, 0.8)',
                            borderColor: '#dc3545',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering income vs expenses chart:', error);
        }
    }
};

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Dashboard.init());
} else {
    // DOM is already ready
    Dashboard.init();
}

// Export for global access (if needed)
window.Dashboard = Dashboard;
window.loadDashboard = () => Dashboard.loadDashboard();

