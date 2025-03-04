// Global chart variables
let sensitivityChart = null;
let summaryChart = null;

/* ---------- Utility Functions ---------- */
function calculateRiskLevel(metric, metricMin, metricMax) {
  const mid = (metricMin + metricMax) / 2;
  const alpha = 10 / (metricMax - metricMin);
  const sigmoid = 1 / (1 + Math.exp(-alpha * (metric - mid)));
  return 1 + 9 * sigmoid;
}

function riskLabel(riskLevel) {
  if (riskLevel <= 3) return "Favorable";
  if (riskLevel <= 7) return "Neutral";
  return "Risk";
}

function recommendedHoldingPeriod(riskLevel, T_days) {
  return Math.round(T_days - ((riskLevel - 1) / 9) * (T_days - 1));
}

/* ---------- Trade Logging ---------- */
function logTrade(tradeData) {
  let tradeHistory = JSON.parse(localStorage.getItem("tradeHistory") || "[]");
  tradeHistory.push(tradeData);
  localStorage.setItem("tradeHistory", JSON.stringify(tradeHistory));
}

/* ---------- Calculator Functions ---------- */
function toggleSection() {
  const model = document.getElementById('modelSelect').value;
  document.getElementById('simpleSection').style.display = (model === 'simple') ? 'block' : 'none';
  document.getElementById('advancedSection').style.display = (model === 'advanced') ? 'block' : 'none';
  document.getElementById('customSection').style.display = (model === 'custom') ? 'block' : 'none';
}

function getTradeFactor(tradeInputId) {
  const tradeValue = document.getElementById(tradeInputId).value;
  return (tradeValue === "buy") ? 1 : -1;
}

function getTypeFactor(typeInputId) {
  const typeValue = document.getElementById(typeInputId).value;
  return (typeValue === "call") ? 1.0 : 1.1;
}

/* ---------- Simple Model Calculation ---------- */
function calculateSimple() {
  const P = parseFloat(document.getElementById('s_price').value);
  const delta = parseFloat(document.getElementById('s_delta').value);
  const atr = parseFloat(document.getElementById('s_atr').value);
  const T_days = parseFloat(document.getElementById('s_tdays').value);
  const iv = parseFloat(document.getElementById('s_iv').value);
  const tradeFactor = getTradeFactor("simpleTrade");
  const typeFactor = getTypeFactor("simpleType");
  const T_factor = 1 / (1 + Math.exp((T_days - 30) / 5));
  
  const riskMetric = (delta * atr * tradeFactor * typeFactor * (iv / 100)) / P * T_factor;
  const numericRiskLevel = calculateRiskLevel(riskMetric, 0.1, 0.5);
  const autoRiskLabel = riskLabel(numericRiskLevel);
  const holdingPeriod = recommendedHoldingPeriod(numericRiskLevel, T_days);
  
  const maxRisk = parseFloat(document.getElementById('s_maxRisk').value);
  const multiplier = parseFloat(document.getElementById('s_multiplier').value);
  
  let stopLoss, takeProfit;
  if (document.getElementById('simpleTrade').value === "buy") {
    stopLoss = P * (1 - maxRisk / 100);
    takeProfit = P * (1 + multiplier * (maxRisk / 100));
  } else {
    stopLoss = P * (1 + maxRisk / 100);
    takeProfit = P * (1 - multiplier * (maxRisk / 100));
  }
  
  const resultHTML = `
    <strong>OI Results:</strong><br>
    Trade: ${document.getElementById('simpleTrade').value.toUpperCase()} | Option: ${document.getElementById('simpleType').value.toUpperCase()}<br>
    Auto Risk Level: ${numericRiskLevel.toFixed(1)} (${autoRiskLabel})<br>
    Recommended Holding Period: ${holdingPeriod} day(s)<br>
    Stop Loss: $${stopLoss.toFixed(2)}<br>
    Take Profit: $${takeProfit.toFixed(2)}<br>
    Note: For Sell orders, profit is capped.
  `;
  document.getElementById('simpleResult').innerHTML = resultHTML;
  
  // Log trade data
  logTrade({
    date: new Date().toLocaleString(),
    model: "Simple",
    trade: document.getElementById('simpleTrade').value,
    type: document.getElementById('simpleType').value,
    riskLevel: numericRiskLevel.toFixed(1),
    stopLoss: stopLoss.toFixed(2),
    takeProfit: takeProfit.toFixed(2)
  });
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, 0, "simple");
}

