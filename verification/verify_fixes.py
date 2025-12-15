import os
import time
from playwright.sync_api import sync_playwright

def verify_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # 1. Upload File
            print("Uploading file...")
            page.set_input_files("input[type='file']", "test.csv")

            # 2. Wait for Column Mapper
            print("Waiting for Column Mapper...")
            page.wait_for_selector("text=Map Columns", timeout=10000)

            # 3. Perform Manual Mapping
            print("Performing manual column mapping...")

            def drag_column(column_name, target_text):
                source = page.locator(f".w-1\\/3 div[draggable='true']").filter(has_text=column_name).first
                # Use a more generic filter for target
                target = page.locator(f".w-2\\/3 div").filter(has_text=target_text).filter(has_text="Drop column").last

                if source.count() > 0 and target.count() > 0:
                    source.drag_to(target)
                    time.sleep(0.2)
                else:
                    print(f"Skipping drag for {column_name} -> {target_text}")

            drag_column("Date", "Date")
            drag_column("Description", "Description")
            drag_column("Amount", "Amount")
            drag_column("Owner", "Owner")
            drag_column("Account", "Account")

            print("Checking account selection...")
            account_container = page.locator(".w-2\\/3 div").filter(has_text="Account").last
            select = account_container.locator("select")

            if select.count() > 0:
                if select.is_enabled():
                    print("Select is enabled, selecting option...")
                    select.select_option(index=1)
                else:
                    print("Select is disabled (likely because Account is mapped). Skipping selection.")
            else:
                print("Native select not found, trying custom dropdown...")
                page.click("text=Select account")
                try:
                    page.click("text=RBC Checking")
                except:
                    print("Could not select custom account.")

            time.sleep(1)

            print("Clicking Next Step...")
            next_btn = page.locator("button:has-text('Next Step')")
            if not next_btn.is_enabled():
                print("Next button disabled. Retrying mapping...")
                drag_column("Date", "Date")
                time.sleep(1)

            next_btn.click()

            # 5. Verify MonthSelector Fixes
            print("Waiting for Month Selector...")
            page.wait_for_selector("text=Select Range", timeout=10000)

            # Verify UI Fixes
            print("Verifying Import button style...")
            import_btn = page.locator("button:has-text('Import')")
            class_attr = import_btn.get_attribute("class")
            if "justify-center" in class_attr:
                print("PASSED: Import button has justify-center.")
            else:
                print(f"FAILED: Import button missing justify-center. Class: {class_attr}")

            print("Verifying Account column...")
            headers = page.locator("th").all_inner_texts()
            if any("Account" in h for h in headers) or any("ACCOUNT" in h for h in headers):
                print("PASSED: Account column present.")
            else:
                print(f"FAILED: Account column missing. Headers: {headers}")

            print("Verifying row data...")
            cells = page.locator("td").all_inner_texts()
            print(f"Cells found: {cells}")

            if "Me" in cells:
                 print("PASSED: Owner 'Me' found.")
            else:
                 print("FAILED: Owner 'Me' not found.")

            if "MyBank" in cells:
                 print("PASSED: Account 'MyBank' found (Mapped).")
            elif "RBC Checking" in cells:
                 print("WARNING: Account 'RBC Checking' found (Fallback). Mapping failed?")
            else:
                 print("FAILED: Account data missing.")

            # Test Back Button LAST
            print("Testing Back Button...")
            page.click("button:has-text('Back')")
            page.wait_for_selector("text=Map Columns", timeout=5000)
            print("PASSED: Back button navigation worked.")

            print("Verification Complete!")
            page.screenshot(path="verification/success.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_final.png")

if __name__ == "__main__":
    verify_fixes()
