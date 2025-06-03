const readline = require("readline"); 
const Boom = require("@hapi/boom");
const path = "./database.json";
const moment = require("moment-timezone");
const os = require("os");
const {
  useMultiFileAuthState,
  default: makeWASocket,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  makeInMemoryStore,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const NodeCache = require("node-cache");
const Groq = require("groq-sdk");
const { ai } = require('./lib/func.js')
const crypto = require("crypto")
const { exec } = require("child_process");
const { createRequire } = require("module");
const { fileURLToPath } = require("url");
const util = require("util")

const PHONENUMBER_MCC = {
  "62": "ID",
  "60": "MY",
  "91": "IN",
  "1": "US",
  "55": "BR",
  "81": "JP",
  "82": "KR",
  "84": "VN",
  "66": "TH",
  "234": "NG",
};
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// ============= Authorization ============= \\

const BOT_NUMBER = "";
const OWNER_NUMBER = ""

// =============------**------============ \\


// ================ Model ============= \\
const groq = new Groq({
  apiKey: "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", // https://console.groq.com/keys
});

// =============------**------============ \\


// ============= Connection ============= \\

/**
 *  @type {import("pino").Logger}
 */
const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: "Xyro" });
logger.level = "silent";

/**
 * @type {import("@whiskeysockets/baileys").MessageStore}
 */
 
const store = makeInMemoryStore({ logger });

async function Handler() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion()

  const creds_json = "session/creds.json";
  if (fs.existsSync(creds_json)) {
    console.info("Connecting....");
  } else {
    console.info("Try To Connecting A number.....");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const phoneNumber = await new Promise((resolve) => {
      rl.question("Please provide a number to pair with (e.g., 628xxxxxxx): ", (number) => {
        rl.close();
        resolve(number);
      });
    });

    if (!phoneNumber) {
      console.info("No phone number provided. Exiting...");
      process.exit(1);
    }

    let format_nomor = phoneNumber.startsWith("0") ? "62" + phoneNumber.slice(1) : phoneNumber;
    format_nomor = format_nomor.replace(/[^0-9]/g, ""); 

    if (!Object.keys(PHONENUMBER_MCC).some((v) => format_nomor.startsWith(v))) {
      console.info("Invalid phone number. Exiting...");
      process.exit(1);
    }

    const msgRetryCounterCache = new NodeCache();

    const Fumi = makeWASocket({
      logger,
      printQRInTerminal: true,
      auth: state,
      browser: ['Chrome', 'MacOS', '3.0'], 
      msgRetryCounterCache,
    });


    store.bind(Fumi.ev);
    Fumi.ev.on("creds.update", saveCreds);
    await sleep(5000);

    let code = await Fumi.requestPairingCode(format_nomor);
    console.info("Pairing code:", code.match(/.{1,4}/g).join("-"));

    Fumi.ev.on("connection.update", async (update) => {
      const { lastDisconnect, connection } = update;

      if (connection === "open") {
        console.info("Connection open");
      } else if (connection === "close") {
        let reason = Boom.isBoom(lastDisconnect?.error) ? lastDisconnect?.error.output.statusCode : null;
        console.info("Connection closed. Reason: ", reason);

        switch (reason) {
          case 400:
            console.info("Bad session, reconnecting...");
            Handler();
            break;
          case 1000:
            console.info("Connection closed, reconnecting...");
            Handler();
            break;
          default:
            console.info("Unknown reason, reconnecting...");
            Handler();
        }
      }
    });

    return;
  }
  const msgRetryCounterCache = new NodeCache();
  const Fumi = makeWASocket({
    logger,
    printQRInTerminal: process.argv.includes("qr"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    retryRequestDelayMs: 10,
    msgRetryCounterCache,
    transactionOpts: {
      maxCommitRetries: 10,
      delayBetweenTriesMs: 10,
    },
    defaultQueryTimeoutMs: undefined,
    maxMsgRetryCount: 15,
    appStateMacVerification: {
      patch: true,
      snapshot: true,
    },
    getMessage: async (key) => {
      const jid = jidNormalizedUser(key.remoteJid);
      const msg = await store.loadMessage(jid, key.id);
      return msg?.message || "";
    },
  });

  store.bind(Fumi.ev);
  Fumi.ev.on("creds.update", saveCreds);

  async function send_activ_notif() {
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ipAddress = ipData.ip;
        const connectedTime = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

        const messageToOwner = `*Hallo OwnerKu!!, Charlotte Aktive Nih!!*\n\n` +
            `🧾IP: ${ipAddress}\n` +
            `📞Number: ${BOT_NUMBER}\n` +
            `🕛Waktu: ${connectedTime}\n\n` +
            `🔮Fumi-Ai By: Xyro\n` +
            `🔎Website: https://xyro.fund\n` +
            `🗳️DonationInfo: https://saweria.co/Ifungtech`;

        await Fumi.sendMessage(`${OWNER_NUMBER}@s.whatsapp.net`, { image: { url: "https://ifung-as.xyro.tech/images/foto.gif" }, caption: messageToOwner });
        console.log("Fumi Was Connected!!!.");
    } catch (error) {
        console.error("Something Wrong, Check Your Code Again", error);
    }
}
  Fumi.ev.on("connection.update", async (update) => {
    const { lastDisconnect, connection } = update;

    if (connection === "open") {
      console.info("Connection open");
      send_activ_notif()
      return;
    }

    if (connection === "close") {
      let reason = Boom.isBoom(lastDisconnect?.error) ? lastDisconnect?.error.output.statusCode : null;

      console.info("Connection closed. Reason: ", reason);

      switch (reason) {
        case 400:
          console.info("Bad session, reconnecting...");
          Handler();
          break;
        case 1000:
          console.info("Connection closed, reconnecting...");
          Handler();
          break;
        case 1001:
          console.info("Connection lost, reconnecting...");
          Handler();
          break;
        case 1002:
          console.info("Connection replaced, reconnecting...");
          Handler();
          break;
        case 1003:
          console.info("Restart required, reconnecting...");
          Handler();
          break;
        case 1004:
          console.info("Logged out, clearing session...");
          if (fs.existsSync("session")) {
            for (const file of fs.readdirSync("session")) {
              fs.unlinkSync(`session/${file}`);
            }
          }
          process.exit(1);
          break;
        case 1005:
          console.info("Multidevice mismatch, check your devices");
          break;
        default:
          console.info("Unknown reason, reconnecting...");
          Handler();
      }
    }
  });


