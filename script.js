/* ------------------ CONFIGURE ------------------ */
const API_KEY = "903ee702147ca57f64022ff77cd6d224"; 
/* ------------------------------------------------ */

const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");
const errorMsg = document.getElementById("errorMsg");
const weatherIcon = document.getElementById("weatherIcon");
const cityNameEl = document.getElementById("cityName");
const tempEl = document.getElementById("temp");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const popup = document.getElementById("weatherAlert");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");
const alertOkBtn = document.getElementById("alertOk");

let forecastData = null;
let currentWeather = null;

function showError(text){
  errorMsg.innerText = text || "Something went wrong.";
  errorMsg.style.display = "block";
}

function hideError(){
  errorMsg.style.display = "none";
}

function showPopup(title, message){
  alertTitle.innerText = title;
  alertMessage.innerText = message;
  popup.style.display = "flex";
  popup.setAttribute("aria-hidden", "false");
}

function closePopup(){
  popup.style.display = "none";
  popup.setAttribute("aria-hidden", "true");
}
alertOkBtn.addEventListener("click", closePopup);

function setIconForWeather(main){
  const s = (main || "").toLowerCase();
  if (s.includes("rain") || s.includes("drizzle")) return "rain.png";
  if (s.includes("thunder") || s.includes("storm")) return "thunder.png";
  if (s.includes("clear")) return "clear.png";
  if (s.includes("cloud")) return "cloud.png";
  if (s.includes("snow")) return "snow.png";
  if (s.includes("mist") || s.includes("haze") || s.includes("fog")) return "mist.png";
  return "weather.png";
}

/* Main fetch + UI update */
async function getWeather(){
  const city = cityInput.value.trim();
  if (!city) {
    showError("Please enter a city name.");
    return;
  }
  hideError();

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

  try {
    console.log("Fetching:", weatherUrl);
    const res = await fetch(weatherUrl);
    if (!res.ok) {
      // parse server message if possible
      const err = await res.json().catch(()=>null);
      const msg = err && err.message ? err.message : `Error ${res.status}`;
      showError(msg);
      return;
    }
    const data = await res.json();
    console.log("Current weather:", data);
    currentWeather = data;

    cityNameEl.innerText = data.name;
    tempEl.innerText = `${Math.round(data.main.temp)}°C`;
    humidityEl.innerText = `${data.main.humidity}%`;
    windEl.innerText = `${data.wind.speed} km/h`;

    const mainCond = (data.weather && data.weather[0] && data.weather[0].main) ? data.weather[0].main : "";
    weatherIcon.src = setIconForWeather(mainCond);

    // sensible popup logic only for notable conditions
    const lc = mainCond.toLowerCase();
    if (lc.includes("thunder") || lc.includes("storm")) {
      showPopup("⛈ Severe Weather", "Thunderstorm expected — consider staying at home.");
    } else if (lc.includes("rain") || lc.includes("drizzle")) {
      showPopup("🌧 Take an umbrella", "Rain expected — carry an umbrella or raincoat.");
    } else if (lc.includes("snow")) {
      showPopup("❄️ Snow alert", "Snow expected — dress warmly.");
    }

    // fetch forecast (for chat)
    try {
      const rf = await fetch(forecastUrl);
      if (rf.ok) {
        forecastData = await rf.json();
        console.log("Forecast fetched:", forecastData);
      } else {
        forecastData = null;
      }
    } catch(fErr) {
      console.warn("Forecast fetch failed:", fErr);
      forecastData = null;
    }

  } catch (err) {
    console.error(err);
    showError("Network or CORS error. See console for details.");
  }
}

/* Chat logic — uses forecast when available */
function botReplyFor(question){
  if (!question) return "Please ask a weather question (e.g. 'Will it rain?').";
  const q = question.toLowerCase();

  // If we have forecast, use next 24h (first 8 × 3-hour entries)
  if (forecastData && Array.isArray(forecastData.list)) {
    const next24 = forecastData.list.slice(0, 8);
    if (q.includes("rain")) {
      const willRain = next24.some(it => {
        const m = it.weather && it.weather[0] && it.weather[0].main ? it.weather[0].main.toLowerCase() : "";
        return m.includes("rain") || m.includes("drizzle") || (it.pop && it.pop > 0.3);
      });
      return willRain ? "🌧 Yes — rain is expected in the next 24 hours." : "☀️ No rain expected in the next 24 hours.";
    }

    if (q.includes("sun") || q.includes("clear")) {
      const willClear = next24.some(it => {
        const m = it.weather && it.weather[0] && it.weather[0].main ? it.weather[0].main.toLowerCase() : "";
        return m.includes("clear");
      });
      return willClear ? "☀️ There will be some clear/sunny periods in the next 24 hours." : "🌥 Mostly cloudy or rainy in the next 24 hours.";
    }

    if (q.includes("temperature") || q.includes("temp") || q.includes("hot") || q.includes("cold")) {
      const next = next24[0];
      return next ? `🌡 Forecasted around ${Math.round(next.main.temp)}°C (next 3-hour slot).` : "I don't have temperature slots right now.";
    }

    if (q.includes("tomorrow")) {
      // coarse answer — check entries roughly 24-48h from now (8..16)
      const tomorrow = forecastData.list.slice(8, 16);
      if (tomorrow.length === 0) return "No forecast available for tomorrow.";
      const rainTomorrow = tomorrow.some(it => {
        const m = it.weather && it.weather[0] && it.weather[0].main ? it.weather[0].main.toLowerCase() : "";
        return m.includes("rain") || m.includes("drizzle");
      });
      return rainTomorrow ? "It looks like there could be rain tomorrow." : "No rain expected tomorrow.";
    }
  }

  // Fallback to current weather (if available)
  if (currentWeather) {
    const m = (currentWeather.weather && currentWeather.weather[0] && currentWeather.weather[0].main) ? currentWeather.weather[0].main.toLowerCase() : "";
    if (q.includes("rain")) {
      return m.includes("rain") || m.includes("drizzle") ? "It's currently raining." : "Not raining right now.";
    }
    if (q.includes("temperature") || q.includes("temp")) {
      return `Current temperature: ${Math.round(currentWeather.main.temp)}°C.`;
    }
  }

  // generic fallback
  if (q.includes("rain")) return "I don't have forecast data yet — please search a city first.";
  return "I can answer about rain/sun/temperature for the searched city. Try: 'Will it rain?', 'Temperature?' or 'Tomorrow?'.";
}

/* UI: chat send */
function addChatMessage(text, who = "bot"){
  const p = document.createElement("p");
  p.innerHTML = who === "user" ? `<b>You:</b> ${text}` : `<b>AI:</b> ${text}`;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const q = chatInput.value.trim();
  if (!q) return;
  addChatMessage(q, "user");
  chatInput.value = "";
  // simulate thinking
  setTimeout(() => {
    const reply = botReplyFor(q);
    addChatMessage(reply, "bot");
  }, 400);
});

/* Enter key behavior for both search and chat */
cityInput.addEventListener("keydown", (e) => { if (e.key === "Enter") getWeather(); });
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });
searchBtn.addEventListener("click", getWeather);