/* ---------- Advanced Model Calculation ---------- */
function calculateAdvanced() {
  const P = parseFloat(document.getElementById('a_price').value);
  const delta = parseFloat(document.getElementById('a_delta').value);
  const theta = parseFloat(document.getElementById('a_theta').value);
  const iv = parseFloat(document.getElementById('a_iv').value);
  const atr = parseFloat(document.getElementById('a_atr').value);
  const ms = parseFloat(document.getElementById('a_ms').value);
  const S = parseFloat(document.getElementById('a_stock').value);
  const T_days = parseFloat(document.getElementById('a_tdays').value);
  const OI = parseFloat(document.getElementById('a_oi').value);
  const tradeFactor = getTradeFactor("advancedTrade");
  const typeFactor = getTypeFactor("advancedType");
  
  const numerator = delta * atr * tradeFactor * typeFactor * (S / P) * Math.sqrt(OI + 1) * Math.log(T_days + 1) * (1 + ((ms - 50) / 50));
  const denominator = P * Math.sqrt(theta) * Math.exp(iv / 100);
  const Q = Math.sqrt(numerator / denominator);
  const numericRiskLevel = calculateRiskLevel(Q, 0.2, 1.0);
  const autoRiskLabel = riskLabel(numericRiskLevel);
  const holdingPeriod = recommendedHoldingPeriod(numericRiskLevel, T_days);
  
  const maxRisk = parseFloat(document.getElementById('a_maxRisk').value);
  const multiplier = parseFloat(document.getElementById('a_multiplier').value);
  
  let stopLoss, takeProfit;
  if (document.getElementById('advancedTrade').value === "buy") {
    stopLoss = P * (1 - maxRisk / 100);
    takeProfit = P * (1 + multiplier * (maxRisk / 100));
  } else {
    stopLoss = P * (1 + maxRisk / 100);
    takeProfit = P * (1 - multiplier * (maxRisk / 100));
  }
  
  const resultHTML = `
    <strong>OI Results:</strong><br>
    Trade: ${document.getElementById('advancedTrade').value.toUpperCase()} | Option: ${document.getElementById('advancedType').value.toUpperCase()}<br>
    Composite Sensitivity Score (Q): ${Q.toFixed(4)}<br>
    Auto Risk Level: ${numericRiskLevel.toFixed(1)} (${autoRiskLabel})<br>
    Recommended Holding Period: ${holdingPeriod} day(s)<br>
    Stop Loss: $${stopLoss.toFixed(2)}<br>
    Take Profit: $${takeProfit.toFixed(2)}<br>
    Note: For Sell orders, profit is capped.
  `;
  document.getElementById('advancedResult').innerHTML = resultHTML;
  
  // Log trade data
  logTrade({
    date: new Date().toLocaleString(),
    model: "Advanced",
    trade: document.getElementById('advancedTrade').value,
    type: document.getElementById('advancedType').value,
    riskLevel: numericRiskLevel.toFixed(1),
    stopLoss: stopLoss.toFixed(2),
    takeProfit: takeProfit.toFixed(2)
  });
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, "advanced");
}

