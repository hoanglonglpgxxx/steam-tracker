const { steamClient, getSteamUpdateInfo } = require('./steam');
const { scheduleOneTask } = require('../actions/cronJobs');
const Reminder = require('../models/reminderModel');
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
const { debugLog } = require('../utils/helper');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1446083526826004591';
const APP_ID = 247060;
const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

module.exports = function discordHandler(lastChangeNumber) {
    discordClient.on('clientReady', () => debugLog(`[DISCORD] 🤖 Bot online: ${discordClient.user.tag}`));

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

        if (message.content === '!r') {
            if (message.channelId !== CHANNEL_ID) return;

            const hourMenu = new StringSelectMenuBuilder()
                .setCustomId('reminder_select_hour')
                .setPlaceholder('Chọn GIỜ...')
                .addOptions(
                    Array.from({ length: 23 }, (_, i) =>
                        new StringSelectMenuOptionBuilder().setLabel(`${i} giờ`).setValue(i.toString())
                    )
                );


            const row1 = new ActionRowBuilder().addComponents(hourMenu);

            await message.reply({
                content: "⏱️ **Cài đặt Nhắc Nhở**\nVui lòng chọn cả **Giờ** và **Phút** để tiếp tục:",
                components: [row1]
            });
        }
    });

    discordClient.on('interactionCreate', async (interaction) => {

        if (interaction.isStringSelectMenu() && interaction.customId === 'reminder_select_hour') {

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

                const modal = new ModalBuilder()
                    .setCustomId(`reminder_submit_${hour}`)
                    .setTitle(`Hẹn giờ lúc ${hour.toString().padStart(2, '0')}:00`);

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
                    content: `⏳ Đã chọn **{'Giờ'}`,
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
                    startDate: timestampMs,
                });

                await newReminder.save();

                scheduleOneTask(newReminder);
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

    discordClient.login(DISCORD_TOKEN);
};

// --- CÁC HÀM HỖ TRỢ ---
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
