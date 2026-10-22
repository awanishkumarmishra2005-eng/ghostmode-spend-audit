const $ = (id) => document.getElementById(id);
const DAY = 86400000;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

// Billing cycles. "tol" is how many days a gap may differ from the typical length.
const CYCLES = [
  { name: "Weekly", days: 7, tol: 2, perMonth: 52 / 12 },
  { name: "Monthly", days: 30.4, tol: 4, perMonth: 1 },
  { name: "Quarterly", days: 91.3, tol: 7, perMonth: 1 / 3 },
  { name: "Yearly", days: 365.25, tol: 15, perMonth: 1 / 12 },
];

// Words that vary between statements but do not identify the merchant.
const NOISE = /\b(pos|card|ref|txn|trx|upi|payment|pmt|ach|autopay|recurring|purchase|debit|inc|llc|ltd|pvt|limited|india|usa|online|www|com|in)\b/g;

const SAMPLE = `Date,Description,Amount
2026-01-01,GROCERY MART,-2310.50
2026-01-03,NETFLIX.COM 866-579-7172,-649.00
2026-01-05,SPOTIFY USA,-119.00
2026-01-12,DROPBOX*PLUS,-999.00
2026-01-14,FUEL STATION,-1800.00
2026-01-20,ADOBE *CREATIVE CLOUD,-1675.00
2026-02-03,NETFLIX.COM 866-579-7172,-649.00
2026-02-05,SPOTIFY USA,-119.00
2026-02-08,RESTAURANT BISTRO,-1450.00
2026-02-12,DROPBOX*PLUS,-999.00
2026-02-20,ADOBE *CREATIVE CLOUD,-1675.00
2026-03-03,NETFLIX.COM 866-579-7172,-649.00
2026-03-05,SPOTIFY USA,-119.00
2026-03-12,DROPBOX*PLUS,-999.00
2026-03-18,PHARMACY,-420.00
2026-03-20,ADOBE *CREATIVE CLOUD,-1675.00
2026-04-03,NETFLIX.COM 866-579-7172,-649.00
2026-04-05,SPOTIFY USA,-119.00
2026-04-11,GROCERY MART,-1980.00
2026-04-20,ADOBE *CREATIVE CLOUD,-1675.00
2026-05-03,NETFLIX.COM 866-579-7172,-699.00
2026-05-05,SPOTIFY USA,-119.00
2026-05-20,ADOBE *CREATIVE CLOUD,-1675.00
2026-05-22,REFUND NETFLIX,49.00
2026-06-03,NETFLIX.COM 866-579-7172,-699.00
2026-06-05,SPOTIFY USA,-119.00
2026-06-08,FUEL STATION,-1650.00
2026-06-20,ADOBE *CREATIVE CLOUD,-1675.00`;

let currentFindings = [];
let currentTemplates = [];
let currentReport = "";

function money(n) { return ($("symbol").value || "") + Number(n).toFixed(2); }
function dateStr(t) { return new Date(t).toISOString().slice(0, 10); }
function showError(msg) { $("error").textContent = msg; $("error").hidden = !msg; }
function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

function detectDelimiter(text) {
  const first = (text.split(/\r?\n/)[0] || "");
  return first.split(";").length > first.split(",").length ? ";" : ",";
}

// Small CSV parser that handles quoted fields with commas and doubled quotes.
function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

function parseDate(s, dayFirst) {
  s = String(s || "").trim();
  let y, mo, d, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    y = +m[1]; mo = +m[2]; d = +m[3];
  } else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
    const a = +m[1], b = +m[2];
    y = +m[3]; if (y < 100) y += 2000;
    d = dayFirst ? a : b; mo = dayFirst ? b : a;
  } else return NaN;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
  return Date.UTC(y, mo - 1, d);
}