/* ---------- Custom Model Calculation ---------- */
function calculateCustom() {
  const P = parseFloat(document.getElementById('c_price').value);
  const theta = parseFloat(document.getElementById('c_theta').value);
  const iv = parseFloat(document.getElementById('c_iv').value);
  const contracts = parseFloat(document.getElementById('c_contracts').value);
  const delta = parseFloat(document.getElementById('c_delta').value);
  const w_iv = parseFloat(document.getElementById('w_iv').value);
  const w_delta = parseFloat(document.getElementById('w_delta').value);
  const w_theta = parseFloat(document.getElementById('w_theta').value);
  const w_oi = parseFloat(document.getElementById('w_oi').value);
  const OI = parseFloat(document.getElementById('c_oi').value);
  const T_days = parseFloat(document.getElementById('c_tdays').value);
  const msSelect = document.getElementById('c_ms');
  const sentiment = msSelect.options[msSelect.selectedIndex].value;
  
  // Weighted parameters
  const weightedIV = w_iv * iv;
  const weightedDelta = w_delta * delta;
  const weightedTheta = w_theta * theta;
  const weightedOI = Math.sqrt(w_oi * (OI + 1));
  
  // Composite value Q_custom
  const Q_custom = Math.sqrt((weightedIV * weightedDelta * weightedTheta * weightedOI) / (P * theta * Math.exp(iv / 100)));
  const numericRiskLevel = calculateRiskLevel(Q_custom, 0.2, 1.0);
  const autoRiskLabel = riskLabel(numericRiskLevel);
  const holdingPeriod = recommendedHoldingPeriod(numericRiskLevel, T_days);
  
  const maxRisk = parseFloat(document.getElementById('c_maxRisk').value);
  const multiplier = parseFloat(document.getElementById('c_multiplier').value);
  
  let stopLoss, takeProfit;
  if (document.getElementById('customTrade').value === "buy") {
    stopLoss = P * (1 - maxRisk / 100);
    takeProfit = P * (1 + multiplier * (maxRisk / 100));
  } else {
    stopLoss = P * (1 + maxRisk / 100);
    takeProfit = P * (1 - multiplier * (maxRisk / 100));
  }
  
  const resultHTML = `
    <strong>OI<sup class="red">+</sup> Results:</strong><br>
    Trade: ${document.getElementById('customTrade').value.toUpperCase()} | Option: ${document.getElementById('customType').value.toUpperCase()}<br>
    Weighted Composite Score (Q_custom): ${Q_custom.toFixed(4)}<br>
    Auto Risk Level: ${numericRiskLevel.toFixed(1)} (${autoRiskLabel})<br>
    Recommended Holding Period: ${holdingPeriod} day(s)<br>
    Stop Loss: $${stopLoss.toFixed(2)}<br>
    Take Profit: $${takeProfit.toFixed(2)}<br>
    Note: For Sell orders, profit is capped.<br>
    Sentiment: ${sentiment}
  `;
  document.getElementById('customResult').innerHTML = resultHTML;
  
  // Log trade data
  logTrade({
    date: new Date().toLocaleString(),
    model: "Custom",
    trade: document.getElementById('customTrade').value,
    type: document.getElementById('customType').value,
    riskLevel: numericRiskLevel.toFixed(1),
    stopLoss: stopLoss.toFixed(2),
    takeProfit: takeProfit.toFixed(2),
    sentiment: sentiment
  });
  
  updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, "advanced");
}

/* ---------- Chart Update Function ---------- */
function updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, modelType) {
  const ctx = document.getElementById('summaryChart').getContext('2d');
  const steps = T_days < 50 ? T_days : 50;
  const days = [];
  const worstValues = [];
  for (let i = 0; i <= steps; i++) {
    const t = (T_days * i) / steps;
    days.push(t.toFixed(1));
    let worst;
    if (modelType === "simple") {
      worst = P * (1 - t / T_days);
    } else {
      const alpha = 1 + theta / 100;
      worst = P * (1 - Math.pow(t / T_days, alpha));
    }
    worstValues.push(worst);
  }
  const stopLossData = Array(steps + 1).fill(stopLoss);
  const takeProfitData = Array(steps + 1).fill(takeProfit);
  const data = {
    labels: days,
    datasets: [
      {
        label: "Stop Loss",
        data: stopLossData,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: "Take Profit",
        data: takeProfitData,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: "Worst-case Scenario",
        data: worstValues,
        borderColor: "rgba(255, 206, 86, 1)",
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };
  if (summaryChart !== null) {
    summaryChart.data = data;
    summaryChart.update();
  } else {
    summaryChart = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: "Days Till Expiration" } },
          y: {
            title: { display: true, text: "Option Value ($)" },
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }
}

/* ---------- Dark Mode Toggle ---------- */
const darkModeButton = document.getElementById("dark-mode-button");
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}
const darkModeSetting = localStorage.getItem("darkMode") === "true";
applyDarkMode(darkModeSetting);
if (darkModeButton) {
  darkModeButton.addEventListener("click", function () {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", isDark);
  });
}

