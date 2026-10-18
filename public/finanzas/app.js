/* ******************************************
* Finanzas: registro rápido de gastos e ingresos.
* Todo se guarda en el navegador (localStorage).
*******************************************/
const $ = (s) => document.querySelector(s)
const KEY = "finanzas.v1"

/* ***********************
* Categorías y palabras que las detectan solas
*************************/
const CATS = [
  { id: "comida", label: "Comida", icon: "🍽️", words: ["super", "mercado", "comida", "restaurante", "cafe", "almuerzo", "cena", "desayuno", "pizza", "tacos", "pan", "snack", "uber eats", "rappi", "didi food"] },
  { id: "transporte", label: "Transporte", icon: "🚗", words: ["uber", "didi", "taxi", "gasolina", "gas", "bus", "metro", "pasaje", "parqueo", "estacionamiento", "peaje"] },
  { id: "casa", label: "Casa", icon: "🏠", words: ["renta", "alquiler", "luz", "agua", "internet", "telefono", "celular", "cable", "hipoteca"] },
  { id: "ocio", label: "Ocio", icon: "🎉", words: ["cine", "netflix", "spotify", "bar", "fiesta", "juego", "concierto", "viaje", "cerveza"] },
  { id: "salud", label: "Salud", icon: "💊", words: ["farmacia", "medico", "doctor", "medicina", "gym", "gimnasio", "dentista", "seguro"] },
  { id: "compras", label: "Compras", icon: "🛍️", words: ["ropa", "zapatos", "amazon", "regalo", "tienda"] },
  { id: "otros", label: "Otros", icon: "•", words: [] },
]
const INCOME = { id: "ingreso", label: "Ingreso", icon: "💰", words: ["sueldo", "salario", "nomina", "cobro", "venta", "freelance", "bono", "ingreso"] }
const ALL = [...CATS, INCOME]
const byId = Object.fromEntries(ALL.map((c) => [c.id, c]))

/* ***********************
* Estado
*************************/
let state = load()
let view = monthKey(today())
let picked = null // categoría elegida a mano (si no, se detecta)
let lastDeleted = null
let toastTimer

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.tx)) return { budget: 0, currency: "USD", ...s }
  } catch {}
  return { tx: [], budget: 0, currency: "USD" }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

/* ***********************
* Utilidades
*************************/
function today() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
function monthKey(date) { return date.slice(0, 7) }
function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function normalize(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") }
function esc(s) { return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) }

function money(n, sign = false) {
  const f = new Intl.NumberFormat("es-419", { style: "currency", currency: state.currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: n % 1 ? 2 : 0 })
  const s = f.format(Math.abs(n))
  if (!sign) return n < 0 ? `−${s}` : s
  return (n < 0 ? "−" : "+") + s
}

// "1.500,50" / "1,500.50" / "12,5" / "1,500" -> número
function parseAmount(raw) {
  let s = raw.replace(/[^\d.,]/g, "")
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",")
  if (lastDot > -1 && lastComma > -1) {
    const dec = lastDot > lastComma ? "." : ","
    s = s.replace(dec === "." ? /,/g : /\./g, "").replace(",", ".")
  } else if (lastDot > -1 || lastComma > -1) {
    const sep = lastDot > -1 ? "." : ","
    const parts = s.split(sep)
    const tail = parts[parts.length - 1]
    s = parts.length > 2 || tail.length === 3 ? parts.join("") : parts.join(".")
  }
  return parseFloat(s)
}

function detect(note) {
  const n = normalize(note)
  if (!n) return null
  // Primero coincidencias largas ("uber eats" antes que "uber")
  const hits = ALL.flatMap((c) => c.words.map((w) => ({ c, w }))).filter(({ w }) => new RegExp(`\\b${w}`).test(n))
  hits.sort((a, b) => b.w.length - a.w.length)
  return hits[0]?.c.id ?? null
}

