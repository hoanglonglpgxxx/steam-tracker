const mongoose = require('mongoose');
const Reminder = require('./models/reminderModel');
const SteamUser = require('steam-user');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');

// ================= CẤU HÌNH (SỬA Ở ĐÂY) =================
require('dotenv').config();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1446083526826004591'; // ID của channel Reminder
const APP_ID = 247060; // Dota 2 Test 2
const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
const STATE_FILE = './last_change.json';

const DB = process.env.DATABASE ? process.env.DATABASE.replace(
    '<PASSWORD>',
    encodeURIComponent(process.env.DATABASE_PASSWORD || '')
) : null;


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

// --- PHẦN STEAM ---
steamClient.setOption('promptSteamGuardCode', false);
steamClient.logOn(STEAM_ACC);

steamClient.on('loggedOn', async () => {
    if (DB) {
        try {
            await mongoose.connect(DB, {
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                retryWrites: true,
            });
            console.log('DB connected');
        } catch (err) {
            console.error('DB connection error:', err);
            process.exit(1);
        }
    } else {
        console.log('No DATABASE configuration found, skipping database connection');
    }

    steamGuardCallback = null;

    console.log(new Date().toLocaleString('vi-VN', {}), `[STEAM] Đang request license cho App ${APP_ID}...`);
    steamClient.requestFreeLicense([APP_ID], (err, grantedPackages, grantedAppIds) => {
        setTimeout(() => {
            console.log(new Date().toLocaleString('vi-VN', {}), '[STEAM] 🚀 Bắt đầu theo dõi Changelist...');
            autoCheckUpdate();
            setInterval(autoCheckUpdate, CHECK_INTERVAL);
        }, 5000);
    });
});

steamClient.on('steamGuard', (domain, callback) => {
    console.log(new Date().toLocaleString('vi-VN', {}), '[!!!] STEAM YÊU CẦU MÃ CODE. Vui lòng chat trên Discord: !code <mã_số>');
    steamGuardCallback = callback;
});

steamClient.on('error', (err) => console.log(new Date().toLocaleString('vi-VN', {}), '[STEAM ERROR]', err));

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

// --- PHẦN DISCORD ---

discordClient.on('clientReady', () => console.log(new Date().toLocaleString('vi-VN', {}), `[DISCORD] 🤖 Bot online: ${discordClient.user.tag}`));

// 1. BẮT SỰ KIỆN TIN NHẮN (!status, !code, !reminder)
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Lệnh nhập code Steam
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

    // Lệnh Status
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

    // Lệnh Reminder (SỬA ĐỔI: Gửi nút thay vì gọi hàm xử lý ngay)
    if (message.content === '!reminder') {
        if (message.channelId !== CHANNEL_ID) return;

        // Tạo nút bấm
        const button = new ButtonBuilder()
            .setCustomId('open_reminder_modal')
            .setLabel('Tạo Nhắc Nhở')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏰');

        const row = new ActionRowBuilder().addComponents(button);

        await message.reply({
            content: "👇 Bấm nút dưới để nhập thông tin Reminder:",
            components: [row]
        });
    }
});

discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'open_reminder_modal') {
        const modal = new ModalBuilder()
            .setCustomId('reminder_modal_submit')
            .setTitle('Cài Đặt Nhắc Nhở');

        const titleInput = new TextInputBuilder()
            .setCustomId('reminder_title')
            .setLabel("Nội dung cần nhắc")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Ví dụ: Check server update...")
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('reminder_description')
            .setLabel("Mô tả")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Ví dụ: Check server update...")
            .setRequired(true);

        const timeInput = new StringSelectMenuBuilder({
            custom_id: 'a cool select menu',
            placeholder: 'Chọn thời gian',
            max_values: 1,
            options: [
                { label: 'option 1', value: '1' },
                { label: 'option 2', value: '2' },
                { label: 'option 3', value: '3' },
            ],
        });

        const row1 = new ActionRowBuilder().addComponents(titleInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);
        const row3 = new ActionRowBuilder().addComponents(timeInput);

        modal.addComponents(row1, row2, row3);

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'reminder_modal_submit') {
        const title = interaction.fields.getTextInputValue('reminder_title');
        const description = interaction.fields.getTextInputValue('reminder_description');
        const time = interaction.fields.getTextInputValue('reminder_time');

        try {
            const newReminder = new Reminder({
                name: 'Test 1',
                description: content,
                startDates: time,
                isConfirmed: false
            });

            await newReminder.save();
            console.log('✅ Document saved successfully to MongoDB!');
        } catch (err) {
            console.error('❌ FAILED to save document:', err.message);
            if (err.code === 11000) {
                console.error('Reason: The name "Test 1" already exists in the database (Unique constraint).');
            }
        }
        await interaction.reply({
            content: `✅ **Đã tạo Reminder thành công!**\n- Nội dung: ${content}\n- Thời gian: ${time} phút nữa.`
        });
    }
});

// --- CÁC HÀM HỖ TRỢ ---

async function autoCheckUpdate() {
    try {
        if (!steamClient.steamID) return;
        const info = await getSteamUpdateInfo();

        if (info.changeNumber > lastChangeNumber) {
            console.log(new Date().toLocaleString('vi-VN', {}), `[UPDATE] Detect new Changelist: ${info.changeNumber}`);
            lastChangeNumber = info.changeNumber;
            fs.writeFileSync(STATE_FILE, JSON.stringify({ changeNumber: lastChangeNumber }));
        } else {
            console.log(new Date().toLocaleString('vi-VN', {}), `[UPDATE] Nothing new`);
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