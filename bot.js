const fetch = require('node-fetch');

// Danh sách ví và Token của bạn
const wallets = [
    { name: "Momo", address: "0x7f23fba89336a1b6cf7d58c88e5acd6656d59b5a", token: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFlZjIwY2U3LWJlOTgtNjIwNS1iNWJiLTU1NDFjYjE3ODk4NCIsInNpZCI6MjQwODU3MDM0LCJyb2xlcyI6WyJ1c2VyIl0sInNjcCI6WyJhbGwiXSwiYWN0aXZhdGVkIjp0cnVlLCJhY3QiOnRydWUsInJvbmluQWRkcmVzcyI6IjB4N2YyM2ZiYTg5MzM2YTFiNmNmN2Q1OGM4OGU1YWNkNjY1NmQ1OWI1YSIsImV4cCI6MTc4NDEzMTQyMCwiaWF0IjoxNzgyOTIxODIwLCJpc3MiOiJBeGllSW5maW5pdHkiLCJzdWIiOiIxZWYyMGNlNy1iZTk4LTYyMDUtYjViYi01NTQxY2IxNzg5ODQifQ.QlUtLUstAhq8dhtWkaPkbTlgaG1CcMtEsy5Z_2srbY4" },
];

const FIREBASE_URL = "https://axie101-default-rtdb.asia-southeast1.firebasedatabase.app/"; // THAY VÀO ĐÂY

async function updateData() {
    for (const wallet of wallets) {
        console.log(`--- Đang xử lý: ${wallet.name} ---`);
        
        try {
            // 1. Lấy dữ liệu từ Axie
            const res = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": wallet.token 
                },
                body: JSON.stringify({
                    query: `query { userLeaderboardRank(user: "${wallet.address}", type: WeeklyPremierQuestPoints) { score rank } }`
                })
            });

            const json = await res.json();
            const stats = json.data?.userLeaderboardRank || { score: 0, rank: "N/A" };
            
            console.log(`Kết quả: ${stats.score} BP (Hạng: ${stats.rank})`);

            // 2. Đẩy lên Firebase bằng REST API
            const fbUrl = `${FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`;
            await fetch(fbUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startBp: stats.score,
                    rank: stats.rank,
                    updatedAt: new Date().toISOString()
                })
            });
            
            console.log("-> Đã đẩy lên Firebase thành công.");
        } catch (err) {
            console.error(`Lỗi ví ${wallet.name}:`, err.message);
        }
    }
}

updateData();
