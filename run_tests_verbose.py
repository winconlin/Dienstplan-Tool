import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8000/tests.html")
        await page.wait_for_selector(".summary", timeout=10000)
        html = await page.content()
        with open("rendered_tests.html", "w") as f:
            f.write(html)
        await browser.close()

asyncio.run(main())
