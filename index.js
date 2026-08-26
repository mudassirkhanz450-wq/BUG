import { Bot } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { BOT_TOKEN, OWNER_ID } from "./setting/config.js";
import { log } from "./path/logger.js";
import { registerBotHandlers } from "./path/handlers.js";
import { restoreDeployedBots } from "./path/deploy.js";
import { loadAllWhatsappSessions } from "./path/whatsapp.js";
import { getUsers } from "./database.js";

const bot = new Bot(BOT_TOKEN);

// sequentialize per-chat: update dari chat yang SAMA tetap urut (biar gak ada
// race condition kayak dua command bareng di 1 chat), tapi chat yang BEDA
// tetap diproses paralel — jadi 1 user pakai command berat gak nge-block user lain.
function getSessionKey(ctx) {
    return ctx.chat?.id?.toString();
}
bot.use(sequentialize(getSessionKey));


// ----------- ( fungsi: notifyOwnerCrash, laporan darurat via Telegram ) ------------ //

    async function notifyOwnerCrash(label, err) {
        const detail = err?.stack || err?.message || String(err);
        log.error(`${label}: ${detail}`);

        if (!OWNER_ID) return;
        try {
            await bot.api.sendMessage(
                OWNER_ID,
                `🚨 *${label}*\n\n\`\`\`\n${detail.slice(0, 3000)}\n\`\`\``,
                { parse_mode: "Markdown" }
            );
        } catch {}
    }


// ----------- ( GLOBAL SAFETY NET: bot gak boleh mati gara-gara error liar ) ------------ //

    process.on("unhandledRejection", (reason) => {
        notifyOwnerCrash("UNHANDLED REJECTION", reason);
    });

    process.on("uncaughtException", (err) => {
        notifyOwnerCrash("UNCAUGHT EXCEPTION", err);
    });


// ----------- ( fungsi: load user pas startup ) ------------ //

    function loadUsersOnStartup() {
        const users = getUsers();
        log.success(`${users.length} user berhasil dimuat dari database`);
        return users;
    }


// ----------- ( daftarin command ke bot utama, isSubBot: false ) ------------ //

    registerBotHandlers(bot, { isSubBot: false });


// ----------- ( start bot utama + restore sesi ) ------------ //

    // run() dari @grammyjs/runner: update diproses paralel (concurrent),
    // beda sama bot.start() bawaan yang proses update satu-satu berurutan
    // (itu penyebab bot "diam"/freeze pas ada command lain yang lagi jalan).
    const runner = run(bot, {
        sink: {
            concurrency: 25, // maksimal 25 update diproses bersamaan
        },
    });

    log.success("SHOYU BOT (utama) berhasil terhubung ke Telegram");

    loadAllWhatsappSessions(bot);
    loadUsersOnStartup();
    await restoreDeployedBots();

    log.whatsapp("SHOYU BOT siap digunakan 🚀");

    // Matiin runner dengan rapi kalau proses di-terminate (misal pas restart PM2/systemd)
    const stopRunner = () => {
        if (runner.isRunning()) runner.stop();
    };
    process.once("SIGINT", stopRunner);
    process.once("SIGTERM", stopRunner);