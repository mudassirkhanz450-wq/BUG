import fs from "fs";
import path from "path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import { log } from "./logger.js";
import * as baileys from "@whiskeysockets/baileys";

const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;

const { useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason, groupMetadataFromInvite } = baileys;

import { SESSION_ROOT, OWNER_ID } from "../setting/config.js";
import { removePairNumber } from "../database.js";

// key = `${uid}_${number}` -> { sock, status, reconnecting }
export const waClients = new Map();

// guard biar gak ada 2 proses init jalan bareng buat key yang sama
const initializingKeys = new Set();

function clientKey(uid, number) {
    return `${uid}_${number}`;
}

function getSessionPath(uid, number) {
    return path.join(SESSION_ROOT, String(uid), String(number));
}

function tag(uid, number) {
    return `User: ${uid} | Nomor: ${number}`;
}

export function getClient(uid, number) {
    return waClients.get(clientKey(uid, number));
}

async function deleteSessionFiles(uid, number) {
    try {
        await fs.promises.rm(getSessionPath(uid, number), { recursive: true, force: true });
    } catch {}
}


// ----------- ( fungsi: notifyOwner, laporan error ke owner via Telegram ) ------------ //

    async function notifyOwner(bot, message) {
        if (!bot?.api || !OWNER_ID) return;
        try {
            await bot.api.sendMessage(OWNER_ID, `🚨 *WA ERROR LOG*\n\n${message}`, { parse_mode: "Markdown" });
        } catch (err) {
            log.error(`Gagal kirim notif ke owner: ${err.message}`);
        }
    }


// ----------- ( fungsi: getReconnectDelay, exponential backoff + jitter ) ------------ //

    function getReconnectDelay(retryCount) {
        const base = 5000;
        const exponential = Math.min(base * 2 ** retryCount, 60000);
        const jitter = Math.floor(Math.random() * 2000);
        return exponential + jitter;
    }


