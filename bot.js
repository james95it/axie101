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
    // Mở một trình duyệt ẩn
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    console.log("⏳ Đang truy cập Axie để vượt qua Cloudflare...");
    // Truy cập thẳng vào web game để trình duyệt tự giải mã vòng xoay Cloudflare
    await page.goto('https://app.axieinfinity.com', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 6000)); // Đợi 6 giây cho chắc chắn vượt qua
    console.log("✅ Đã vào trong, bắt đầu lấy điểm!");

    // Tính toán ngày giờ (cộng thêm 7 tiếng vì máy chủ GitHub chạy giờ UTC)
    const d = new Date();
    d.setHours(d.getHours() + 7);
    const yyyy = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dailyCycleId = `${yyyy}-${m}-${day}_10h01`;

    for (const wallet of wallets) {
        if (!wallet.token) {
            console.log(`❌ Bỏ qua ví ${wallet.name} (Chưa cài Token trong GitHub Secrets).`);
            continue;
        }

        // Bơm lệnh lấy điểm vào trực tiếp bên trong trình duyệt đã vượt tường lửa
        const bp = await page.evaluate(async (address, token) => {
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
                const data = await res.json();
                if (data.errors) return null;
                const u = data.data && data.data.userLeaderboardRank;
                return u && u.score ? parseInt(u.score) : 0;
            } catch (e) {
                return null;
            }
        }, wallet.address, wallet.token);

        if (bp !== null) {
            const dbRef = `${FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`;
            await fetch(dbRef, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dailyCycleId: dailyCycleId, startBp: bp })
            });
            console.log(`✅ Đã chốt mốc ${bp} BP cho ví ${wallet.name}`);
        } else {
            console.log(`⚠️ Không lấy được điểm cho ví ${wallet.name}`);
        }
    }
    
    await browser.close();
    console.log("🎉 Hoàn tất tiến trình!");
})();
