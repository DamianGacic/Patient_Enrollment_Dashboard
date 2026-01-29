// Global variables
let enrollmentData = [];
let projectionData = null;
let charts = {};
let sortColumn = null;
let sortDirection = 'asc';

// API base URL
const API_BASE = 'http://localhost:3000/api';

// Initialize the dashboard
async function init() {
    await loadEnrollmentData();
    setupEventListeners();
    await updateProjections();
}

// Load enrollment data from API
async function loadEnrollmentData() {
    try {
        const response = await fetch(`${API_BASE}/enrollment`);
        enrollmentData = await response.json();
        console.log('Loaded enrollment data:', enrollmentData);
        populateCountryFilter();
        updateDataTable();
    } catch (error) {
        console.error('Error loading enrollment data:', error);
        alert('Failed to load enrollment data. Please ensure the server is running.');
    }
}

// Populate country filter dropdown
function populateCountryFilter() {
    const countryFilter = document.getElementById('countryFilter');
    const countries = [...new Set(enrollmentData.map(d => d.country))].sort();

    // Clear existing options except "All Countries"
    countryFilter.innerHTML = '<option value="all">All Countries</option>';

    // Add country options
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('updateProjections').addEventListener('click', updateProjections);
    document.getElementById('regionFilter').addEventListener('change', handleRegionChange);
    document.getElementById('countryFilter').addEventListener('change', filterData);

    // Add sorting to table headers
    const headers = document.querySelectorAll('#enrollmentTable thead th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
    });
}

// Handle region filter change
function handleRegionChange() {
    const selectedRegion = document.getElementById('regionFilter').value;
    const countryFilter = document.getElementById('countryFilter');

    // Update country filter based on region
    if (selectedRegion === 'all') {
        populateCountryFilter();
    } else {
        const countries = [...new Set(
            enrollmentData
                .filter(d => d.region === selectedRegion)
                .map(d => d.country)
        )].sort();

        countryFilter.innerHTML = '<option value="all">All Countries</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilter.appendChild(option);
        });
    }

    countryFilter.value = 'all';
    filterData();
}

// Filter data by region and country
function filterData() {
    updateDataTable();
    updateProjections();
}

