const cors = require("cors");
app.use(cors());

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PANEL_API_KEY = process.env.PANEL_API_KEY;
const BSC_API_KEY = process.env.BSC_API_KEY;
const TARGET_WALLET = "0x6C7723E803A2F625E9b845b4EBfd14f99be5ce22".toLowerCase();

app.post("/confirm", async (req, res) => {
  const { username, txhash } = req.body;
  if (!username || !txhash) {
    return res.status(400).json({ error: "Username or txHash missing" });
  }

  try {
    const userRes = await axios.get(`https://jinglesmm.com/adminapi/v2/users?username=${username}`, {
      headers: { "X-Api-Key": PANEL_API_KEY }
    });

    if (!userRes.data?.data?.list?.length) {
      return res.status(404).json({ error: "Username not found" });
    }

    const txRes = await axios.get(`https://api.bscscan.com/api?module=account&action=tokentx&txhash=${txhash}&apikey=${BSC_API_KEY}`);
    const tx = txRes.data?.result?.[0];

    if (!tx || tx.tokenSymbol !== "USDT" || tx.to.toLowerCase() !== TARGET_WALLET) {
      return res.status(400).json({ error: "Invalid or unrelated transaction" });
    }

    const decimals = parseInt(tx.tokenDecimal);
    const amount = parseFloat(tx.value) / Math.pow(10, decimals);

    const addRes = await axios.post("https://jinglesmm.com/adminapi/v2/payments/add", {
      username,
      amount: parseFloat(amount.toFixed(2)),
      method: "Manual #6",
      memo: "Auto Payment via API",
      affiliate_commission: true
    }, {
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
