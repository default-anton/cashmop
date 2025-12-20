from playwright.sync_api import sync_playwright

def verify_layout(page):
    # Mock the Wails backend
    page.add_init_script("""
        window.go = {
            main: {
                App: {
                    GetUncategorizedTransactions: async () => {
                        return [
                            {
                                id: 1,
                                date: '2023-10-27',
                                description: 'STARBUCKS COFFEE',
                                amount: -5.75,
                                category_id: null,
                                category_name: '',
                                account_id: 1,
                                owner_id: null
                            }
                        ];
                    },
                    SearchCategories: async () => [],
                    SaveCategorizationRule: async () => {},
                    CategorizeTransaction: async () => {}
                }
            }
        };
    """)

    # Navigate to the app
    page.goto("http://localhost:5173")

    # Wait for the transaction card to appear
    page.wait_for_selector("text=STARBUCKS COFFEE")

    # Verify that the placeholder for the rule card is present
    # This confirms the layout change: allocated space between card and input
    placeholder = page.locator("text=Select text in the transaction card to create a rule")
    placeholder.wait_for()

    # Take a screenshot of the layout with the placeholder
    page.screenshot(path="verification/layout_with_placeholder.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_layout(page)
        except Exception as e:
            print(e)
        finally:
            browser.close()
