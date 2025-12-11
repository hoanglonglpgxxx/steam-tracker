function debugLog(str) {
    console.log(new Date().toLocaleString('vi-VN', {}), str);
}

module.exports = {
    debugLog
};