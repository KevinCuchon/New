/* ******************************************
* Finanzas: registro rápido de gastos e ingresos.
* Todo se guarda en el navegador (localStorage).
*******************************************/
const $ = (s) => document.querySelector(s)
const KEY = "finanzas.v1"

/* ***********************
* Categorías por defecto (editables desde Ajustes)
*************************/
const DEFAULT_CATS = [
  { id: "comida", label: "Comida", icon: "🍽️", type: "out" },
  { id: "transporte", label: "Transporte", icon: "🚗", type: "out" },
  { id: "casa", label: "Casa", icon: "🏠", type: "out" },
  { id: "ocio", label: "Ocio", icon: "🎉", type: "out" },
  { id: "salud", label: "Salud", icon: "💊", type: "out" },
  { id: "compras", label: "Compras", icon: "🛍️", type: "out" },
  { id: "otros", label: "Otros", icon: "•", type: "out" },
  { id: "ingreso", label: "Ingreso", icon: "💰", type: "in" },
]
const MISSING = { label: "Sin categoría", icon: "•" }

/* ***********************
* Estado
*************************/
let state = load()
let view = monthKey(today())
let lastDeleted = null
let editing = null // id del movimiento abierto en el editor
let toastTimer

function withDefaults(s) {
  return { tx: [], budget: 0, currency: "USD", ...s, cats: s?.cats?.length ? s.cats : DEFAULT_CATS.map((c) => ({ ...c })) }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.tx)) return withDefaults(s)
  } catch {}
  return withDefaults({})
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

function cat(id) { return state.cats.find((c) => c.id === id) || MISSING }

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
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) }
function newId() { return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2) }

function formatter(n = 0) {
  return new Intl.NumberFormat("es-419", { style: "currency", currency: state.currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: n % 1 ? 2 : 0 })
}
function money(n, sign = false) {
  const s = formatter(n).format(Math.abs(n))
  if (!sign) return n < 0 ? `−${s}` : s
  return (n < 0 ? "−" : "+") + s
}
function currencySymbol() {
  return formatter().formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"
}

// "1.500,50" / "1,500.50" / "12,5" / "1,500" -> número
function parseAmount(raw) {
  let s = String(raw).replace(/[^\d.,]/g, "")
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

/* ***********************
* Render
*************************/
function render() {
  const [y, m] = view.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" })
  $("#month").textContent = label[0].toUpperCase() + label.slice(1)
  $("#next").disabled = view >= monthKey(today())
  $("#cur-symbol").textContent = currencySymbol()

  const tx = state.tx.filter((t) => monthKey(t.date) === view)
  const income = tx.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0)
  const expense = tx.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0)
  const balance = income - expense

  $("#balance").textContent = money(balance)
  $("#balance").classList.toggle("neg", balance < 0)
  $("#income").textContent = money(income, true)
  $("#expense").textContent = money(-expense, true)

  renderChips()
  renderBudget(expense)
  renderCats(tx, expense)
  renderList(tx)
}

