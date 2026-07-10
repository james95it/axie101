const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fetch = require('node-fetch');

// Cấu hình Stealth
puppeteer.use(StealthPlugin());

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

async function updateWallet(wallet) {
    if (!wallet.token) return;

    console.log(`--- Đang xử lý: ${wallet.name} ---`);
    
    // Khởi tạo trình duyệt tàng hình
    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/chromium-browser', // Dòng này là bắt buộc trên Linux/GitHub Actions
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Giúp tránh lỗi tràn bộ nhớ trên GitHub
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Điều hướng tới trang trung gian hoặc trang chính để khởi tạo session
        await page.goto('https://app.roninchain.com/', { waitUntil: 'networkidle2' });

        // Thực hiện request GraphQL từ bên trong trình duyệt (đã được Stealth Plugin bảo vệ)
      const stats = await page.evaluate(async (w) => {
            const response = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": w.token,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    "Origin": "https://app.roninchain.com",
                    "Referer": "https://app.roninchain.com/"
                },
                body: JSON.stringify({
                    operationName: "GetQuestsSeasonStatsAndUserRank",
                    variables: { 
                        user: w.address, 
                        includeUserRank: true, 
                        leaderboardType: "WeeklyPremierQuestPoints" 
                    },
                    query: `query GetQuestsSeasonStatsAndUserRank($leaderboardType: LeaderboardType!, $user: String!) {
                        userLeaderboardRank(user: $user, type: $leaderboardType) { score rank }
                    }`
                })
            });
            return await response.json();
        }, wallet);

        const data = stats.data?.userLeaderboardRank || { score: 0, rank: "N/A" };
        console.log(`Kết quả: ${data.score} BP (Hạng: ${data.rank})`);

        // Đẩy lên Firebase bằng REST API (dùng lại fetch của Node)
        const fbUrl = `${process.env.FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`;
        await fetch(fbUrl, {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startBp: data.score,
                rank: data.rank,
                updatedAt: new Date().toISOString()
            })
        });

        console.log(`-> Đã cập nhật Firebase thành công.`);
    } catch (e) {
        console.error(`Lỗi ví ${wallet.name}:`, e.message);
    } finally {
        await browser.close();
    }
}

async function run() {
    for (const w of wallets) {
        await updateWallet(w);
    }
    process.exit();
}

run();