// Keeps the sign. Assumes "." is the decimal point; European "1.234,56" is not supported yet.
function parseAmount(s) {
  const t = String(s || "").trim();
  if (!t) return NaN;
  const num = parseFloat(t.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return NaN;
  return /-|\(/.test(t) ? -num : num;
}

function merchantKey(desc) {
  let s = String(desc).toLowerCase().split("*")[0];
  s = s.replace(/[^a-z\s]/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
  return s.split(" ").slice(0, 3).join(" ") || String(desc).toLowerCase().slice(0, 20);
}

// Returns the best-fitting billing cycle, or null if the gaps are irregular.
function detectCycle(dates) {
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY);
  if (!gaps.length) return null;
  let best = null;
  for (const c of CYCLES) {
    const fit = gaps.filter(g => Math.abs(g - c.days) <= c.tol).length;
    if (fit / gaps.length >= 0.66 && (!best || fit > best.fit)) best = { cycle: c, fit };
  }
  return best ? { cycle: best.cycle, consistent: best.fit === gaps.length } : null;
}

function matchService(key, list) {
  const text = key + " " + list.map(t => t.desc.toLowerCase()).join(" ");
  return SERVICES.find(s => s.keywords.some(k => text.includes(k))) || null;
}

function cancelText(f) {
  return `Subject: Cancel my ${f.name} subscription

Hello,

Please cancel my ${f.name} subscription. My most recent charge was ${money(f.latest)} on ${dateStr(f.lastDate)}.

Please confirm in writing that the subscription is cancelled and that no further charges will be made.

Thank you,
[Your name]`;
}

function populateColumns() {
  const text = $("raw").value;
  if (!text.trim()) return;
  const rows = parseCSV(text, detectDelimiter(text));
  if (!rows.length) return;
  const headers = $("hasHeader").checked
    ? rows[0].map(h => h.trim())
    : rows[0].map((_, i) => "Column " + (i + 1));
  const opts = `<option value="-1">Choose...</option>` +
    headers.map((h, i) => `<option value="${i}">${esc(h || "Column " + (i + 1))}</option>`).join("");
  $("colDate").innerHTML = opts;
  $("colDesc").innerHTML = opts;
  $("colAmount").innerHTML = opts;
  const guess = (re) => {
    const i = headers.findIndex(h => re.test(h.toLowerCase()));
    return i < 0 ? -1 : i;
  };
  $("colDate").value = guess(/date|posted/);
  $("colDesc").value = guess(/desc|detail|narration|merchant|payee|particular|name/);
  $("colAmount").value = guess(/^amount|amount|debit|withdraw|amt/);
}

function analyze() {
  showError("");
  const text = $("raw").value;
  const rows = parseCSV(text, detectDelimiter(text));
  if (rows.length < 2) return showError("Need a header row and at least one data row.");

  const iDate = +$("colDate").value, iDesc = +$("colDesc").value, iAmt = +$("colAmount").value;
  if (iDate < 0 || iDesc < 0 || iAmt < 0) return showError("Choose the date, description and amount columns.");

  const dayFirst = $("dayFirst").checked;
  const data = $("hasHeader").checked ? rows.slice(1) : rows;
  const txns = [];
  let skipped = 0;
  for (const r of data) {
    const date = parseDate(r[iDate], dayFirst);
    const amount = parseAmount(r[iAmt]);
    const desc = (r[iDesc] || "").trim();
    if (isNaN(date) || isNaN(amount) || !desc) { skipped++; continue; }
    txns.push({ date, amount, desc });
  }
  if (!txns.length) return showError("No valid rows. Check the column choices and the day/month setting.");

  // Work out which sign means money leaving the account.
  let mode = $("spendMode").value;
  if (mode === "auto") {
    const negatives = txns.filter(t => t.amount < 0).length;
    mode = negatives >= txns.length / 2 ? "negative" : "positive";
  }
  const sign = mode === "negative" ? -1 : 1;
  const spends = txns.map(t => ({ ...t, spend: sign * t.amount })).filter(t => t.spend > 0);
  if (!spends.length) return showError("No spending rows found. Try changing 'Spending shows as'.");

  const referenceDate = Math.max(...txns.map(t => t.date));
  const groups = {};
  for (const t of spends) {
    const key = merchantKey(t.desc);
    (groups[key] = groups[key] || []).push(t);
  }

  const found = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);
    const det = detectCycle(list.map(t => t.date));
    if (!det) continue;

    const first = list[0].spend;
    const last = list[list.length - 1].spend;
    const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const lastDate = list[list.length - 1].date;
    const quietDays = (referenceDate - lastDate) / DAY;
    const stopped = quietDays > det.cycle.days * 2 + det.cycle.tol;

    let confidence;
    if (list.length >= 3 && det.consistent) confidence = "High";
    else if (list.length >= 3) confidence = "Medium";
    else confidence = "Low (2 charges)";

    found.push({
      key, name: titleCase(key), count: list.length,
      cycle: det.cycle.name, latest: last, changePct, lastDate, stopped, confidence,
      monthly: last * det.cycle.perMonth, transactions: list,
      service: matchService(key, list),
    });
  }
  found.sort((a, b) => b.monthly - a.monthly);
  currentFindings = found;
  render(found, referenceDate, skipped, txns.length, mode);
}

