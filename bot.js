const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const FIREBASE_URL = process.env.FIREBASE_URL.replace(/\/$/, "");
const roninRpcUrl = "https://api.roninchain.com/rpc";
// Các địa chỉ hợp đồng
const SLP_CONTRACT = "0xa8754b9fa15fc18bb59458815510e40a12cd2014";
const AXS_CONTRACT = "0x97a9107c1793bc407d6f527b77e7fff4d812bece"; 
const STAKED_AXS_CONTRACT = "0x05b0bb3c1c320b280501b86706c3551995bc8571"; 
const WETH_CONTRACT = "0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5";

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

function hexToDec(hexStr, decimals) {
    if (!hexStr || hexStr === "0x" || hexStr === "0x0") return 0;
    try { return Number(BigInt(hexStr)) / Math.pow(10, decimals); } catch(e) { return 0; }
}

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    for (const wallet of wallets) {
        if (!wallet.token) continue;
        console.log(`Đang cập nhật ví: ${wallet.name}...`);

        // 1. Fetch BP từ API Axie (qua Puppeteer)
        const bpResult = await page.evaluate(async (address, token) => {
            const res = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": token },
                body: JSON.stringify({
                    operationName: "GetQuestsSeasonStatsAndUserRank",
                    variables: { user: address, includeUserRank: true, leaderboardType: "WeeklyPremierQuestPoints" },
                    query: `query GetQuestsSeasonStatsAndUserRank($leaderboardType: LeaderboardType!, $user: String!) {
                        userLeaderboardRank(user: $user, type: $leaderboardType) { score rank }
                    }`
                })
            });
            const data = await res.json();
            return data.data?.userLeaderboardRank || { score: 0, rank: "N/A" };
        }, wallet.address, wallet.token);

        // 2. Fetch Assets (Số dư từ RPC)
        const cleanAddress = wallet.address.toLowerCase().replace("0x", "");
        const balanceDataParam = "0x70a08231000000000000000000000000" + cleanAddress;
        
        const assets = await Promise.all([
            fetch(roninRpcUrl, {method:'POST', body: JSON.stringify({jsonrpc:"2.0", method:"eth_getBalance", params:[wallet.address, "latest"], id:1})}),
            fetch(roninRpcUrl, {method:'POST', body: JSON.stringify({jsonrpc:"2.0", method:"eth_call", params:[{to: SLP_CONTRACT, data: balanceDataParam}, "latest"], id:2})}),
            fetch(roninRpcUrl, {method:'POST', body: JSON.stringify({jsonrpc:"2.0", method:"eth_call", params:[{to: AXS_CONTRACT, data: balanceDataParam}, "latest"], id:3})}),
            fetch(roninRpcUrl, {method:'POST', body: JSON.stringify({jsonrpc:"2.0", method:"eth_call", params:[{to: WETH_CONTRACT, data: balanceDataParam}, "latest"], id:4})}),
            fetch(roninRpcUrl, {method:'POST', body: JSON.stringify({jsonrpc:"2.0", method:"eth_call", params:[{to: STAKED_AXS_CONTRACT, data: balanceDataParam}, "latest"], id:5})})
        ]).then(responses => Promise.all(responses.map(r => r.json())));

        const assetData = {
            ron: hexToDec(assets[0].result, 18),
            slp: hexToDec(assets[1].result, 0),
            axs: hexToDec(assets[2].result, 18) + hexToDec(assets[4].result, 18),
            weth: hexToDec(assets[3].result, 18),
            updatedAt: new Date().toISOString()
        };

        // 3. Ghi vào Firebase
        await fetch(`${FIREBASE_URL}/axie_master/daily_tracker/${wallet.address.toLowerCase()}.json`, {
            method: 'PUT',
            body: JSON.stringify({ startBp: bpResult.score, rank: bpResult.rank, updatedAt: new Date().toISOString() })
        });
        await fetch(`${FIREBASE_URL}/axie_master/wallet_assets/${wallet.address.toLowerCase()}.json`, {
            method: 'PUT',
            body: JSON.stringify(assetData)
        });

        console.log(`✅ ${wallet.name} đã cập nhật BP và Assets!`);
    }

    await browser.close();
})();