// "45 súper" -> { amount: 45, note: "súper", type: "out", cat: "comida" }
function parseEntry(text) {
  const m = text.match(/([+-]?)\s*\$?\s*(\d[\d.,]*)/)
  if (!m) return null
  const amount = parseAmount(m[2])
  if (!amount || amount <= 0) return null
  const note = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim()
  const auto = detect(note)
  const cat = picked ?? auto ?? (m[1] === "+" ? "ingreso" : "otros")
  const type = m[1] === "+" || cat === "ingreso" ? "in" : "out"
  return { amount, note, type, cat: type === "in" ? "ingreso" : cat === "ingreso" ? "otros" : cat }
}

/* ***********************
* Render
*************************/
function render() {
  const [y, m] = view.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" })
  $("#month").textContent = label[0].toUpperCase() + label.slice(1)
  $("#next").disabled = view >= monthKey(today())

  const tx = state.tx.filter((t) => monthKey(t.date) === view)
  const income = tx.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0)
  const expense = tx.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0)
  const balance = income - expense

  $("#balance").textContent = money(balance)
  $("#balance").classList.toggle("neg", balance < 0)
  $("#income").textContent = money(income, true)
  $("#expense").textContent = money(-expense, true)

  renderBudget(expense)
  renderCats(tx, expense)
  renderList(tx)
}

function renderBudget(expense) {
  const box = $("#budget")
  box.hidden = !state.budget
  if (!state.budget) return
  const left = state.budget - expense
  const pct = Math.min(100, (expense / state.budget) * 100)
  const fill = $("#budget-fill")
  fill.style.width = pct + "%"
  fill.className = pct >= 100 ? "over" : pct >= 80 ? "warn" : ""

  let text
  if (left < 0) {
    text = `Te pasaste ${money(-left)} del presupuesto`
  } else if (view === monthKey(today())) {
    const [y, m] = view.split("-").map(Number)
    const daysLeft = new Date(y, m, 0).getDate() - new Date().getDate() + 1
    text = `Te quedan ${money(left)} · ${money(left / daysLeft)} por día`
  } else {
    text = `Sobraron ${money(left)} de ${money(state.budget)}`
  }
  $("#budget-text").textContent = text
}

function renderCats(tx, expense) {
  const totals = {}
  tx.filter((t) => t.type === "out").forEach((t) => (totals[t.cat] = (totals[t.cat] || 0) + t.amount))
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1])
  $("#cats-section").hidden = rows.length === 0
  const max = rows[0]?.[1] || 1
  $("#cats").innerHTML = rows.map(([id, v]) => {
    const c = byId[id] || byId.otros
    return `<li><span>${c.icon} ${c.label}</span><span class="amt">${money(v)} · ${Math.round((v / expense) * 100)}%</span>
      <div class="bar"><span style="width:${(v / max) * 100}%"></span></div></li>`
  }).join("")
}

function renderList(tx) {
  const sorted = [...tx].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)
  $("#empty").hidden = sorted.length > 0
  let html = "", lastDay = ""
  for (const t of sorted) {
    if (t.date !== lastDay) {
      lastDay = t.date
      html += `<li class="day">${dayLabel(t.date)}</li>`
    }
    const c = byId[t.cat] || byId.otros
    html += `<li class="item">
      <span class="ico">${c.icon}</span>
      <span class="txt"><b>${esc(t.note || c.label)}</b>${t.note ? `<small>${c.label}</small>` : ""}</span>
      <span class="amt ${t.type}">${money(t.type === "in" ? t.amount : -t.amount, true)}</span>
      <button class="del" data-id="${t.id}" aria-label="Eliminar">×</button>
    </li>`
  }
  $("#list").innerHTML = html
}

function dayLabel(date) {
  const t = today()
  if (date === t) return "Hoy"
  const y = new Date(t + "T00:00")
  y.setDate(y.getDate() - 1)
  if (date === localISO(y)) return "Ayer"
  return new Date(date + "T00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })
}
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/* ***********************
* Formulario rápido
*************************/
function renderChips() {
  const entry = $("#entry").value
  const parsed = entry ? parseEntry(entry) : null
  const active = picked ?? parsed?.cat ?? null
  $("#chips").innerHTML = ALL.map((c) =>
    `<button type="button" class="chip" role="radio" data-cat="${c.id}" aria-checked="${c.id === active}">${c.icon} ${c.label}</button>`
  ).join("")
  const on = $('#chips [aria-checked="true"]')
  if (on) $("#chips").scrollLeft = on.offsetLeft - $("#chips").offsetLeft - 8
}

function setDate(value) {
  $("#date").value = value
  $("#date-text").textContent = value === today()
    ? "Hoy"
    : new Date(value + "T00:00").toLocaleDateString("es", { day: "numeric", month: "short" })
}

$("#entry").addEventListener("input", renderChips)

$("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip")
  if (!chip) return
  picked = picked === chip.dataset.cat ? null : chip.dataset.cat
  renderChips()
  $("#entry").focus()
})

