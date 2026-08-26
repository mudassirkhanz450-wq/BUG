import { Bot } from "grammy";
import { log } from "./logger.js";
import { getAllBotsRaw, removeBotEntry } from "../database.js";
import { registerBotHandlers } from "./handlers.js";

// key = token -> instance Bot yang lagi jalan
export const deployedBots = new Map();


// ----------- ( fungsi: startDeployedBot ) ------------ //

    export async function startDeployedBot(token, ownerId, deployerUid) {
        if (deployedBots.has(token)) {
            return deployedBots.get(token);
        }

        const subBot = new Bot(token);

        registerBotHandlers(subBot, {
            isSubBot: true,
            subBotOwnerId: String(ownerId),
        });

        subBot.catch((err) => {
            log.error(`Sub-bot error (...${token.slice(-6)}): ${err.message}`);
        });

        // validasi token dulu sebelum start, biar gak nyangkut proses zombie
        await subBot.init();
        subBot.start();

        deployedBots.set(token, subBot);
        log.success(`Sub-bot aktif | Owner: ${ownerId} | Deployer: ${deployerUid}`);

        return subBot;
    }


// ----------- ( fungsi: stopDeployedBot ) ------------ //

    export async function stopDeployedBot(token) {
        const subBot = deployedBots.get(token);
        if (!subBot) return false;

        try {
            await subBot.stop();
        } catch {}

        deployedBots.delete(token);
        log.warning(`Sub-bot dihentikan (...${token.slice(-6)})`);
        return true;
    }


// ----------- ( fungsi: restoreDeployedBots, dipanggil pas startup ) ------------ //

    export async function restoreDeployedBots() {
        const all = getAllBotsRaw();
        const entries = Object.entries(all);

        if (!entries.length) {
            log.warning("Belum ada bot ter-deploy, skip restore.");
            return;
        }

        let success = 0;
        let failed = 0;

        for (const [deployerUid, bots] of entries) {
            for (const b of bots) {
                try {
                    await startDeployedBot(b.token, b.ownerId, deployerUid);
                    success++;
                } catch (err) {
                    failed++;
                    log.error(`Restore sub-bot gagal (...${b.token.slice(-6)}): ${err.message}`);

                    // token invalid/dicabut -> bersihin biar gak nyoba lagi tiap restart
                    if (err.message?.includes("404") || err.message?.includes("Not Found")) {
                        removeBotEntry(deployerUid, b.token);
                        log.warning(`Token invalid dihapus otomatis (...${b.token.slice(-6)})`);
                    }
                }
            }
        }

        log.success(`Restore sub-bot selesai — 🟢 ${success} berhasil, 🔴 ${failed} gagal`);
    }