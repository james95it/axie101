const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const wallet = { 
    name: "Momo", 
    address: "0x7f23fba89336a1b6cf7d58c88e5acd6656d59b5a", 
    token: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFlZjIwY2U3LWJlOTgtNjIwNS1iNWJiLTU1NDFjYjE3ODk4NCIsInNpZCI6MjQwODU3MDM0LCJyb2xlcyI6WyJ1c2VyIl0sInNjcCI6WyJhbGwiXSwiYWN0aXZhdGVkIjp0cnVlLCJhY3QiOnRydWUsInJvbmluQWRkcmVzcyI6IjB4N2YyM2ZiYTg5MzM2YTFiNmNmN2Q1OGM4OGU1YWNkNjY1NmQ1OWI1YSIsImV4cCI6MTc4NDEzMTQyMCwiaWF0IjoxNzgyOTIxODIwLCJpc3MiOiJBeGllSW5maW5pdHkiLCJzdWIiOiIxZWYyMGNlNy1iZTk4LTYyMDUtYjViYi01NTQxY2IxNzg5ODQifQ.QlUtLUstAhq8dhtWkaPkbTlgaG1CcMtEsy5Z_2srbY4" 
};

async function run() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox'],
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
    });
    
    const page = await browser.newPage();
    
    // Bật tính năng bắt request
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        // Nếu trang đang cố gửi request đến API Axie, chúng ta chèn Header vào
        if (request.url().includes('graphql-gateway.axieinfinity.com')) {
            request.continue({
                headers: {
                    ...request.headers(),
                    'Authorization': wallet.token,
                    'x-apollo-operation-name': 'userLeaderboardRank',
                    'apollo-require-preflight': 'true'
                }
            });
        } else {
            request.continue();
        }
    });

    try {
        console.log("Đang truy cập trang Ronin để lấy session...");
        await page.goto('https://app.roninchain.com', { waitUntil: 'networkidle2' });

        // Tự kích hoạt việc gọi API bằng cách chạy đoạn code lấy dữ liệu trong console
        console.log("Đang gọi dữ liệu...");
        const data = await page.evaluate(async (w) => {
            const res = await fetch("https://graphql-gateway.axieinfinity.com/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: `query userLeaderboardRank($user: String!, $type: LeaderboardType!) { userLeaderboardRank(user: $user, type: $type) { score rank } }`,
                    variables: { user: w.address, type: "WeeklyPremierQuestPoints" }
                })
            });
            return await res.json();
        }, wallet);

        console.log("Kết quả:", data.data?.userLeaderboardRank);
    } catch (err) {
        console.error("Lỗi:", err.message);
    } finally {
        await browser.close();
    }
}

run();
