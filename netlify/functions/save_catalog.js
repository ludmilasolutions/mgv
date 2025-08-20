const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";

    if (!token || !owner || !repo) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing GitHub env vars" }),
      };
    }

    const { catalog } = JSON.parse(event.body);
    const content = Buffer.from(JSON.stringify(catalog, null, 2)).toString("base64");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/catalog.json`;

    // Obtener sha actual
    const currentFile = await fetch(url, {
      headers: { Authorization: `token ${token}` },
    }).then(r => r.json());

    const sha = currentFile.sha;

    // Guardar nuevo contenido
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Update catalog.json from panel",
        content,
        branch,
        sha,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al guardar");

    return { statusCode: 200, body: JSON.stringify({ ok: true, data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
