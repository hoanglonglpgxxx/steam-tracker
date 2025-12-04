const SteamUser = require('steam-user');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// ================= CẤU HÌNH (SỬA Ở ĐÂY) =================
require('dotenv').config();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = 247060; // Dota 2 Test 2 (Chuẩn theo SteamDB)
const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
const STATE_FILE = './last_change.json';

const STEAM_ACC = {
    accountName: process.env.ACCOUNT_NAME,
    password: process.env.PASSWORD
};

// ========================================================

const steamClient = new SteamUser();
const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let lastChangeNumber = 0;
let steamGuardCallback = null;

// Load trạng thái cũ
if (fs.existsSync(STATE_FILE)) {
    try { lastChangeNumber = JSON.parse(fs.readFileSync(STATE_FILE)).changeNumber || 0; } catch (e) { }
}

// Tự động nhớ máy (Sentry), lần sau không hỏi code nữa
steamClient.setOption('promptSteamGuardCode', false);
steamClient.logOn(STEAM_ACC);

steamClient.on('loggedOn', () => {
    console.log('[STEAM] ✅ Đăng nhập thành công!');
    steamGuardCallback = null;

    console.log(`[STEAM] Đang request license cho App ${APP_ID}...`);
    steamClient.requestFreeLicense([APP_ID], (err, grantedPackages, grantedAppIds) => {
        setTimeout(() => {
            console.log('[STEAM] 🚀 Bắt đầu theo dõi Changelist...');
            autoCheckUpdate();
            setInterval(autoCheckUpdate, CHECK_INTERVAL);
        }, 5000);
    });
});

steamClient.on('steamGuard', (domain, callback) => {
    console.log('[!!!] STEAM YÊU CẦU MÃ CODE. Vui lòng chat trên Discord: !code <mã_số>');
    steamGuardCallback = callback;
});

steamClient.on('error', (err) => console.log('[STEAM ERROR]', err));

function getSteamUpdateInfo() {
    return new Promise((resolve, reject) => {
        steamClient.getProductInfo([APP_ID], [], true, (err, apps) => {
            if (err) return reject(new Error(`Lỗi kết nối Steam: ${err.message}`));

            const appData = apps[APP_ID];

            if (!appData) return reject(new Error("Không tìm thấy dữ liệu App (Đang chờ License hoặc sai ID)"));

            let changeNum = appData.changenumber;
            if (!changeNum && appData.appinfo) {
                changeNum = appData.appinfo.changenumber;
            }

            if (!changeNum) return reject(new Error("Dữ liệu về (OK) nhưng không có Change Number."));

            let finalName = "";

            if (APP_ID === 247060) {
                finalName = "SteamDB Unknown App 247060 (Dota 2 Test 2 - Dedicated Server)";
            } else {
                finalName = (appData.appinfo && appData.appinfo.common && appData.appinfo.common.name)
                    ? appData.appinfo.common.name
                    : `Unknown App ${APP_ID}`;
            }

            resolve({
                changeNumber: changeNum,
                name: finalName
            });
        });
    });
}

discordClient.on('ready', () => console.log(`[DISCORD] 🤖 Bot online: ${discordClient.user.tag}`));

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!code ')) {
        const code = message.content.split(' ')[1];
        if (steamGuardCallback) {
            message.reply(`🔄 Đang gửi mã \`${code}\` lên Steam...`);
            steamGuardCallback(code);
        } else {
            message.reply("Bot đang không yêu cầu mã (Đã login rồi).");
        }
        return;
    }

    if (message.content === '!status') {
        if (!steamClient.steamID) return message.reply("⚠️ Bot chưa login xong Steam. Vui lòng chờ...");

        const msg = await message.reply("🔄 Đang lấy dữ liệu từ Valve...");
        try {
            const info = await getSteamUpdateInfo();
            await msg.edit({ content: null, embeds: [createSteamDBEmbed(info, lastChangeNumber)] });
        } catch (e) {
            await msg.edit(`❌ Lỗi: ${e.message}`);
        }
    }

    if (message.content === '!reminder') {
        const msg = await message.reply("reminder");
        console.log(new Date(), message.channelId, message.channel());
    }
});

async function autoCheckUpdate() {
    try {
        if (!steamClient.steamID) return;

        const info = await getSteamUpdateInfo();

        if (info.changeNumber > lastChangeNumber) {
            console.log(`[UPDATE] Phát hiện Changelist mới: ${info.changeNumber}`);

            lastChangeNumber = info.changeNumber;
            fs.writeFileSync(STATE_FILE, JSON.stringify({ changeNumber: lastChangeNumber }));

            // Tùy chọn: Gửi tin nhắn vào kênh Discord (bỏ comment dòng dưới và điền ID kênh)
            // const channel = discordClient.channels.cache.get('ID_KENH_MUON_BAO');
            // if (channel) channel.send({ embeds: [createSteamDBEmbed(info, lastChangeNumber - 1)] }); 
        }
    } catch (e) {
        console.error('[AUTO CHECK ERROR]', e.message);
    }
}

function createSteamDBEmbed(info, oldVer) {
    const isNew = info.changeNumber > oldVer;

    return new EmbedBuilder()
        .setColor(isNew ? 0x66c0f4 : 0x1b2838)
        .setTitle(`Changelist #${info.changeNumber}`)
        .setURL(`https://steamdb.info/app/${APP_ID}/history/`)
        .setDescription(isNew ? `**🚀 NEW UPDATE DETECTED!**` : "No new changes.")
        .addFields(
            { name: 'AppID', value: `\`${APP_ID}\``, inline: true },
            { name: 'Type', value: `\`Unknown\``, inline: true },
            { name: 'Name', value: `\`${info.name}\``, inline: false },

            { name: '🆕 Changelist ID', value: `\`#${info.changeNumber}\``, inline: true },
            { name: '⏮️ Previous', value: `\`#${oldVer}\``, inline: true }
        )
        .setThumbnail(`https://steamdb.info/static/img/app/${APP_ID}.jpg`)
        .setTimestamp()
        .setFooter({ text: "SteamDB Monitor • Data from Valve PICS", iconURL: "https://steamdb.info/static/logo.png" });
}

discordClient.login(DISCORD_TOKEN);