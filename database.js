import fs from "fs";
import path from "path";
import { OWNER_ID } from "./setting/config.js";

const DB_DIR = "./database";

function dbPath(name) {
    return path.join(DB_DIR, `${name}.json`);
}

function readJson(name, fallback) {
    try {
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

        const file = dbPath(name);
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
        return fallback;
    }
}

function writeJson(name, data) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2));
}

/* ================= ADMIN ================= */
export function getAdmins() {
    return readJson("admin", { admins: [] }).admins;
}
export function addAdmin(id) {
    const data = readJson("admin", { admins: [] });
    if (!data.admins.includes(id)) data.admins.push(id);
    writeJson("admin", data);
}
export function removeAdmin(id) {
    const data = readJson("admin", { admins: [] });
    data.admins = data.admins.filter((x) => x !== id);
    writeJson("admin", data);
}

/* ================= PREMIUM ================= */
export function getPremiums() {
    return readJson("premium", { premium: [] }).premium;
}
export function addPremium(id) {
    const data = readJson("premium", { premium: [] });
    if (!data.premium.includes(id)) data.premium.push(id);
    writeJson("premium", data);
}
export function removePremium(id) {
    const data = readJson("premium", { premium: [] });
    data.premium = data.premium.filter((x) => x !== id);
    writeJson("premium", data);
}

/* ================= MODE ================= */
export function getMode() {
    return readJson("mode", { mode: "private" }).mode;
}
export function setMode(mode) {
    writeJson("mode", { mode });
}

/* ================= USERS (buat broadcast) ================= */
export function getUsers() {
    return readJson("users", { users: [] }).users;
}
export function addUser(id) {
    const data = readJson("users", { users: [] });
    if (!data.users.includes(String(id))) {
        data.users.push(String(id));
        writeJson("users", data);
    }
}
export function removeUser(id) {
    const data = readJson("users", { users: [] });
    data.users = data.users.filter((x) => x !== String(id));
    writeJson("users", data);
}

/* ================= PAIRS ================= */
export function getAllPairs() {
    return readJson("pairs", {});
}
export function getPairsForUser(uid) {
    const data = getAllPairs();
    return data[uid] || [];
}
export function addPairNumber(uid, number) {
    const data = getAllPairs();
    if (!data[uid]) data[uid] = [];
    if (!data[uid].includes(number)) data[uid].push(number);
    writeJson("pairs", data);
}
export function removePairNumber(uid, number) {
    const data = getAllPairs();
    if (data[uid]) {
        data[uid] = data[uid].filter((n) => n !== number);
        if (data[uid].length === 0) delete data[uid];
    }
    writeJson("pairs", data);
}
export function clearAllPairs() {
    writeJson("pairs", {});
    
}

/* ================= DEPLOYED BOTS (per user, gak kecampur) ================= */
export function getAllBotsRaw() {
    return readJson("bots", {});
}
export function getBotsForUser(uid) {
    return getAllBotsRaw()[String(uid)] || [];
}
export function addBotEntry(uid, token, ownerId) {
    const data = getAllBotsRaw();
    const key = String(uid);
    if (!data[key]) data[key] = [];

    if (data[key].some((b) => b.token === token)) return false;

    data[key].push({ token, ownerId: String(ownerId), addedAt: Date.now() });
    writeJson("bots", data);
    return true;
}
export function removeBotEntry(uid, token) {
    const data = getAllBotsRaw();
    const key = String(uid);
    if (data[key]) {
        data[key] = data[key].filter((b) => b.token !== token);
        if (!data[key].length) delete data[key];
    }
    writeJson("bots", data);
}
export function findBotOwnerUid(token) {
    const data = getAllBotsRaw();
    for (const uid of Object.keys(data)) {
        if (data[uid].some((b) => b.token === token)) return uid;
    }
    return null;
}

/* ================= ACCESS HELPERS ================= */
export function isOwner(id) {
    return String(id) === String(OWNER_ID);
}
export function isAdmin(id) {
    return isOwner(id) || getAdmins().includes(String(id));
}
export function isPremium(id) {
    return getPremiums().includes(String(id));
}
export function hasAccess(id) {
    return isOwner(id) || isAdmin(id) || isPremium(id);
}
export function canUseBot(id) {
    if (getMode() === "public") return true;
    return hasAccess(id);
}