$("#date").addEventListener("change", (e) => setDate(e.target.value || today()))

$("#quick").addEventListener("submit", (e) => {
  e.preventDefault()
  const parsed = parseEntry($("#entry").value)
  if (!parsed) {
    $("#entry").focus()
    toast("Escribe un monto, ej. 45 súper")
    return
  }
  const date = $("#date").value || today()
  state.tx.push({ id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), ts: Date.now(), date, ...parsed })
  save()
  view = monthKey(date)
  $("#entry").value = ""
  picked = null
  setDate(today())
  renderChips()
  render()
  $("#entry").focus()
})

/* ***********************
* Lista: eliminar con deshacer
*************************/
$("#list").addEventListener("click", (e) => {
  const btn = e.target.closest(".del")
  if (!btn) return
  const i = state.tx.findIndex((t) => t.id === btn.dataset.id)
  if (i < 0) return
  lastDeleted = state.tx.splice(i, 1)[0]
  save()
  render()
  toast("Movimiento eliminado", true)
})

function toast(text, undo = false) {
  $("#toast-text").textContent = text
  $("#toast-undo").hidden = !undo
  $("#toast").hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4000)
}

$("#toast-undo").addEventListener("click", () => {
  if (lastDeleted) state.tx.push(lastDeleted)
  lastDeleted = null
  save()
  render()
  $("#toast").hidden = true
})

/* ***********************
* Navegación por meses
*************************/
$("#prev").addEventListener("click", () => { view = shiftMonth(view, -1); render() })
$("#next").addEventListener("click", () => { view = shiftMonth(view, 1); render() })

/* ***********************
* Ajustes, exportar e importar
*************************/
$("#open-settings").addEventListener("click", () => {
  $("#set-budget").value = state.budget || ""
  $("#set-currency").value = state.currency
  $("#settings").showModal()
})
$("#set-budget").addEventListener("input", (e) => { state.budget = Math.max(0, parseFloat(e.target.value) || 0); save(); render() })
$("#set-currency").addEventListener("change", (e) => { state.currency = e.target.value; save(); render() })

function download(name, content, type) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

$("#export-csv").addEventListener("click", () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`
  const rows = [...state.tx].sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [t.date, t.type === "in" ? "Ingreso" : "Gasto", byId[t.cat]?.label ?? t.cat, q(t.note), t.type === "in" ? t.amount : -t.amount].join(","))
  download(`finanzas-${today()}.csv`, "﻿Fecha,Tipo,Categoría,Nota,Monto\n" + rows.join("\n"), "text/csv")
})

$("#export-json").addEventListener("click", () => {
  download(`finanzas-respaldo-${today()}.json`, JSON.stringify(state, null, 2), "application/json")
})

$("#import-json").addEventListener("click", () => $("#import-file").click())
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0]
  e.target.value = ""
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    if (!Array.isArray(data.tx)) throw new Error()
    if (!confirm(`¿Reemplazar tus datos por la copia (${data.tx.length} movimientos)?`)) return
    state = { budget: 0, currency: "USD", ...data }
    save()
    $("#settings").close()
    render()
    toast("Copia restaurada")
  } catch {
    toast("Ese archivo no es una copia válida")
  }
})

$("#wipe").addEventListener("click", () => {
  if (!confirm("¿Borrar todos los movimientos? No se puede deshacer.")) return
  state = { tx: [], budget: state.budget, currency: state.currency }
  save()
  $("#settings").close()
  render()
})

/* ***********************
* Inicio
*************************/
setDate(today())
renderChips()
render()

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {})
}
