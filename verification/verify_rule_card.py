from playwright.sync_api import sync_playwright

def verify_rule_card(page):
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
    # Assuming Vite runs on port 5173 by default
    page.goto("http://localhost:5173")

    # Wait for the transaction card to appear
    page.wait_for_selector("text=STARBUCKS COFFEE")

    # Verify the layout initially (no rule card)
    page.screenshot(path="verification/initial_state.png")

    # Trigger rule creation by selecting text
    # We need to select "STARBUCKS" in the description
    # This is tricky with Playwright's mouse API, but we can simulate the selection via JS if needed,
    # or try to drag.

    # Locate the description element
    description = page.locator("text=STARBUCKS COFFEE")
    box = description.bounding_box()

    # Select text by dragging mouse
    page.mouse.move(box['x'], box['y'] + box['height'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + 100, box['y'] + box['height'] / 2)
    page.mouse.up()

    # Trigger the onMouseUp event if needed, but the drag should handle it if the listener is on the card
    # The listener is onMouseUp={handleTextSelection} on the Card component

    # Wait for the rule card to appear
    # The rule card contains "Auto-Rule"
    page.wait_for_selector("text=Auto-Rule")

    # Take a screenshot
    page.screenshot(path="verification/rule_card_visible.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_rule_card(page)
        except Exception as e:
            print(e)
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
