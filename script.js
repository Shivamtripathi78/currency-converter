const API_BASE = "https://api.frankfurter.dev/v2";

const form = document.getElementById("converterForm");
const amountInput = document.getElementById("amount");
const fromCurrency = document.getElementById("fromCurrency");
const toCurrency = document.getElementById("toCurrency");
const swapBtn = document.getElementById("swapBtn");
const convertBtn = document.getElementById("convertBtn");

const resultSection = document.getElementById("result");
const convertedAmountElement = document.getElementById("convertedAmount");
const conversionSummary = document.getElementById("conversionSummary");
const exchangeRateElement = document.getElementById("exchangeRate");
const rateDateElement = document.getElementById("rateDate");
const errorMessage = document.getElementById("errorMessage");
const amountSymbol = document.getElementById("amountSymbol");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

let currencies = [];
let history = [];
let latestRate = null;

const currencyNames = new Map();

function formatMoney(amount, currency) {
    try {
        return new Intl.NumberFormat("en", {
            style: "currency",
            currency,
            maximumFractionDigits: 4
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

function getCurrencySymbol(currency) {
    try {
        const parts = new Intl.NumberFormat("en", {
            style: "currency",
            currency
        }).formatToParts(1);

        return parts.find(part => part.type === "currency")?.value || currency;
    } catch {
        return currency;
    }
}

function updateAmountSymbol() {
    amountSymbol.textContent = getCurrencySymbol(fromCurrency.value);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
    resultSection.classList.add("hidden");
}

function clearError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        let details = "";

        try {
            const data = await response.json();
            details = data.message || "";
        } catch {
            // Response may not contain JSON.
        }

        throw new Error(
            details || `Request failed with status ${response.status}.`
        );
    }

    return response.json();
}

async function loadCurrencies() {
    convertBtn.disabled = true;
    convertBtn.textContent = "Loading currencies...";

    try {
        const data = await fetchJSON(`${API_BASE}/currencies`);

        currencies = data
            .filter(currency => currency.iso_code && currency.name)
            .sort((a, b) => a.iso_code.localeCompare(b.iso_code));

        currencyNames.clear();

        currencies.forEach(currency => {
            currencyNames.set(currency.iso_code, currency.name);
        });

        populateCurrencySelect(fromCurrency, "USD");
        populateCurrencySelect(toCurrency, "INR");

        updateAmountSymbol();

        convertBtn.disabled = false;
        convertBtn.textContent = "Convert Currency →";
    } catch (error) {
        showError(
            `Unable to load currencies. Check your internet connection and try again. ${error.message}`
        );

        convertBtn.disabled = false;
        convertBtn.textContent = "Convert Currency →";
    }
}

function populateCurrencySelect(selectElement, preferredCurrency) {
    selectElement.replaceChildren();

    currencies.forEach(currency => {
        const option = document.createElement("option");

        option.value = currency.iso_code;
        option.textContent =
            `${currency.iso_code} - ${currency.name}`;

        selectElement.appendChild(option);
    });

    if (currencies.some(currency => currency.iso_code === preferredCurrency)) {
        selectElement.value = preferredCurrency;
    }
}

async function convertCurrency(event) {
    event.preventDefault();
    clearError();

    const amount = Number(amountInput.value);
    const from = fromCurrency.value;
    const to = toCurrency.value;

    if (!Number.isFinite(amount) || amount <= 0) {
        showError("Please enter an amount greater than zero.");
        amountInput.focus();
        return;
    }

    if (!from || !to) {
        showError("Please select both currencies.");
        return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    try {
        let rate;
        let rateDate;

        if (from === to) {
            rate = 1;
            rateDate = "Same currency";
        } else {
            const data = await fetchJSON(
                `${API_BASE}/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`
            );

            rate = data.rate;
            rateDate = data.date;

            if (!Number.isFinite(rate) || rate <= 0) {
                throw new Error("The API returned an invalid exchange rate.");
            }
        }

        const converted = amount * rate;

        latestRate = {
            from,
            to,
            rate,
            date: rateDate
        };

        convertedAmountElement.textContent = formatMoney(converted, to);

        conversionSummary.textContent =
            `${formatMoney(amount, from)} = ${formatMoney(converted, to)}`;

        exchangeRateElement.textContent =
            `1 ${from} = ${rate.toLocaleString("en", {
                maximumFractionDigits: 8
            })} ${to}`;

        rateDateElement.textContent =
            rateDate === "Same currency"
                ? "No exchange rate needed."
                : `Rate date: ${rateDate}`;

        resultSection.classList.remove("hidden");
        errorMessage.classList.add("hidden");

        addToHistory({
            amount,
            converted,
            from,
            to,
            rate,
            date: rateDate
        });
    } catch (error) {
        showError(
            `Conversion failed. Please check your connection or currency selection. ${error.message}`
        );
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = "Convert Currency →";
    }
}

function addToHistory(item) {
    history.unshift(item);
    history = history.slice(0, 5);
    renderHistory();
}

function renderHistory() {
    historyList.replaceChildren();

    if (history.length === 0) {
        const emptyMessage = document.createElement("p");

        emptyMessage.className = "empty-history";
        emptyMessage.textContent = "Your conversions will appear here.";

        historyList.appendChild(emptyMessage);
        return;
    }

    history.forEach(item => {
        const row = document.createElement("article");
        row.className = "history-item";

        const details = document.createElement("div");

        const pair = document.createElement("p");
        pair.className = "history-pair";
        pair.textContent = `${item.from} → ${item.to}`;

        const detail = document.createElement("p");
        detail.className = "history-detail";
        detail.textContent =
            `${formatMoney(item.amount, item.from)} · Rate: ${item.rate}`;

        details.append(pair, detail);

        const converted = document.createElement("p");
        converted.className = "history-result";
        converted.textContent = formatMoney(item.converted, item.to);

        row.append(details, converted);
        historyList.appendChild(row);
    });
}

swapBtn.addEventListener("click", () => {
    const previousFrom = fromCurrency.value;

    fromCurrency.value = toCurrency.value;
    toCurrency.value = previousFrom;

    updateAmountSymbol();
    clearError();

    if (latestRate) {
        resultSection.classList.add("hidden");
    }
});

fromCurrency.addEventListener("change", () => {
    updateAmountSymbol();
    clearError();
    resultSection.classList.add("hidden");
});

toCurrency.addEventListener("change", () => {
    clearError();
    resultSection.classList.add("hidden");
});

amountInput.addEventListener("input", () => {
    clearError();
});

form.addEventListener("submit", convertCurrency);

clearHistoryBtn.addEventListener("click", () => {
    history = [];
    renderHistory();
});

loadCurrencies();