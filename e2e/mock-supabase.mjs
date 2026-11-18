// Servidor simulado de Supabase (PostgREST + Auth mínimo) para pruebas E2E.
// Implementa sólo lo que la app usa: select con relaciones embebidas, filtros
// eq/neq/gte/lte/in/is, order, insert/upsert/update/delete y columnas generadas.
//
// Endpoints de control (sólo pruebas):
//   POST /__reset   body: { seed?: {...tablas}, latencyMs?: number }
//   GET  /__stats   -> { requests: [{method, table, bytes, ms}], ... }
//   GET  /__db      -> volcado de la base en memoria
//
// Uso: node e2e/mock-supabase.mjs   (PORT=54321 por defecto)

import http from "node:http"
import { randomUUID } from "node:crypto"
import zlib from "node:zlib"

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54321)

// ---------- Esquema ----------
const SCHEMA = {
  clientes: { unique: ["telefono"], required: ["telefono", "nombre"] },
  flores: { required: ["nombre", "precio_actual"], defaults: { is_active: true } },
  insumos: { required: ["nombre"], defaults: { is_active: true, unidad: "unidad", precio_actual: 0 } },
  arreglos: {
    unique: ["codigo"],
    required: ["nombre", "precio_real"],
    defaults: { is_active: true, descripcion: null, foto_url: null, codigo: null, categoria: null },
  },
  arreglo_flores: { required: ["arreglo_id", "flor_id"], defaults: { cantidad: 1 } },
  arreglo_insumos: { required: ["arreglo_id", "insumo_id"], defaults: { cantidad: 1 } },
  pedidos: {
    required: ["cliente", "precio_total"],
    serial: "numero_pedido",
    defaults: {
      telefono: null, direccion: null, domicilio: null, fecha_entrega: null, hora_entrega: null,
      arreglo_id: null, foto_url: null, descripcion: null, mensaje_tarjeta: null,
      abono: 0, pago_efectivo: 0, pago_tarjeta: 0, pago_transferencia: 0, estado: "Pendiente",
    },
    check: (r) =>
      ["Pendiente", "En preparación", "En ruta", "Entregado", "Cancelado"].includes(r.estado)
        ? null
        : `new row for relation "pedidos" violates check constraint "pedidos_estado_check"`,
    generated: (r) => ({ saldo: round2(Number(r.precio_total) - Number(r.abono || 0)) }),
  },
}

// relaciones: tabla -> { nombreEmbed: { table, kind: 'one'|'many', local, foreign } }
const RELATIONS = {
  pedidos: { arreglos: { table: "arreglos", kind: "one", local: "arreglo_id", foreign: "id" } },
  arreglos: {
    arreglo_flores: { table: "arreglo_flores", kind: "many", local: "id", foreign: "arreglo_id" },
    arreglo_insumos: { table: "arreglo_insumos", kind: "many", local: "id", foreign: "arreglo_id" },
    pedidos: { table: "pedidos", kind: "many", local: "id", foreign: "arreglo_id" },
  },
  arreglo_flores: {
    flores: { table: "flores", kind: "one", local: "flor_id", foreign: "id" },
    arreglos: { table: "arreglos", kind: "one", local: "arreglo_id", foreign: "id" },
  },
  arreglo_insumos: { insumos: { table: "insumos", kind: "one", local: "insumo_id", foreign: "id" } },
}

const round2 = (n) => Math.round(n * 100) / 100

let db = {}
let serials = {}
let latencyMs = 0
let stats = []

function reset(seed = {}) {
  db = {}
  serials = {}
  for (const t of Object.keys(SCHEMA)) db[t] = []
  for (const [t, rows] of Object.entries(seed)) {
    for (const r of rows) insertRow(t, r, { skipChecks: true })
  }
  stats = []
}

function insertRow(table, input, { skipChecks = false } = {}) {
  const s = SCHEMA[table]
  if (!s) throw httpErr(404, "42P01", `relation "public.${table}" does not exist`)
  const now = new Date().toISOString()
  const row = { id: randomUUID(), created_at: now, ...(s.defaults || {}), ...stripUndefined(input) }
  if (table === "clientes" && !row.updated_at) row.updated_at = now
  if (s.serial && row[s.serial] == null) {
    serials[table] = (serials[table] || 0) + 1
    row[s.serial] = serials[table]
  } else if (s.serial) {
    serials[table] = Math.max(serials[table] || 0, row[s.serial])
  }
  if (!skipChecks) validate(table, row, null)
  if (s.generated) Object.assign(row, s.generated(row))
  db[table].push(row)
  return row
}

