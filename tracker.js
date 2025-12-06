const mongoose = require('mongoose');
const Reminder = require('./models/reminderModel');
const SteamUser = require('steam-user');
const { transporter, mailOptions } = require('./actions/sendMail');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
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

console.log(STEAM_ACC);

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

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });

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

    if (message.content === '!reminder') {
        if (message.channelId !== CHANNEL_ID) return;

        const hourMenu = new StringSelectMenuBuilder()
            .setCustomId('reminder_select_hour')
            .setPlaceholder('Chọn GIỜ...')
            .addOptions(
                Array.from({ length: 23 }, (_, i) =>
                    new StringSelectMenuOptionBuilder().setLabel(`${i} giờ`).setValue(i.toString())
                )
            );

        const minMenu = new StringSelectMenuBuilder()
            .setCustomId('reminder_select_min')
            .setPlaceholder('Chọn PHÚT...')
            .addOptions(
                Array.from({ length: 12 }, (_, i) =>
                    new StringSelectMenuOptionBuilder().setLabel(`${i * 5} phút`).setValue((i * 5).toString())
                )
            );

        const row1 = new ActionRowBuilder().addComponents(hourMenu);
        const row2 = new ActionRowBuilder().addComponents(minMenu);

        await message.reply({
            content: "⏱️ **Cài đặt Nhắc Nhở**\nVui lòng chọn cả **Giờ** và **Phút** để tiếp tục:",
            components: [row1, row2]
        });
    }
});

discordClient.on('interactionCreate', async (interaction) => {

    if (interaction.isStringSelectMenu() &&
        (interaction.customId === 'reminder_select_hour' || interaction.customId === 'reminder_select_min')) {

        const currentVal = parseInt(interaction.values[0]);
        const isHourMenu = interaction.customId === 'reminder_select_hour';
        let otherVal = null;

        interaction.message.components.forEach(row => {
            row.components.forEach(component => {
                if (component.customId !== interaction.customId) {
                    const selectedOption = component.options.find(opt => opt.default);
                    if (selectedOption) otherVal = parseInt(selectedOption.value);
                }
            });
        });

        if (otherVal !== null) {
            const hour = isHourMenu ? currentVal : otherVal;
            const minute = isHourMenu ? otherVal : currentVal;

            const modal = new ModalBuilder()
                .setCustomId(`reminder_submit_${hour}_${minute}`)
                .setTitle(`Hẹn giờ lúc ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);

            const titleInput = new TextInputBuilder()
                .setCustomId('reminder_title')
                .setLabel("Nội dung cần nhắc")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const dateInput = new TextInputBuilder()
                .setCustomId('reminder_date')
                .setLabel("Ngày (DD/MM/YYYY)")
                .setPlaceholder("Ví dụ: 07/12/2025 (Bỏ trống = Hôm nay)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(dateInput);

            modal.addComponents(row1, row2);
            await interaction.showModal(modal);
        }

        else {
            const oldRows = interaction.message.components;
            const newRows = [];
            for (const row of oldRows) {
                const oldComponent = row.components[0];
                const newComponent = StringSelectMenuBuilder.from(oldComponent);
                if (oldComponent.customId === interaction.customId) {
                    newComponent.setOptions(oldComponent.options.map(opt => ({
                        label: opt.label, value: opt.value, default: opt.value === interaction.values[0]
                    })));
                }
                newRows.push(new ActionRowBuilder().addComponents(newComponent));
            }
            await interaction.update({
                content: `⏳ Đã chọn **${isHourMenu ? 'Giờ' : 'Phút'}**. Hãy chọn nốt mục còn lại...`,
                components: newRows
            });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('reminder_submit_')) {

        const parts = interaction.customId.split('_');
        const selectedHour = parseInt(parts[2]);
        const selectedMinute = parseInt(parts[3]);

        const title = interaction.fields.getTextInputValue('reminder_title');
        const dateInputStr = interaction.fields.getTextInputValue('reminder_date');

        let targetDate = new Date();

        if (dateInputStr.trim() !== "") {
            const dateParts = dateInputStr.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const year = parseInt(dateParts[2]);
                targetDate = new Date(year, month, day);
            }
        }

        targetDate.setHours(selectedHour);
        targetDate.setMinutes(selectedMinute);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);

        const timestampMs = targetDate.getTime();

        if (timestampMs < Date.now()) {
            return interaction.reply({
                content: `⚠️ Thời gian bạn chọn (${targetDate.toLocaleString('vi-VN')}) đã qua rồi! Vui lòng chọn lại.`,
                ephemeral: true
            });
        }

        try {
            const newReminder = new Reminder({
                name: title,
                description: title,
                startDates: timestampMs,
                isConfirmed: false
            });

            await newReminder.save();

            const discordTimestamp = Math.floor(timestampMs / 1000);
            await interaction.reply({
                content: `✅ **Đã tạo Nhắc Nhở!**\n- Nội dung: ${title}\n- Thời gian: <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>)`
            });

        } catch (err) {
            console.error(err);
            await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true });
        }
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