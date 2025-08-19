export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.PANEL_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  return res.status(200).send("pong");
};