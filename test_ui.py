import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://localhost:8000/Dienstplan.html")
        await page.evaluate('document.getElementById("section-stations").classList.remove("hidden")')
        await page.wait_for_selector("#section-stations")
        await page.screenshot(path="stations.png")
        print("Done")

if __name__ == "__main__":
    asyncio.run(main())
