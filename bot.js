const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const FIREBASE_URL = process.env.FIREBASE_URL;

const wallets = [
    { name: "Momo", address: "0x7f23fba89336a1b6cf7d58c88e5acd6656d59b5a", token: process.env.TOKEN_MOMO },
    { name: "James1", address: "0x39fac7a74365c188c293bd9a064323b50e63cde7", token: process.env.TOKEN_JAMES1 },
    { name: "Crysite", address: "0xe9add5b325d2b7f869b3a3c7b1047600a76192f7", token: process.env.TOKEN_CRYSITE },
    { name: "Cody", address: "0x9b3bc1c03e5a8889e893e54950a7c31c11301b79", token: process.env.TOKEN_CODY },
    { name: "Randy", address: "0x7ca6b3a5d9ec0ba2ba00298aa67b768d9bbf7e01", token: process.env.TOKEN_RANDY },
    { name: "Omi", address: "0x92b626df33ba8bf0d3abd7297e48e5e48e1be030", token: process.env.TOKEN_OMI },
    { name: "Pokemon", address: "0x374ef4e2154a37ee4fa27b30a173f2f68978c740", token: process.env.TOKEN_POKEMON },
    { name: "Loki", address: "0xb62c04bdd810f6b47b5221eaaeebe6fc94038aab", token: process.env.TOKEN_LOKI }
];

(async () => {
    // 1. Khởi động trình duyệt với các lệnh tắt khiên bảo mật CORS
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-web-security', 
            '--disable-features=IsolateOrigins,site-per-process'
        ] 
    });
    const page = await browser.newPage();

    // 2. Truy cập thẳng vào cổng API để lấy vé qua cửa Cloudflare
    console.log("⏳ Đang truy cập thẳng vào Cổng API để lấy vé Cloudflare...");
    await page.goto('https://graphql-gateway.axieinfinity.com/graphql', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 8000)); // Đợi 8 giây để hệ thống kiểm tra xong
    console.log("✅ Đã lấy vé thành công, bắt đầu gọi điểm!");

    // 3. Tính toán ngày giờ lưu Firebase (UTC + 7)
    const d = new Date();
    d.setHours(d.getHours() + 7);
    const yyyy = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dailyCycleId = `${yyyy}-${m}-${day}_10h01`;

    // 4. Bắt đầu vòng lặp lấy điểm cho từng ví
    for (const wallet of wallets) {
        if (!wallet.token) {
            console.log(`❌ Bỏ qua ví ${wallet.name} (Chưa cài Token trong GitHub Secrets).`);
            continue;
        }

        const result = await page.evaluate(async (address, token) => {
            try {
                const res = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": token
                    },
                    body: JSON.stringify({
                        operationName: "GetQuestsSeasonStatsAndUserRank",
                        variables: { user: address, includeUserRank: true, leaderboardType: "WeeklyPremierQuestPoints" },
                        query: `query GetQuestsSeasonStatsAndUserRank($leaderboardType: LeaderboardType!, $user: String!, $includeUserRank: Boolean!) {\n  leaderboard(type: $leaderboardType) {\n    totalParticipants\n    totalScore\n    __typename\n  }\n  userLeaderboardRank(user: $user, type: $leaderboardType) @include(if: $includeUserRank) {\n    rank\n    score\n    details\n    user\n    __typename\n  }\n}\n`
                    })
                });
                
                const text = await res.text();
                if (res.status !== 200) {
                    return { success: false, reason: `Lỗi HTTP ${res.status}`, detail: text.substring(0, 150) };
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch(e) {
                    return { success: false, reason: "Phản hồi không phải JSON (Bị chặn API)", detail: text.substring(0, 150) };
                }

                if (data.errors) {
                    return { success: false, reason: "Lỗi token (Có thể token đã hết hạn)", detail: JSON.stringify(data.errors) };
                }

                const u = data.data && data.data.userLeaderboardRank;
                const bp = u && u.score ? parseInt(u.score) : 0;
                return { success: true, bp: bp };

            } catch (e) {
                return { success: false, reason: "Lỗi kết nối Fetch nội bộ", detail: e.message };
            }
        }, wallet.address, wallet.token);

        // 5. Gửi lên Firebase nếu thành công, hoặc in lỗi nếu thất bại
        if (result.success) {
            const bp = result.bp;
            const dbRef = `${FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`;
            await fetch(dbRef, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dailyCycleId: dailyCycleId, startBp: bp })
            });
            console.log(`✅ Đã chốt mốc ${bp} BP cho ví ${wallet.name}`);
        } else {
            console.log(`⚠️ Lỗi ví ${wallet.name}: ${result.reason}`);
            console.log(`   └─ Chi tiết: ${result.detail}`);
        }
    }
    
    await browser.close();
    console.log("🎉 Hoàn tất tiến trình!");
})();
// Test đánh thức cron job ngày 19/6