// Update projections
async function updateProjections() {
    const targetPatients = parseInt(document.getElementById('targetPatients').value);
    const targetDate = document.getElementById('targetDate').value;
    const targetEnrollmentRate = parseFloat(document.getElementById('targetEnrollmentRate').value);
    const selectedRegion = document.getElementById('regionFilter').value;
    const selectedCountry = document.getElementById('countryFilter').value;
    const additionalSites = parseInt(document.getElementById('additionalSites').value) || 0;
    const rampUpMonths = parseInt(document.getElementById('rampUpMonths').value) || 6;
    const holidayImpact = document.getElementById('holidayImpact').checked;

    // DEBUG: Log the target enrollment rate being sent
    console.log('=== SENDING TO BACKEND ===');
    console.log('targetEnrollmentRate:', targetEnrollmentRate);

    // Filter data by region and country
    let filteredData = enrollmentData;
    if (selectedRegion !== 'all') {
        filteredData = filteredData.filter(d => d.region === selectedRegion);
    }
    if (selectedCountry !== 'all') {
        filteredData = filteredData.filter(d => d.country === selectedCountry);
    }

    // Calculate current enrollment rate from actual data
    const totalPts = filteredData.reduce((sum, s) => sum + s.current.patientsRandomized, 0);
    const totalSites = filteredData.reduce((sum, s) => sum + s.current.sitesOpen, 0);
    const totalMonths = filteredData.reduce((sum, s) => sum + s.current.monthsSitesOpen, 0);
    const currentEnrollmentRate = totalSites > 0 && totalMonths > 0
        ? totalPts / (totalSites * (totalMonths / filteredData.length))
        : 0.6;

    try {
        const response = await fetch(`${API_BASE}/projections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetPatients,
                targetDate,
                currentEnrollmentRate,
                targetEnrollmentRate,
                enrollmentData: filteredData,
                additionalSites,
                rampUpMonths,
                holidayImpact
            })
        });

        projectionData = await response.json();
        console.log('=== RECEIVED FROM BACKEND ===');
        console.log('LPLV date:', projectionData.lplv?.estimatedDate);
        console.log('Full projection data:', projectionData);

        updateSummaryStats();
        updateInsights();
        updateCharts();
    } catch (error) {
        console.error('Error updating projections:', error);
    }
}

// Update summary statistics
function updateSummaryStats() {
    if (!projectionData) return;

    document.getElementById('totalEnrolled').textContent = projectionData.summary.currentTotal;
    document.getElementById('totalPlanned').textContent = projectionData.summary.totalPlannedPatients;
    document.getElementById('percentComplete').textContent = projectionData.summary.percentComplete;
    document.getElementById('sitesActive').textContent = projectionData.summary.currentSitesOpen;
    document.getElementById('totalSites').textContent = projectionData.summary.totalPlannedSites;

    // Calculate weighted average current rate from actual data
    const selectedRegion = document.getElementById('regionFilter').value;
    const filteredData = selectedRegion === 'all'
        ? enrollmentData
        : enrollmentData.filter(d => d.region === selectedRegion);

    const totalPts = filteredData.reduce((sum, s) => sum + s.current.patientsRandomized, 0);
    const totalSites = filteredData.reduce((sum, s) => sum + s.current.sitesOpen, 0);
    const totalMonths = filteredData.reduce((sum, s) => sum + s.current.monthsSitesOpen, 0);

    // Calculate actual average rate
    const avgRate = totalSites > 0 && totalMonths > 0
        ? (totalPts / (totalSites * (totalMonths / filteredData.length))).toFixed(2)
        : '0.00';

    document.getElementById('currentRate').textContent = avgRate;
}

// Update insights panel
function updateInsights() {
    if (!projectionData) return;

    document.getElementById('requiredPtsPerMonth').textContent =
        projectionData.requirements.requiredPatientsPerMonth;
    document.getElementById('requiredPtsPerSitePerMonth').textContent =
        projectionData.requirements.requiredPatientsPerSitePerMonth;
    document.getElementById('sitesNeeded').textContent =
        projectionData.requirements.sitesNeededAtTargetRate;
    document.getElementById('lplvDate').textContent =
        new Date(projectionData.lplv.estimatedDate).toLocaleDateString();

    const lplvStatus = document.getElementById('lplvStatus');
    const targetDate = new Date(projectionData.summary.targetDate);
    const lplvDate = new Date(projectionData.lplv.estimatedDate);

    if (projectionData.lplv.onTrack) {
        lplvStatus.textContent = '✓ On track to meet target';
        lplvStatus.style.color = '#48bb78';
    } else {
        const monthsLate = Math.round((lplvDate - targetDate) / (1000 * 60 * 60 * 24 * 30));
        lplvStatus.textContent = `⚠ ${monthsLate} months behind target`;
        lplvStatus.style.color = '#f56565';
    }
}

// Sort table by column
function sortTable(columnIndex) {
    const selectedRegion = document.getElementById('regionFilter').value;
    let filteredData = selectedRegion === 'all'
        ? [...enrollmentData]
        : enrollmentData.filter(d => d.region === selectedRegion);

    // Determine sort direction
    if (sortColumn === columnIndex) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = columnIndex;
        sortDirection = 'asc';
    }

    // Sort data based on column
    filteredData.sort((a, b) => {
        let aVal, bVal;

        switch(columnIndex) {
            case 0: // Region
                aVal = a.region;
                bVal = b.region;
                break;
            case 1: // Country
                aVal = a.country;
                bVal = b.country;
                break;
            case 2: // Sites Planned
                aVal = a.planned.sites;
                bVal = b.planned.sites;
                break;
            case 3: // Sites Open
                aVal = a.current.sitesOpen;
                bVal = b.current.sitesOpen;
                break;
            case 4: // Patients Planned
                aVal = a.planned.patients;
                bVal = b.planned.patients;
                break;
            case 5: // Patients Enrolled
                aVal = a.current.patientsRandomized;
                bVal = b.current.patientsRandomized;
                break;
            case 6: // FPFV
                aVal = a.current.fpfv;
                bVal = b.current.fpfv;
                break;
            case 7: // Current Rate
                aVal = a.current.patientsPerSitePerMonth;
                bVal = b.current.patientsPerSitePerMonth;
                break;
            case 8: // Progress
                aVal = a.planned.patients > 0 ? (a.current.patientsRandomized / a.planned.patients * 100) : 0;
                bVal = b.planned.patients > 0 ? (b.current.patientsRandomized / b.planned.patients * 100) : 0;
                break;
            default:
                return 0;
        }

        // Handle string vs number comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        } else {
            return sortDirection === 'asc'
                ? aVal - bVal
                : bVal - aVal;
        }
    });

    // Update table with sorted data
    renderTable(filteredData);
    updateSortIndicators(columnIndex);
}

// Update sort indicators in table headers
function updateSortIndicators(columnIndex) {
    const headers = document.querySelectorAll('#enrollmentTable thead th');
    headers.forEach((header, index) => {
        // Remove existing indicators
        header.textContent = header.textContent.replace(' ▲', '').replace(' ▼', '');

        // Add indicator to sorted column
        if (index === columnIndex) {
            header.textContent += sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

// Render table with data
function renderTable(data) {
    const tbody = document.getElementById('enrollmentTableBody');
    tbody.innerHTML = '';

    data.forEach(site => {
        const progress = site.planned.patients > 0
            ? (site.current.patientsRandomized / site.planned.patients * 100).toFixed(1)
            : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${site.region}</td>
            <td>${site.country}</td>
            <td>${site.planned.sites}</td>
            <td>${site.current.sitesOpen}</td>
            <td>${site.planned.patients}</td>
            <td>${site.current.patientsRandomized}</td>
            <td>${site.current.fpfv}</td>
            <td>${site.current.patientsPerSitePerMonth.toFixed(2)}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                ${progress}%
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update data table
function updateDataTable(filterRegion = 'all') {
    const filteredData = filterRegion === 'all'
        ? enrollmentData
        : enrollmentData.filter(d => d.region === filterRegion);

    // Reset sort when filter changes
    sortColumn = null;
    sortDirection = 'asc';

    renderTable(filteredData);

    // Clear sort indicators
    const headers = document.querySelectorAll('#enrollmentTable thead th');
    headers.forEach(header => {
        header.textContent = header.textContent.replace(' ▲', '').replace(' ▼', '');
    });
}

// Update charts
function updateCharts() {
    if (!projectionData) return;

    updateProjectionChart();
    updatePlannedRegionChart();
    updateEnrolledRegionChart();
}

// Update projection chart
function updateProjectionChart() {
    const ctx = document.getElementById('projectionChart').getContext('2d');

    if (charts.projection) {
        charts.projection.destroy();
    }

    const labels = projectionData.monthlyProjection.map(p => p.date);
    const plannedData = projectionData.monthlyProjection.map(p => p.planned);
    const currentRateData = projectionData.monthlyProjection.map(p => p.currentRate);
    const targetRateData = projectionData.monthlyProjection.map(p => p.targetRate);

    charts.projection = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Planned Trajectory',
                    data: plannedData,
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Current Rate Projection',
                    data: currentRateData,
                    borderColor: '#f56565',
                    backgroundColor: 'rgba(245, 101, 101, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Target Rate Projection',
                    data: targetRateData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 11
                        }
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Cumulative Patients',
                        font: {
                            size: 11
                        }
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Shared state for region visibility
const regionVisibility = {
    'LATAM': true,
    'APAC': true,
    'EMEA': true
};

// Update planned region chart
function updatePlannedRegionChart() {
    const ctx = document.getElementById('plannedRegionChart').getContext('2d');

    if (charts.plannedRegion) {
        charts.plannedRegion.destroy();
    }

    // Aggregate data by region
    const regionOrder = ['LATAM', 'APAC', 'EMEA'];
    const regionColors = {
        'LATAM': 'rgba(102, 126, 234, 0.7)',
        'APAC': 'rgba(72, 187, 120, 0.7)',
        'EMEA': 'rgba(245, 101, 101, 0.7)'
    };
    const regionBorderColors = {
        'LATAM': '#667eea',
        'APAC': '#48bb78',
        'EMEA': '#f56565'
    };

    const regionData = {};
    regionOrder.forEach(region => {
        regionData[region] = { planned: 0, enrolled: 0 };
    });

    enrollmentData.forEach(site => {
        if (regionData[site.region]) {
            regionData[site.region].planned += site.planned.patients;
            regionData[site.region].enrolled += site.current.patientsRandomized;
        }
    });

    // Create separate datasets for each region to enable legend toggle
    const datasets = regionOrder.map(region => ({
        label: region,
        data: regionOrder.map(r => r === region ? regionData[region].planned : null),
        backgroundColor: regionColors[region],
        borderColor: regionBorderColors[region],
        borderWidth: 2,
        hidden: !regionVisibility[region]
    }));

    charts.plannedRegion = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: regionOrder,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    },
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const region = legendItem.text;

                        // Toggle visibility state
                        regionVisibility[region] = !regionVisibility[region];

                        // Update both charts
                        if (charts.plannedRegion) {
                            const meta = charts.plannedRegion.getDatasetMeta(index);
                            meta.hidden = !regionVisibility[region];
                            charts.plannedRegion.update();
                        }

                        if (charts.enrolledRegion) {
                            const enrolledMeta = charts.enrolledRegion.getDatasetMeta(index);
                            enrolledMeta.hidden = !regionVisibility[region];
                            charts.enrolledRegion.update();
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return context[0].dataset.label;
                        },
                        label: function(context) {
                            return context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Patients',
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Region',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update enrolled region chart
function updateEnrolledRegionChart() {
    const ctx = document.getElementById('enrolledRegionChart').getContext('2d');

    if (charts.enrolledRegion) {
        charts.enrolledRegion.destroy();
    }

    // Aggregate data by region
    const regionOrder = ['LATAM', 'APAC', 'EMEA'];
    const regionColors = {
        'LATAM': 'rgba(102, 126, 234, 0.7)',
        'APAC': 'rgba(72, 187, 120, 0.7)',
        'EMEA': 'rgba(245, 101, 101, 0.7)'
    };
    const regionBorderColors = {
        'LATAM': '#667eea',
        'APAC': '#48bb78',
        'EMEA': '#f56565'
    };

    const regionData = {};
    regionOrder.forEach(region => {
        regionData[region] = { planned: 0, enrolled: 0 };
    });

    enrollmentData.forEach(site => {
        if (regionData[site.region]) {
            regionData[site.region].planned += site.planned.patients;
            regionData[site.region].enrolled += site.current.patientsRandomized;
        }
    });

    const data = regionOrder.map(region => regionData[region].enrolled);

    // Find max enrolled value to determine step size
    const maxEnrolled = Math.max(...data);
    const stepSize = 50;
    const maxY = Math.ceil(maxEnrolled / stepSize) * stepSize + stepSize;

    // Create separate datasets for each region to enable legend toggle
    const enrolledDatasets = regionOrder.map(region => ({
        label: region,
        data: regionOrder.map(r => r === region ? regionData[region].enrolled : null),
        backgroundColor: regionColors[region],
        borderColor: regionBorderColors[region],
        borderWidth: 2,
        hidden: !regionVisibility[region]
    }));

    charts.enrolledRegion = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: regionOrder,
            datasets: enrolledDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    },
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const region = legendItem.text;

                        // Toggle visibility state
                        regionVisibility[region] = !regionVisibility[region];

                        // Update both charts
                        if (charts.plannedRegion) {
                            const plannedMeta = charts.plannedRegion.getDatasetMeta(index);
                            plannedMeta.hidden = !regionVisibility[region];
                            charts.plannedRegion.update();
                        }

                        if (charts.enrolledRegion) {
                            const meta = charts.enrolledRegion.getDatasetMeta(index);
                            meta.hidden = !regionVisibility[region];
                            charts.enrolledRegion.update();
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return context[0].dataset.label;
                        },
                        label: function(context) {
                            return context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxY,
                    ticks: {
                        stepSize: stepSize,
                        font: {
                            size: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Patients',
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Region',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update performance chart
function updatePerformanceChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    if (charts.performance) {
        charts.performance.destroy();
    }

    const countries = enrollmentData.map(site => site.country);
    const currentRates = enrollmentData.map(site => site.current.patientsPerSitePerMonth);
    const targetRate = parseFloat(document.getElementById('targetEnrollmentRate').value);

    // Color code based on performance vs target
    const backgroundColors = currentRates.map(rate =>
        rate >= targetRate ? 'rgba(72, 187, 120, 0.6)' : 'rgba(245, 101, 101, 0.6)'
    );

    charts.performance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countries,
            datasets: [
                {
                    label: 'Current Rate (pts/site/month)',
                    data: currentRates,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(c => c.replace('0.6', '1')),
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Patients per Site per Month'
                    }
                }
            }
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

