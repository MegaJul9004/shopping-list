import fs from "node:fs";
import path from "node:path";

// Globale Rollen werden ueber einzelne Textdateien in backend/roles/ verwaltet.
// Jede Zeile: "benutzername|nutzernummer". Kommentare mit // und Leerzeilen werden ignoriert.
// Trennzeichen ist | (Pipe), NICHT #, weil Proxmox # als Kommentarzeichen interpretiert.
const rolesDir = path.resolve(process.cwd(), "roles");
if (!fs.existsSync(rolesDir)) fs.mkdirSync(rolesDir, { recursive: true });

// Reihenfolge = Prioritaet (hoechste zuerst)
export const ROLE_ORDER = ["owner", "developer", "admin", "supporter", "user"];

export const ROLE_LABELS = {
  owner: "Owner",
  developer: "Entwickler",
  admin: "Admin",
  supporter: "Unterstützer/Spender",
  user: "Benutzer"
};

export const ROLE_HIERARCHY = ROLE_ORDER.slice();

export function getAllowedGlobalRolesForAssigner(assignerRole) {
  // Wer welche Rollen vergeben darf (nur Owner darf zuweisen)
  return { canAssign: assignerRole === "owner" };
}

function roleFile(role) {
  return path.join(rolesDir, `${role}.txt`);
}

function normalizeLine(line) {
  const t = String(line).trim();
  if (!t) return null;
  if (t.startsWith("//")) return null;
  return t;
}

export function readRoleMembers(role) {
  const file = roleFile(role);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const members = [];
  for (const line of lines) {
    const entry = normalizeLine(line);
    if (!entry) continue;
    const sepIdx = entry.indexOf("|");
    if (sepIdx === -1) continue;
    const username = entry.slice(0, sepIdx).trim();
    const userNumber = Number(entry.slice(sepIdx + 1).trim());
    if (!username || !Number.isFinite(userNumber)) continue;
    members.push({ username, userNumber });
  }
  return members;
}

export function writeRoleMembers(role, members) {
  const file = roleFile(role);
  const lines = members.map((m) => `${m.username}|${m.userNumber}`);
  fs.writeFileSync(file, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
}

// Ermittelt die hoechste Rolle eines Nutzers (Standard: user)
export function getUserRole(username, userNumber) {
  for (const role of ROLE_ORDER) {
    const members = readRoleMembers(role);
    if (members.some((m) => m.username === username && m.userNumber === userNumber)) {
      return role;
    }
  }
  return "user";
}

export function getAllRoles() {
  const result = {};
  for (const role of ROLE_ORDER) {
    result[role] = readRoleMembers(role);
  }
  return result;
}

// Weist einem Nutzer eine Rolle zu und entfernt ihn aus allen anderen.
export function assignRole({ username, userNumber, role }) {
  if (!ROLE_ORDER.includes(role)) {
    throw new Error("Unknown role: " + role);
  }
  for (const r of ROLE_ORDER) {
    if (r === role) continue;
    writeRoleMembers(
      r,
      readRoleMembers(r).filter((m) => !(m.username === username && m.userNumber === userNumber))
    );
  }
  const target = readRoleMembers(role).filter(
    (m) => !(m.username === username && m.userNumber === userNumber)
  );
  target.push({ username, userNumber });
  writeRoleMembers(role, target);
  return role;
}
