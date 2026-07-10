const admin = require("firebase-admin");

// 1. Cấu hình Firebase Admin (Đảm bảo bạn đã cài: npm install firebase-admin)
// Bạn cần tạo serviceAccountKey.json từ Firebase Console -> Project Settings -> Service Accounts
const serviceAccount = require("./serviceAccountKey.json"); 

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_URL
});

const db = admin.database();

// 2. Danh sách ví (Sử dụng biến môi trường từ GitHub Secrets)
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

async function getAxieStats(wallet) {
    console.log(`Đang lấy dữ liệu cho ví: ${wallet.name}...`);
    
    try {
        const response = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": wallet.token,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
                operationName: "GetQuestsSeasonStatsAndUserRank",
                variables: { user: wallet.address, includeUserRank: true, leaderboardType: "WeeklyPremierQuestPoints" },
                query: `query GetQuestsSeasonStatsAndUserRank($leaderboardType: LeaderboardType!, $user: String!) {
                    userLeaderboardRank(user: $user, type: $leaderboardType) { score rank }
                }`
            })
        });

        const result = await response.json();
        return result.data?.userLeaderboardRank || { score: 0, rank: "N/A" };
    } catch (error) {
        console.error(`Lỗi lấy dữ liệu ví ${wallet.name}:`, error);
        return { score: 0, rank: "Lỗi API" };
    }
}

async function run() {
    for (const wallet of wallets) {
        if (!wallet.token) {
            console.log(`Bỏ qua ví ${wallet.name} (Không có token)`);
            continue;
        }

        const stats = await getAxieStats(wallet);
        
        // Ghi vào Firebase
        const updateData = {
            startBp: stats.score,
            rank: stats.rank,
            updatedAt: new Date().toISOString()
        };

        await db.ref('axie_master/daily_tracker/' + wallet.address.toLowerCase()).set(updateData);
        console.log(`Đã cập nhật ví ${wallet.name}: ${stats.score} BP (Hạng: ${stats.rank})`);
    }
    console.log("Hoàn tất cập nhật tất cả ví!");
    process.exit();
}

run();
