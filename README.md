# GramVision

District and village data analysis, running entirely on your own Mac. Sign in and
the bundled **Surat Census 2026 Primary Census Abstract** (2,000 enumeration
blocks, 53 columns) is already charted — no upload, no setup wizard, no cloud
service. Every chart carries a written reading underneath, produced from the same
numbers the chart draws.

---

## Run it on macOS

### What you need

| | Minimum | Check with |
|---|---|---|
| macOS | 12 Monterey or newer | — |
| Python | 3.10 or newer | `python3 --version` |
| Node.js | 18 or newer | `node --version` |

If either is missing, install them with [Homebrew](https://brew.sh):

```bash
brew install python node
```

### 1. One-time setup

Open **Terminal**, go to the project folder, and run the setup script:

```bash
cd ~/Downloads/gramvision
chmod +x scripts/*.sh
./scripts/setup-macos.sh
```

That creates a Python virtual environment in `backend/.venv`, installs the Python
packages, installs the frontend packages, and copies `.env.example` to
`backend/.env`.

<details>
<summary>Prefer to run the steps yourself?</summary>

```bash
cd ~/Downloads/gramvision/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env

cd ../frontend
npm install
```
</details>

### 2. Start it

GramVision runs as two processes, so you need **two Terminal tabs**
(`Cmd` + `T` opens a new one).

**Tab 1 — the backend:**

```bash
cd ~/Downloads/gramvision
./scripts/start-backend.sh
```

Wait for `Application startup complete`. The API is now on
<http://127.0.0.1:8000>, and <http://127.0.0.1:8000/docs> lists every endpoint.

**Tab 2 — the app:**

```bash
cd ~/Downloads/gramvision
./scripts/start-frontend.sh
```

Open <http://127.0.0.1:5173> in your browser.

> Leave both tabs running while you use GramVision. Closing a tab stops that half
> of the app. `Ctrl` + `C` in a tab stops it cleanly.

### 3. Create your account

On first run, choose **Create an account**. The account lives in a SQLite file on
your Mac — there is no sign-up email and nothing leaves the machine. Use any email
address you will remember; it identifies the account and receives password-reset
codes once SMTP is configured.

Straight after signing in, the Overview page shows the Surat headcount and the
five dashboards are ready. Nothing needs uploading first.

---

## What is in the app

### Five Surat dashboards

Each page picks the columns it needs from whichever dataset is selected in the top
bar, draws the charts, and writes out what the numbers say.

| Page | What it charts |
|---|---|
| **Population** | Headcount by zone, men against women, sex ratio against parity, growth since the 2011 baseline, people per household, Scheduled Caste and Tribe share, and how block sizes are distributed |
| **Education** | Literacy rate by zone, male against female literacy, where the gender gap is widest, literate against illiterate headcounts, literacy against work participation, and the spread across blocks |
| **Occupation** | The mix of main work, the district-wide share of each work category, work participation by zone and by sex, main against marginal against non-workers, and how much work is seasonal |
| **Agriculture** | Agricultural workers by zone, the farming share of the workforce, cultivators against labourers, rural against urban farm dependency, land-holding farmers within farm work, and farm dependency against literacy |
| **Infrastructure** | Households by zone, how crowded homes are, people added since 2011, rural and urban housing stock, workshops inside homes, and households against population |

### The reading under every chart

Each chart card ends with a short written reading, generated from the aggregated
values on screen. It names the highest and lowest groups with their figures, the
size of the gap between them, the average and the midpoint, how concentrated or
evenly spread the measure is, and anything more than two standard deviations from
the average. For a scatter plot it reports the correlation and what it does and
does not imply; for a histogram, the busiest band and which way the distribution
leans; for a trend, the direction and the size of the change.

Rates and shares are never added together. A page comparing male and female
literacy reports the two averages and the gap in **percentage points**, because
summing percentages across zones would mean nothing.

### Chart builder

**Chart builder** in the sidebar opens whatever dataset is selected, with full
control:

- **Chart type** — ranked bars, ranked dots, column chart, line, area, stacked
  bars, grouped bars, pie, doughnut, scatter plot, histogram
- **Group by** — any column that classifies rows
- **Measure** — any column that holds numbers which vary, or several at once for
  stacked and grouped charts
- **Combine values by** — adding up, averaging, or counting records
- **Filters** — two at a time, on any column
- **Order and limit** — largest first, smallest first, by name, and how many
  groups to show
- **Chart title** — follows the chart until you write your own

Every card also offers a **Table** view of the same numbers, and **PNG** and
**CSV** export. **Save this chart** keeps the whole configuration — it reopens
exactly as you left it, next time you sign in.

### Sensible axes, every time

GramVision never guesses axes from a list of expected column names. It reads the
values and sorts every column into one of five roles:

| Role | Example in the census file | Can it go on an axis? |
|---|---|---|
| Constant | `District_Name`, always "Surat" | No — one bar is not a chart |
| Identifier | `Record_ID`, different on every row | No — 2,000 groups of one |
| Reference code | `SMC_Zone_Code` | Not as a measurement |
| Grouping | `SMC_Zone_Name`, `TRU`, `Area_Name` | Yes, as the category |
| Measurement | `TOT_P`, `No_HH`, `Effective_Literacy_Rate_Pct` | Yes, as the measure |

It then scores the candidates, preferring groupings with four to thirty values
over near-unique ones, and headline measures over their male/female halves. In the
builder, **Show how these columns were sorted** lists the columns it set aside and
why.

### Indicators worked out from the file

Where the columns allow it, GramVision derives further indicators and labels them
as such — male and female literacy rates, the literacy gender gap, average
household size, work participation by sex, the marginal share of workers,
agricultural workers and their share of the workforce, people added since 2011,
and more. Each rule runs only when every column it needs is present, so an
uploaded file gets exactly the indicators it can support and no others.

---

## Your own data

**Upload a file** takes a CSV, XLSX or XLS up to 20 MB, with column names in the
first row. GramVision profiles the columns and draws a first set of charts
immediately — a ranked comparison, a trend if there is a time column, the main
measures side by side, a scatter plot, a distribution, and a second way of cutting
the data.

Once uploaded, pick your file in the **Charting** selector at the top of any page
and the five dashboards re-draw against it. A dashboard that finds none of its own
columns says so plainly and charts what your file does contain instead.

### What the census file does not carry

The bundled dataset is a Primary Census Abstract: it counts **people**, not fields
or assets. It holds no crop, land-area, irrigation, road, water, sanitation or
facility columns, and GramVision does not invent them.

- **Agriculture** therefore charts the agrarian workforce the census does record —
  cultivators, agricultural labourers, and farm dependency by zone and by
  settlement type.
- **Infrastructure** charts housing stock and growth, which is where service demand
  comes from.

Both pages say this on screen and list the columns they would chart if present.
Upload a dataset with real crop or amenity columns and those pages lead with them
automatically.

### Comparing datasets

**Compare datasets** lines up two datasets on every numeric column they share and
reports each average, the difference and the percentage change. The built-in
dataset can be compared directly — it does not need copying into your library
first.

### Practice data

**Practice data** generates clearly-labelled synthetic records for trying out
charts and exports. Every row carries a `SIMULATED DATA — NOT OFFICIAL STATISTICS`
marker, and the label follows it into the PDF export.

---

## Exports

| From | Gives you |
|---|---|
| Any chart card, **PNG** | The chart as a 2× image with its title |
| Any chart card, **CSV** | The exact numbers behind that chart |
| **My datasets**, **CSV** | The dataset as it was uploaded |
| **My datasets**, **Excel** | The same data as `.xlsx` |
| **My datasets**, **PDF** | A report: the overview, the written readings, data-quality checks and every numeric column's mean, minimum and maximum |

---

## Password reset by email

Resetting a forgotten password needs an SMTP server. Without one, the rest of the
app works normally; only the reset and password-change codes will fail.

Edit `backend/.env` and fill in your provider's details:

```ini
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-login
SMTP_PASSWORD=your-smtp-key
SMTP_FROM_EMAIL=a-verified-sender@example.com
SMTP_FROM_NAME=GramVision
```

Restart the backend afterwards. `GET /api/auth/email-status` reports whether the
settings are complete without revealing them.

Also set a real `SECRET_KEY` in `backend/.env` — it signs the sign-in tokens:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Where your work is kept

| | Path |
|---|---|
| Accounts, dataset records, saved charts | `backend/gramvision.db` |
| Uploaded files | `backend/uploads/` |
| The bundled census file | `backend/data/Surat_Census_2026_PCA_2000_Sample.csv` |

Nothing is sent anywhere. To back up, stop the backend and copy
`backend/gramvision.db` **and** `backend/uploads/` together — restoring one
without the other leaves dataset records pointing at files that are not there.

Upgrading from an earlier version keeps your database: missing columns are added
on startup, so existing accounts, uploads and saved charts carry over.

---

## Testing

**Backend** — 26 tests covering column profiling, the written readings, the
built-in dataset, uploads, exports, comparison and account isolation:

```bash
cd backend
source .venv/bin/activate
python -m pytest -q
```

**Frontend build:**

```bash
cd frontend
npm run build
```

**By hand, once both are running:** sign in, confirm the Overview headcount reads
91,76,301, open each of the five dashboards and check every chart has a reading
below it, switch a chart type in the builder, save a chart and reopen it from
**Saved charts**, then upload a CSV of your own and confirm charts appear without
any further configuration.

---

## If something goes wrong

**"Cannot reach the GramVision backend"** — Tab 1 is not running, or it stopped.
Start it again and look for `Application startup complete`.

**`Address already in use`** — something else holds the port. Find and stop it:

```bash
lsof -ti:8000 | xargs kill   # or :5173 for the frontend
```

**`command not found: python3`** — install it with `brew install python`, then
open a new Terminal tab so the path updates.

**`zsh: permission denied: ./scripts/...`** — run `chmod +x scripts/*.sh` once.

**"The built-in dataset file is missing from backend/data"** — the CSV was moved
or deleted. Restore
`backend/data/Surat_Census_2026_PCA_2000_Sample.csv`, or upload your own copy from
the **Upload a file** page.

**A chart page says it found no columns it recognises** — the dataset selected in
the top bar is not the census file. Switch back to **Surat Census 2026** in the
**Charting** selector.

**Charts look empty after a filter** — the filter removed every row with a number
in that column. Clear it in the builder's Filters section.

---

## Project layout

```
gramvision/
├── backend/
│   ├── app/
│   │   ├── analytics/
│   │   │   ├── profiling.py     column roles, axis scoring
│   │   │   ├── interpret.py     written readings
│   │   │   ├── aggregate.py     server-side grouping
│   │   │   └── analysis.py      dataset summary and chart suggestions
│   │   ├── api/
│   │   │   ├── auth.py          register, sign in, password reset
│   │   │   ├── data.py          uploads, saved charts, comparison, exports
│   │   │   └── builtin.py       the bundled dataset, no upload needed
│   │   ├── core/                settings, database, tokens
│   │   ├── models/              SQLAlchemy tables
│   │   └── services/            built-in sources, PDF report, email
│   ├── data/                    the bundled census CSV
│   ├── tests/                   pytest suite
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── profile.js       column roles in the browser
│       │   ├── interpret.js     the reading under every chart
│       │   ├── aggregate.js     grouping, histograms, scatter points
│       │   ├── derive.js        indicators worked out from the file
│       │   ├── topics.js        the five dashboards and their charts
│       │   ├── chartData.js     one spec to one drawable chart
│       │   └── palette.js       the validated chart colours
│       ├── components/          chart renderer, chart card, app shell
│       ├── views/               one file per page
│       └── pages/               sign-in and the workspace
├── scripts/                     macOS setup and start scripts
└── README.md
```

## A note on the charts

The eight categorical colours were validated as an ordered set against a white
chart surface: every neighbouring pair stays distinguishable under protanopia,
deuteranopia and tritanopia as well as for full-colour vision. Colours are
assigned in a fixed order and never cycled. Rates that sit in a narrow band far
from zero are drawn as ranked dots rather than bars, because a bar chart claims a
zero baseline that those values do not have. Every chart has a table view, so no
value is reachable only by hovering.