const PREFIX = ["/", "#", "!"];
let listCmdNya = {};

function upDB(senderNumber, senderName, userMessage, res_after_callback) {
    let db;
    if (fs.existsSync(path)) {
        db = JSON.parse(fs.readFileSync(path, "utf8"));
    } else {
        db = {};
    }
    
}

function event_on(command, description, callback) {
    listCmdNya[command] = { description, callback };
}



Fumi.ev.on("messages.upsert", async (msg) => {
    if (msg.messages.length === 0) return;
    let m = msg.messages[0];
    let jid = m.key.remoteJid;
    let participant = m.key.participant;

     let raw = null;
    if (participant && participant.split("@")[0].length <=    15) {
    raw = participant.split("@")[0];
    }
    else if (jid && jid.split("@")[0].length <= 15) {
    raw = jid.split("@")[0];
    }
    else {
    raw = null;
    console.log("senderNumber:", null);
    }
    senderNumber = raw;
    let senderName = null
    senderName = m.pushName || "Unknown";
    let reply = (text) => Fumi.sendMessage(jid, { text }, { quoted: m });
    if (m.key.fromMe) return;
     
    const messageContent = m.message?.conversation || m.message?.extendedTextMessage?.text || "";



   // debuger, open the cmd when you want do debugging your code

    console.log("MsgCntn:", messageContent);
    console.log("Context Info:", m.message?.extendedTextMessage?.contextInfo || "null" );
    console.log("Replying:", m.message?.extendedTextMessage?.contextInfo?.participant === `${BOT_NUMBER}@s.whatsapp.net`);

    
    const proses_cmd = async (command, args) => {
        if (listCmdNya[command]) {
            const res_after_callback = await listCmdNya[command].callback(args, reply, Fumi, jid, m, senderNumber, senderName);
            
            
            
            upDB(senderNumber, senderName, messageContent, res_after_callback);
        } else {
            const res_after_callback = "Hmm, I don't understand this kind of message. Try again in plain text, or let's find a new topic. or type \*\/help\* For More Information.";
            reply(res_after_callback);
            
            upDB(senderNumber, senderName, messageContent, res_after_callback);
        }
    };

    if (jid.includes("@g.us")) {
        const keTagBotnya = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(`${BOT_NUMBER}@s.whatsapp.net`);
        const quotedMess = m.message?.extendedTextMessage?.contextInfo?.quotedMess;
        const replyingBot = m.message?.extendedTextMessage?.contextInfo?.participant === `${BOT_NUMBER}@s.whatsapp.net`;

        if (keTagBotnya || replyingBot) {
            const botJids = messageContent.indexOf(`@${BOT_NUMBER}`);
            const textAfterMention = botJids >= 0 ? messageContent.substring(botJids + BOT_NUMBER.length + 1).trim() : messageContent;

               let checkPrefix = PREFIX.find((p) => textAfterMention.startsWith(p));
            if (checkPrefix) {
                let [command, ...args] = textAfterMention.substring(checkPrefix.length).split(" ");
                await proses_cmd(command, args.join(" "));
            } else {
                
                Fumi.sendPresenceUpdate("composing", jid);
                await sleep(1000)
                let chatAI;
try {
  chatAI = await ChatAI(textAfterMention || quotedMess?.conversation || "", senderNumber, senderName);
} catch (err) {
  console.error("ChatAI Error:", err.message);
  reply("⚠️ Sorry, an error occurred when getting a response.");
  return;
}
                reply(chatAI);

                upDB(senderNumber, senderName, messageContent, chatAI);
                Fumi.sendPresenceUpdate("available", jid);
            }
        } else {
            console.info("Bot not tagged or replied to, no response.");
        }
    } else {
        let checkPrefix = PREFIX.find((p) => messageContent.startsWith(p));
        if (checkPrefix) {
        let [command, ...args] = messageContent.substring(checkPrefix.length).split(" ");
            await proses_cmd(command, args.join(" "));
        } else {
            
            Fumi.sendPresenceUpdate("composing", jid);
            await sleep(1000)
            let chatAI;
try {
  chatAI = await ChatAI(messageContent, senderNumber, senderName);
} catch (err) {
  console.error("ChatAI Error:", err.message);
  reply("⚠️ Sorry, an error occurred when getting a response.");
  return;
}
            reply(chatAI);

            upDB(senderNumber, senderName, messageContent, chatAI);
            Fumi.sendPresenceUpdate("available", jid);
        }
    }

    console.log("====================================");
    console.log("By : " + senderNumber);
    console.log("Message : " + messageContent);
    console.log("====================================\n\n");
})