function validate(table, row, selfId) {
  const s = SCHEMA[table]
  for (const col of s.required || []) {
    if (row[col] === null || row[col] === undefined)
      throw httpErr(400, "23502", `null value in column "${col}" of relation "${table}" violates not-null constraint`)
  }
  for (const col of s.unique || []) {
    if (row[col] == null) continue
    if (db[table].some((r) => r.id !== selfId && r[col] === row[col]))
      throw httpErr(409, "23505", `duplicate key value violates unique constraint "${table}_${col}_key"`)
  }
  if (s.check) {
    const msg = s.check(row)
    if (msg) throw httpErr(400, "23514", msg)
  }
}

function stripUndefined(o) {
  const out = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out
}

function httpErr(status, code, message) {
  const e = new Error(message)
  e.status = status
  e.body = { code, message, details: null, hint: null }
  return e
}

// ---------- Parser de select ----------
function parseSelect(str) {
  str = (str || "*").replace(/\s+/g, "")
  const items = []
  let i = 0
  function parseList() {
    const list = []
    let cur = ""
    while (i < str.length) {
      const ch = str[i]
      if (ch === "(") {
        i++
        const children = parseList()
        list.push({ embed: cur, children })
        cur = ""
      } else if (ch === ")") {
        i++
        if (cur) list.push({ col: cur })
        return list
      } else if (ch === ",") {
        i++
        if (cur) list.push({ col: cur })
        cur = ""
      } else {
        cur += ch
        i++
      }
    }
    if (cur) list.push({ col: cur })
    return list
  }
  items.push(...parseList())
  return items
}

function project(table, row, sel) {
  const out = {}
  for (const item of sel) {
    if (item.col === "*") Object.assign(out, row)
    else if (item.col) {
      const [name, alias] = item.col.split(":").reverse()
      out[alias || name] = row[name]
    }
  }
  for (const item of sel) {
    if (!item.embed) continue
    const [relName, alias] = item.embed.split(":").reverse()
    const rel = RELATIONS[table]?.[relName.replace(/!inner$/, "")]
    if (!rel) throw httpErr(400, "PGRST200", `Could not find a relationship between '${table}' and '${relName}'`)
    const key = alias || relName
    if (rel.kind === "one") {
      const target = db[rel.table].find((r) => r[rel.foreign] === row[rel.local])
      out[key] = target ? project(rel.table, target, item.children) : null
    } else {
      out[key] = db[rel.table]
        .filter((r) => r[rel.foreign] === row[rel.local])
        .map((r) => project(rel.table, r, item.children))
    }
  }
  return out
}

// ---------- Filtros ----------
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"])

function parseValue(v) {
  if (v === "null") return null
  if (v === "true") return true
  if (v === "false") return false
  return v
}

function splitInList(s) {
  // in.("a","b",c)
  const inner = s.replace(/^\(/, "").replace(/\)$/, "")
  const out = []
  let cur = ""
  let q = false
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '"') q = !q
    else if (ch === "," && !q) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  if (cur || inner.length) out.push(cur)
  return out
}