// ----------- ( fungsi: initWhatsappForNumber ) ------------ //

    export async function initWhatsappForNumber(bot, uid, number, retryCount = 0) {
        const MAX_RETRIES = 5;
        const key = clientKey(uid, number);
        const sessionPath = getSessionPath(uid, number);

        const oldClient = waClients.get(key);
        if (oldClient?.sock && oldClient.status === "open") {
            log.info(`Session sudah aktif, skip init ulang | ${tag(uid, number)}`);
            return oldClient.sock;
        }

        if (initializingKeys.has(key)) {
            log.warning(`Init sudah berjalan, skip duplikat | ${tag(uid, number)}`);
            return oldClient?.sock || null;
        }
        initializingKeys.add(key);

        try {
            if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

            log.loading(`Menghubungkan WhatsApp... | ${tag(uid, number)}`);

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            const sock = makeWASocket({
                logger: pino({ level: "silent" }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                syncFullHistory: false,
                markOnlineOnConnect: false,
                retryRequestDelayMs: 500,
            });

            sock.ev.on("creds.update", saveCreds);

            waClients.set(key, { sock, status: "connecting", reconnecting: false });

            sock.waitForOpen = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Timeout menunggu koneksi WhatsApp"));
                }, 60000);

                sock.ev.on("connection.update", (update) => {
                    if (update.connection === "open") {
                        clearTimeout(timeout);
                        resolve(true);
                    }
                    if (update.connection === "close") {
                        clearTimeout(timeout);
                        reject(new Error("Koneksi WhatsApp tertutup"));
                    }
                });
            });
            sock.waitForOpen.catch(() => {});

            sock.ev.on("connection.update", async (update) => {
                try {
                    const { connection, lastDisconnect } = update || {};
                    const client = waClients.get(key);

                    if (connection === "close") {
                        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                        if (client) client.status = "closed";

                        if (reason === DisconnectReason.restartRequired) {
                            log.info(`Restart koneksi (normal, bagian dari pairing) | ${tag(uid, number)}`);
                            initializingKeys.delete(key);
                            initWhatsappForNumber(bot, uid, number, 0).catch((err) => {
                                log.error(`Restart koneksi gagal | ${tag(uid, number)} | ${err.message}`);
                            });
                            return;
                        }

                        if (
                            reason === DisconnectReason.loggedOut ||
                            reason === DisconnectReason.connectionReplaced ||
                            reason === 401 ||
                            reason === 403
                        ) {
                            log.error(`Logout / Banned / Diganti sesi lain, session dihapus otomatis | ${tag(uid, number)}`);

                            await deleteSessionFiles(uid, number);
                            removePairNumber(String(uid), number);
                            waClients.delete(key);
                            initializingKeys.delete(key);

                            await notifyOwner(bot, `Nomor \`${number}\` (user \`${uid}\`) logout/banned/diganti sesi lain. Sesi otomatis dihapus.`);

                            try {
                                await bot.api.sendMessage(
                                    uid,
                                    `🚫 *WhatsApp terputus*\nNomor ${number} logout/banned, sesi otomatis dihapus.`,
                                    { parse_mode: "Markdown" }
                                );
                            } catch {}
                            return;
                        }

                        if (client && !client.reconnecting && retryCount < MAX_RETRIES) {
                            client.reconnecting = true;
                            const delay = getReconnectDelay(retryCount);
                            log.warning(`Terputus, reconnecting dalam ${Math.round(delay / 1000)}s (${retryCount + 1}/${MAX_RETRIES})... | ${tag(uid, number)}`);

                            setTimeout(() => {
                                const c = waClients.get(key);
                                if (c) c.reconnecting = false;
                                initializingKeys.delete(key);
                                initWhatsappForNumber(bot, uid, number, retryCount + 1).catch((err) => {
                                    log.error(`Reconnect gagal | ${tag(uid, number)} | ${err.message}`);
                                });
                            }, delay);

                        } else if (retryCount >= MAX_RETRIES) {
                            log.error(`Gagal reconnect setelah ${MAX_RETRIES}x, session dihapus | ${tag(uid, number)}`);

                            await deleteSessionFiles(uid, number);
                            removePairNumber(String(uid), number);
                            waClients.delete(key);
                            initializingKeys.delete(key);

                            await notifyOwner(bot, `Nomor \`${number}\` (user \`${uid}\`) gagal reconnect setelah ${MAX_RETRIES}x. Sesi dihapus.`);

                            try {
                                await bot.api.sendMessage(
                                    uid,
                                    `🚫 *Sesi dihapus otomatis*\nGagal reconnect nomor ${number} setelah ${MAX_RETRIES} percobaan.`,
                                    { parse_mode: "Markdown" }
                                );
                            } catch {}
                        }
                    } else if (connection === "open") {
                        if (client) client.status = "open";
                        initializingKeys.delete(key);
                        log.success(`WhatsApp terhubung! | ${tag(uid, number)}`);
                    }
                } catch (err) {
                    log.error(`Error internal connection.update | ${tag(uid, number)} | ${err.message}`);
                    await notifyOwner(bot, `Error internal di handler koneksi\n${tag(uid, number)}\n\n\`${err.message}\``);
                }
            });

            return sock;

        } finally {
            setTimeout(() => initializingKeys.delete(key), 5000);
        }
    }


// ----------- ( fungsi: waitForPairSuccess, khusus dipakai flow /pair ) ------------ //

    export function waitForPairSuccess(uid, number, timeoutMs = 90000) {
        return new Promise((resolve, reject) => {
            const key = clientKey(uid, number);
            const start = Date.now();

            const interval = setInterval(() => {
                const client = waClients.get(key);

                if (client?.status === "open") {
                    clearInterval(interval);
                    resolve(true);
                    return;
                }

                if (!client) {
                    clearInterval(interval);
                    reject(new Error("Pairing gagal, sesi dihapus (kemungkinan logout/banned)"));
                    return;
                }

                if (Date.now() - start > timeoutMs) {
                    clearInterval(interval);
                    reject(new Error("Timeout menunggu WhatsApp terhubung"));
                }
            }, 1000);
        });
    }


