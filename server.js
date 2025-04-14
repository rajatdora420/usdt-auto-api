const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PANEL_API_KEY = process.env.PANEL_API_KEY;
const BSC_API_KEY = process.env.BSC_API_KEY;
const TARGET_WALLET = "0x6C7723E803A2F625E9b845b4EBfd14f99be5ce22".toLowerCase();
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

app.post("/confirm", async (req, res) => {
  const { username, txhash } = req.body;
  if (!username || !txhash) return res.status(400).json({ error: "Username or txHash missing" });

  try {
    // ✅ 1. Validate user
    const userRes = await axios.get(`https://jinglesmm.com/adminapi/v2/users?username=${username}`, {
      headers: { "X-Api-Key": PANEL_API_KEY }
    });

    if (!userRes.data?.data?.list?.length) return res.status(404).json({ error: "Username not found" });

    // ✅ 2. Fetch transaction receipt
    const txRes = await axios.get(`https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txhash}&apikey=${BSC_API_KEY}`);
    const receipt = txRes.data?.result;

    if (!receipt || receipt.status !== "0x1") {
      return res.status(400).json({ error: "Transaction failed or not found" });
    }

    // ✅ 3. Find USDT transfer log
    const transferLog = receipt.logs.find(log =>
      log.address.toLowerCase() === USDT_CONTRACT.toLowerCase()
    );

    if (!transferLog) return res.status(400).json({ error: "USDT transfer log not found in this transaction" });

    const toAddress = "0x" + transferLog.topics[2].slice(26); // extract last 40 chars (wallet)
    if (toAddress.toLowerCase() !== TARGET_WALLET) {
      return res.status(400).json({ error: "USDT was not sent to your wallet" });
    }

    const amount = parseInt(transferLog.data, 16) / 1e18; // 18 decimals for USDT

    // ✅ 4. Send to panel
    const payload = {
      payment_id: 181680,
      user: {
        username: username
      },
      amount: {
        value: amount.toFixed(2),
        currency_code: "USD",
        formatted: `$${amount.toFixed(2)}`
      },
      memo: "Auto Payment via USDT Script",
      affiliate_commission: true
    };

    const addRes = await axios.post("https://jinglesmm.com/adminapi/v2/payments/add", payload, {
      headers: { "X-Api-Key": PANEL_API_KEY }
    });

    if (addRes.data.error_code === 0) {
      return res.json({ success: true, message: `${amount.toFixed(2)} USDT added to ${username}` });
    } else {
      return res.status(500).json({ error: addRes.data.error_message });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