function cmp(a, b) {
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b)
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function buildFilters(params) {
  const filters = []
  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue
    const dot = raw.indexOf(".")
    let op = raw.slice(0, dot)
    let val = raw.slice(dot + 1)
    let negate = false
    if (op === "not") {
      negate = true
      const d2 = val.indexOf(".")
      op = val.slice(0, d2)
      val = val.slice(d2 + 1)
    }
    const fn = (row) => {
      const cell = row[key]
      switch (op) {
        case "eq": {
          const v = parseValue(val)
          return cell === v || (cell != null && v != null && String(cell) === String(v))
        }
        case "neq": {
          // En SQL, NULL <> 'x' es NULL (no coincide)
          if (cell == null) return false
          return String(cell) !== String(parseValue(val))
        }
        case "gt": return cell != null && cmp(cell, val) > 0
        case "gte": return cell != null && cmp(cell, val) >= 0
        case "lt": return cell != null && cmp(cell, val) < 0
        case "lte": return cell != null && cmp(cell, val) <= 0
        case "in": return cell != null && splitInList(val).map(String).includes(String(cell))
        case "is": return val === "null" ? cell == null : cell === parseValue(val)
        case "ilike": {
          const re = new RegExp("^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*") + "$", "i")
          return cell != null && re.test(String(cell))
        }
        default: throw httpErr(400, "PGRST100", `operador no soportado en mock: ${op}`)
      }
    }
    filters.push(negate ? (r) => !fn(r) : fn)
  }
  return (row) => filters.every((f) => f(row))
}

function applyOrder(rows, order) {
  if (!order) return rows
  const specs = order.split(",").map((s) => {
    const [col, dir = "asc", nulls] = s.split(".")
    const desc = dir === "desc"
    // PostgreSQL: ASC -> NULLS LAST, DESC -> NULLS FIRST
    const nullsFirst = nulls ? nulls === "nullsfirst" : desc
    return { col, desc, nullsFirst }
  })
  return [...rows].sort((a, b) => {
    for (const { col, desc, nullsFirst } of specs) {
      const x = a[col]
      const y = b[col]
      if (x == null && y == null) continue
      if (x == null) return nullsFirst ? -1 : 1
      if (y == null) return nullsFirst ? 1 : -1
      const c = cmp(x, y)
      if (c !== 0) return desc ? -c : c
    }
    return 0
  })
}

// ---------- HTTP ----------
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,PUT,OPTIONS,HEAD")
  res.setHeader("Access-Control-Allow-Headers", "*")
  res.setHeader("Access-Control-Expose-Headers", "Content-Range")
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      const s = Buffer.concat(chunks).toString("utf8")
      resolve(s ? JSON.parse(s) : null)
    })
  })
}