// ============= Command ============= \\

event_on("help", "Display", (args, reply) => {
    let menuText = "\> Command Available\n";
    for (let cmd in listCmdNya) {
        menuText += `${PREFIX[0]}${cmd} - ${listCmdNya[cmd].description}\n`;
    }
    reply(menuText);
});

event_on("p", "Server Info", (args, reply) => {
    let serverInfo = getServerInfo();
    reply(serverInfo);
});
/*
event_on("tes", "You Absolutely Know This", (args, reply) => {
    let argument = args.trim();
    if (argument) {
        reply(`Hai! Kamu mengetik: ${argument}`);
    } else {
        reply("Kamu tidak memberikan argumen. Contoh penggunaan: /tes hadir");
    }
});
*/

/*
event_on("news", "Show Latest News Or Search News", async (args, reply) => {
    try {
        const query = args.trim();
        const searchTerm = query || "latest news";
        const res = await ai.berita(searchTerm);

        if (!res || !res.results || res.results.length === 0) {
            return reply(`Tidak ditemukan berita untuk: *${searchTerm}*`);
        }

        let pesan = query
            ? `> Hasil pencarian berita untuk: *${searchTerm}*\n\n`
            : `> Berita terbaru:\n\n`;

        res.results.forEach((item, index) => {
            pesan += `${index + 1}. ${item.title}\n`;
            pesan += `- ${item.snippet}\n\n`;
        });

        reply(pesan);
    } catch (error) {
        console.error("Error mengambil berita:", error);
        reply("Terjadi kesalahan saat mengambil berita.");
    }
});

*/

