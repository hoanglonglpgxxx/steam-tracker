const SteamUser = require('steam-user');
const { debugLog } = require('../utils/helper');
const { taskAuto } = require('../actions/taskAuto');

const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
const APP_ID = 247060;

let steamGuardCallback = null;
const STEAM_ACC = {
    accountName: process.env.ACCOUNT_NAME,
    password: process.env.PASSWORD
};
const steamClient = new SteamUser();

function steamHandler(lastChangeNumber) {
    steamClient.setOption('promptSteamGuardCode', false);
    steamClient.logOn(STEAM_ACC);

    steamClient.on('loggedOn', async () => {
        steamGuardCallback = null;

        debugLog(`[STEAM] Đang request license cho App ${APP_ID}...`);
        steamClient.requestFreeLicense([APP_ID], (err, grantedPackages, grantedAppIds) => {
            setTimeout(() => {
                debugLog('[STEAM] 🚀 Bắt đầu theo dõi Changelist...');
                autoCheckUpdate();
                taskAuto('0 0,12 * * *', autoCheckUpdate);
            }, 5000);
        });

    });

    steamClient.on('steamGuard', (domain, callback) => {
        debugLog('[!!!] STEAM YÊU CẦU MÃ CODE. Vui lòng chat trên Discord: !code <mã_số>');
        steamGuardCallback = callback;
    });

    steamClient.on('error', (err) => console.log(new Date().toLocaleString('vi-VN', {}), '[STEAM ERROR]', err));
}

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

async function autoCheckUpdate(lastChangeNumber) {
    try {
        if (!steamClient.steamID) return;
        const info = await getSteamUpdateInfo();

        if (info.changeNumber > lastChangeNumber) {
            debugLog(`[UPDATE] Detect new Changelist: ${info.changeNumber}`);
            lastChangeNumber = info.changeNumber;
            fs.writeFileSync(STATE_FILE, JSON.stringify({ changeNumber: lastChangeNumber }));
        } else {
            debugLog(`[UPDATE] Nothing new`);
        }
    } catch (e) {
        console.error('[AUTO CHECK ERROR]', e.message);
    }
}

module.exports = {
    steamClient,
    getSteamUpdateInfo,
    steamHandler
};