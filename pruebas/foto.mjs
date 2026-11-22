// Foto de la app con un diseño aplicado. Uso: node pruebas/foto.mjs <salida.png> <forma> <apoyo> <palN> [modeloId]
import { abrirApp, aplicar, aplicarModeloId, disenoForma } from "./lib.mjs";
const [, , SAL, FORMA, APOYO, PALN, MODELO] = process.argv;
const { page, cerrar } = await abrirApp();
if (MODELO){ await aplicarModeloId(page, MODELO); await page.evaluate((o) => { $("#apoyo").value = o.a; $("#palN").value = o.n; pintarApoyo(); refrescar(); }, { a: APOYO, n: PALN }); }
else await aplicar(page, disenoForma(FORMA, APOYO === "palitos", { campos: { apoyo: APOYO, palN: PALN } }));
await page.evaluate(() => { document.querySelectorAll("details.sec").forEach((d) => { d.open = /Placa y medidas/.test(d.querySelector("summary").textContent); }); encuadrar(); document.getElementById("btnFrontal").click(); });
await page.waitForTimeout(500);
await page.screenshot({ path: SAL });
await cerrar();
