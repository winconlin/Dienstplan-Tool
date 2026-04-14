import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8000/tests.html")
        await page.wait_for_selector("#summary", timeout=10000)

        results = await page.evaluate("() => document.getElementById('summary').innerText")
        print("Test Results Summary:\n", results)

        await browser.close()

asyncio.run(run())
