# 📊 Global Enrollment Dashboard for Study XYZ

A comprehensive, interactive web-based dashboard for tracking and projecting clinical trial enrollment across multiple global regions. Built with Node.js, Express, and Chart.js, this tool provides real-time insights into enrollment progress, site activation, and trajectory projections.

![Dashboard Overview](./screenshots/dashboard-overview.png)

## ✨ Features

### 📈 Real-Time Enrollment Tracking
- **Live enrollment statistics** across LATAM, APAC, EMEA, and North America
- **Progress monitoring** with visual indicators and percentage completion
- **Site activation tracking** showing active vs. planned sites
- **Current enrollment rate** calculations (patients/site/month)

![Summary Statistics](./screenshots/summary-statistics.png)

### 🎯 Interactive Visualizations

#### Enrollment Projection Chart
Track planned trajectory vs. actual enrollment rates with multiple projection scenarios:
- Planned trajectory (target: 4,050 patients by December 2027)
- Current rate projection
- Target rate projection

![Enrollment Projection](./screenshots/enrollment-projection.png)

#### Regional Enrollment Analysis
Side-by-side comparison of planned vs. current enrollment by region:
- **Planned Enrollment**: Standard Y-axis scaling
- **Current Enrollment**: Granular Y-axis (50-patient increments)
- **Interactive legends**: Click to show/hide specific regions
- **Synchronized controls**: Toggle regions across both charts simultaneously
- **Color-coded regions**: LATAM (Purple), APAC (Green), EMEA (Red)

![Regional Analysis](./screenshots/regional-analysis.png)

### 🔧 Scenario Modeling
Adjust key parameters to explore different enrollment scenarios:
- Target patient count
- Target completion date
- Current enrollment rate
- Target enrollment rate
- Region filtering (All, LATAM, APAC, EMEA, North America)

### 📋 Detailed Data Table
- **Sortable columns**: Click any header to sort by that metric
- **Visual progress bars**: Quick visual reference for enrollment progress
- **Comprehensive metrics**: Sites, patients, FPFV dates, enrollment rates
- **Region filtering**: Focus on specific geographic areas

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd demo1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Prepare your data**
   - Place your enrollment data in `study-enrolment.xlsx` in the root directory
   - The Excel file should contain columns for: Country, Sites Planned, Patients Planned, FPFV, Sites Open, Patients Randomized, and enrollment rates

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the dashboard**
   - Navigate to `http://localhost:3000` in your web browser

## 💡 Usage

### Viewing Enrollment Data
- **Summary cards** at the top show key metrics at a glance
- **Detailed table** displays all site-level enrollment data
- **Click column headers** to sort by any metric

### Analyzing Projections
- Review the **Enrollment Projection** chart to see trajectory comparisons
- Use the **Regional Analysis** charts to compare planned vs. current enrollment
- **Click legend items** to show/hide specific regions

### Running Scenarios
- Adjust parameters in the **Scenario Modeling** panel
- Click **"Update Projections"** to recalculate
- Review **Key Insights** for required rates and LPLV estimates

## 📊 Key Metrics Explained

### Enrollment Progress
- **Current enrolled / Total planned patients**
- Shows overall study progress as a percentage

### Current Enrollment Rate
- **pts/site/month**: Average number of patients enrolled per site per month
- Calculated from actual enrollment data
- Baseline: ~0.6 pts/site/month

### Required Enrollment Rate
- Rate needed to reach target by completion date
- Calculated based on:
  - Remaining patients needed
  - Months until target date
  - Currently active sites

### Sites Needed
- Number of active sites required to meet target at specified enrollment rate
- Helps plan site activation timeline

### LPLV (Last Patient Last Visit)
- Projected completion date based on current enrollment rate
- Indicates if study is on track (green) or behind schedule (red)

## 📁 Project Structure

```
demo1/
├── server.js              # Express backend server
├── package.json           # Project dependencies
├── study-enrolment.xlsx   # Enrollment data (Excel format)
├── public/
│   ├── index.html        # Dashboard UI
│   ├── app.js            # Frontend logic & chart rendering
│   └── styles.css        # Styling and responsive design
├── screenshots/           # Dashboard screenshots (for README)
│   ├── dashboard-overview.png
│   ├── summary-statistics.png
│   ├── enrollment-projection.png
│   └── regional-analysis.png
└── README.md             # This file
```

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Excel Parsing**: xlsx library
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Charts**: Chart.js
- **API**: RESTful endpoints with CORS support

## 🎨 Features Highlights

- ✅ Fully responsive design (works on desktop, tablet, and mobile)
- ✅ Interactive charts with hover tooltips
- ✅ Real-time scenario modeling
- ✅ Sortable data tables
- ✅ Region-based filtering
- ✅ Color-coded regional data (LATAM: Purple, APAC: Green, EMEA: Red)
- ✅ Synchronized chart controls

## 📝 API Endpoints

### `GET /api/enrollment`
Returns all enrollment data from the Excel file.

**Response:**
```json
[
  {
    "region": "LATAM",
    "country": "Chile",
    "planned": { "sites": 10, "patients": 300, "patientsPerSite": 30 },
    "current": { "fpfv": "01-Jul-25", "sitesOpen": 5, "patientsRandomized": 15, ... }
  },
  ...
]
```

### `POST /api/projections`
Calculates enrollment projections based on provided parameters.

**Request Body:**
```json
{
  "targetPatients": 4050,
  "targetDate": "2027-12-31",
  "currentEnrollmentRate": 0.6,
  "targetEnrollmentRate": 1.0,
  "enrollmentData": [...]
}
```

**Response:**
```json
{
  "summary": {
    "currentTotal": 108,
    "percentComplete": 2.7,
    "currentSitesOpen": 39,
    ...
  },
  "insights": {
    "requiredRatePerSite": 1.2,
    "sitesNeeded": 85,
    "estimatedLPLV": "2030-05-15",
    ...
  },
  "monthlyProjection": [...]
}
```

## 🔧 Customization

### Adjusting Target Metrics
- Use the **Scenario Modeling** panel to modify targets in real-time
- Update `targetPatients` for different enrollment goals
- Change `targetDate` for different study timelines

### Adding Regions
- Update the Excel file with new regions
- Dashboard will automatically detect and display them
- Colors will be assigned automatically

### Styling
- Edit `public/styles.css` to customize colors and layout
- Modify the gradient in the h1 style for different header colors
- Adjust chart colors in `public/app.js`

## 🐛 Troubleshooting

**Server won't start**
- Ensure Node.js is installed (`node --version`)
- Check that port 3000 is available
- Verify all dependencies are installed (`npm install`)

**Data not loading**
- Confirm `study-enrolment.xlsx` is in the root directory
- Check Excel file format matches expected structure
- Review browser console for errors (F12)

**Charts not displaying**
- Ensure Chart.js CDN is accessible
- Check browser console for JavaScript errors
- Verify data is being returned from API (`/api/enrollment`)

## 🚀 Future Enhancements

- 📤 Export projections to PDF/Excel
- 📧 Email alerts for enrollment milestones
- 📈 Historical trend analysis
- 📅 Holiday calendar integration
- 👥 Multi-user access with authentication
- 🔄 Real-time data sync with clinical trial management systems
- 📱 Mobile app version

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 👥 Authors

Built for clinical trial enrollment tracking and projection analysis.

---

**Note**: Create a `screenshots` folder and add your dashboard screenshots:
- `dashboard-overview.png` - Full dashboard view
- `summary-statistics.png` - Summary cards section
- `enrollment-projection.png` - Projection chart
- `regional-analysis.png` - Regional comparison charts

