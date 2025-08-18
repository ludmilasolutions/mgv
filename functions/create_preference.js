
export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.items) || !body.items.length) {
      res.status(400).json({ error: "Missing items" }); return;
    }

    const pref = {
      items: body.items.map(it => ({
        title: it.title,
        quantity: it.quantity,
        unit_price: Number(it.unit_price),
        currency_id: it.currency_id || "ARS"
      })),
      back_urls: {
        success: body.success || "https://example.com/success",
        failure: body.failure || "https://example.com/failure",
        pending: body.pending || "https://example.com/pending"
      },
      auto_return: "approved"
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.MP_ACCESS_TOKEN
      },
      body: JSON.stringify(pref)
    });
    const data = await mpRes.json();
    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: data });
    }
    return res.status(200).json({ init_point: data.init_point });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