// ----------- ( fungsi: loadAllWhatsappSessions, restore semua sesi pas startup ) ------------ //

    export async function loadAllWhatsappSessions(bot) {
        log.loading("Memulai restore semua session WhatsApp...");

        if (!fs.existsSync(SESSION_ROOT)) {
            log.warning("Folder session tidak ditemukan, tidak ada yang di-restore.");
            return;
        }

        const userIds = (await fs.promises.readdir(SESSION_ROOT)).filter((uid) =>
            fs.statSync(path.join(SESSION_ROOT, uid)).isDirectory()
        );

        if (!userIds.length) {
            log.warning("Folder session kosong, tidak ada yang di-restore.");
            return;
        }

        let successCount = 0;
        let failedCount = 0;

        for (const uid of userIds) {
            const userPath = path.join(SESSION_ROOT, uid);
            const numbers = (await fs.promises.readdir(userPath)).filter((num) =>
                fs.statSync(path.join(userPath, num)).isDirectory()
            );

            if (!numbers.length) continue;

            log.info(`User ${uid} — ditemukan ${numbers.length} session tersimpan`);

            for (const number of numbers) {
                try {
                    log.loading(`Restore session... | ${tag(uid, number)}`);
                    await initWhatsappForNumber(bot, uid, number);
                    successCount++;

                    await new Promise((r) => setTimeout(r, 800));
                } catch (err) {
                    failedCount++;
                    log.error(`Gagal restore | ${tag(uid, number)} | ${err.message}`);
                    await notifyOwner(bot, `Gagal restore sesi\n${tag(uid, number)}\n\n\`${err.message}\``);
                }
            }
        }

        log.success(`Restore selesai — 🟢 ${successCount} berhasil, 🔴 ${failedCount} gagal`);
    }


// ----------- ( fungsi: waitForConnection, backward-compat ) ------------ //

    export function waitForConnection(sock, timeout = 60000) {
        return new Promise((resolve, reject) => {
            let timer = setTimeout(() => {
                reject(new Error("Timeout menunggu WhatsApp terhubung"));
            }, timeout);

            const handler = (update) => {
                const { connection } = update;

                if (connection === "open") {
                    clearTimeout(timer);
                    sock.ev.off("connection.update", handler);
                    resolve(true);
                }

                if (connection === "close") {
                    clearTimeout(timer);
                    sock.ev.off("connection.update", handler);
                    reject(new Error("Pairing gagal, koneksi tertutup"));
                }
            };

            sock.ev.on("connection.update", handler);
        });
    }


// ----------- ( fungsi: endWhatsappForNumber, hapus 1 sesi ) ------------ //

    export async function endWhatsappForNumber(uid, number) {
        const key = clientKey(uid, number);
        const client = waClients.get(key);

        log.warning(`Menghapus session... | ${tag(uid, number)}`);

        try {
            if (client?.sock?.end) await client.sock.end();
        } catch {}

        waClients.delete(key);
        initializingKeys.delete(key);
        await deleteSessionFiles(uid, number);

        log.success(`Session berhasil dihapus | ${tag(uid, number)}`);
    }


// ----------- ( fungsi: clearAllSessions, hapus semua sesi ) ------------ //

    export async function clearAllSessions() {
        const total = waClients.size;
        log.warning(`Menghapus SEMUA session WhatsApp (${total} aktif)...`);

        for (const key of [...waClients.keys()]) {
            const client = waClients.get(key);
            try {
                if (client?.sock?.end) await client.sock.end();
            } catch {}
            waClients.delete(key);
            initializingKeys.delete(key);
        }

        try {
            await fs.promises.rm(SESSION_ROOT, { recursive: true, force: true });
            fs.mkdirSync(SESSION_ROOT, { recursive: true });
            log.success(`Semua session (${total}) berhasil dihapus.`);
        } catch (err) {
            log.error(`Gagal membersihkan folder session: ${err.message}`);
        }
    }