/* ---------- Trade History Display (for history.html) ---------- */
function displayTradeHistory() {
  const tableBody = document.getElementById("tradeTable").querySelector("tbody");
  let tradeHistory = JSON.parse(localStorage.getItem("tradeHistory") || "[]");
  tableBody.innerHTML = "";
  tradeHistory.forEach(trade => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${trade.date}</td>
      <td>${trade.model}</td>
      <td>${trade.trade}</td>
      <td>${trade.type}</td>
      <td>${trade.riskLevel}</td>
      <td>$${trade.stopLoss}</td>
      <td>$${trade.takeProfit}</td>
    `;
    tableBody.appendChild(tr);
  });
}

/* Clear Trade History */
const clearHistoryButton = document.getElementById("clearHistory");
if (clearHistoryButton) {
  clearHistoryButton.addEventListener("click", function () {
    localStorage.removeItem("tradeHistory");
    displayTradeHistory();
  });
}

/* ---------- Notes Functionality ---------- */
let currentNoteId = null;
function getNotes() {
  return JSON.parse(localStorage.getItem("notes") || "[]");
}
function saveNotes(notes) {
  localStorage.setItem("notes", JSON.stringify(notes));
}
function displayFileList() {
  const fileList = document.getElementById("fileList");
  if (!fileList) return;
  fileList.innerHTML = "";
  const notes = getNotes();
  notes.forEach(note => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `<span class="file-title">${note.title}</span>
                          <button class="loadNote" data-id="${note.id}">Load</button>
                          <button class="deleteNote" data-id="${note.id}">Delete</button>`;
    fileList.appendChild(fileItem);
  });
}
function clearEditor() {
  const noteTitle = document.getElementById("noteTitle");
  const noteContent = document.getElementById("noteContent");
  if (noteTitle) noteTitle.value = "";
  if (noteContent) noteContent.value = "";
  currentNoteId = null;
}
const saveNoteButton = document.getElementById("saveNote");
if (saveNoteButton) {
  saveNoteButton.addEventListener("click", function() {
    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();
    if (!title || !content) {
      alert("Please enter both title and content.");
      return;
    }
    let notes = getNotes();
    if (currentNoteId) {
      notes = notes.map(note => note.id === currentNoteId ? { id: currentNoteId, title, content } : note);
    } else {
      const note = { id: Date.now(), title, content };
      notes.push(note);
      currentNoteId = note.id;
    }
    saveNotes(notes);
    displayFileList();
    alert("Note saved!");
  });
}
const newNoteButton = document.getElementById("newNote");
if (newNoteButton) {
  newNoteButton.addEventListener("click", function() {
    clearEditor();
  });
}
const fileListContainer = document.getElementById("fileList");
if (fileListContainer) {
  fileListContainer.addEventListener("click", function(e) {
    if (e.target.classList.contains("loadNote")) {
      const noteId = Number(e.target.getAttribute("data-id"));
      const notes = getNotes();
      const note = notes.find(n => n.id === noteId);
      if (note) {
        currentNoteId = note.id;
        document.getElementById("noteTitle").value = note.title;
        document.getElementById("noteContent").value = note.content;
      }
    } else if (e.target.classList.contains("deleteNote")) {
      const noteId = Number(e.target.getAttribute("data-id"));
      let notes = getNotes();
      notes = notes.filter(n => n.id !== noteId);
      saveNotes(notes);
      if (currentNoteId === noteId) {
        clearEditor();
      }
      displayFileList();
    }
  });
}
if (document.getElementById("fileList")) {
  displayFileList();
}

/* ---------- Event Listener for Model Selector ---------- */
const modelSelect = document.getElementById("modelSelect");
if (modelSelect) {
  modelSelect.addEventListener("change", toggleSection);
}

/* ---------- If on Trade History Page, display history ---------- */
if (document.getElementById("tradeTable")) {
  displayTradeHistory();
}
