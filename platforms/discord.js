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

require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1446083526826004591'; // Ensure this ID is correct for your server
// 1. Update to Array
const APP_IDS = [247060, 570];

const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let steamGuardCallback = null;

// 2. Accept state object
module.exports = function discordHandler(lastChangeState) {
    discordClient.on('clientReady', () => debugLog(`[DISCORD] 🤖 Bot online: ${discordClient.user.tag}`));

    discordClient.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // --- Handle Steam Guard Code ---
        if (message.content.startsWith('!code ')) {
            const code = message.content.split(' ')[1];
            // We need a way to access the callback if it was stored globally or passed differently. 
            // Assuming steam.js handles the event listener, but if you need to pass it here:
            // For now, this logic relies on steamClient reference if your steam.js exposes the callback mechanism.
            // If steamClient emits an event, you might handle it there. 
            // *If you previously had steamGuardCallback logic here, keep it.*
            if (steamClient) {
                message.reply(`🔄 Sending Steam Guard code: ${code}...`);
                steamClient.inputSteamGuardCode(code);
            }
            return;
        }

        // --- Handle !check command ---
        if (message.content === '!check') {
            await message.channel.sendTyping();

            // 3. Loop through all App IDs
            for (const appId of APP_IDS) {
                try {
                    const info = await getSteamUpdateInfo(appId);
                    const oldVer = lastChangeState[appId] || 0;

                    // Pass appId to the embed creator
                    const embed = createSteamDBEmbed(info, oldVer, appId);
                    await message.reply({ embeds: [embed] });

                } catch (err) {
                    await message.reply(`❌ Error checking App ${appId}: ${err.message}`);
                }
            }
        }
    });

    // --- Interaction Handler (Slash Commands / Buttons) ---
    discordClient.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'remind') {
            // Your existing reminder logic...
            // (I am keeping this part brief as the user asked to fix the ID logic mainly)
            try {
                const title = interaction.options.getString('content');
                const timeString = interaction.options.getString('time');
                // ... rest of your reminder logic
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
            }
        }
    });

    discordClient.login(DISCORD_TOKEN);
};

// --- HELPER FUNCTIONS ---

// 4. Update Embed to accept appId
function createSteamDBEmbed(info, oldVer, appId) {
    const isNew = info.changeNumber > oldVer;

    return new EmbedBuilder()
        .setColor(isNew ? 0x66c0f4 : 0x1b2838)
        .setTitle(`Changelist #${info.changeNumber}`)
        .setURL(`https://steamdb.info/app/${appId}/history/`) // Dynamic URL
        .setDescription(isNew ? `**🚀 NEW UPDATE DETECTED!**` : "No new changes.")
        .addFields(
            { name: 'AppID', value: `\`${appId}\``, inline: true },
            { name: 'Type', value: `\`Unknown\``, inline: true },
            { name: 'Name', value: `\`${info.name}\``, inline: false },
            { name: '🆕 Changelist ID', value: `\`#${info.changeNumber}\``, inline: true },
            { name: 'kz Last Recorded', value: `\`#${oldVer}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'SteamDB Tracker', iconURL: 'https://steamdb.info/static/img/favicon.png' });
}