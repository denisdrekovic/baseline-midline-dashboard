import puppeteer from "puppeteer";
import fs from "fs";

const BASE = "http://localhost:3001";

const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 1100 } });
const page = await browser.newPage();

// Login
await page.goto(`${BASE}/`);
await page.waitForSelector("input", { timeout: 8000 });
const inputs = await page.$$("input");
await inputs[0].type("admin");
await inputs[1].type("shubhminth@dmin2024");
await page.click("button[type='submit']");
await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 12000 }).catch(() => {});

// Setup page (empty state)
await page.goto(`${BASE}/lib-calculator/setup`, { waitUntil: "networkidle2", timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "/tmp/lib-screens/01-setup-empty.png", fullPage: true });
console.log("setup-empty.png");

// Calculator page (no lock)
await page.goto(`${BASE}/lib-calculator`, { waitUntil: "networkidle2", timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "/tmp/lib-screens/02-calc-no-lock.png", fullPage: false });
console.log("calc-no-lock.png");

// Inject a lock via localStorage so we can show locked state
await page.goto(`${BASE}/lib-calculator/setup`, { waitUntil: "networkidle2", timeout: 15000 });
await page.evaluate(() => {
  const lock = {
    lockedYear: 2025,
    referenceCpi: 197,
    cohortPercentsAboveLib: { control: 0.0395, t1Survey: 0.1357, t2Survey: 0.65 },
    programPopulations: { t1Full: 23875, t2Full: 3040 },
    computedLibUsd: 5552.93,
    computedLibInr: 463077,
    cohortHeadcountsAboveLib: { control: 0, t1Survey: 3239.84, t2Survey: 1976 },
    programWeightedPercentAboveLib: 0.1938,
    programTotalAboveLib: 5215.84,
    programTotalPopulation: 26915,
    anchorId: "oct-2022-study",
    lockedAt: new Date().toISOString(),
  };
  localStorage.setItem("lib-program:annual-locks", JSON.stringify([lock]));
});
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "/tmp/lib-screens/03-setup-locked.png", fullPage: true });
console.log("setup-locked.png");

// Calculator page with lock
await page.goto(`${BASE}/lib-calculator`, { waitUntil: "networkidle2", timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: "/tmp/lib-screens/04-calc-with-lock.png", fullPage: false });
console.log("calc-with-lock.png");

await browser.close();
console.log("done");
