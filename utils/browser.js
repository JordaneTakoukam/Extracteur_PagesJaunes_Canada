const puppeteer = require('puppeteer');

let browserInstance;

async function createBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({ headless: true });
  }
  return browserInstance;
}

module.exports = { createBrowser };
