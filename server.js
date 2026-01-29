const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Read and parse Excel file
function readEnrollmentData() {
  const workbook = XLSX.readFile('study-enrolment.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with raw: false to get formatted values
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

  // Parse the data structure
  const enrollmentData = [];
  let currentRegion = '';

  for (let i = 2; i < rawData.length; i++) { // Start from row 2 (skip headers)
    const row = rawData[i];

    // Skip empty rows
    if (!row || row.length === 0 || !row[0]) continue;

    // Check if this is a region header (LATAM, APAC, EMEA, North America)
    if (row.length === 1 || !row[1]) {
      const regionName = row[0].trim();
      if (['LATAM', 'APAC', 'EMEA', 'North America'].includes(regionName)) {
        currentRegion = regionName;
      }
      continue;
    }

    // This is a country row with data
    if (row[0] && currentRegion && row[1]) {
      const parseNumber = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };

      enrollmentData.push({
        region: currentRegion,
        country: row[0].trim(),
        planned: {
          sites: parseNumber(row[1]),
          patients: parseNumber(row[2]),
          patientsPerSite: parseNumber(row[3])
        },
        current: {
          fpfv: row[5] || '',
          monthsSitesOpen: parseNumber(row[6]),
          sitesOpen: parseNumber(row[7]),
          patientsRandomized: parseNumber(row[8]),
          patientsPerMonth: parseNumber(row[9]),
          patientsPerSite: parseNumber(row[10]),
          patientsPerSitePerMonth: parseNumber(row[11])
        }
      });
    }
  }

  return enrollmentData;
}

