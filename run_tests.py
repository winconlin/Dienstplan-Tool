import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8000/tests.html")
        await page.wait_for_selector(".summary", timeout=10000)

        # Output text result
        text = await page.locator(".summary").inner_text()
        print(f"Test Results: {text}")

        # Check if tests failed
        failed = await page.locator(".fail").count()
        if failed > 0:
            print("Tests FAILED")
        else:
            print("Tests PASSED")

        await browser.close()

asyncio.run(main())