function render(found, referenceDate, skipped, validRows, mode) {
  const active = found.filter(f => !f.stopped);
  const activeMonthly = active.reduce((s, f) => s + f.monthly, 0);
  const rises = found.filter(f => !f.stopped && f.changePct > 2).length;
  const quiet = found.filter(f => f.stopped).length;

  $("summary").innerHTML = `
    <div class="stat">Recurring merchants<b>${active.length}</b></div>
    <div class="stat">Estimated monthly<b>${money(activeMonthly)}</b></div>
    <div class="stat">Estimated yearly<b>${money(activeMonthly * 12)}</b></div>
    <div class="stat">Price increases<b>${rises}</b></div>
    <div class="stat">No recent charge<b>${quiet}</b></div>`;

  $("notes").textContent =
    `Reference date (latest row in file): ${dateStr(referenceDate)}. Spending read as ${mode === "negative" ? "negative" : "positive"} numbers. ` +
    `${validRows} rows read${skipped ? `, ${skipped} skipped (check the date format or amount column)` : ""}. ` +
    `Only repeated, regular charges are listed.`;

  if (!found.length) {
    $("list").innerHTML = `<p class="muted">No recurring charges found. This can happen with fewer than two months of data.</p>`;
  } else {
    currentTemplates = found.map(f => cancelText(f));
    $("list").innerHTML = found.map((f, i) => {
      const flags = [];
      if (f.changePct > 2 && !f.stopped) flags.push(`<span class="flag">Price up ${f.changePct.toFixed(0)}%</span>`);
      if (f.stopped) flags.push(`<span class="flag quiet">No recent charge</span>`);
      if (f.count === 2) flags.push(`<span class="flag quiet">Only 2 charges</span>`);
      const svc = f.service
        ? `<p>Possible match: <strong>${esc(f.service.name)}</strong>. <a href="${esc(f.service.accountUrl)}" target="_blank" rel="noopener noreferrer">Account page</a> (${esc(f.service.lastChecked)}, confirm before using)</p>`
        : `<p class="muted small">No known service matched. Search the merchant name with "cancel subscription" on its website.</p>`;
      return `
        <details class="item">
          <summary>
            <span class="name">${esc(f.name)}</span>
            <span class="badge ${f.confidence === "High" ? "ok" : "warn"}">${esc(f.confidence)}</span>
            ${flags.join("")}
            <span class="amt">${money(f.monthly)}/mo</span>
          </summary>
          <div class="detail">
            <p>${esc(f.cycle)} · ${f.count} charges · latest ${money(f.latest)} · last charged ${dateStr(f.lastDate)}${f.stopped ? " · may have stopped" : ""}</p>
            ${svc}
            <p class="muted small">Matching transactions:</p>
            <ul>${f.transactions.map(t => `<li>${dateStr(t.date)} · ${esc(t.desc)} · ${money(t.spend)}</li>`).join("")}</ul>
            <p class="muted small">Cancellation request (edit before sending):</p>
            <pre>${esc(currentTemplates[i])}</pre>
            <button class="ghost" type="button" data-copy="${i}">Copy request</button>
          </div>
        </details>`;
    }).join("");
  }

  const lines = [
    "GhostMode recurring charge report",
    `Reference date: ${dateStr(referenceDate)}`,
    `Recurring merchants (active): ${active.length}`,
    `Estimated monthly total: ${money(activeMonthly)}`,
    `Estimated yearly total: ${money(activeMonthly * 12)}`,
    "",
    ...found.map(f => `- ${f.name}: ${money(f.monthly)}/month (${f.cycle}, ${f.confidence}${f.stopped ? ", no recent charge" : ""}${f.changePct > 2 && !f.stopped ? `, price up ${f.changePct.toFixed(0)}%` : ""})`),
    "",
    "Lead to review, not proof of a subscription. Verify against your own records.",
  ];
  currentReport = lines.join("\n");
  $("results").hidden = false;
}

function copyText(text, okMsg) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert(okMsg), () => fallbackCopy(text, okMsg));
  } else fallbackCopy(text, okMsg);
}
function fallbackCopy(text, okMsg) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); alert(okMsg); } catch { alert("Copy failed. Select the text and copy it manually."); }
  ta.remove();
}

function downloadCsv() {
  const header = "merchant,cycle,confidence,charges,latest,monthly_equivalent,last_charge,price_change_pct,no_recent_charge";
  const body = currentFindings.map(f => [
    `"${f.name.replace(/"/g, '""')}"`, f.cycle, f.confidence, f.count,
    f.latest.toFixed(2), f.monthly.toFixed(2), dateStr(f.lastDate),
    f.changePct.toFixed(1), f.stopped ? "yes" : "no",
  ].join(","));
  const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ghostmode-findings.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    $("raw").value = String(reader.result);
    populateColumns();
  };
  reader.readAsText(file);
}

// Events
$("file").addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });
$("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("over"); });
$("drop").addEventListener("dragleave", () => $("drop").classList.remove("over"));
$("drop").addEventListener("drop", (e) => {
  e.preventDefault();
  $("drop").classList.remove("over");
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
$("raw").addEventListener("change", populateColumns);
$("hasHeader").addEventListener("change", populateColumns);
$("analyze").addEventListener("click", analyze);
$("sample").addEventListener("click", () => { $("raw").value = SAMPLE; populateColumns(); analyze(); });
$("copyReport").addEventListener("click", () => copyText(currentReport, "Report copied."));
$("downloadCsv").addEventListener("click", downloadCsv);
document.addEventListener("click", (e) => {
  const i = e.target.dataset.copy;
  if (i !== undefined) copyText(currentTemplates[+i], "Cancellation request copied. Edit your name before sending.");
});