// API endpoint to get enrollment data
app.get('/api/enrollment', (req, res) => {
  try {
    const data = readEnrollmentData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to calculate projections
app.post('/api/projections', (req, res) => {
  try {
    const {
      targetPatients = 4050,
      targetDate = '2027-12-31',
      currentEnrollmentRate = 0.6,
      targetEnrollmentRate = 1.0,
      enrollmentData,
      additionalSites = 0,
      rampUpMonths = 6,
      holidayImpact = true
    } = req.body;

    // Calculate current totals
    const currentTotal = enrollmentData.reduce((sum, site) =>
      sum + (site.current.patientsRandomized || 0), 0);

    const currentSitesOpen = enrollmentData.reduce((sum, site) =>
      sum + (site.current.sitesOpen || 0), 0);

    const totalPlannedSites = enrollmentData.reduce((sum, site) =>
      sum + (site.planned.sites || 0), 0);

    const totalPlannedPatients = enrollmentData.reduce((sum, site) =>
      sum + (site.planned.patients || 0), 0);

    // Calculate remaining patients
    const remainingPatients = targetPatients - currentTotal;

    // Calculate months until target date
    const today = new Date();
    const target = new Date(targetDate);
    const monthsRemaining = Math.max(0,
      (target.getFullYear() - today.getFullYear()) * 12 +
      (target.getMonth() - today.getMonth()));

    // Calculate required enrollment rate
    const requiredPatientsPerMonth = monthsRemaining > 0 ?
      remainingPatients / monthsRemaining : 0;
    
    const requiredPatientsPerSitePerMonth = currentSitesOpen > 0 ?
      requiredPatientsPerMonth / currentSitesOpen : 0;

    // Helper function to check if month is holiday period (Dec or Jan)
    const isHolidayMonth = (date) => {
      const month = date.getMonth();
      return month === 11 || month === 0; // December (11) or January (0)
    };

    // Generate monthly projection with ramp-up and holiday impact
    const monthlyProjection = [];
    let cumulativePatients = currentTotal;
    let cumulativeCurrentRate = currentTotal;
    let cumulativeTargetRate = currentTotal;

    // Calculate max projection period - extend beyond target date to find LPLV
    // Estimate based on target rate: if we need 4000 patients and can enroll 50/month, we need 80 months
    const estimatedMonthsNeeded = targetEnrollmentRate > 0 && (currentSitesOpen + additionalSites) > 0
      ? Math.ceil(remainingPatients / (targetEnrollmentRate * (currentSitesOpen + additionalSites) * 0.9)) // 0.9 accounts for holidays
      : 120;
    const maxProjectionMonths = Math.min(Math.max(monthsRemaining + 12, estimatedMonthsNeeded), 120);

    for (let month = 0; month <= maxProjectionMonths; month++) {
      const projectionDate = new Date(today);
      projectionDate.setMonth(projectionDate.getMonth() + month);

      // Planned trajectory (linear to target)
      const plannedCumulative = currentTotal + (remainingPatients * month / monthsRemaining);

      // Calculate effective sites (gradually add additional sites over ramp-up period)
      let effectiveSites = currentSitesOpen;
      if (month > 0 && additionalSites > 0) {
        const sitesAddedSoFar = Math.min(additionalSites, (additionalSites * month) / Math.max(rampUpMonths, 1));
        effectiveSites = currentSitesOpen + sitesAddedSoFar;
      }

      // Calculate effective enrollment rate with ramp-up
      // Uses targetEnrollmentRate (user's selected target rate from UI)
      let effectiveEnrollmentRate = currentEnrollmentRate;
      if (month > 0 && month <= rampUpMonths) {
        // Linear ramp from current to target enrollment rate
        const rampProgress = month / rampUpMonths;
        effectiveEnrollmentRate = currentEnrollmentRate + (targetEnrollmentRate - currentEnrollmentRate) * rampProgress;
      } else if (month > rampUpMonths) {
        // After ramp-up, use full target enrollment rate
        effectiveEnrollmentRate = targetEnrollmentRate;
      }

      // Apply holiday impact (20% reduction in Dec/Jan)
      let holidayFactor = 1.0;
      if (holidayImpact && isHolidayMonth(projectionDate)) {
        holidayFactor = 0.8; // 20% reduction
      }

      // Calculate monthly enrollment for current rate (with ramp-up and holidays)
      if (month > 0) {
        const monthlyEnrollment = currentEnrollmentRate * currentSitesOpen * holidayFactor;
        cumulativeCurrentRate += monthlyEnrollment;
      }

      // Calculate monthly enrollment for target rate (with ramp-up, additional sites, and holidays)
      if (month > 0) {
        const monthlyEnrollment = effectiveEnrollmentRate * effectiveSites * holidayFactor;
        cumulativeTargetRate += monthlyEnrollment;
      }

      monthlyProjection.push({
        month: month,
        date: projectionDate.toISOString().split('T')[0],
        planned: Math.min(plannedCumulative, targetPatients),
        currentRate: Math.min(cumulativeCurrentRate, targetPatients),
        targetRate: Math.min(cumulativeTargetRate, targetPatients)  // cumulative patients at target enrollment rate
      });

      // Stop projecting if we've reached the target with all scenarios
      if (cumulativeTargetRate >= targetPatients &&
          cumulativeCurrentRate >= targetPatients &&
          plannedCumulative >= targetPatients) {
        break;
      }
    }

    // =================================================================
    // DIRECT LPLV CALCULATION USING TARGET ENROLLMENT RATE
    // This is a simple, direct calculation that MUST change with targetEnrollmentRate
    // =================================================================

    console.log('=== LPLV CALCULATION DEBUG ===');
    console.log('targetEnrollmentRate received:', targetEnrollmentRate);
    console.log('currentSitesOpen:', currentSitesOpen);
    console.log('additionalSites:', additionalSites);
    console.log('remainingPatients:', remainingPatients);

    // Simple direct calculation: months = remainingPatients / (rate * sites)
    const effectiveTotalSites = currentSitesOpen + additionalSites;
    const monthlyPatientsAtTargetRate = targetEnrollmentRate * effectiveTotalSites;

    // Account for holidays (reduce by ~17% for 2 holiday months per year)
    const holidayAdjustment = holidayImpact ? 0.83 : 1.0;
    const adjustedMonthlyPatients = monthlyPatientsAtTargetRate * holidayAdjustment;

    // Calculate months to complete at target rate
    let monthsToCompleteAtTargetRate;
    if (adjustedMonthlyPatients > 0) {
      monthsToCompleteAtTargetRate = Math.ceil(remainingPatients / adjustedMonthlyPatients);
    } else {
      monthsToCompleteAtTargetRate = 999; // Impossible to complete
    }

    console.log('monthlyPatientsAtTargetRate:', monthlyPatientsAtTargetRate);
    console.log('adjustedMonthlyPatients:', adjustedMonthlyPatients);
    console.log('monthsToCompleteAtTargetRate:', monthsToCompleteAtTargetRate);

    // Calculate LPLV date by adding months to today
    const lplvDate = new Date();
    lplvDate.setMonth(lplvDate.getMonth() + monthsToCompleteAtTargetRate);

    console.log('LPLV date calculated:', lplvDate.toISOString().split('T')[0]);
    console.log('=== END LPLV DEBUG ===')

    // Calculate sites needed at target enrollment rate (accounting for ramp-up and holidays)
    let sitesNeededAtTargetRate = currentSitesOpen + additionalSites;

    // Check if we'll reach the target with current settings
    const willReachTarget = monthlyProjection.some(p => p.targetRate >= targetPatients);

    if (!willReachTarget) {
      // Need more sites - estimate based on shortfall
      const lastProjection = monthlyProjection[monthlyProjection.length - 1];
      const shortfall = targetPatients - lastProjection.targetRate;
      const avgMonthlyRate = targetEnrollmentRate * 0.9; // Account for holidays
      const additionalSitesNeeded = Math.ceil(shortfall / (avgMonthlyRate * 12));
      sitesNeededAtTargetRate = currentSitesOpen + additionalSites + additionalSitesNeeded;
    }

    res.json({
      summary: {
        currentTotal,
        targetPatients,
        totalPlannedPatients,
        remainingPatients,
        percentComplete: (currentTotal / totalPlannedPatients * 100).toFixed(1),
        percentOfStudyTarget: (currentTotal / targetPatients * 100).toFixed(1),
        currentSitesOpen,
        totalPlannedSites,
        sitesRemaining: totalPlannedSites - currentSitesOpen,
        monthsRemaining,
        targetDate
      },
      requirements: {
        requiredPatientsPerMonth: requiredPatientsPerMonth.toFixed(2),
        requiredPatientsPerSitePerMonth: requiredPatientsPerSitePerMonth.toFixed(2),
        sitesNeededAtTargetRate,
        additionalSitesNeeded: Math.max(0, sitesNeededAtTargetRate - currentSitesOpen)
      },
      lplv: {
        monthsToComplete: monthsToCompleteAtTargetRate.toFixed(1),
        estimatedDate: lplvDate.toISOString().split('T')[0],
        onTrack: monthsToCompleteAtTargetRate <= monthsRemaining
      },
      monthlyProjection
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