/*
event_on("imagine", "Make Your Own Character", async (args, reply, Fumi, jid, m) => {
    let argument = args.trim();
    if (argument) {
        Fumi.sendMessage(jid, { react: { text: "⌛", key: m.key }})
        Fumi.sendPresenceUpdate("composing", jid);
        const gen = await ai.bing(argument);
        let img = 0;
        for (const gambar of gen) {
          img += 1;
          await Fumi.sendMessage(jid, { image: { url: gambar.contentUrl } }, { quoted: m })
        }
        Fumi.sendPresenceUpdate("available", jid);
        Fumi.sendMessage(jid, { react: { text: "", key: m.key }})
        
    } else {
        reply("Use /waifu and type whats in your mind");
    }
});

event_on("waifu", "Create Your Imagination", async (args, reply, Fumi, jid, m) => {
    let argument = args.trim();
    if (argument) {
        Fumi.sendMessage(jid, { react: { text: "⌛", key: m.key }})
        Fumi.sendPresenceUpdate("composing", jid);
        const gen = await ai.realistic(argument);
        await Fumi.sendMessage(jid, { image: { url: gen.image } }, { quoted: m })
        Fumi.sendPresenceUpdate("available", jid);
        Fumi.sendMessage(jid, { react: { text: "", key: m.key }})
        
    } else {
        reply("Use /imagine and type whats in your mind");
    }
});
*/
event_on("reset", "Reset session chat", async (args, reply, Fumi, jid, m, senderNumber, senderName) => {
   
    const db = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};

    if (!db[senderNumber] || !db[senderNumber].chatId) {
        reply("Session chat tidak ditemukan untuk nomor ini.");
        return;
    }
    delete db[senderNumber].chatId;
    
    fs.writeFileSync(path, JSON.stringify(db, null, 2));
    reply("Session chat berhasil dihapus.");
});


// =======================
// Command: /eval
// =======================
event_on("eval", "Evaluasi kode JavaScript", async (args, reply, Fumi, jid, m, senderNumber)=> {
    if (senderNumber !== OWNER_NUMBER) return reply("mff kamu bukan owner...")
    const code = args.trim();
    if (!code) return reply("Masukkan kode JavaScript untuk dieksekusi.");
    
    const require = createRequire(__dirname);

    let result;
    try {
        result = /await/i.test(code)
            ? await eval(`(async () => { ${code} })()`)
            : eval(code);
    } catch (err) {
        result = err;
    }

    try {
    const output = typeof result === "object"
        ? util.inspect(result, { depth: 1 })
        : String(result);
    reply(output);
} catch (e) {
    reply(`Gagal mengirim hasil:\n${String(e)}`);
}

});

// =======================
// Command: /exec
// =======================
event_on("exec", "Jalankan perintah shell", async (args, reply, Fumi, jid, m, senderNumber) => {
    if (senderNumber !== OWNER_NUMBER) return reply("mff kamu bukan owner...")
    const command = args.trim();
    if (!command) return reply("Masukkan perintah shell untuk dieksekusi.");

    exec(command, (err, stdout, stderr) => {
        if (err) {
            return reply(`❌ Error:\n${err.message}`);
        }

        if (stderr) {
            return reply(`⚠️ Stderr:\n${stderr}`);
        }

        reply(`✅ Output:\n${stdout || "Perintah selesai tanpa output."}`);
    });
});

// =============------**------============ \\
}
Handler();

function getServerInfo() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `Server Uptime: ${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
}

// fungsi tidur / sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ChatAI(text, senderNumber, senderName, userMessage, res_after_callback) {
    if (!senderNumber) {
        throw new Error("Sender number tidak ditemukan. Pastikan senderNumber dikirim dengan benar.");
    }

    const db = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
    let userChatId = db[senderNumber]?.chatId;

    if (!userChatId) {
        const response = await fetch('https://api.apigratis.tech/cai/send_message', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                external_id: "AhUP7a7tnKbpuP8gnE1a-oIQTr0mgixh0B5UfohCn1k",
                message: text,
                chat_id: "",
                n_ressurect: false,
            }),
        });

        const result = await response.json();

        if (result?.status && result?.result?.chat_id) {
            userChatId = result.result.chat_id;

            db[senderNumber] = {
        ...db[senderNumber],
        chatId: userChatId, 
        name: senderName || "Unknown",
        number: senderNumber,
        lastMessage: userMessage,
        lastResponse: res_after_callback,
    };

    fs.writeFileSync(path, JSON.stringify(db, null, 2));

            console.log(`New User: ${senderNumber}, ChatId      :`, userChatId);
        } else {
            throw new Error("Invalid Res From API.");
        }
    }

    const secondRes = await fetch('https://api.apigratis.tech/cai/send_message', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            external_id: "AhUP7a7tnKbpuP8gnE1a-oIQTr0mgixh0B5UfohCn1k",
            message: text,
            chat_id: userChatId,
            n_ressurect: false,
        }),
    });

    const thirdRes = await secondRes.json();

    if (thirdRes?.status && thirdRes?.result?.replies?.[0]?.text) {
        return thirdRes.result.replies[0].text;
    } else {
        throw new Error("Session made, But Respon was not Oke.");
    }
}