function renderChips() {
  $("#chips").innerHTML = state.cats.map((c) =>
    `<button type="button" class="chip ${c.type}" data-cat="${esc(c.id)}">${esc(c.icon)} ${esc(c.label)}</button>`
  ).join("")
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
    const c = cat(id)
    return `<li><span>${esc(c.icon)} ${esc(c.label)}</span><span class="amt">${money(v)} · ${Math.round((v / expense) * 100)}%</span>
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
    const c = cat(t.cat)
    html += `<li><button type="button" class="item" data-id="${esc(t.id)}">
      <span class="ico">${esc(c.icon)}</span>
      <span class="txt"><b>${esc(t.note || c.label)}</b>${t.note ? `<small>${esc(c.label)}</small>` : ""}</span>
      <span class="amt ${t.type}">${money(t.type === "in" ? t.amount : -t.amount, true)}</span>
    </button></li>`
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

/* ***********************
* Registro rápido: monto (teclado numérico) + tocar categoría
*************************/
function setDate(value) {
  $("#date").value = value
  $("#date-text").textContent = value === today()
    ? "Hoy"
    : new Date(value + "T00:00").toLocaleDateString("es", { day: "numeric", month: "short" })
}

$("#date").addEventListener("change", (e) => setDate(e.target.value || today()))

$("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip")
  if (!chip) return
  const amount = parseAmount($("#amount").value)
  if (!amount || amount <= 0) {
    $("#amount").focus()
    toast("Primero escribe el monto")
    return
  }
  const c = cat(chip.dataset.cat)
  const date = $("#date").value || today()
  const tx = { id: newId(), ts: Date.now(), date, amount, note: $("#note").value.trim(), type: c.type, cat: chip.dataset.cat }
  state.tx.push(tx)
  save()
  view = monthKey(date)
  $("#amount").value = ""
  $("#note").value = ""
  setDate(today())
  render()
  lastDeleted = null
  toast(`${c.icon} ${money(c.type === "in" ? amount : -amount, true)} guardado`)
})

// El teclado de Android sí tiene "Ir": pide elegir categoría.
$("#quick").addEventListener("submit", (e) => {
  e.preventDefault()
  document.activeElement?.blur()
  toast("Toca una categoría para guardar")
})

/* ***********************
* Editar un movimiento
*************************/
$("#list").addEventListener("click", (e) => {
  const item = e.target.closest(".item")
  if (!item) return
  const t = state.tx.find((t) => t.id === item.dataset.id)
  if (!t) return
  editing = t.id
  $("#edit-amount").value = String(t.amount).replace(".", ",")
  $("#edit-note").value = t.note || ""
  $("#edit-cat").innerHTML = state.cats.map((c) =>
    `<option value="${esc(c.id)}">${esc(c.icon)} ${esc(c.label)}${c.type === "in" ? " (ingreso)" : ""}</option>`
  ).join("") + (state.cats.some((c) => c.id === t.cat) ? "" : `<option value="${esc(t.cat)}">${MISSING.label}</option>`)
  $("#edit-cat").value = t.cat
  $("#edit-date").value = t.date
  $("#edit").returnValue = ""
  $("#edit").showModal()
})

$("#edit").addEventListener("close", () => {
  const t = state.tx.find((t) => t.id === editing)
  editing = null
  if (!t || $("#edit").returnValue !== "save") return
  const amount = parseAmount($("#edit-amount").value)
  if (!amount || amount <= 0) return toast("Monto no válido: no se guardó")
  const c = state.cats.find((c) => c.id === $("#edit-cat").value)
  Object.assign(t, {
    amount,
    note: $("#edit-note").value.trim(),
    cat: $("#edit-cat").value,
    type: c ? c.type : t.type,
    date: $("#edit-date").value || t.date,
  })
  save()
  render()
  toast("Cambios guardados")
})

$("#edit-cancel").addEventListener("click", () => $("#edit").close())

$("#edit-delete").addEventListener("click", () => {
  const i = state.tx.findIndex((t) => t.id === editing)
  $("#edit").close()
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
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3500)
}

$("#toast-undo").addEventListener("click", () => {
  if (lastDeleted) state.tx.push(lastDeleted)
  lastDeleted = null
  save()
  render()
  $("#toast").hidden = true
})

// Confirmación dentro de la página.
function ask(text, ok = "Sí") {
  return new Promise((resolve) => {
    const d = $("#confirm")
    $("#confirm-text").textContent = text
    $("#confirm-ok").textContent = ok
    d.returnValue = ""
    d.addEventListener("close", () => resolve(d.returnValue === "yes"), { once: true })
    d.showModal()
  })
}

/* ***********************
* Navegación por meses
*************************/
$("#prev").addEventListener("click", () => { view = shiftMonth(view, -1); render() })
$("#next").addEventListener("click", () => { view = shiftMonth(view, 1); render() })

/* ***********************
* Ajustes: presupuesto, moneda y categorías
*************************/
$("#open-settings").addEventListener("click", () => {
  $("#set-budget").value = state.budget || ""
  $("#set-currency").value = state.currency
  renderCatEditor()
  $("#settings").showModal()
})
$("#set-budget").addEventListener("change", (e) => { state.budget = Math.max(0, parseAmount(e.target.value) || 0); save(); render() })
$("#set-currency").addEventListener("change", (e) => { state.currency = e.target.value; save(); render() })

function renderCatEditor() {
  $("#cat-list").innerHTML = state.cats.map((c) => `<li data-id="${esc(c.id)}">
      <input class="cat-icon" value="${esc(c.icon)}" maxlength="8" aria-label="Ícono">
      <input class="cat-name" value="${esc(c.label)}" maxlength="24" aria-label="Nombre">
      <button type="button" class="cat-type ${c.type}" aria-label="Cambiar entre gasto e ingreso">${c.type === "in" ? "Ingreso" : "Gasto"}</button>
      <button type="button" class="cat-del" aria-label="Borrar categoría">×</button>
    </li>`).join("")
}

function catFromRow(el) {
  const id = el.closest("li").dataset.id
  return state.cats.find((c) => c.id === id)
}

$("#cat-list").addEventListener("change", (e) => {
  const c = catFromRow(e.target)
  if (!c) return
  if (e.target.matches(".cat-icon")) c.icon = e.target.value.trim() || "•"
  if (e.target.matches(".cat-name")) c.label = e.target.value.trim() || c.label
  save()
  render()
})

$("#cat-list").addEventListener("click", async (e) => {
  const c = catFromRow(e.target)
  if (!c) return
  if (e.target.matches(".cat-type")) {
    c.type = c.type === "in" ? "out" : "in"
  } else if (e.target.matches(".cat-del")) {
    if (state.cats.length === 1) return toast("Deja al menos una categoría")
    const used = state.tx.filter((t) => t.cat === c.id).length
    if (used && !(await ask(`"${c.label}" tiene ${used} movimiento(s). Quedarán como "Sin categoría". ¿Borrarla?`, "Borrar"))) return
    state.cats = state.cats.filter((x) => x !== c)
  } else return
  save()
  render()
  renderCatEditor()
})

$("#cat-add").addEventListener("click", () => {
  state.cats.push({ id: newId(), label: "Nueva", icon: "🏷️", type: "out" })
  save()
  render()
  renderCatEditor()
  const inputs = $("#cat-list").querySelectorAll(".cat-name")
  inputs[inputs.length - 1].select()
})

/* ***********************
* Exportar, importar y borrar
*************************/
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
    .map((t) => [t.date, t.type === "in" ? "Ingreso" : "Gasto", q(cat(t.cat).label), q(t.note), t.type === "in" ? t.amount : -t.amount].join(","))
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
    if (!(await ask(`¿Reemplazar tus datos por la copia (${data.tx.length} movimientos)?`, "Reemplazar"))) return
    state = withDefaults(data)
    save()
    $("#settings").close()
    render()
    toast("Copia restaurada")
  } catch {
    toast("Ese archivo no es una copia válida")
  }
})

$("#wipe").addEventListener("click", async () => {
  if (!(await ask("¿Borrar todos los movimientos? No se puede deshacer.", "Borrar todo"))) return
  state = { ...state, tx: [] }
  save()
  $("#settings").close()
  render()
})

/* ***********************
* Inicio
*************************/
setDate(today())
render()

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {})
}
