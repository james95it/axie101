
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
    try {
        console.log(`Đang xử lý ví: ${wallet.name}`);
        
        const response = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": wallet.token,
                // Thêm các headers này để giả lập trình duyệt thật
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Origin": "https://app.roninchain.com",
                "Referer": "https://app.roninchain.com/"
            },
            body: JSON.stringify({
                query: `query { userLeaderboardRank(user: "${wallet.address}", type: WeeklyPremierQuestPoints) { score rank } }`
            })
        });

        const text = await response.text(); // Đọc dạng text trước để debug
        try {
            const json = JSON.parse(text);
            const stats = json.data?.userLeaderboardRank || { score: 0, rank: "N/A" };
            
            // Đẩy lên Firebase
            const fbUrl = `${process.env.FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`;
            await fetch(fbUrl, {
                method: "PUT",
                body: JSON.stringify({
                    startBp: stats.score,
                    rank: stats.rank,
                    updatedAt: new Date().toISOString()
                })
            });
            console.log(`-> Xong! ${wallet.name}: ${stats.score} BP`);
        } catch (parseError) {
            console.error(`Dữ liệu nhận về không phải JSON:`, text);
        }
    } catch (e) {
        console.error(`Lỗi ví ${wallet.name}:`, e.message);
    }
}

async function run() {
    for (const w of wallets) {
        if (w.token) await updateWallet(w);
    }
}

run();