let currentReq = null
function send(res, status, body, extraHeaders = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body)
  const headers = { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  // Igual que Supabase: respuestas comprimidas con gzip si el cliente lo acepta
  const acceptsGzip = (currentReq?.headers["accept-encoding"] || "").includes("gzip")
  if (acceptsGzip && payload.length > 1024) {
    const gz = zlib.gzipSync(payload)
    res.writeHead(status, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" })
    res.end(gz)
    res.__gzBytes = gz.length
    return Buffer.byteLength(payload)
  }
  res.writeHead(status, headers)
  res.end(payload)
  res.__gzBytes = Buffer.byteLength(payload)
  return Buffer.byteLength(payload)
}

async function handleRest(req, res, url) {
  const table = url.pathname.replace(/^\/rest\/v1\//, "")
  if (!SCHEMA[table]) throw httpErr(404, "42P01", `relation "public.${table}" does not exist`)
  const params = url.searchParams
  const prefer = req.headers["prefer"] || ""
  const wantsSingle = (req.headers["accept"] || "").includes("vnd.pgrst.object")
  const returnRep = prefer.includes("return=representation")
  const sel = parseSelect(params.get("select") || "*")
  const match = buildFilters(params)

  const finish = (rows, status) => {
    let out = rows.map((r) => project(table, r, sel))
    if (wantsSingle) {
      if (out.length !== 1)
        throw httpErr(406, "PGRST116", `JSON object requested, multiple (or no) rows returned`)
      return send(res, status, out[0])
    }
    return send(res, status, out)
  }

  if (req.method === "GET" || req.method === "HEAD") {
    let rows = db[table].filter(match)
    rows = applyOrder(rows, params.get("order"))
    const offset = Number(params.get("offset") || 0)
    const limit = params.get("limit") ? Number(params.get("limit")) : undefined
    rows = rows.slice(offset, limit !== undefined ? offset + limit : undefined)
    return finish(rows, 200)
  }

  if (req.method === "POST") {
    let body = await readBody(req)
    if (!Array.isArray(body)) body = [body]
    const merge = prefer.includes("resolution=merge-duplicates")
    const conflictCol = params.get("on_conflict")
    // transacción: validar todo antes de confirmar
    const snapshot = structuredClone(db[table])
    const serialSnap = serials[table]
    const created = []
    try {
      for (const input of body) {
        if (merge && conflictCol && input[conflictCol] != null) {
          const existing = db[table].find((r) => r[conflictCol] === input[conflictCol])
          if (existing) {
            Object.assign(existing, stripUndefined(input))
            validate(table, existing, existing.id)
            if (SCHEMA[table].generated) Object.assign(existing, SCHEMA[table].generated(existing))
            created.push(existing)
            continue
          }
        }
        if ("saldo" in input) throw httpErr(400, "428C9", `cannot insert a non-DEFAULT value into column "saldo"`)
        created.push(insertRow(table, input))
      }
    } catch (e) {
      db[table] = snapshot
      serials[table] = serialSnap
      throw e
    }
    if (!returnRep) return send(res, 201, undefined)
    return finish(created, 201)
  }

  if (req.method === "PATCH") {
    const patch = await readBody(req)
    if ("saldo" in patch) throw httpErr(400, "428C9", `column "saldo" can only be updated to DEFAULT`)
    const rows = db[table].filter(match)
    const backup = rows.map((r) => ({ ...r }))
    try {
      for (const r of rows) {
        Object.assign(r, stripUndefined(patch))
        validate(table, r, r.id)
        if (SCHEMA[table].generated) Object.assign(r, SCHEMA[table].generated(r))
      }
    } catch (e) {
      rows.forEach((r, i) => Object.assign(r, backup[i]))
      throw e
    }
    if (!returnRep) return send(res, 204, undefined)
    return finish(rows, 200)
  }

  if (req.method === "DELETE") {
    const rows = db[table].filter(match)
    // FK: arreglo_flores.flor_id ON DELETE RESTRICT; cascadas
    if (table === "flores" && rows.some((f) => db.arreglo_flores.some((af) => af.flor_id === f.id)))
      throw httpErr(409, "23503", `update or delete on table "flores" violates foreign key constraint`)
    const ids = new Set(rows.map((r) => r.id))
    db[table] = db[table].filter((r) => !ids.has(r.id))
    if (table === "arreglos") {
      db.arreglo_flores = db.arreglo_flores.filter((r) => !ids.has(r.arreglo_id))
      db.arreglo_insumos = db.arreglo_insumos.filter((r) => !ids.has(r.arreglo_id))
      db.pedidos.forEach((p) => ids.has(p.arreglo_id) && (p.arreglo_id = null))
    }
    if (!returnRep) return send(res, 204, undefined)
    return finish(rows, 200)
  }

  throw httpErr(405, "PGRST", "method not allowed")
}

const server = http.createServer(async (req, res) => {
  cors(res)
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    return res.end()
  }
  currentReq = req
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const started = Date.now()
  let bytes = 0
  try {
    if (url.pathname === "/__reset") {
      const body = (await readBody(req)) || {}
      latencyMs = body.latencyMs || 0
      reset(body.seed || {})
      return send(res, 200, { ok: true })
    }
    if (url.pathname === "/__stats") return send(res, 200, { requests: stats })
    if (url.pathname === "/__stats/clear") {
      stats = []
      return send(res, 200, { ok: true })
    }
    if (url.pathname === "/__db") return send(res, 200, db)

    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs))

    if (url.pathname.startsWith("/auth/v1/")) {
      bytes = send(res, 401, { code: 401, error_code: "no_authorization", msg: "No session (mock)" })
      return
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      bytes = await handleRest(req, res, url)
      return
    }
    bytes = send(res, 404, { message: "not found" })
  } catch (e) {
    bytes = send(res, e.status || 500, e.body || { message: String(e) })
  } finally {
    if (!url.pathname.startsWith("/__") && req.method !== "OPTIONS") {
      stats.push({
        method: req.method,
        path: url.pathname.replace(/^\/rest\/v1\//, ""),
        query: url.search,
        status: res.statusCode,
        bytes: bytes || 0,
        gzipBytes: res.__gzBytes || 0,
        ms: Date.now() - started,
      })
    }
  }
})

reset()
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase] escuchando en http://127.0.0.1:${PORT}`)
})
