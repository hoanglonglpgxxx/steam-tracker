const SteamUser = require('steam-user');
const fs = require('fs');
const { debugLog } = require('../utils/helper');
const { taskAuto } = require('../actions/cronJobs');

require('dotenv').config();

const STATE_FILE = './last_change.json';
const APP_IDS = [247060, 570];

let steamGuardCallback = null;
const STEAM_ACC = {
    accountName: process.env.ACCOUNT_NAME,
    password: process.env.PASSWORD
};
const steamClient = new SteamUser();

function getSteamUpdateInfo(appId) {
    return new Promise((resolve, reject) => {
        steamClient.getProductInfo([appId], [], (err, apps, packages) => {
            if (err) return reject(err);

            const appData = apps[appId];
            if (!appData) return reject(new Error(`No data for AppID: ${appId}`));

            let changeNum = appData.changenumber;
            if (!changeNum && appData.appinfo) {
                changeNum = appData.appinfo.changenumber;
            }

            if (!changeNum) return reject(new Error(`(OK) but no Change Number for ${appId}.`));

            let finalName = "";
            if (appId === 247060) {
                finalName = "SteamDB Unknown App 247060 (Dota 2 Test 2 - Dedicated Server)";
            } else if (appId === 570) {
                finalName = "Dota 2";
            } else {
                finalName = (appData.appinfo && appData.appinfo.common && appData.appinfo.common.name)
                    ? appData.appinfo.common.name
                    : `Unknown App ${appId}`;
            }

            resolve({
                appId: appId,
                changeNumber: changeNum,
                name: finalName
            });
        });
    });
}

async function autoCheckUpdate(lastChangeState) {
    try {
        if (!steamClient.steamID) return;

        let hasUpdates = false;

        for (const appId of APP_IDS) {
            try {
                const info = await getSteamUpdateInfo(appId);
                const currentLastChange = lastChangeState[appId] || 0;

                if (info.changeNumber > currentLastChange) {
                    debugLog(`[UPDATE] Detect new Changelist for ${info.name} (${appId}): ${info.changeNumber}`);

                    lastChangeState[appId] = info.changeNumber;
                    hasUpdates = true;
                } else {
                    debugLog(`[UPDATE] Nothing new for ${appId}`);
                }
            } catch (innerError) {
                console.error(`Error checking App ${appId}:`, innerError.message);
            }
        }

        if (hasUpdates) {
            fs.writeFileSync(STATE_FILE, JSON.stringify(lastChangeState, null, 2));
        }

    } catch (err) {
        console.error('Error in autoCheckUpdate:', err);
    }
}

function steamHandler(lastChangeState) {
    steamClient.setOption('promptSteamGuardCode', false);
    steamClient.logOn(STEAM_ACC);

    steamClient.on('loggedOn', async () => {
        steamGuardCallback = null;

        debugLog(`[STEAM] Đang request license cho Apps ${APP_IDS.join(', ')}...`);

        steamClient.requestFreeLicense(APP_IDS, (err, grantedPackages, grantedAppIds) => {
            setTimeout(() => {
                debugLog('[STEAM] 🚀 Bắt đầu theo dõi Changelist...');

                autoCheckUpdate(lastChangeState);

                taskAuto('0 0,12 * * *', () => autoCheckUpdate(lastChangeState));
            }, 5000);
        });
    });

    steamClient.on('steamGuard', (domain, callback) => {
        debugLog('[!!!] STEAM YÊU CẦU MÃ CODE. Vui lòng chat trên Discord: !code <mã_số>');
    });

    steamClient.on('error', (err) => {
        console.error('Steam login error:', err);
    });
}

module.exports = { steamHandler, getSteamUpdateInfo, steamClient };